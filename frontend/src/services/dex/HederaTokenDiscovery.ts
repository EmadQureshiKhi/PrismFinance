import { HederaToken } from './types';
import { CUSTOM_TOKENS } from './customTokens';

export class HederaTokenDiscovery {
  private mirrorNodeUrl: string;
  private network: 'testnet' | 'mainnet';
  private tokenCache: Map<string, HederaToken> = new Map();
  private allTokensCache: HederaToken[] | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.network = network;
    this.mirrorNodeUrl =
      network === 'mainnet'
        ? 'https://mainnet-public.mirrornode.hedera.com'
        : 'https://testnet.mirrornode.hedera.com';
    
    // Try to load from localStorage
    this.loadFromLocalStorage();
  }

  /**
   * Load cached tokens from localStorage (network-specific)
   */
  private loadFromLocalStorage(): void {
    try {
      const cacheKey = `hedera_tokens_cache_${this.network}`;
      const timestampKey = `hedera_tokens_timestamp_${this.network}`;
      
      const cached = localStorage.getItem(cacheKey);
      const timestamp = localStorage.getItem(timestampKey);
      
      if (cached && timestamp) {
        const cacheAge = Date.now() - parseInt(timestamp);
        
        // Use cache if less than 24 hours old
        if (cacheAge < this.CACHE_DURATION) {
          this.allTokensCache = JSON.parse(cached);
          this.cacheTimestamp = parseInt(timestamp);
          console.log(`✅ Loaded ${this.allTokensCache?.length} tokens from ${this.network} cache (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
        } else {
          console.log('⏰ Cache expired, will fetch fresh data');
          localStorage.removeItem(cacheKey);
          localStorage.removeItem(timestampKey);
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error);
    }
  }

  /**
   * Save tokens to localStorage (network-specific, only from SaucerSwap)
   */
  private saveToLocalStorage(tokens: HederaToken[], fromSaucerSwap: boolean = false): void {
    try {
      // Only save if from SaucerSwap
      if (!fromSaucerSwap) {
        return;
      }

      const cacheKey = `hedera_tokens_cache_${this.network}`;
      const timestampKey = `hedera_tokens_timestamp_${this.network}`;
      const sourceKey = `hedera_tokens_source_${this.network}`;
      
      localStorage.setItem(cacheKey, JSON.stringify(tokens));
      localStorage.setItem(timestampKey, Date.now().toString());
      localStorage.setItem(sourceKey, 'saucerswap');
      console.log(`💾 Saved ${tokens.length} tokens to ${this.network} cache permanently (source: SaucerSwap)`);
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error);
    }
  }

  /**
   * Fetch tokens - Try cache first, then SaucerSwap API, fallback to custom list
   */
  async fetchAllTokens(): Promise<HederaToken[]> {
    // Check if we have SaucerSwap cache
    const sourceKey = `hedera_tokens_source_${this.network}`;
    const cachedSource = localStorage.getItem(sourceKey);
    
    // Return cached tokens if from SaucerSwap and fresh
    if (this.allTokensCache && this.allTokensCache.length > 0 && cachedSource === 'saucerswap') {
      const cacheAge = Date.now() - this.cacheTimestamp;
      if (cacheAge < this.CACHE_DURATION) {
        console.log(`✅ Using SaucerSwap cached tokens (${Math.round(cacheAge / 1000 / 60)} minutes old, ${this.allTokensCache.length} tokens)`);
        return this.allTokensCache;
      }
    }
    
    console.log(`🔄 Attempting to fetch tokens from ${this.network}...`);
    try {
      const tokens: HederaToken[] = [];
      const tokenMap = new Map<string, HederaToken>();

      // Only try SaucerSwap API for mainnet
      if (this.network === 'mainnet') {
        console.log('📡 Calling SaucerSwap API...');
        try {
          const saucerResponse = await fetch('https://api.saucerswap.finance/tokens/known', {
            headers: {
              'x-api-key': import.meta.env.VITE_SAUCERSWAP_API_KEY || '',
            },
          });

          console.log(`📥 SaucerSwap API response: ${saucerResponse.status} ${saucerResponse.statusText}`);

          if (saucerResponse.ok) {
            const saucerData = await saucerResponse.json();
            const saucerTokens = Array.isArray(saucerData) ? saucerData : [];

            // Process SaucerSwap tokens
            for (const token of saucerTokens) {
              const hederaToken: HederaToken = {
                tokenId: token.id,
                symbol: token.symbol || 'UNKNOWN',
                name: token.name || 'Unknown Token',
                decimals: token.decimals || 0,
                type: 'FUNGIBLE_COMMON',
                priceUsd: token.priceUsd,
                logo: token.icon,
              };

              tokens.push(hederaToken);
              tokenMap.set(hederaToken.tokenId, hederaToken);
              this.tokenCache.set(hederaToken.tokenId, hederaToken);
            }

            console.log(`✅ SUCCESS! Loaded ${tokens.length} tokens from SaucerSwap API`);
            
            // Cache the tokens permanently (mark as from SaucerSwap)
            this.allTokensCache = tokens;
            this.cacheTimestamp = Date.now();
            this.saveToLocalStorage(tokens, true); // true = from SaucerSwap
            
            return tokens;
          } else {
            console.warn(`❌ SaucerSwap API error: ${saucerResponse.status} ${saucerResponse.statusText}`);
            console.warn(`⏳ Will retry on next load (refresh in 5 minutes)`);
          }
        } catch (apiError) {
          console.error('❌ SaucerSwap API request failed:', apiError);
          console.warn(`⏳ Will retry on next load (refresh in 5 minutes)`);
        }
      } else {
        console.log('ℹ️ Testnet mode - skipping SaucerSwap API');
      }

      // For testnet or mainnet fallback, use custom tokens (but don't cache them)
      console.log(`📋 Using custom token list (${CUSTOM_TOKENS.length} tokens)`);
      for (const token of CUSTOM_TOKENS) {
        tokens.push(token);
        tokenMap.set(token.tokenId, token);
        this.tokenCache.set(token.tokenId, token);
      }

      console.log(`✅ Loaded ${tokens.length} custom tokens (${this.network === 'testnet' ? 'testnet' : 'fallback - will retry SaucerSwap on next refresh'})`);
      
      // Don't cache fallback tokens - keep trying SaucerSwap
      this.allTokensCache = tokens;
      this.cacheTimestamp = Date.now();
      this.saveToLocalStorage(tokens, false); // false = not from SaucerSwap
      
      return tokens;
    } catch (error) {
      console.error('Error loading tokens:', error);
      return CUSTOM_TOKENS;
    }
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

  /**
   * Top tokens (fallback)
   */
  private getTopTokens(): HederaToken[] {
    return CUSTOM_TOKENS;
  }
}
