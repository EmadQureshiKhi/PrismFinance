import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// Oracle contract addresses (from your backend)
const ASSET_ORACLE_MANAGER = '0xf352c354A78Aa30a6D21845D5f55045a37b11092';
const PYTH_PRICE_ORACLE = '0x1050eb5E510E6d9D747fEeD6E32B76D4061896F4';

// AssetOracleManager ABI (minimal - just what we need)
const ASSET_ORACLE_ABI = [
  'function getPrice(string symbol) view returns (uint256 price, uint256 timestamp)',
  'function prices(string) view returns (uint256 price, uint256 timestamp)'
];

// PythPriceOracle ABI (minimal)
const PYTH_ORACLE_ABI = [
  'function getPrice(string symbol) view returns (uint256)',
  'function fallbackPrices(string) view returns (uint256)'
];

interface OraclePrice {
  symbol: string;
  price: number; // USD price
  timestamp?: number;
}

interface OraclePricesHook {
  prices: { [symbol: string]: number };
  isLoading: boolean;
  error: string | null;
  refreshPrices: () => Promise<void>;
  getPrice: (symbol: string) => number | null;
}

export const useOraclePrices = (): OraclePricesHook => {
  const [prices, setPrices] = useState<{ [symbol: string]: number }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get Hedera provider
  const getProvider = useCallback(() => {
    const rpcUrl = 'https://testnet.hashio.io/api'; // Use testnet
    return new ethers.JsonRpcProvider(rpcUrl);
  }, []);

  // Fetch prices from oracle contracts
  const refreshPrices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const provider = getProvider();
      const assetOracle = new ethers.Contract(ASSET_ORACLE_MANAGER, ASSET_ORACLE_ABI, provider);
      const pythOracle = new ethers.Contract(PYTH_PRICE_ORACLE, PYTH_ORACLE_ABI, provider);

      const newPrices: { [symbol: string]: number } = {};

      // Asset symbols (matching your oracle-server.js)
      const assets = ['HBAR', 'BTC', 'ETH', 'TSLA', 'AAPL', 'SPY', 'GOLD', 'TBILL'];

      console.log('📊 Fetching oracle prices...');

      for (const symbol of assets) {
        try {
          // Try AssetOracleManager first
          try {
            const [price, timestamp] = await assetOracle.getPrice(symbol);
            if (price > 0n) {
              // Prices are stored with 8 decimals
              const priceUsd = Number(price) / 1e8;
              newPrices[`p${symbol}`] = priceUsd; // Add 'p' prefix for frontend
              console.log(`✅ p${symbol}: $${priceUsd.toFixed(6)} (AssetOracleManager)`);
              continue;
            }
          } catch (e) {
            // If AssetOracleManager fails, try PythPriceOracle fallback
            const fallbackPrice = await pythOracle.getPrice(symbol);
            if (fallbackPrice > 0n) {
              const priceUsd = Number(fallbackPrice) / 1e8;
              newPrices[`p${symbol}`] = priceUsd;
              console.log(`✅ p${symbol}: $${priceUsd.toFixed(6)} (PythPriceOracle fallback)`);
              continue;
            }
          }

          console.warn(`⚠️ No price found for p${symbol}`);
        } catch (err) {
          console.error(`❌ Error fetching p${symbol}:`, err);
        }
      }

      setPrices(newPrices);
      console.log('💰 Oracle prices loaded:', newPrices);

    } catch (err: any) {
      console.error('❌ Error fetching oracle prices:', err);
      setError(err.message || 'Failed to fetch oracle prices');
    } finally {
      setIsLoading(false);
    }
  }, [getProvider]);

  // Get specific price
  const getPrice = useCallback((symbol: string): number | null => {
    return prices[symbol] || null;
  }, [prices]);

  // Auto-fetch on mount
  useEffect(() => {
    refreshPrices();

    // Refresh every 30 seconds (matching oracle update interval)
    const interval = setInterval(refreshPrices, 30000);
    return () => clearInterval(interval);
  }, [refreshPrices]);

  return {
    prices,
    isLoading,
    error,
    refreshPrices,
    getPrice
  };
};
