import { HederaToken } from './types';
import { TESTNET_TOKENS } from './customTokens';

/**
 * Testnet-only token discovery
 * No caching - always returns fresh testnet tokens
 */
export class HederaTokenDiscovery {
  private mirrorNodeUrl: string;
  private tokenCache: Map<string, HederaToken> = new Map();

  constructor() {
    this.mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
    console.log('🔧 HederaTokenDiscovery initialized for TESTNET');
  }

  /**
   * Fetch all tokens - returns testnet tokens immediately
   */
  async fetchAllTokens(): Promise<HederaToken[]> {
    console.log(`✅ Loaded ${TESTNET_TOKENS.length} testnet tokens`);
    
    // Cache tokens for quick lookup
    for (const token of TESTNET_TOKENS) {
      this.tokenCache.set(token.tokenId, token);
    }
    
    return TESTNET_TOKENS;
  }

  /**
   * Get token info by ID
   */
  async getTokenInfo(tokenId: string): Promise<HederaToken | null> {
    // Check cache first
    if (this.tokenCache.has(tokenId)) {
      return this.tokenCache.get(tokenId)!;
    }

    // Handle HBAR
    if (tokenId === 'HBAR') {
      return {
        tokenId: 'HBAR',
        symbol: 'HBAR',
        name: 'Hedera',
        decimals: 8,
        type: 'FUNGIBLE_COMMON',
      };
    }

    // Fetch from mirror node if not in cache
    try {
      const response = await fetch(`${this.mirrorNodeUrl}/api/v1/tokens/${tokenId}`);

      if (!response.ok) return null;

      const token = await response.json();
      const hederaToken: HederaToken = {
        tokenId: token.token_id,
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || 'Unknown Token',
        decimals: parseInt(token.decimals) || 0,
        type: token.type,
        totalSupply: token.total_supply,
      };

      this.tokenCache.set(tokenId, hederaToken);
      return hederaToken;
    } catch (error) {
      console.error(`Error fetching token ${tokenId}:`, error);
      return null;
    }
  }
}
