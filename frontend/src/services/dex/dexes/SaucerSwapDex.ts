import { DexInterface, SwapQuote } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * SaucerSwap DEX Integration
 * 
 * Uses backend proxy to call smart contracts and get real quotes
 */
export class SaucerSwapDex implements DexInterface {
  name = 'SaucerSwap';

  /**
   * Get swap quote from SaucerSwap (tries V1 and V2, returns best)
   */
  async getQuote(
    inputToken: string,
    outputToken: string,
    amount: string
  ): Promise<SwapQuote | null> {
    try {
      console.log(`🔄 SaucerSwap: Getting quote for ${amount} ${inputToken} → ${outputToken}`);

      // Get correct decimals for each token
      const inputDecimals = this.getTokenDecimals(inputToken);
      const outputDecimals = this.getTokenDecimals(outputToken);

      const response = await fetch(`${BACKEND_URL}/api/quote/all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputToken,
          outputToken,
          amount,
          inputDecimals,
          outputDecimals,
        }),
      });

      if (!response.ok) {
        console.error(`❌ Backend error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data.success || !data.bestQuote) {
        console.warn('❌ No valid quote from SaucerSwap');
        return null;
      }

      const best = data.bestQuote;
      const exchangeRate = parseFloat(best.outputAmount) / parseFloat(amount);

      console.log(`✅ SaucerSwap ${best.version.toUpperCase()}: ${best.outputAmount} ${outputToken} (fee: ${best.fee}%)`);

      return {
        dexName: `${this.name} ${best.version.toUpperCase()}`,
        inputToken: {
          tokenId: inputToken,
          symbol: inputToken === 'HBAR' ? 'HBAR' : inputToken.split('.').pop() || inputToken,
          name: inputToken,
          decimals: 8,
          type: 'FUNGIBLE_COMMON',
        },
        outputToken: {
          tokenId: outputToken,
          symbol: outputToken === 'HBAR' ? 'HBAR' : outputToken.split('.').pop() || outputToken,
          name: outputToken,
          decimals: 8,
          type: 'FUNGIBLE_COMMON',
        },
        inputAmount: amount,
        outputAmount: best.outputAmount,
        exchangeRate: exchangeRate,
        priceImpact: 0.1, // TODO: Calculate from pool reserves
        fee: best.fee,
        route: [inputToken, outputToken],
        estimatedGas: '0.05',
      };
    } catch (error) {
      console.error('❌ SaucerSwap quote error:', error);
      return null;
    }
  }

  /**
   * Get token decimals from custom tokens or cached data
   */
  private getTokenDecimals(tokenId: string): number {
    // Check custom tokens first
    const customTokens = [
      { tokenId: 'HBAR', decimals: 8 },
      { tokenId: '0.0.731861', decimals: 6 }, // SAUCE
      { tokenId: '0.0.456858', decimals: 6 }, // USDC
      { tokenId: '0.0.1460200', decimals: 6 }, // XSAUCE
      { tokenId: '0.0.834116', decimals: 8 }, // HBARX
      { tokenId: '0.0.8279134', decimals: 8 }, // BONZO
    ];
    
    const custom = customTokens.find(t => t.tokenId === tokenId);
    if (custom) return custom.decimals;
    
    // Try cached tokens
    try {
      const cached = localStorage.getItem('hedera_tokens_cache_mainnet');
      if (cached) {
        const tokens = JSON.parse(cached);
        const token = tokens.find((t: any) => t.tokenId === tokenId);
        if (token?.decimals) return token.decimals;
      }
    } catch (e) {
      console.warn('Failed to get decimals from cache:', e);
    }
    
    // Default to 8
    return 8;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
