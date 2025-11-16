import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";

// Import ABIs
import PrismPerpsVaultABI from "@/contracts/PrismPerpsVault.json";
import PrismPerpsEngineABI from "@/contracts/PrismPerpsEngine.json";
import { CONTRACTS } from "@/config/contracts";

// Contract addresses from deployment
const PERPS_VAULT = CONTRACTS.perpsVault;
const PERPS_ENGINE = CONTRACTS.perpsEngine;

interface Position {
    id: string;
    isLong: boolean;
    size: string;
    collateral: string;
    leverage: number;
    entryPrice: string;
    currentPrice: string;
    unrealizedPnL: string;
    liquidationPrice: string;
    marginRatio: string;
}

interface AccountBalance {
    total: string;
    available: string;
    locked: string;
}

export const usePerps = () => {
    const { connection } = useWallet();
    const [position, setPosition] = useState<Position | null>(null);
    const [allPositions, setAllPositions] = useState<Position[]>([]);
    const [balance, setBalance] = useState<AccountBalance>({ total: "0", available: "0", locked: "0" });
    const [isLoading, setIsLoading] = useState(false);

    const getProvider = useCallback(() => {
        if (!connection) return null;
        
        // For MetaMask, use window.ethereum
        if (connection.wallet.id === 'metamask' && typeof window !== 'undefined' && window.ethereum) {
            return new ethers.BrowserProvider(window.ethereum);
        }
        
        // For HashPack or fallback, use Hedera JSON-RPC
        const network = connection.network || 'testnet';
        const rpcUrl = network === "testnet"
            ? "https://testnet.hashio.io/api"
            : "https://mainnet.hashio.io/api";
        
        return new ethers.JsonRpcProvider(rpcUrl);
    }, [connection]);

    const getSigner = useCallback(async () => {
        if (!connection) return null;
        
        const provider = getProvider();
        if (!provider) return null;
        
        // For MetaMask, get signer from provider
        if (connection.wallet.id === 'metamask' && provider instanceof ethers.BrowserProvider) {
            return await provider.getSigner();
        }
        
        // For HashPack, return null (needs different handling)
        return null;
    }, [connection, getProvider]);

    // Fetch user balance
    const fetchBalance = useCallback(async () => {
        if (!connection) return;

        try {
            const provider = getProvider();
            if (!provider) return;

            const vault = new ethers.Contract(PERPS_VAULT, PrismPerpsVaultABI.abi, provider);
            const userAddress = connection.account.evmAddress || `0x${connection.account.accountId.split('.')[2].padStart(40, '0')}`;

            const [total, available, locked] = await Promise.all([
                vault.getTotalBalance(userAddress),
                vault.getAvailableBalance(userAddress),
                vault.lockedCollateral(userAddress),
            ]);

            setBalance({
                total: ethers.formatEther(total),
                available: ethers.formatEther(available),
                locked: ethers.formatEther(locked),
            });
        } catch (error) {
            console.error("Error fetching balance:", error);
        }
    }, [connection, getProvider]);

    // Fetch all user positions
    const fetchPosition = useCallback(async () => {
        if (!connection) return;

        try {
            const provider = getProvider();
            if (!provider) return;

            const engine = new ethers.Contract(PERPS_ENGINE, PrismPerpsEngineABI.abi, provider);
            const userAddress = connection.account.evmAddress || `0x${connection.account.accountId.split('.')[2].padStart(40, '0')}`;

            // Get user's position IDs
            const positionIds = await engine.getUserPositions(userAddress);
            
            if (positionIds.length > 0) {
                // Fetch all positions
                const positions = await Promise.all(
                    positionIds.map(async (id: string) => {
                        const posInfo = await engine.getPositionInfoById(id);
                        
                        if (posInfo.size > 0n) {
                            return {
                                id,
                                isLong: posInfo.isLong,
                                size: ethers.formatEther(posInfo.size),
                                collateral: ethers.formatEther(posInfo.collateral),
                                leverage: Number(posInfo.leverage),
                                entryPrice: ethers.formatUnits(posInfo.entryPrice, 8),
                                currentPrice: ethers.formatUnits(posInfo.currentPrice, 8),
                                unrealizedPnL: ethers.formatEther(posInfo.unrealizedPnL),
                                liquidationPrice: ethers.formatUnits(posInfo.liquidationPrice, 8),
                                marginRatio: (Number(posInfo.marginRatio) / 100).toFixed(2),
                            };
                        }
                        return null;
                    })
                );

                // Filter out null positions
                const validPositions = positions.filter((p): p is Position => p !== null);
                
                setAllPositions(validPositions);
                // Set the first position as the main position for backward compatibility
                setPosition(validPositions[0] || null);
            } else {
                setAllPositions([]);
                setPosition(null);
            }
        } catch (error) {
            console.error("Error fetching position:", error);
        }
    }, [connection, getProvider]);

    // Deposit collateral
    const depositCollateral = async (amount: string) => {
        if (!connection) throw new Error("Wallet not connected");

        setIsLoading(true);
        try {
            const signer = await getSigner();
            if (!signer) throw new Error("No signer available");

            const vault = new ethers.Contract(PERPS_VAULT, PrismPerpsVaultABI.abi, signer);

            // Convert HBAR to wei (HBAR has 8 decimals, but we use 18 for internal accounting)
            const weiAmount = ethers.parseEther(amount);

            const tx = await vault.depositCollateral({ value: weiAmount });
            await tx.wait();

            await fetchBalance();
            return tx.hash;
        } catch (error: any) {
            console.error("Deposit failed:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // Withdraw collateral
    const withdrawCollateral = async (amount: string) => {
        if (!connection) throw new Error("Wallet not connected");

        setIsLoading(true);
        try {
            const signer = await getSigner();
            if (!signer) throw new Error("No signer available");

            const vault = new ethers.Contract(PERPS_VAULT, PrismPerpsVaultABI.abi, signer);
            const weiAmount = ethers.parseEther(amount);

            const tx = await vault.withdrawCollateral(weiAmount);
            await tx.wait();

            await fetchBalance();
            return tx.hash;
        } catch (error: any) {
            console.error("Withdraw failed:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // Open position
    const openPosition = async (isLong: boolean, collateralAmount: string, leverage: number) => {
        if (!connection) throw new Error("Wallet not connected");

        setIsLoading(true);
        try {
            const signer = await getSigner();
            if (!signer) throw new Error("No signer available");

            const engine = new ethers.Contract(PERPS_ENGINE, PrismPerpsEngineABI.abi, signer);
            const weiAmount = ethers.parseEther(collateralAmount);

            // Pass false for isVaultHedge (this is a regular user position, not a vault hedge)
            const tx = await engine.openPosition(isLong, weiAmount, leverage, false);
            await tx.wait();

            await Promise.all([fetchBalance(), fetchPosition()]);
            return tx.hash;
        } catch (error: any) {
            console.error("Open position failed:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // Close position
    const closePosition = async (positionId?: string) => {
        if (!connection) throw new Error("Wallet not connected");

        setIsLoading(true);
        try {
            const signer = await getSigner();
            if (!signer) throw new Error("No signer available");

            const engine = new ethers.Contract(PERPS_ENGINE, PrismPerpsEngineABI.abi, signer);

            // If no positionId provided, use the current position's ID
            const idToClose = positionId || position?.id;
            if (!idToClose) throw new Error("No position to close");

            const tx = await engine.closePosition(idToClose);
            await tx.wait();

            await Promise.all([fetchBalance(), fetchPosition()]);
            return tx.hash;
        } catch (error: any) {
            console.error("Close position failed:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-refresh
    useEffect(() => {
        if (connection) {
            fetchBalance();
            fetchPosition();

            const interval = setInterval(() => {
                fetchBalance();
                fetchPosition();
            }, 10000); // Refresh every 10 seconds

            return () => clearInterval(interval);
        }
    }, [connection, fetchBalance, fetchPosition]);

    return {
        position,
        allPositions,
        balance,
        isLoading,
        depositCollateral,
        withdrawCollateral,
        openPosition,
        closePosition,
        refreshData: () => Promise.all([fetchBalance(), fetchPosition()]),
    };
};
