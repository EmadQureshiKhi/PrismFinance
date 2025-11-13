import { DexInterface, SwapQuote } from '../types';
import { ethers } from 'ethers';

/**
 * SaucerSwap DEX Integration - TESTNET ONLY
 * Supports both V1 (AMM) and V2 (Concentrated Liquidity)
 * 
 * Official Testnet Contract IDs:
 * V1:
 * - Router V3: 0.0.19264
 * - Factory: 0.0.9959
 * V2:
 * - SwapRouter: 0.0.1414040
 * - QuoterV2: 0.0.1390002
 * - WHBAR Token: 0.0.15058
 */

interface V1PoolInfo {
  id: number;
  contractId: string;
  tokenA: { id: string; symbol: string; decimals: number };
  tokenB: { id: string; symbol: string; decimals: number };
  tokenReserveA: string;
  tokenReserveB: string;
}

interface RouteInfo {
  path: string[];
  version: 'V1' | 'V2';
  hops: number;
}

export class SaucerSwapDex implements DexInterface {
  name = 'SaucerSwap';
  private provider: ethers.JsonRpcProvider;
  private v1RouterAddress: string;
  private v1FactoryAddress: string;
  private v2QuoterAddress: string;
  private whbarTokenId: string;
  private whbarAddress: string;
  private v1PoolsCache: V1PoolInfo[] | null = null;
  private apiKey: string;

  // Testnet token decimals
  private readonly TOKEN_DECIMALS: Record<string, number> = {
    'HBAR': 8,
    '0.0.15058': 8,      // WHBAR Token
    '0.0.5449': 6,       // USDC
    '0.0.1183558': 6,    // SAUCE
    '0.0.5529': 8,       // DAI
    '0.0.5365': 6,       // CLXY
    '0.0.2231533': 8,    // HBARX
    '0.0.5599': 8,       // ALPHA
    '0.0.3772909': 8,    // KARATE
  };

  // Testnet token symbols
  private readonly TOKEN_SYMBOLS: Record<string, string> = {
    'HBAR': 'HBAR',
    '0.0.15058': 'WHBAR',
    '0.0.5449': 'USDC',
    '0.0.1183558': 'SAUCE',
    '0.0.5529': 'DAI',
    '0.0.5365': 'CLXY',
    '0.0.2231533': 'HBARX',
    '0.0.5599': 'ALPHA',
    '0.0.3772909': 'KARATE',
  };

  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://testnet.hashio.io/api', undefined, {
      batchMaxCount: 1,
    });

    this.apiKey = import.meta.env.VITE_SAUCERSWAP_API_KEY_TESTNET || '';

    // V1 addresses
    this.v1RouterAddress = '0x' + this.toEvmAddress('0.0.19264');
    this.v1FactoryAddress = '0x' + this.toEvmAddress('0.0.9959');

    // V2 addresses
    this.v2QuoterAddress = '0x' + this.toEvmAddress('0.0.1390002');

    this.whbarTokenId = '0.0.15058';
    this.whbarAddress = '0x' + this.toEvmAddress(this.whbarTokenId);

    console.log('🔧 SaucerSwap initialized for TESTNET (V1 + V2)');
    console.log(`   V1 Router: ${this.v1RouterAddress} (0.0.19264)`);
    console.log(`   V2 Quoter: ${this.v2QuoterAddress} (0.0.1390002)`);
    console.log(`   WHBAR: ${this.whbarAddress} (${this.whbarTokenId})`);
    console.log(`   API Key: ${this.apiKey ? '✅ Configured' : '❌ Missing'}`);
  }

  /**
   * Fetch all V1 pools from SaucerSwap REST API
   */
  private async fetchV1Pools(): Promise<V1PoolInfo[]> {
    if (this.v1PoolsCache) {
      return this.v1PoolsCache;
    }

    try {
      const response = await fetch('https://test-api.saucerswap.finance/pools/', {
        headers: { 'x-api-key': this.apiKey },
      });

      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch V1 pools: ${response.status}`);
        return [];
      }

      const pools = await response.json();
      this.v1PoolsCache = pools;
      console.log(`✅ Loaded ${pools.length} V1 pools from testnet`);
      return pools;
    } catch (error) {
      console.error('❌ Error fetching V1 pools:', error);
      return [];
    }
  }

  /**
   * Find all possible routes between two tokens (V1 only for now)
   * Returns multiple routes sorted by potential output
   */
  private async findAllRoutes(fromToken: string, toToken: string): Promise<RouteInfo[]> {
    const from = fromToken === 'HBAR' ? this.whbarTokenId : fromToken;
    const to = toToken === 'HBAR' ? this.whbarTokenId : toToken;

    const routes: RouteInfo[] = [];
    const pools = await this.fetchV1Pools();

    // Check direct route
    const directExists = pools.some(p =>
      (p.tokenA.id === from && p.tokenB.id === to) ||
      (p.tokenA.id === to && p.tokenB.id === from)
    );

    if (directExists) {
      routes.push({
        path: [from, to],
        version: 'V1',
        hops: 1,
      });
    }

    // Find all 2-hop routes through intermediate tokens
    const intermediateTokens = [
      '0.0.5449',        // USDC
      this.whbarTokenId, // WHBAR
      '0.0.1183558',     // SAUCE
    ];

    for (const intermediate of intermediateTokens) {
      if (intermediate === from || intermediate === to) continue;

      const hop1Exists = pools.some(p =>
        (p.tokenA.id === from && p.tokenB.id === intermediate) ||
        (p.tokenA.id === intermediate && p.tokenB.id === from)
      );

      const hop2Exists = pools.some(p =>
        (p.tokenA.id === intermediate && p.tokenB.id === to) ||
        (p.tokenA.id === to && p.tokenB.id === intermediate)
      );

      if (hop1Exists && hop2Exists) {
        routes.push({
          path: [from, intermediate, to],
          version: 'V1',
          hops: 2,
        });
      }
    }

    console.log(`🔍 Found ${routes.length} possible routes for ${from} → ${to}`);
    routes.forEach((r, i) => {
      const symbols = r.path.map(id => this.getTokenSymbol(id)).join(' → ');
      console.log(`   Route ${i + 1}: ${symbols} (${r.hops} hop${r.hops > 1 ? 's' : ''}, ${r.version})`);
    });

    return routes;
  }

  /**
   * Get quote for a specific route using V1 Router
   */
  private async getV1Quote(
    route: RouteInfo,
    inputToken: string,
    outputToken: string,
    amount: string,
    inputDecimals: number,
    outputDecimals: number
  ): Promise<SwapQuote | null> {
    try {
      const amountInSmallestUnit = this.toSmallestUnit(amount, inputDecimals);
      const path = route.path.map(tokenId => '0x' + this.toEvmAddress(tokenId));

      const abi = [
        'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
      ];

      const routerContract = new ethers.Contract(this.v1RouterAddress, abi, this.provider);
      const amounts = await routerContract.getAmountsOut(amountInSmallestUnit, path);

      const outputAmountSmallest = amounts[amounts.length - 1].toString();
      const outputAmount = this.fromSmallestUnit(outputAmountSmallest, outputDecimals);
      const exchangeRate = parseFloat(outputAmount) / parseFloat(amount);
      const fee = 0.3 * route.hops;

      return {
        dexName: `${this.name} V1`,
        inputToken: {
          tokenId: inputToken,
          symbol: this.getTokenSymbol(inputToken),
          name: inputToken,
          decimals: inputDecimals,
          type: 'FUNGIBLE_COMMON',
        },
        outputToken: {
          tokenId: outputToken,
          symbol: this.getTokenSymbol(outputToken),
          name: outputToken,
          decimals: outputDecimals,
          type: 'FUNGIBLE_COMMON',
        },
        inputAmount: amount,
        outputAmount: outputAmount,
        exchangeRate: exchangeRate,
        priceImpact: 0.1,
        fee: fee,
        route: route.path,
        estimatedGas: '0.05',
      };
    } catch (error) {
      console.error(`❌ V1 quote error for route:`, error);
      return null;
    }
  }

  /**
   * Get quote for V2 (concentrated liquidity)
   * V2 uses QuoterV2 contract for quotes
   */
  private async getV2Quote(
    route: RouteInfo,
    inputToken: string,
    outputToken: string,
    amount: string,
    inputDecimals: number,
    outputDecimals: number
  ): Promise<SwapQuote | null> {
    try {
      const amountInSmallestUnit = this.toSmallestUnit(amount, inputDecimals);

      // V2 QuoterV2 ABI (simplified)
      const abi = [
        'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
      ];

      const quoterContract = new ethers.Contract(this.v2QuoterAddress, abi, this.provider);

      const tokenIn = '0x' + this.toEvmAddress(route.path[0]);
      const tokenOut = '0x' + this.toEvmAddress(route.path[1]);

      // V2 uses fee tiers: 500 (0.05%), 3000 (0.3%), 10000 (1%)
      const fee = 3000; // 0.3% default

      const params = {
        tokenIn,
        tokenOut,
        amountIn: amountInSmallestUnit,
        fee,
        sqrtPriceLimitX96: 0, // No price limit
      };

      const result = await quoterContract.quoteExactInputSingle.staticCall(params);
      const outputAmountSmallest = result[0].toString();
      const outputAmount = this.fromSmallestUnit(outputAmountSmallest, outputDecimals);
      const exchangeRate = parseFloat(outputAmount) / parseFloat(amount);

      return {
        dexName: `${this.name} V2`,
        inputToken: {
          tokenId: inputToken,
          symbol: this.getTokenSymbol(inputToken),
          name: inputToken,
          decimals: inputDecimals,
          type: 'FUNGIBLE_COMMON',
        },
        outputToken: {
          tokenId: outputToken,
          symbol: this.getTokenSymbol(outputToken),
          name: outputToken,
          decimals: outputDecimals,
          type: 'FUNGIBLE_COMMON',
        },
        inputAmount: amount,
        outputAmount: outputAmount,
        exchangeRate: exchangeRate,
        priceImpact: 0.05,
        fee: 0.3,
        route: route.path,
        estimatedGas: '0.08',
      };
    } catch (error) {
      console.error(`❌ V2 quote error:`, error);
      return null;
    }
  }

  /**
   * Get all possible quotes (V1 and V2) for the swap
   * Returns up to 3 best quotes sorted by output amount
   */
  async getAllQuotes(
    inputToken: string,
    outputToken: string,
    amount: string
  ): Promise<SwapQuote[]> {
    console.log(`🔄 SaucerSwap: Getting all quotes for ${amount} ${inputToken} → ${outputToken}`);

    const inputDecimals = this.getTokenDecimals(inputToken);
    const outputDecimals = this.getTokenDecimals(outputToken);

    // Find all possible V1 routes
    const v1Routes = await this.findAllRoutes(inputToken, outputToken);

    // Add V2 direct route (if pool exists)
    const from = inputToken === 'HBAR' ? this.whbarTokenId : inputToken;
    const to = outputToken === 'HBAR' ? this.whbarTokenId : outputToken;

    const v2DirectRoute: RouteInfo = {
      path: [from, to],
      version: 'V2',
      hops: 1,
    };

    // Combine V1 and V2 routes
    const allRoutes = [...v1Routes, v2DirectRoute];

    if (allRoutes.length === 0) {
      console.warn(`⚠️ No routes available for ${inputToken} → ${outputToken}`);
      return [];
    }

    console.log(`🔍 Testing ${allRoutes.length} routes (${v1Routes.length} V1, 1 V2)`);

    // Get quotes for all routes (V1 and V2)
    const quotePromises = allRoutes.map(route => {
      if (route.version === 'V1') {
        return this.getV1Quote(route, inputToken, outputToken, amount, inputDecimals, outputDecimals);
      } else {
        return this.getV2Quote(route, inputToken, outputToken, amount, inputDecimals, outputDecimals);
      }
    });

    const quotes = (await Promise.all(quotePromises)).filter(q => q !== null) as SwapQuote[];

    // Sort by best output amount (descending)
    quotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount));

    // Return top 3 best quotes
    const topQuotes = quotes.slice(0, 3);

    console.log(`✅ Got ${quotes.length} valid quotes, showing top ${topQuotes.length}`);
    topQuotes.forEach((q, i) => {
      const routeStr = q.route.map(id => this.getTokenSymbol(id)).join(' → ');
      const badge = i === 0 ? '⭐' : '';
      console.log(`   ${i + 1}. ${q.dexName}: ${q.outputAmount} ${q.outputToken.symbol} via ${routeStr} ${badge}`);
    });

    return topQuotes;
  }

  /**
   * Get single best quote (for backward compatibility)
   */
  async getQuote(
    inputToken: string,
    outputToken: string,
    amount: string
  ): Promise<SwapQuote | null> {
    const quotes = await this.getAllQuotes(inputToken, outputToken, amount);
    return quotes.length > 0 ? quotes[0] : null;
  }

  private getTokenDecimals(tokenId: string): number {
    return this.TOKEN_DECIMALS[tokenId] || 8;
  }

  private getTokenSymbol(tokenId: string): string {
    return this.TOKEN_SYMBOLS[tokenId] || tokenId.split('.').pop() || tokenId;
  }

  private toEvmAddress(tokenId: string): string {
    const parts = tokenId.split('.');
    const num = parseInt(parts[parts.length - 1]);
    return num.toString(16).padStart(40, '0');
  }

  private toSmallestUnit(amount: string, decimals: number): string {
    const value = parseFloat(amount);
    const multiplier = Math.pow(10, decimals);
    return Math.floor(value * multiplier).toString();
  }

  private fromSmallestUnit(amount: string, decimals: number): string {
    const value = parseFloat(amount);
    const divisor = Math.pow(10, decimals);
    return (value / divisor).toString();
  }

  /**
   * Execute V1 swap
   */
  async executeV1Swap(
    route: string[],
    amountIn: string,
    minAmountOut: string,
    deadline: number,
    signer: any,
    isHbarInput: boolean = false,
    isHbarOutput: boolean = false
  ): Promise<any> {
    try {
      const path = route.map(tokenId => '0x' + this.toEvmAddress(tokenId));

      let abi: string[];
      let tx: any;
      const gasLimit = 500000; // Set explicit gas limit for MetaMask

      if (isHbarInput) {
        // Swapping HBAR (native) for tokens
        console.log('💎 Using swapExactETHForTokens (HBAR → Token)');
        console.log(`   Amount in: ${amountIn}`);
        console.log(`   Min amount out: ${minAmountOut}`);
        console.log(`   Path: ${path.join(' → ')}`);

        abi = [
          'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)'
        ];
        const contract = new ethers.Contract(this.v1RouterAddress, abi, signer);
        tx = await contract.swapExactETHForTokens(
          minAmountOut,
          path,
          await signer.getAddress(),
          deadline,
          { value: amountIn, gasLimit } // Send HBAR as value with gas limit
        );
      } else if (isHbarOutput) {
        // Swapping tokens for HBAR (native)
        console.log('💎 Using swapExactTokensForETH (Token → HBAR)');
        console.log(`   Amount in: ${amountIn}`);
        console.log(`   Min amount out: ${minAmountOut}`);

        abi = [
          'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
        ];
        const contract = new ethers.Contract(this.v1RouterAddress, abi, signer);
        tx = await contract.swapExactTokensForETH(
          amountIn,
          minAmountOut,
          path,
          await signer.getAddress(),
          deadline,
          { gasLimit }
        );
      } else {
        // Regular token-to-token swap
        console.log('🔄 Using swapExactTokensForTokens (Token → Token)');
        console.log(`   Amount in: ${amountIn}`);
        console.log(`   Min amount out: ${minAmountOut}`);

        abi = [
          'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
        ];
        const contract = new ethers.Contract(this.v1RouterAddress, abi, signer);
        tx = await contract.swapExactTokensForTokens(
          amountIn,
          minAmountOut,
          path,
          await signer.getAddress(),
          deadline,
          { gasLimit }
        );
      }

      console.log(`📤 V1 Swap transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ V1 Swap confirmed in block ${receipt.blockNumber}`);

      return receipt;
    } catch (error) {
      console.error('❌ V1 Swap failed:', error);
      throw error;
    }
  }

  /**
   * Execute V2 swap
   */
  async executeV2Swap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minAmountOut: string,
    deadline: number,
    signer: any
  ): Promise<any> {
    try {
      const tokenInAddress = '0x' + this.toEvmAddress(tokenIn);
      const tokenOutAddress = '0x' + this.toEvmAddress(tokenOut);

      const abi = [
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)'
      ];

      const swapRouterAddress = '0x' + this.toEvmAddress('0.0.1414040'); // V2 SwapRouter
      const routerContract = new ethers.Contract(swapRouterAddress, abi, signer);

      const params = {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        fee: 3000, // 0.3%
        recipient: await signer.getAddress(),
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0, // No price limit
      };

      const tx = await routerContract.exactInputSingle(params);

      console.log(`📤 V2 Swap transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ V2 Swap confirmed in block ${receipt.blockNumber}`);

      return receipt;
    } catch (error) {
      console.error('❌ V2 Swap failed:', error);
      throw error;
    }
  }

  /**
   * Execute swap based on selected route
   */
  async executeSwap(
    quote: SwapQuote,
    slippageTolerance: number, // e.g., 0.5 for 0.5%
    signer: any
  ): Promise<any> {
    try {
      console.log(`🔄 Executing swap: ${quote.inputAmount} ${quote.inputToken.symbol} → ${quote.outputToken.symbol}`);
      console.log(`   Route: ${quote.route.join(' → ')}`);
      console.log(`   Expected output: ${quote.outputAmount}`);
      console.log(`   Slippage tolerance: ${slippageTolerance}%`);

      // Check if HBAR is involved
      const isHbarInput = quote.inputToken.tokenId === 'HBAR';
      const isHbarOutput = quote.outputToken.tokenId === 'HBAR';

      // Calculate minimum output with slippage
      const minOutput = parseFloat(quote.outputAmount) * (1 - slippageTolerance / 100);
      const minOutputSmallest = this.toSmallestUnit(minOutput.toString(), quote.outputToken.decimals);
      const amountInSmallest = this.toSmallestUnit(quote.inputAmount, quote.inputToken.decimals);

      // Deadline: 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      console.log(`   Amount in (smallest unit): ${amountInSmallest}`);
      console.log(`   Min output (with ${slippageTolerance}% slippage): ${minOutput.toFixed(6)}`);
      console.log(`   Min output (smallest unit): ${minOutputSmallest}`);

      // Execute based on version
      if (quote.dexName.includes('V2')) {
        return await this.executeV2Swap(
          quote.route[0],
          quote.route[quote.route.length - 1],
          amountInSmallest,
          minOutputSmallest,
          deadline,
          signer
        );
      } else {
        return await this.executeV1Swap(
          quote.route,
          amountInSmallest,
          minOutputSmallest,
          deadline,
          signer,
          isHbarInput,
          isHbarOutput
        );
      }
    } catch (error) {
      console.error('❌ Swap execution failed:', error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
