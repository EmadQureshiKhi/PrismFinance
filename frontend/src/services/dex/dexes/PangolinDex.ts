import { DexInterface, SwapQuote } from '../types';

export class PangolinDex implements DexInterface {
    name = 'Pangolin';
    private apiUrl = 'https://api.pangolin.exchange';

    async getQuote(
        inputToken: string,
        outputToken: string,
        amount: string
    ): Promise<SwapQuote | null> {
        try {
            // Pangolin API for Hedera
            const response = await fetch(
                `${this.apiUrl}/hedera/quote`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tokenIn: inputToken === 'HBAR' ? 'HBAR' : inputToken,
                        tokenOut: outputToken === 'HBAR' ? 'HBAR' : outputToken,
                        amountIn: amount,
                    }),
                }
            );

            if (!response.ok) {
                console.warn(`Pangolin API error: ${response.status}`);
                return null;
            }

            const data = await response.json();

            return {
                dexName: this.name,
                inputToken: {
                    tokenId: inputToken,
                    symbol: inputToken === 'HBAR' ? 'HBAR' : inputToken.split('.').pop() || inputToken,
                    name: inputToken,
                    decimals: 8,
                    type: 'FUNGIBLE_COMMON'
                },
                outputToken: {
                    tokenId: outputToken,
                    symbol: outputToken === 'HBAR' ? 'HBAR' : outputToken.split('.').pop() || outputToken,
                    name: outputToken,
                    decimals: 8,
                    type: 'FUNGIBLE_COMMON'
                },
                inputAmount: amount,
                outputAmount: data.amountOut || '0',
                exchangeRate: parseFloat(data.price || '0'),
                priceImpact: parseFloat(data.priceImpact || '0'),
                fee: 0.3, // Pangolin standard fee
                route: data.path || [inputToken, outputToken],
                estimatedGas: data.gas || '0.05',
            };
        } catch (error) {
            console.error('Pangolin quote error:', error);
            return null;
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.apiUrl}/health`, { method: 'GET' });
            return response.ok;
        } catch {
            return false;
        }
    }
}
