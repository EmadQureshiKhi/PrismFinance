import { HederaToken } from './types';

/**
 * Testnet-only token list for Prism Finance
 * Using official SaucerSwap Testnet token IDs
 */
/**
 * Testnet tokens with active liquidity pools
 * Sorted by pool count (most liquid first)
 */
export const TESTNET_TOKENS: HederaToken[] = [
  {
    tokenId: 'HBAR',
    symbol: 'HBAR',
    name: 'Hedera',
    decimals: 8,
    type: 'FUNGIBLE_COMMON',
    logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/hbar.png',
  },
  {
    tokenId: '0.0.5449',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    type: 'FUNGIBLE_COMMON',
    logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/usdc.png',
  },
  {
    tokenId: '0.0.1183558',
    symbol: 'SAUCE',
    name: 'SaucerSwap',
    decimals: 6,
    type: 'FUNGIBLE_COMMON',
    logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/sauce.png',
  },
  {
    tokenId: '0.0.5529',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 8,
    type: 'FUNGIBLE_COMMON',
    logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/dai.png',
  },
  {
    tokenId: '0.0.5365',
    symbol: 'CLXY',
    name: 'Calaxy',
    decimals: 6,
    type: 'FUNGIBLE_COMMON',
    logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/clxy.png',
  },
  {
    tokenId: '0.0.2231533',
    symbol: 'HBARX',
    name: 'Stader HBARX',
    decimals: 8,
    type: 'FUNGIBLE_COMMON',
    logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/hbarx.png',
  },
  {
    tokenId: '0.0.5599',
    symbol: 'ALPHA',
    name: 'Alpha',
    decimals: 8,
    type: 'FUNGIBLE_COMMON',
    logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/alpha.png',
  },
  {
    tokenId: '0.0.3772909',
    symbol: 'KARATE',
    name: 'Karate Combat',
    decimals: 8,
    type: 'FUNGIBLE_COMMON',
    logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/karate.png',
  },
];
