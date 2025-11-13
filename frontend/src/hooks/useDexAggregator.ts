import { useState, useEffect, useMemo } from 'react';
import { DexAggregator } from '@/services/dex/DexAggregator';
import { HederaTokenDiscovery } from '@/services/dex/HederaTokenDiscovery';
import { SwapRoute, HederaToken } from '@/services/dex/types';

export const useDexAggregator = () => {
  const [tokens, setTokens] = useState<HederaToken[]>([]);
  const [routes, setRoutes] = useState<SwapRoute[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Testnet only
  const aggregator = useMemo(() => new DexAggregator('testnet'), []);
  const tokenDiscovery = useMemo(() => new HederaTokenDiscovery(), []);

  // Fetch tokens on mount
  useEffect(() => {
    const loadTokens = async () => {
      try {
        setIsLoadingTokens(true);
        const fetchedTokens = await tokenDiscovery.fetchAllTokens();
        setTokens(fetchedTokens);
      } catch (err) {
        console.error('Error loading tokens:', err);
        setError('Failed to load tokens');
      } finally {
        setIsLoadingTokens(false);
      }
    };

    loadTokens();
  }, [tokenDiscovery]);

  // Get quotes from all DEXes
  const getQuotes = async (
    fromToken: string,
    toToken: string,
    amount: string,
    autoMode: boolean = true
  ) => {
    if (!amount || parseFloat(amount) <= 0) {
      setRoutes([]);
      return;
    }

    try {
      setIsLoadingRoutes(true);
      setError(null);

      const fetchedRoutes = await aggregator.aggregateQuotes(fromToken, toToken, amount);
      setRoutes(fetchedRoutes);

      if (fetchedRoutes.length === 0) {
        setError('No routes available for this pair');
      }
    } catch (err) {
      console.error('Error getting quotes:', err);
      setError('Failed to get quotes');
      setRoutes([]);
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  // Get best route only
  const getBestRoute = async (fromToken: string, toToken: string, amount: string) => {
    try {
      setIsLoadingRoutes(true);
      setError(null);

      const bestRoute = await aggregator.getBestRoute(fromToken, toToken, amount);
      setRoutes(bestRoute ? [bestRoute] : []);

      if (!bestRoute) {
        setError('No route available');
      }
    } catch (err) {
      console.error('Error getting best route:', err);
      setError('Failed to get route');
      setRoutes([]);
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  return {
    tokens,
    routes,
    isLoadingTokens,
    isLoadingRoutes,
    error,
    getQuotes,
    getBestRoute,
  };
};
