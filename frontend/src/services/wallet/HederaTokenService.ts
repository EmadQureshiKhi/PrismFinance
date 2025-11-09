import { Token } from './types';

export class HederaTokenService {
    private mirrorNodeUrl: string;

    constructor(network: 'testnet' | 'mainnet' = 'testnet') {
        this.mirrorNodeUrl = network === 'mainnet'
            ? 'https://mainnet-public.mirrornode.hedera.com'
            : 'https://testnet.mirrornode.hedera.com';
    }

    /**
     * Fetch all tokens for a given account from Hedera Mirror Node
     */
    async fetchAccountTokens(accountId: string): Promise<Token[]> {
        try {
            const response = await fetch(
                `${this.mirrorNodeUrl}/api/v1/accounts/${accountId}/tokens?limit=100`
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch tokens: ${response.statusText}`);
            }

            const data = await response.json();
            const tokens: Token[] = [];

            // Process each token balance
            for (const tokenBalance of data.tokens || []) {
                if (parseFloat(tokenBalance.balance) > 0) {
                    // Fetch token info
                    const tokenInfo = await this.fetchTokenInfo(tokenBalance.token_id);

                    if (tokenInfo) {
                        tokens.push({
                            symbol: tokenInfo.symbol,
                            name: tokenInfo.name,
                            balance: this.formatBalance(tokenBalance.balance, tokenInfo.decimals),
                            decimals: parseInt(tokenInfo.decimals),
                            logo: this.getTokenLogo(tokenInfo.symbol),
                            tokenId: tokenBalance.token_id,
                            price: 0, // Price will be fetched separately if needed
                        });
                    }
                }
            }

            return tokens;
        } catch (error) {
            console.error('Error fetching account tokens:', error);
            return [];
        }
    }

    /**
     * Fetch token information from Hedera Mirror Node
     */
    private async fetchTokenInfo(tokenId: string): Promise<any> {
        try {
            const response = await fetch(
                `${this.mirrorNodeUrl}/api/v1/tokens/${tokenId}`
            );

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error(`Error fetching token info for ${tokenId}:`, error);
            return null;
        }
    }

    /**
     * Format token balance based on decimals
     */
    private formatBalance(balance: string, decimals: string): string {
        const decimalPlaces = parseInt(decimals);
        const balanceNum = parseFloat(balance) / Math.pow(10, decimalPlaces);

        // Format with appropriate decimal places
        if (balanceNum < 0.01) {
            return balanceNum.toFixed(decimalPlaces);
        } else if (balanceNum < 1) {
            return balanceNum.toFixed(4);
        } else {
            return balanceNum.toFixed(2);
        }
    }

    /**
     * Get token logo - can be extended to fetch from a token registry
     */
    private getTokenLogo(symbol: string): string {
        // Default token logos - can be extended with a proper token registry
        const logoMap: Record<string, string> = {
            'USDC': '/assets/tokens/usdc.svg',
            'USDT': '/assets/tokens/usdt.svg',
            'HBAR': '/assets/svgs/Hedera/hedera-hashgraph-hbar-seeklogo.svg',
        };

        return logoMap[symbol] || '/assets/tokens/default.svg';
    }

    /**
     * Fetch token prices from CoinGecko (optional)
     */
    async fetchTokenPrices(symbols: string[]): Promise<Record<string, number>> {
        try {
            // Map Hedera token symbols to CoinGecko IDs
            const coinGeckoIds: Record<string, string> = {
                'HBAR': 'hedera-hashgraph',
                'USDC': 'usd-coin',
                'USDT': 'tether',
            };

            const ids = symbols
                .map(symbol => coinGeckoIds[symbol])
                .filter(Boolean)
                .join(',');

            if (!ids) return {};

            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
            );

            const data = await response.json();
            const prices: Record<string, number> = {};

            // Map back to symbols
            for (const [symbol, id] of Object.entries(coinGeckoIds)) {
                if (data[id]?.usd) {
                    prices[symbol] = data[id].usd;
                }
            }

            return prices;
        } catch (error) {
            console.error('Error fetching token prices:', error);
            return {};
        }
    }
}
