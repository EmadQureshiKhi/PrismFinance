import { CONTRACTS } from '@/config/contracts';

export interface HederaTransaction {
  txHash: string;
  timestamp: number;
  type: 'vault_deposit' | 'vault_withdraw' | 'asset_buy' | 'asset_sell' | 'unknown';
  status: 'SUCCESS' | 'FAILED';
  from: string;
  to: string;
  amount?: string;
  tokenSymbol?: string;
  memo?: string;
}

class HederaTransactionService {
  private readonly MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com';
  
  // Contract addresses to filter
  private readonly VAULT_ADDRESS = CONTRACTS.vault;
  private readonly ASSET_EXCHANGE_ADDRESS = CONTRACTS.assetExchange;

  async fetchAccountTransactions(accountId: string, limit = 50): Promise<HederaTransaction[]> {
    try {
      console.log('🔍 Fetching Hedera transactions for:', accountId);
      
      // Fetch transactions from mirror node
      const response = await fetch(
        `${this.MIRROR_NODE_URL}/api/v1/transactions?account.id=${accountId}&limit=${limit}&order=desc`
      );

      if (!response.ok) {
        throw new Error(`Mirror node error: ${response.status}`);
      }

      const data = await response.json();
      const transactions: HederaTransaction[] = [];

      for (const tx of data.transactions || []) {
        // Only include transactions with our contracts
        const isVaultTx = tx.transfers?.some((t: any) => 
          t.account === this.VAULT_ADDRESS
        );
        const isAssetTx = tx.transfers?.some((t: any) => 
          t.account === this.ASSET_EXCHANGE_ADDRESS
        );

        if (!isVaultTx && !isAssetTx) continue;

        const parsed: HederaTransaction = {
          txHash: tx.transaction_id,
          timestamp: parseFloat(tx.consensus_timestamp),
          type: this.parseTransactionType(tx, isVaultTx, isAssetTx),
          status: tx.result === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
          from: tx.transfers?.[0]?.account || '',
          to: tx.transfers?.[tx.transfers.length - 1]?.account || '',
          memo: tx.memo_base64 ? atob(tx.memo_base64) : undefined,
        };

        transactions.push(parsed);
      }

      console.log(`✅ Found ${transactions.length} relevant transactions`);
      return transactions;
    } catch (error) {
      console.error('Error fetching Hedera transactions:', error);
      return [];
    }
  }

  private parseTransactionType(
    tx: any,
    isVaultTx: boolean,
    isAssetTx: boolean
  ): HederaTransaction['type'] {
    // Try to parse from memo or function call
    const memo = tx.memo_base64 ? atob(tx.memo_base64).toLowerCase() : '';
    
    if (isVaultTx) {
      if (memo.includes('deposit') || memo.includes('mint')) {
        return 'vault_deposit';
      }
      if (memo.includes('withdraw') || memo.includes('burn')) {
        return 'vault_withdraw';
      }
    }

    if (isAssetTx) {
      if (memo.includes('buy') || memo.includes('purchase')) {
        return 'asset_buy';
      }
      if (memo.includes('sell')) {
        return 'asset_sell';
      }
    }

    return 'unknown';
  }

  getHashScanLink(txHash: string): string {
    return `https://hashscan.io/${CONTRACTS.network}/transaction/${txHash}`;
  }
}

export const hederaTxService = new HederaTransactionService();
