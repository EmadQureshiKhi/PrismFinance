import { HederaToken } from './types';

/**
 * Manually curated list of tokens to display in Prism Finance
 * Add your tokens here with all the metadata
 */
export const CUSTOM_TOKENS: HederaToken[] = [
    // HBAR - Native token
    {
        tokenId: 'HBAR',
        symbol: 'HBAR',
        name: 'Hedera',
        decimals: 8,
        type: 'FUNGIBLE_COMMON',
        logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/hbar.png',
    },

    // SAUCE - SaucerSwap Token
    {
        tokenId: '0.0.731861',
        symbol: 'SAUCE',
        name: 'SaucerSwap',
        decimals: 6,
        type: 'FUNGIBLE_COMMON',
        logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/0.0.731861.png',
    },

    // USDC - USD Coin
    {
        tokenId: '0.0.456858',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        type: 'FUNGIBLE_COMMON',
        logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/0.0.456858.png',
    },

    // XSAUCE - Staked SAUCE
    {
        tokenId: '0.0.1460200',
        symbol: 'XSAUCE',
        name: 'xSAUCE',
        decimals: 6,
        type: 'FUNGIBLE_COMMON',
        logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/0.0.1460200.png',
    },

    // HBARX - Stader Staked HBAR
    {
        tokenId: '0.0.834116',
        symbol: 'HBARX',
        name: 'Stader HBARX',
        decimals: 8,
        type: 'FUNGIBLE_COMMON',
        logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/0.0.834116.png',
    },

    // BONZO
    {
        tokenId: '0.0.8279134',
        symbol: 'BONZO',
        name: 'BONZO',
        decimals: 8,
        type: 'FUNGIBLE_COMMON',
        logo: 'https://dwk1opv266jxs.cloudfront.net/icons/tokens/0.0.8279134.png',
    },
];
