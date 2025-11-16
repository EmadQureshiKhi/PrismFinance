import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { CONTRACTS } from "@/config/contracts";
import { db } from "@/services/database";

// Import ABI
import PrismVaultV2ABI from "@/contracts/PrismVaultV2ABI.json";

// Helper function to clean error messages
const cleanErrorMessage = (error: any): string => {
  if (!error) return "Transaction failed";
  
  const message = error.message || error.toString();
  
  if (message.includes("user rejected")) {
    return "Transaction was cancelled";
  } else if (message.includes("insufficient funds")) {
    return "Insufficient HBAR balance";
  } else if (message.includes("Insufficient collateral")) {
    return "Insufficient collateral ratio";
  } else if (message.includes("execution reverted")) {
    return "Transaction failed - check your inputs";
  } else if (message.includes("Slippage exceeded")) {
    return "Price changed too much, try again";
  } else {
    // Extract just the first part before technical details
    const shortMessage = message.split("(")[0].split("{")[0].trim();
    return shortMessage.length > 80 
      ? shortMessage.substring(0, 80) + "..." 
      : shortMessage;
  }
};

interface HedgeInfo {
  isActive: boolean;
  hedgedAmount: string;
  entryPrice: string;
  currentPrice: string;
  pnl: string;
  effectiveCollateral: string;
}

interface UserPosition {
  collateral: string;
  debt: string;
  ratio: string;
  healthy: boolean;
  positions: Record<string, string>;
  hedgeInfo?: HedgeInfo;
}

interface VaultHook {
  // State
  userPosition: UserPosition | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  depositAndMint: (hbarAmount: string, tokenSymbol: string, mintAmount: string) => Promise<void>;
  burnAndWithdraw: (tokenSymbol: string, burnAmount: string, withdrawAmount: string) => Promise<void>;
  refreshPosition: () => Promise<void>;
  getMaxMintable: (tokenSymbol: string) => Promise<string>;
  
  // Yield functions
  getCurrentAPY?: () => Promise<{ base: number; bonus: number }>;
  calculateYield?: (userAddress: string) => Promise<string>;
  claimYield?: () => Promise<any>;
  getYieldReserve?: () => Promise<string>;
  
  // Hedging functions
  getHedgeInfo: () => Promise<HedgeInfo | null>;
}

// Cache key for localStorage
const VAULT_CACHE_KEY = 'prism_vault_position';

export const useVault = (): VaultHook => {
  const { connection } = useWallet();

  // Initialize state from cache if available
  const [userPosition, setUserPosition] = useState<UserPosition | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(VAULT_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is for the current account
        const currentAccount = connection?.account?.accountId;
        if (parsed.accountId === currentAccount) {
          return parsed.position;
        }
      }
    } catch (err) {
      console.error('Error loading cached position:', err);
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Get provider and signer
  const getProvider = useCallback(() => {
    if (!connection) return null;

    // For MetaMask, use window.ethereum
    if (connection.wallet.id === 'metamask' && typeof window !== 'undefined' && window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }

    // For HashPack or fallback, use Hedera JSON-RPC
    const network = connection.network || CONTRACTS.network;
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

    // For HashPack, we'll need to use their signing method
    // For now, return null and handle signing differently
    return null;
  }, [connection, getProvider]);

  // Get user address (EVM format)
  const getUserAddress = useCallback(() => {
    if (!connection) return null;

    // Use evmAddress if available
    if (connection.account.evmAddress) {
      return connection.account.evmAddress;
    }

    // Fallback: convert account ID to EVM address
    // Hedera account 0.0.X maps to 0x00000000000000000000000000000000000X
    const accountNum = connection.account.accountId.split('.')[2];
    return '0x' + accountNum.padStart(40, '0');
  }, [connection]);

  // Get vault contract instance
  const getVaultContract = useCallback(async (needsSigner = false) => {
    const provider = getProvider();
    if (!provider) throw new Error("No provider available");

    if (needsSigner) {
      const signer = await getSigner();
      if (!signer) throw new Error("No signer available");
      return new ethers.Contract(CONTRACTS.vault, PrismVaultV2ABI, signer);
    }

    return new ethers.Contract(CONTRACTS.vault, PrismVaultV2ABI, provider);
  }, [getProvider, getSigner]);

  // Execute HashPack transaction using Hedera SDK


  // Fetch user position
  const refreshPosition = useCallback(async () => {
    if (!connection) {
      setUserPosition(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const vault = await getVaultContract();
      const userAddress = getUserAddress();

      if (!userAddress) {
        throw new Error("Could not determine user address");
      }

      // Get user position from contract
      const position = await vault.getUserPosition(userAddress);

      // Get individual token positions
      const tokenSymbols = ["pUSD", "pEUR", "pGBP", "pJPY", "pHKD", "pAED", "pBTC", "pETH", "pTSLA", "pAAPL", "pGOLD", "pSPY", "pTBILL"];
      const positions: Record<string, string> = {};

      for (const symbol of tokenSymbols) {
        const balance = await vault.positions(userAddress, symbol);
        positions[symbol] = ethers.formatEther(balance);
      }

      const newPosition = {
        collateral: ethers.formatEther(position.collateral || 0),
        debt: ethers.formatEther(position.debt || 0),
        ratio: position.ratio?.toString() || "0",
        healthy: position.healthy || false,
        positions,
      };

      setUserPosition(newPosition);

      // Cache the position in localStorage
      try {
        localStorage.setItem(VAULT_CACHE_KEY, JSON.stringify({
          accountId: connection.account.accountId,
          position: newPosition,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.error('Error caching position:', err);
      }
    } catch (err: any) {
      console.error("Error fetching position:", err);
      setError(err.message || "Failed to fetch position");
    } finally {
      setIsLoading(false);
    }
  }, [connection, getVaultContract, getUserAddress]);

  // Deposit HBAR and mint tokens
  const depositAndMint = useCallback(async (
    hbarAmount: string,
    tokenSymbol: string,
    mintAmount: string
  ) => {
    if (!connection) throw new Error("Wallet not connected");

    try {
      setIsLoading(true);
      setError(null);

      // Convert amounts to wei
      const hbarWei = ethers.parseEther(hbarAmount);
      const mintWei = ethers.parseEther(mintAmount);

      let receipt;

      if (connection.wallet.id === 'metamask') {
        // MetaMask: Use combined function (1 transaction)
        const vault = await getVaultContract(true);

        console.log("Depositing and minting in one transaction...");
        console.log("  HBAR:", hbarAmount);
        console.log("  Token:", tokenSymbol, mintAmount);

        const tx = await vault.depositAndMint(tokenSymbol, mintWei, { value: hbarWei });
        console.log("Transaction sent:", tx.hash);

        receipt = await tx.wait();
        console.log("✅ Deposit and mint completed:", receipt);
      } else {
        // HashPack: Not yet supported
        throw new Error("HashPack not supported yet, coming soon! Please use MetaMask for now.");
      }

      // Refresh position first to get updated ratio
      console.log("Refreshing position...");
      await refreshPosition();
      
      // Log transaction to database with updated ratio
      if (receipt?.hash && connection.account.accountId) {
        // Calculate the new ratio after transaction
        const newCollateral = parseFloat(userPosition?.collateral || "0") + parseFloat(hbarAmount);
        const newDebt = parseFloat(userPosition?.debt || "0") + parseFloat(mintAmount) * 5; // Approximate debt value
        const newRatio = newDebt > 0 ? ((newCollateral / newDebt) * 100).toFixed(0) : undefined;
        
        await db.logVaultTransaction({
          walletAddress: connection.account.accountId,
          type: 'deposit_mint',
          hbarAmount,
          tokenSymbol,
          tokenAmount: mintAmount,
          collateralRatio: newRatio,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber?.toString(),
        });
      }
      
      console.log("✅ Deposit and mint completed successfully!");

      return receipt; // Return receipt with tx hash
    } catch (err: any) {
      console.error("Error in depositAndMint:", err);
      console.error("Error details:", {
        message: err.message,
        code: err.code,
        reason: err.reason,
        data: err.data
      });
      setError(err.message || "Transaction failed");
      throw err;
    } finally {
      setIsLoading(false);
      console.log("Loading state cleared");
    }
  }, [connection, getVaultContract, refreshPosition]);

  // Burn tokens and withdraw HBAR
  const burnAndWithdraw = useCallback(async (
    tokenSymbol: string,
    burnAmount: string,
    withdrawAmount: string
  ) => {
    if (!connection) throw new Error("Wallet not connected");

    try {
      setIsLoading(true);
      setError(null);

      // Convert amounts to wei
      const burnWei = ethers.parseEther(burnAmount);
      const withdrawWei = ethers.parseEther(withdrawAmount);

      let receipt;

      if (connection.wallet.id === 'metamask') {
        // MetaMask: Use combined function (1 transaction)
        const vault = await getVaultContract(true);

        console.log("Burning and withdrawing in one transaction...");
        console.log("  Burn:", tokenSymbol, burnAmount);
        console.log("  Withdraw:", withdrawAmount, "HBAR");

        const tx = await vault.burnAndWithdraw(tokenSymbol, burnWei, withdrawWei);
        console.log("Transaction sent:", tx.hash);

        receipt = await tx.wait();
        console.log("✅ Burn and withdraw completed:", receipt);
      } else {
        // HashPack: Not yet supported
        throw new Error("HashPack not supported yet, coming soon! Please use MetaMask for now.");
      }

      // Refresh position first to get updated ratio
      console.log("Refreshing position...");
      await refreshPosition();
      
      // Log transaction to database with updated ratio
      if (receipt?.hash && connection.account.accountId) {
        // Calculate the new ratio after transaction
        const newCollateral = Math.max(0, parseFloat(userPosition?.collateral || "0") - parseFloat(withdrawAmount));
        const newDebt = Math.max(0, parseFloat(userPosition?.debt || "0") - parseFloat(burnAmount) * 5); // Approximate debt value
        const newRatio = newDebt > 0 ? ((newCollateral / newDebt) * 100).toFixed(0) : undefined;
        
        await db.logVaultTransaction({
          walletAddress: connection.account.accountId,
          type: 'burn_withdraw',
          hbarAmount: withdrawAmount,
          tokenSymbol,
          tokenAmount: burnAmount,
          collateralRatio: newRatio,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber?.toString(),
        });
      }
      
      console.log("✅ Burn and withdraw completed successfully!");

      return receipt; // Return receipt with tx hash
    } catch (err: any) {
      console.error("Error in burnAndWithdraw:", err);
      console.error("Error details:", {
        message: err.message,
        code: err.code,
        reason: err.reason,
        data: err.data
      });
      setError(err.message || "Transaction failed");
      throw err;
    } finally {
      setIsLoading(false);
      console.log("Loading state cleared");
    }
  }, [connection, getVaultContract, refreshPosition]);

  // Get max mintable amount for a token
  const getMaxMintable = useCallback(async (tokenSymbol: string): Promise<string> => {
    if (!connection) return "0";

    try {
      const vault = await getVaultContract(false);
      const userAddress = getUserAddress();

      const maxWei = await vault.getMaxMintable(userAddress, tokenSymbol);
      return ethers.formatEther(maxWei);
    } catch (err) {
      console.error("Error getting max mintable:", err);
      return "0";
    }
  }, [connection, getVaultContract, getUserAddress]);

  // Auto-refresh position when wallet connects
  useEffect(() => {
    if (connection) {
      // Only fetch if we don't have cached data or if it's stale (older than 30 seconds)
      const shouldFetch = !userPosition || (() => {
        try {
          const cached = localStorage.getItem(VAULT_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            const age = Date.now() - (parsed.timestamp || 0);
            return age > 30000; // Refresh if older than 30 seconds
          }
        } catch (err) {
          return true;
        }
        return true;
      })();

      if (shouldFetch) {
        refreshPosition();
      }
    }
  }, [connection, refreshPosition, userPosition]);

  // ============ Yield System Functions ============
  
  /**
   * Get current APY rates
   * @returns Object with base and bonus APY percentages
   */
  const getCurrentAPY = useCallback(async (): Promise<{ base: number; bonus: number }> => {
    try {
      const vault = await getVaultContract();
      if (!vault) return { base: 0, bonus: 0 };

      const [base, bonus] = await vault.getCurrentAPY();
      return {
        base: parseFloat(ethers.formatUnits(base, 2)), // Convert basis points to %
        bonus: parseFloat(ethers.formatUnits(bonus, 2))
      };
    } catch (err) {
      console.error("Error getting APY:", err);
      return { base: 0, bonus: 0 };
    }
  }, [getVaultContract]);

  /**
   * Calculate accrued yield for user
   * @param userAddress User's address
   * @returns Accrued yield in HBAR
   */
  const calculateYield = useCallback(async (userAddress: string): Promise<string> => {
    try {
      const vault = await getVaultContract();
      if (!vault) return "0";

      const yieldWei = await vault.calculateYield(userAddress);
      return ethers.formatEther(yieldWei); // Convert wei to HBAR
    } catch (err) {
      console.error("Error calculating yield:", err);
      return "0";
    }
  }, [getVaultContract]);

  /**
   * Claim accrued yield
   * @returns Transaction receipt
   */
  const claimYield = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const vault = await getVaultContract(true); // Need signer for transactions
      if (!vault) throw new Error("Vault contract not initialized");

      const userAddress = getUserAddress();
      if (!userAddress) throw new Error("User address not available");

      // Get yield amount before claiming
      const yieldAmount = await vault.calculateYield(userAddress);
      const yieldInHbar = ethers.formatEther(yieldAmount);

      console.log("Claiming yield...");
      const tx = await vault.claimYield();
      console.log("Transaction sent:", tx.hash);

      const receipt = await tx.wait();
      console.log("Yield claimed successfully!");

      // Save to database
      if (connection?.account?.accountId) {
        try {
          await db.logVaultTransaction({
            walletAddress: connection.account.accountId,
            type: "burn_withdraw", // Use existing type for now (claim is like a withdraw)
            hbarAmount: yieldInHbar,
            tokenSymbol: "HBAR",
            tokenAmount: "0", // No token burned
            txHash: tx.hash,
          });
          console.log("✅ Yield claim saved to database");
        } catch (dbErr) {
          console.error("Error saving to database:", dbErr);
          // Don't throw - transaction was successful
        }
      }

      // Refresh position after claiming
      await refreshPosition();

      return receipt;
    } catch (err: any) {
      console.error("Error claiming yield:", err);
      const errorMessage = cleanErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, refreshPosition, getUserAddress, connection]);

  /**
   * Get yield reserve balance
   * @returns Yield reserve in HBAR
   */
  const getYieldReserve = useCallback(async (): Promise<string> => {
    try {
      const vault = await getVaultContract();
      if (!vault) return "0";

      const reserveWei = await vault.yieldReserve();
      return ethers.formatEther(reserveWei);
    } catch (err) {
      console.error("Error getting yield reserve:", err);
      return "0";
    }
  }, [getVaultContract]);

  // ============ Delta-Neutral Hedging Functions ============

  /**
   * Get user's hedge position info
   * @returns Hedge information including PnL and effective collateral
   */
  const getHedgeInfo = useCallback(async (): Promise<HedgeInfo | null> => {
    try {
      const vault = await getVaultContract();
      if (!vault) {
        console.log("No vault contract");
        return null;
      }

      const userAddress = getUserAddress();
      if (!userAddress) {
        console.log("No user address");
        return null;
      }

      console.log("Fetching hedge info for:", userAddress);
      const hedgeInfo = await vault.getUserHedgeInfo(userAddress);
      console.log("Raw hedge info:", hedgeInfo);
      
      if (!hedgeInfo.isActive) {
        return {
          isActive: false,
          hedgedAmount: "0",
          entryPrice: "0",
          currentPrice: "0",
          pnl: "0",
          effectiveCollateral: "0"
        };
      }

      const result = {
        isActive: hedgeInfo.isActive,
        hedgedAmount: ethers.formatEther(hedgeInfo.hedgedAmount),
        entryPrice: ethers.formatUnits(hedgeInfo.entryPrice, 8),
        currentPrice: ethers.formatUnits(hedgeInfo.currentPrice, 8),
        pnl: ethers.formatEther(hedgeInfo.pnl),
        effectiveCollateral: ethers.formatEther(hedgeInfo.effectiveCollateral)
      };
      
      console.log("Formatted hedge info:", result);
      return result;
    } catch (err) {
      console.error("Error getting hedge info:", err);
      return null;
    }
  }, [getVaultContract, getUserAddress]);

  return {
    userPosition,
    isLoading,
    getMaxMintable,
    error,
    depositAndMint,
    burnAndWithdraw,
    refreshPosition,
    // Yield functions
    getCurrentAPY,
    calculateYield,
    claimYield,
    getYieldReserve,
    getHedgeInfo,
  };
};
