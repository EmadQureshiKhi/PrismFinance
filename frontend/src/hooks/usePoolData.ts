import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import poolsConfig from '@/config/deployments-production.json';

const POOL_ABI = [
  'function realReserveA() view returns (uint256)',
  'function realReserveB() view returns (uint256)',
  'function virtualReserveA() view returns (uint256)',
  'function virtualReserveB() view returns (uint256)',
  'function oraclePrice() view returns (uint256)',
  'function lastOracleUpdate() view returns (uint256)',
  'function accumulatedFeesA() view returns (uint256)',
  'function accumulatedFeesB() view returns (uint256)',
  'function paused() view returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const HBAR_POOL_ABI = [
  'function realReserveHBAR() view returns (uint256)',
  'function realReserveToken() view returns (uint256)',
  'function virtualReserveHBAR() view returns (uint256)',
  'function virtualReserveToken() view returns (uint256)',
  'function HBAR_PRICE_USD() view returns (uint256)',
  'function accumulatedFeesHBAR() view returns (uint256)',
  'function accumulatedFeesToken() view returns (uint256)',
  'function paused() view returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const CACHE_KEY = 'prism_pool_data_cache';
const CACHE_DURATION = 30000; // 30 seconds

export interface PoolData {
  pair: string;
  poolAddress: string;
  contractId: string;
  tokenA: string;
  tokenB: string;
  realReserveA: string;
  realReserveB: string;
  virtualReserveA: string;
  virtualReserveB: string;
  oraclePrice: string;
  lastUpdate: number;
  feesA: string;
  feesB: string;
  paused: boolean;
  totalSupply: string;
  userLPBalance: string;
  userPoolShare: number;
}

interface CachedData {
  pools: PoolData[];
  timestamp: number;
  userAddress: string;
}

// Load cached data from localStorage
function loadCache(): CachedData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedData = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    
    // Return cache even if old - we'll refresh in background
    return data;
  } catch (error) {
    console.error('Error loading cache:', error);
    return null;
  }
}

// Save data to localStorage
function saveCache(pools: PoolData[], userAddress: string) {
  try {
    const data: CachedData = {
      pools,
      timestamp: Date.now(),
      userAddress,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

export function usePoolData() {
  const [pools, setPools] = useState<PoolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingFresh, setIsFetchingFresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  const fetchPoolData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsFetchingFresh(true);
      }
      setError(null);

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      const poolData: PoolData[] = [];

      // Get all pools from config (skip PHP pool)
      const poolEntries = Object.entries(poolsConfig.pools).filter(
        ([name]) => name !== 'pUSD/pPHP'
      );

      for (const [name, pool] of poolEntries) {
        try {
          const isHBARPool = name === 'HBAR/pUSD';
          
          if (isHBARPool) {
            // HBAR pool has different interface
            const poolContract = new ethers.Contract(
              pool.poolAddress,
              HBAR_POOL_ABI,
              provider
            );

            const [
              realReserveHBAR,
              realReserveToken,
              virtualReserveHBAR,
              virtualReserveToken,
              hbarPrice,
              feesHBAR,
              feesToken,
              paused,
              totalSupply,
              userBalance,
            ] = await Promise.all([
              poolContract.realReserveHBAR(),
              poolContract.realReserveToken(),
              poolContract.virtualReserveHBAR(),
              poolContract.virtualReserveToken(),
              poolContract.HBAR_PRICE_USD(),
              poolContract.accumulatedFeesHBAR(),
              poolContract.accumulatedFeesToken(),
              poolContract.paused(),
              poolContract.totalSupply(),
              poolContract.balanceOf(userAddress),
            ]);

            // LP tokens are in 8 decimals (not 18!)
            const totalSupplyNum = parseFloat(ethers.formatUnits(totalSupply, 8));
            const userBalanceNum = parseFloat(ethers.formatUnits(userBalance, 8));
            const poolShare = totalSupplyNum > 0 ? (userBalanceNum / totalSupplyNum) * 100 : 0;

            poolData.push({
              pair: name,
              poolAddress: pool.poolAddress,
              contractId: pool.contractId,
              tokenA: pool.tokenA,
              tokenB: pool.tokenB,
              realReserveA: ethers.formatUnits(realReserveHBAR, 8),
              realReserveB: ethers.formatUnits(realReserveToken, 8),
              virtualReserveA: ethers.formatUnits(virtualReserveHBAR, 8),
              virtualReserveB: ethers.formatUnits(virtualReserveToken, 8),
              oraclePrice: ethers.formatUnits(hbarPrice, 18),
              lastUpdate: Date.now() / 1000, // HBAR pool doesn't track lastUpdate
              feesA: ethers.formatUnits(feesHBAR, 8),
              feesB: ethers.formatUnits(feesToken, 8),
              paused,
              totalSupply: ethers.formatUnits(totalSupply, 8),
              userLPBalance: ethers.formatUnits(userBalance, 8),
              userPoolShare: poolShare,
            });
          } else {
            // Regular HTS pool
            const poolContract = new ethers.Contract(
              pool.poolAddress,
              POOL_ABI,
              provider
            );

            const [
              realReserveA,
              realReserveB,
              virtualReserveA,
              virtualReserveB,
              oraclePrice,
              lastUpdate,
              feesA,
              feesB,
              paused,
              totalSupply,
              userBalance,
            ] = await Promise.all([
              poolContract.realReserveA(),
              poolContract.realReserveB(),
              poolContract.virtualReserveA(),
              poolContract.virtualReserveB(),
              poolContract.oraclePrice(),
              poolContract.lastOracleUpdate(),
              poolContract.accumulatedFeesA(),
              poolContract.accumulatedFeesB(),
              poolContract.paused(),
              poolContract.totalSupply(),
              poolContract.balanceOf(userAddress),
            ]);

            // LP tokens are in 8 decimals (not 18!)
            const totalSupplyNum = parseFloat(ethers.formatUnits(totalSupply, 8));
            const userBalanceNum = parseFloat(ethers.formatUnits(userBalance, 8));
            const poolShare = totalSupplyNum > 0 ? (userBalanceNum / totalSupplyNum) * 100 : 0;

            poolData.push({
              pair: name,
              poolAddress: pool.poolAddress,
              contractId: pool.contractId,
              tokenA: pool.tokenA,
              tokenB: pool.tokenB,
              realReserveA: ethers.formatUnits(realReserveA, 8),
              realReserveB: ethers.formatUnits(realReserveB, 8),
              virtualReserveA: ethers.formatUnits(virtualReserveA, 8),
              virtualReserveB: ethers.formatUnits(virtualReserveB, 8),
              oraclePrice: ethers.formatUnits(oraclePrice, 18),
              lastUpdate: Number(lastUpdate),
              feesA: ethers.formatUnits(feesA, 8),
              feesB: ethers.formatUnits(feesB, 8),
              paused,
              totalSupply: ethers.formatUnits(totalSupply, 8),
              userLPBalance: ethers.formatUnits(userBalance, 8),
              userPoolShare: poolShare,
            });
          }
        } catch (err) {
          console.error(`Error fetching data for pool ${name}:`, err);
        }
      }

      setPools(poolData);
      saveCache(poolData, userAddress);
      setLastUpdated(Date.now());
    } catch (err: any) {
      console.error('Error fetching pool data:', err);
      setError(err.message || 'Failed to fetch pool data');
    } finally {
      setIsLoading(false);
      setIsFetchingFresh(false);
    }
  };

  useEffect(() => {
    // Load cache immediately
    const cached = loadCache();
    if (cached && cached.pools.length > 0) {
      console.log('📦 Loaded pool data from cache');
      setPools(cached.pools);
      setLastUpdated(cached.timestamp);
      setIsLoading(false);
      
      // Fetch fresh data in background
      fetchPoolData(false);
    } else {
      // No cache, fetch with loading state
      fetchPoolData(true);
    }
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchPoolData(false); // Background refresh, no loading state
    }, CACHE_DURATION);
    
    return () => clearInterval(interval);
  }, []);

  return {
    pools,
    isLoading,
    isFetchingFresh,
    lastUpdated,
    error,
    refetch: () => fetchPoolData(false), // Manual refresh without loading state
  };
}
