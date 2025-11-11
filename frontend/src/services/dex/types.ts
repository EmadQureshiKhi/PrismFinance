// DEX Aggregator Types

export interface HederaToken {
  tokenId: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  type: 'FUNGIBLE_COMMON' | 'NON_FUNGIBLE_UNIQUE';
  totalSupply?: string;
  priceUsd?: number;
}

export interface SwapQuote {
  dexName: string;
  inputToken: HederaToken;
  outputToken: HederaToken;
  inputAmount: string;
  outputAmount: string;
  exchangeRate: number;
  priceImpact: number;
  fee: number;
  route: string[];
  estimatedGas: string;
}

export interface SwapRoute {
  quote: SwapQuote;
  isBestPrice: boolean;
  savingsVsBest?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface DexInterface {
  name: string;
  getQuote(
    inputToken: string,
    outputToken: string,
    amount: string
  ): Promise<SwapQuote | null>;
  isAvailable(): Promise<boolean>;
}

export interface AggregatorOptions {
  dexes?: string[];
  slippage?: number;
  timeout?: number;
}
