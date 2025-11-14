import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { CONTRACTS, ASSETS } from "@/config/contracts";

// Import ABI
import PrismAssetExchangeABI from "@/contracts/PrismAssetExchangeABI.json";

interface AssetBalance {
  symbol: string;
  balance: string;
  valueUSD: string;
  valueHBAR: string;
}

interface AssetExchangeHook {
  // State
  balances: AssetBalance[];
  isLoading: boolean;
  error: string | null;

  // Actions
  buyAsset: (tokenSymbol: string, hbarAmount: string, minTokensOut: string) => Promise<any>;
  sellAsset: (tokenSymbol: string, tokenAmount: string, minHbarOut: string) => Promise<any>;
  getQuoteBuy: (tokenSymbol: string, hbarAmount: string) => Promise<{ tokensOut: string; fee: string }>;
  getQuoteSell: (tokenSymbol: string, tokenAmount: string) => Promise<{ hbarOut: string; fee: string }>;
  refreshBalances: () => Promise<void>;
}

// Helper function to clean error messages
const cleanErrorMessage = (error: any): string => {
  if (!error) return "Transaction failed";
  
  const message = error.message || error.toString();
  
  if (message.includes("user rejected")) {
    return "Transaction was cancelled";
  } else if (message.includes("insufficient funds")) {
    return "Insufficient HBAR balance";
  } else if (message.includes("execution reverted")) {
    return "Transaction failed - asset may not be available";
  } else if (message.includes("Insufficient balance")) {
    return "Insufficient token balance";
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

export const useAssetExchange = (): AssetExchangeHook => {
  const { connection } = useWallet();

  const [balances, setBalances] = useState<AssetBalance[]>(() => {
    // Load cached balances immediately for instant display
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('prism_asset_balances');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error("Failed to parse cached balances:", e);
        }
      }
    }
    return [];
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
    if (connection.wallet.id === 'metamask' && typeof window !== 'undefined' && (window as any).ethereum) {
      return new ethers.BrowserProvider((window as any).ethereum);
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
    const accountNum = connection.account.accountId.split('.')[2];
    return '0x' + accountNum.padStart(40, '0');
  }, [connection]);

  // Get asset exchange contract instance
  const getAssetExchangeContract = useCallback(async (needsSigner = false) => {
    const provider = getProvider();
    if (!provider) throw new Error("No provider available");

    if (needsSigner) {
      const signer = await getSigner();
      if (!signer) throw new Error("No signer available");
      return new ethers.Contract(CONTRACTS.assetExchange, PrismAssetExchangeABI, signer);
    }

    return new ethers.Contract(CONTRACTS.assetExchange, PrismAssetExchangeABI, provider);
  }, [getProvider, getSigner]);

  // Refresh asset balances
  const refreshBalances = useCallback(async (showLoading = true) => {
    if (!connection) {
      console.log("No connection, skipping balance refresh");
      setBalances([]);
      // Clear cache when disconnected
      if (typeof window !== 'undefined') {
        localStorage.removeItem('prism_asset_balances');
      }
      return;
    }

    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      const assetExchange = await getAssetExchangeContract();
      const userAddress = getUserAddress();

      if (!userAddress) {
        throw new Error("Could not determine user address");
      }

      // Get balances for all assets
      const newBalances: AssetBalance[] = [];

      for (const symbol of ASSETS) {
        try {
          const balance = await assetExchange.balances(userAddress, symbol);
          // Contract stores balances in wei (18 decimals)
          const balanceFormatted = ethers.formatEther(balance);

          if (parseFloat(balanceFormatted) > 0) {
            // Get current value in HBAR
            try {
              const [hbarOut] = await assetExchange.getQuoteSell(symbol, balance);
              // HBAR amounts are also in wei (18 decimals)
              const valueHBAR = ethers.formatEther(hbarOut);

              newBalances.push({
                symbol,
                balance: balanceFormatted,
                valueUSD: "0",
                valueHBAR,
              });
            } catch (err) {
              newBalances.push({
                symbol,
                balance: balanceFormatted,
                valueUSD: "0",
                valueHBAR: "0",
              });
            }
          }
        } catch (err) {
          console.error(`Error fetching balance for ${symbol}:`, err);
        }
      }

      setBalances(newBalances);

      // Cache balances in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('prism_asset_balances', JSON.stringify(newBalances));
      }

    } catch (err: any) {
      console.error("Error fetching balances:", err);
      setError(err.message || "Failed to fetch balances");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [connection, getAssetExchangeContract, getUserAddress]);

  // Buy asset (HBAR → pTSLA)
  const buyAsset = useCallback(async (
    tokenSymbol: string,
    hbarAmount: string,
    minTokensOut: string
  ) => {
    if (!connection) throw new Error("Wallet not connected");

    try {
      setIsLoading(true);
      setError(null);

      // Contract expects wei (18 decimals)
      const hbarWei = ethers.parseEther(hbarAmount);

      // Handle minTokensOut - it might have too many decimals for parseEther
      let minTokensWei: bigint;
      try {
        minTokensWei = ethers.parseEther(minTokensOut);
      } catch (e) {
        // If parsing fails due to too many decimals, truncate to 18 decimals
        const minTokensNum = parseFloat(minTokensOut);
        minTokensWei = BigInt(Math.floor(minTokensNum * 1e18));
      }

      if (connection.wallet.id === 'metamask') {
        const assetExchange = await getAssetExchangeContract(true);

        console.log("Buying asset:", tokenSymbol, "with", hbarAmount, "HBAR");

        const tx = await assetExchange.buyAsset(tokenSymbol, minTokensWei, {
          value: hbarWei,
          gasLimit: 500000
        });
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("✅ Asset purchased:", receipt);

        // Optimistically update balance immediately
        const expectedTokens = await getQuoteBuy(tokenSymbol, hbarAmount);
        const currentBalance = balances.find(b => b.symbol === tokenSymbol);
        const newBalance = currentBalance
          ? (parseFloat(currentBalance.balance) + parseFloat(expectedTokens.tokensOut)).toString()
          : expectedTokens.tokensOut;

        // Update balances optimistically
        setBalances(prev => {
          const existing = prev.find(b => b.symbol === tokenSymbol);
          if (existing) {
            return prev.map(b =>
              b.symbol === tokenSymbol
                ? { ...b, balance: newBalance }
                : b
            );
          } else {
            return [...prev, {
              symbol: tokenSymbol,
              balance: newBalance,
              valueUSD: "0",
              valueHBAR: "0"
            }];
          }
        });

        // Cache the updated balances
        if (typeof window !== 'undefined') {
          const updatedBalances = balances.map(b =>
            b.symbol === tokenSymbol ? { ...b, balance: newBalance } : b
          );
          if (!balances.find(b => b.symbol === tokenSymbol)) {
            updatedBalances.push({
              symbol: tokenSymbol,
              balance: newBalance,
              valueUSD: "0",
              valueHBAR: "0"
            });
          }
          localStorage.setItem('prism_asset_balances', JSON.stringify(updatedBalances));
        }

        // Refresh actual balances in background without showing loading
        setTimeout(() => refreshBalances(false), 2000);
        return receipt;
      } else {
        throw new Error("HashPack not supported yet. Please use MetaMask.");
      }
    } catch (err: any) {
      console.error("Error in buyAsset:", err);
      setError(cleanErrorMessage(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [connection, getAssetExchangeContract, refreshBalances]);

  // Sell asset (pTSLA → HBAR)
  const sellAsset = useCallback(async (
    tokenSymbol: string,
    tokenAmount: string,
    minHbarOut: string
  ) => {
    if (!connection) throw new Error("Wallet not connected");

    try {
      setIsLoading(true);
      setError(null);

      if (connection.wallet.id === 'metamask') {
        const assetExchange = await getAssetExchangeContract(true);
        const userAddress = getUserAddress();

        if (!userAddress) {
          throw new Error("Could not determine user address");
        }

        // Contract expects wei (18 decimals)
        const tokenWei = ethers.parseEther(tokenAmount);

        // minHbarOut is also in wei (18 decimals)
        let minHbarWei: bigint;
        try {
          minHbarWei = ethers.parseEther(minHbarOut);
        } catch (e) {
          const minHbarNum = parseFloat(minHbarOut);
          minHbarWei = isNaN(minHbarNum) || minHbarNum <= 0 ? BigInt(0) : BigInt(Math.floor(minHbarNum * 1e18));
        }

        console.log("Selling", tokenAmount, tokenSymbol);

        const tx = await assetExchange.sellAsset(tokenSymbol, tokenWei, minHbarWei, {
          gasLimit: 500000
        });
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("✅ Asset sold:", receipt);

        // Optimistically update balance immediately
        const currentBalance = balances.find(b => b.symbol === tokenSymbol);
        const newBalance = currentBalance
          ? (parseFloat(currentBalance.balance) - parseFloat(tokenAmount)).toString()
          : "0";

        // Update balances optimistically
        setBalances(prev => {
          if (parseFloat(newBalance) <= 0) {
            // Remove from list if balance is 0
            return prev.filter(b => b.symbol !== tokenSymbol);
          }
          return prev.map(b =>
            b.symbol === tokenSymbol
              ? { ...b, balance: newBalance }
              : b
          );
        });

        // Cache the updated balances
        if (typeof window !== 'undefined') {
          const updatedBalances = balances
            .map(b => b.symbol === tokenSymbol ? { ...b, balance: newBalance } : b)
            .filter(b => parseFloat(b.balance) > 0);
          localStorage.setItem('prism_asset_balances', JSON.stringify(updatedBalances));
        }

        // Refresh actual balances in background without showing loading
        setTimeout(() => refreshBalances(false), 2000);
        return receipt;
      } else {
        throw new Error("HashPack not supported yet. Please use MetaMask.");
      }
    } catch (err: any) {
      console.error("Error in sellAsset:", err);
      setError(cleanErrorMessage(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [connection, getAssetExchangeContract, refreshBalances]);

  // Get quote for buying asset
  const getQuoteBuy = useCallback(async (
    tokenSymbol: string,
    hbarAmount: string
  ): Promise<{ tokensOut: string; fee: string }> => {
    if (!connection) return { tokensOut: "0", fee: "0" };

    try {
      const assetExchange = await getAssetExchangeContract(false);
      // Contract expects wei (18 decimals)
      const hbarWei = ethers.parseEther(hbarAmount);

      const [tokensOut, fee] = await assetExchange.getQuoteBuy(tokenSymbol, hbarWei);

      // Contract returns wei (18 decimals)
      return {
        tokensOut: ethers.formatEther(tokensOut),
        fee: ethers.formatEther(fee)
      };
    } catch (err) {
      console.error("Error getting buy quote:", err);
      return { tokensOut: "0", fee: "0" };
    }
  }, [connection, getAssetExchangeContract]);

  // Get quote for selling asset
  const getQuoteSell = useCallback(async (
    tokenSymbol: string,
    tokenAmount: string
  ): Promise<{ hbarOut: string; fee: string }> => {
    if (!connection) return { hbarOut: "0", fee: "0" };

    try {
      const assetExchange = await getAssetExchangeContract(false);
      // Contract expects wei (18 decimals)
      const tokenWei = ethers.parseEther(tokenAmount);

      const [hbarOut, fee] = await assetExchange.getQuoteSell(tokenSymbol, tokenWei);

      // Contract returns wei (18 decimals)
      return {
        hbarOut: ethers.formatEther(hbarOut),
        fee: ethers.formatEther(fee)
      };
    } catch (err) {
      console.error("Error getting sell quote:", err);
      return { hbarOut: "0", fee: "0" };
    }
  }, [connection, getAssetExchangeContract]);

  // Auto-refresh balances when wallet connects
  useEffect(() => {
    if (connection) {
      // Show loading only if we don't have cached balances
      const hasCachedBalances = balances.length > 0;
      refreshBalances(!hasCachedBalances);
    }
  }, [connection, refreshBalances]);

  return {
    balances,
    isLoading,
    error,
    buyAsset,
    sellAsset,
    getQuoteBuy,
    getQuoteSell,
    refreshBalances,
  };
};
