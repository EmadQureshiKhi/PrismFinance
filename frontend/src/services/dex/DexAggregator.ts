import { SwapQuote, SwapRoute, AggregatorOptions, DexInterface } from './types';
import { SaucerSwapDex } from './dexes/SaucerSwapDex';

export class DexAggregator {
  private dexes: Map<string, DexInterface> = new Map();

  constructor(network: 'mainnet' | 'testnet' = 'testnet') {
    // Register Hedera DEXes with swap APIs
    // SaucerSwap - Largest Hedera DEX with API (testnet only for now)
    // More DEXes can be added here as they become available
    this.registerDex(new SaucerSwapDex());
    
    console.log(`🔧 DexAggregator initialized for ${network}`);
  }

  private registerDex(dex: DexInterface) {
    this.dexes.set(dex.name.toLowerCase(), dex);
  }

  /**
   * Get quotes from all DEXes and return sorted by best price
   * Now supports multiple routes from each DEX
   */
  async aggregateQuotes(
    inputToken: string,
    outputToken: string,
    amount: string,
    options: AggregatorOptions = {}
  ): Promise<SwapRoute[]> {
    const { dexes = ['saucerswap'], timeout = 5000 } = options;

    console.log(`🔍 Aggregating quotes for ${amount} ${inputToken} → ${outputToken}`);

    // Fetch all quotes from all DEXes in parallel
    const quotePromises = dexes.map(async (dexName) => {
      const dex = this.dexes.get(dexName.toLowerCase());
      if (!dex) return [];

      try {
        const isAvailable = await dex.isAvailable();
        if (!isAvailable) return [];

        // Check if DEX supports getAllQuotes (for multiple routes)
        if ('getAllQuotes' in dex && typeof dex.getAllQuotes === 'function') {
          return await (dex as any).getAllQuotes(inputToken, outputToken, amount);
        } else {
          // Fallback to single quote
          const quote = await dex.getQuote(inputToken, outputToken, amount);
          return quote ? [quote] : [];
        }
      } catch (error) {
        console.error(`Error getting quotes from ${dexName}:`, error);
        return [];
      }
    });

    // Wait for all quotes with timeout
    const quotesArrays = await Promise.race([
      Promise.all(quotePromises),
      new Promise<SwapQuote[][]>((resolve) =>
        setTimeout(() => resolve([]), timeout)
      ),
    ]);

    // Flatten all quotes from all DEXes
    const allQuotes = quotesArrays.flat();

    if (allQuotes.length === 0) {
      console.warn('⚠️ No valid quotes received');
      return [];
    }

    // Sort by output amount (descending)
    allQuotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount));

    // Create routes with best price indicator
    const bestOutputAmount = parseFloat(allQuotes[0].outputAmount);
    const routes: SwapRoute[] = allQuotes.map((quote, index) => {
      const outputAmount = parseFloat(quote.outputAmount);
      const isBestPrice = index === 0;
      const savingsVsBest = isBestPrice
        ? undefined
        : ((bestOutputAmount - outputAmount) / bestOutputAmount * 100).toFixed(2) + '%';

      return {
        quote,
        isBestPrice,
        savingsVsBest,
        confidence: this.calculateConfidence(quote),
      };
    });

    console.log(`✅ Found ${routes.length} routes across all DEXes, best: ${routes[0].quote.dexName}`);
    routes.forEach((r, i) => {
      const routeStr = r.quote.route.map(id => {
        const symbol = id === 'HBAR' ? 'HBAR' : id.split('.').pop();
        return symbol;
      }).join(' → ');
      console.log(`   ${i + 1}. ${r.quote.dexName}: ${r.quote.outputAmount} via ${routeStr} ${r.isBestPrice ? '⭐' : ''}`);
    });

    return routes;
  }

  /**
   * Get best route automatically
   */
  async getBestRoute(
    inputToken: string,
    outputToken: string,
    amount: string,
    options?: AggregatorOptions
  ): Promise<SwapRoute | null> {
    const routes = await this.aggregateQuotes(inputToken, outputToken, amount, options);
    return routes.length > 0 ? routes[0] : null;
  }

  /**
   * Calculate confidence level based on liquidity and price impact
   */
  private calculateConfidence(quote: SwapQuote): 'high' | 'medium' | 'low' {
    if (quote.priceImpact < 0.5) return 'high';
    if (quote.priceImpact < 2) return 'medium';
    return 'low';
  }
}
