import { useState, useEffect } from 'react';
import { db } from '@/services/database';
import { hederaTxService } from '@/services/hederaTransactions';

export interface ActivityItem {
  id: string;
  type: 'vault_deposit' | 'vault_withdraw' | 'asset_buy' | 'asset_sell';
  symbol: string;
  amount: string;
  secondaryAmount?: string; // For swaps (HBAR amount)
  timestamp: Date;
  txHash: string;
  status: 'SUCCESS' | 'FAILED';
  source: 'db' | 'hedera';
}

export function useActivity(walletAddress: string | undefined, limit = 50) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function fetchActivity() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch from database (instant)
        const dbTxs = await db.getAllTransactions(walletAddress, limit);
        
        // Convert DB transactions to ActivityItems
        const dbActivities: ActivityItem[] = dbTxs.map(tx => {
          if (tx.source === 'vault') {
            return {
              id: tx.tx_hash,
              type: tx.type === 'deposit_mint' ? 'vault_deposit' : 'vault_withdraw',
              symbol: tx.token_symbol,
              amount: tx.token_amount,
              secondaryAmount: tx.hbar_amount,
              timestamp: new Date(tx.created_at),
              txHash: tx.tx_hash,
              status: 'SUCCESS' as const,
              source: 'db' as const,
            };
          } else {
            return {
              id: tx.tx_hash,
              type: tx.type === 'buy' ? 'asset_buy' : 'asset_sell',
              symbol: tx.asset_symbol,
              amount: tx.amount,
              secondaryAmount: tx.total_cost, // HBAR cost
              timestamp: new Date(tx.created_at),
              txHash: tx.tx_hash,
              status: 'SUCCESS' as const,
              source: 'db' as const,
            };
          }
        });

        if (mounted) {
          setActivities(dbActivities);
        }

        // Fetch from Hedera mirror node (background)
        const hederaTxs = await hederaTxService.fetchAccountTransactions(walletAddress, limit);
        
        // Merge with DB transactions (deduplicate by tx hash)
        const dbTxHashes = new Set(dbActivities.map(a => a.txHash));
        const newHederaTxs = hederaTxs
          .filter(tx => !dbTxHashes.has(tx.txHash))
          .map(tx => ({
            id: tx.txHash,
            type: tx.type as ActivityItem['type'],
            symbol: tx.tokenSymbol || 'HBAR',
            amount: tx.amount || '0',
            timestamp: new Date(tx.timestamp / 1000000), // Convert nanoseconds to ms
            txHash: tx.txHash,
            status: tx.status,
            source: 'hedera' as const,
          }));

        if (mounted) {
          const merged = [...dbActivities, ...newHederaTxs]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
          setActivities(merged);
        }

      } catch (err) {
        console.error('Error fetching activity:', err);
        if (mounted) {
          setError('Failed to load activity');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchActivity();

    return () => {
      mounted = false;
    };
  }, [walletAddress, limit]);

  return { activities, isLoading, error };
}
