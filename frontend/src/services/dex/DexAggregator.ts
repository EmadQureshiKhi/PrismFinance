import { SwapQuote, SwapRoute, AggregatorOptions, DexInterface } from './types';
import { SaucerSwapDex } from './dexes/SaucerSwapDex';

export class DexAggregator {
  private dexes: Map<string, DexInterface> = new Map();

  constructor() {
    // Register Hedera DEXes with swap APIs
    // SaucerSwap - Largest Hedera DEX (needs API key)
    // More DEXes can be added here as they become available
    this.registerDex(new SaucerSwapDex());
  }

  private registerDex(dex: DexInterface) {
    this.dexes.set(dex.name.toLowerCase(), dex);
  }

  /**
   * Get quotes from all DEXes and return sorted by best price
   */
  async aggregateQuotes(
    inputToken: string,
    outputToken: string,
    amount: string,
    options: AggregatorOptions = {}
  ): Promise<SwapRoute[]> {
    const { dexes = ['saucerswap'], timeout = 5000 } = options;

    console.log(`🔍 Aggregating quotes for ${amount} ${inputToken} → ${outputToken}`);

    // Fetch quotes from all DEXes in parallel
    const quotePromises = dexes.map(async (dexName) => {
      const dex = this.dexes.get(dexName.toLowerCase());
      if (!dex) return null;

      try {
        const isAvailable = await dex.isAvailable();
        if (!isAvailable) return null;

        return await dex.getQuote(inputToken, outputToken, amount);
      } catch (error) {
        console.error(`Error getting quote from ${dexName}:`, error);
        return null;
      }
    });

    // Wait for all quotes with timeout
    const quotes = await Promise.race([
      Promise.all(quotePromises),
      new Promise<(SwapQuote | null)[]>((resolve) =>
        setTimeout(() => resolve([]), timeout)
      ),
    ]);

    // Filter out null quotes and sort by output amount (best first)
    const validQuotes = quotes.filter((q): q is SwapQuote => q !== null);

    if (validQuotes.length === 0) {
      console.warn('⚠️ No valid quotes received');
      return [];
    }

    // Sort by output amount (descending)
    validQuotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount));

    // Create routes with best price indicator
    const bestOutputAmount = parseFloat(validQuotes[0].outputAmount);
    const routes: SwapRoute[] = validQuotes.map((quote, index) => {
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

    console.log(`✅ Found ${routes.length} routes, best: ${routes[0].quote.dexName}`);
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
