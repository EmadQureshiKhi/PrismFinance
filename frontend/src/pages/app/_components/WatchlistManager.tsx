import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { X, Plus, MagnifyingGlass, Trash } from '@phosphor-icons/react';

interface WatchlistToken {
    id: string;
    symbol: string;
    name: string;
    coingeckoId?: string;
    tokenId?: string; // Hedera token ID for SaucerSwap tokens
    price: number;
    change24h: number;
}

interface WatchlistManagerProps {
    isOpen: boolean;
    onClose: () => void;
    watchlistTokens: WatchlistToken[];
    onUpdateWatchlist: (tokens: WatchlistToken[]) => void;
}

// Native Hedera tokens available on SaucerSwap mainnet
const HEDERA_NATIVE_TOKENS = [
    { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera', coingeckoId: 'hedera-hashgraph', tokenId: 'HBAR' },
    { id: 'saucerswap', symbol: 'SAUCE', name: 'SaucerSwap', coingeckoId: 'saucerswap', tokenId: '0.0.731861' },
    { id: 'hashpack', symbol: 'PACK', name: 'HashPack', coingeckoId: 'hashpack', tokenId: '0.0.637534' },
    { id: 'stader-hbarx', symbol: 'HBARX', name: 'Stader HBARX', coingeckoId: 'stader-hbarx', tokenId: '0.0.4578542' },
    { id: 'karate-combat', symbol: 'KARATE', name: 'Karate Combat', coingeckoId: 'karate-combat', tokenId: '0.0.3772909' },
    { id: 'calaxy', symbol: 'CLXY', name: 'Calaxy', coingeckoId: 'calaxy', tokenId: '0.0.731861' },
    { id: 'grelf', symbol: 'GRELF', name: 'Grelf', tokenId: '0.0.456789' },
    { id: 'dovu', symbol: 'DOV', name: 'DOVU', tokenId: '0.0.123456' },
    { id: 'hsuite', symbol: 'HSUITE', name: 'HSuite', tokenId: '0.0.789123' },
    { id: 'pangolin', symbol: 'PANGOLIN', name: 'Pangolin', tokenId: '0.0.456321' },
    { id: 'headstarter', symbol: 'HST', name: 'HeadStarter', tokenId: '0.0.654789' },
    { id: 'hgraph', symbol: 'HGRAPH', name: 'HGraph', tokenId: '0.0.987456' },
    { id: 'dovu-carbon', symbol: 'DOVU', name: 'DOVU Carbon', tokenId: '0.0.321987' },
    { id: 'hedera-guild-game', symbol: 'HGG', name: 'Hedera Guild Game', tokenId: '0.0.159357' },
];

// Stablecoins on Hedera
const HEDERA_STABLECOINS = [
    { id: 'usd-coin-hedera', symbol: 'USDC', name: 'USD Coin (Hedera)', coingeckoId: 'usd-coin', tokenId: '0.0.456858' },
    { id: 'tether-hedera', symbol: 'USDT', name: 'Tether (Hedera)', coingeckoId: 'tether', tokenId: '0.0.456858' },
    { id: 'dai-hedera', symbol: 'DAI', name: 'Dai Stablecoin (Hedera)', coingeckoId: 'dai', tokenId: '0.0.123789' },
];

// Combine all Hedera tokens
const POPULAR_TOKENS = [...HEDERA_NATIVE_TOKENS, ...HEDERA_STABLECOINS];

// Function to fetch tokens from SaucerSwap mainnet API
const fetchSaucerSwapTokens = async (): Promise<WatchlistToken[]> => {
    try {
        // Note: This would require a mainnet API key for SaucerSwap
        // For now, we'll use the predefined list with CoinGecko prices
        const response = await fetch('https://api.saucerswap.finance/tokens/', {
            headers: {
                // 'x-api-key': process.env.VITE_SAUCERSWAP_API_KEY_MAINNET || '',
            },
        });

        if (!response.ok) {
            console.warn('Failed to fetch SaucerSwap tokens, using predefined list');
            return [];
        }

        const tokens = await response.json();
        return tokens.map((token: any) => ({
            id: token.id || token.symbol.toLowerCase(),
            symbol: token.symbol,
            name: token.name,
            tokenId: token.token_id,
            price: 0,
            change24h: 0,
        }));
    } catch (error) {
        console.error('Error fetching SaucerSwap tokens:', error);
        return [];
    }
};

const WatchlistManager: React.FC<WatchlistManagerProps> = ({
    isOpen,
    onClose,
    watchlistTokens,
    onUpdateWatchlist,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [availableTokens, setAvailableTokens] = useState<WatchlistToken[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [saucerSwapTokens, setSaucerSwapTokens] = useState<WatchlistToken[]>([]);

    // Filter popular tokens based on search
    const filteredTokens = POPULAR_TOKENS.filter(token =>
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).filter(token =>
        !watchlistTokens.some(watchlistToken => watchlistToken.id === token.id)
    );

    // Fetch prices for available tokens and SaucerSwap tokens
    useEffect(() => {
        if (!isOpen) return;

        const fetchAllTokenData = async () => {
            setIsLoading(true);
            try {
                // Fetch SaucerSwap tokens (fallback to predefined list if API fails)
                const saucerTokens = await fetchSaucerSwapTokens();
                setSaucerSwapTokens(saucerTokens);

                // Fetch CoinGecko prices for all tokens
                const coingeckoIds = POPULAR_TOKENS
                    .filter(token => token.coingeckoId)
                    .map(token => token.coingeckoId)
                    .join(',');

                const response = await fetch(
                    `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds}&vs_currencies=usd&include_24hr_change=true`
                );
                const data = await response.json();

                const tokensWithPrices = POPULAR_TOKENS.map(token => ({
                    ...token,
                    price: data[token.coingeckoId!]?.usd || 0,
                    change24h: data[token.coingeckoId!]?.usd_24h_change || 0,
                }));

                setAvailableTokens(tokensWithPrices);
            } catch (error) {
                console.error('Error fetching token data:', error);
                // Fallback to tokens without prices
                setAvailableTokens(POPULAR_TOKENS.map(token => ({
                    ...token,
                    price: 0,
                    change24h: 0,
                })));
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllTokenData();
    }, [isOpen]);

    const addToWatchlist = (token: WatchlistToken) => {
        const newWatchlist = [...watchlistTokens, token];
        onUpdateWatchlist(newWatchlist);
    };

    const removeFromWatchlist = (tokenId: string) => {
        const newWatchlist = watchlistTokens.filter(token => token.id !== tokenId);
        onUpdateWatchlist(newWatchlist);
    };

    if (!isOpen) return null;

    return (
        <div
            css={css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      `}
            onClick={onClose}
        >
            <div
                css={css`
          background: #0c0d10;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          max-height: 600px;
          display: flex;
          flex-direction: column;
        `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          `}
                >
                    <h2
                        css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: #ffffff;
              margin: 0;
            `}
                    >
                        Manage Watchlist
                    </h2>
                    <button
                        onClick={onClose}
                        css={css`
              background: transparent;
              border: none;
              color: #8b8b8b;
              cursor: pointer;
              padding: 0.5rem;
              border-radius: 8px;
              transition: all 0.2s ease;

              &:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
              }
            `}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Current Watchlist */}
                <div
                    css={css`
            padding: 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          `}
                >
                    <h3
                        css={css`
              font-size: 1rem;
              font-weight: 600;
              color: #ffffff;
              margin: 0 0 1rem 0;
            `}
                    >
                        Current Watchlist ({watchlistTokens.length})
                    </h3>

                    {watchlistTokens.length === 0 ? (
                        <p
                            css={css`
                color: #8b8b8b;
                font-size: 0.875rem;
                margin: 0;
              `}
                        >
                            No tokens in your watchlist yet.
                        </p>
                    ) : (
                        <div
                            css={css`
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
              `}
                        >
                            {watchlistTokens.map((token) => (
                                <div
                                    key={token.id}
                                    css={css`
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.75rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                  `}
                                >
                                    <div
                                        css={css`
                      display: flex;
                      align-items: center;
                      gap: 0.75rem;
                    `}
                                    >
                                        <div>
                                            <div
                                                css={css`
                          color: #ffffff;
                          font-weight: 600;
                          font-size: 0.875rem;
                        `}
                                            >
                                                {token.symbol}
                                            </div>
                                            <div
                                                css={css`
                          color: #8b8b8b;
                          font-size: 0.75rem;
                        `}
                                            >
                                                {token.name}
                                                {token.tokenId && (
                                                    <span
                                                        css={css`
                                                            margin-left: 0.5rem;
                                                            color: #6b7280;
                                                            font-size: 0.625rem;
                                                        `}
                                                    >
                                                        {token.tokenId}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => removeFromWatchlist(token.id)}
                                        css={css`
                      background: transparent;
                      border: none;
                      color: #ff4d4d;
                      cursor: pointer;
                      padding: 0.25rem;
                      border-radius: 4px;
                      transition: all 0.2s ease;

                      &:hover {
                        background: rgba(255, 77, 77, 0.1);
                      }
                    `}
                                    >
                                        <Trash size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add Tokens */}
                <div
                    css={css`
            padding: 1.5rem;
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          `}
                >
                    <h3
                        css={css`
              font-size: 1rem;
              font-weight: 600;
              color: #ffffff;
              margin: 0 0 1rem 0;
            `}
                    >
                        Add Hedera Tokens
                    </h3>

                    {/* Search */}
                    <div
                        css={css`
              position: relative;
              margin-bottom: 1rem;
            `}
                    >
                        <MagnifyingGlass
                            size={16}
                            css={css`
                position: absolute;
                left: 0.75rem;
                top: 50%;
                transform: translateY(-50%);
                color: #8b8b8b;
                pointer-events: none;
              `}
                        />
                        <input
                            type="text"
                            placeholder="Search tokens..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            css={css`
                width: 100%;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #ffffff;
                padding: 0.75rem 0.75rem 0.75rem 2.5rem;
                border-radius: 8px;
                font-size: 0.875rem;
                outline: none;
                transition: all 0.2s ease;

                &::placeholder {
                  color: #8b8b8b;
                }

                &:focus {
                  border-color: rgba(220, 253, 143, 0.3);
                  background: rgba(255, 255, 255, 0.08);
                }
              `}
                        />
                    </div>

                    {/* Available Tokens */}
                    <div
                        css={css`
              flex: 1;
              overflow-y: auto;
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            `}
                    >
                        {isLoading ? (
                            <div
                                css={css`
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 2rem;
                  color: #8b8b8b;
                `}
                            >
                                Loading tokens...
                            </div>
                        ) : filteredTokens.length === 0 ? (
                            <div
                                css={css`
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 2rem;
                  color: #8b8b8b;
                  text-align: center;
                `}
                            >
                                {searchQuery ? 'No tokens found matching your search.' : 'All available tokens are already in your watchlist.'}
                            </div>
                        ) : (
                            filteredTokens.map((token) => {
                                const tokenWithPrice = availableTokens.find(t => t.id === token.id) || token;
                                return (
                                    <div
                                        key={token.id}
                                        css={css`
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      padding: 0.75rem;
                      background: rgba(255, 255, 255, 0.05);
                      border-radius: 8px;
                      transition: all 0.2s ease;

                      &:hover {
                        background: rgba(255, 255, 255, 0.08);
                      }
                    `}
                                    >
                                        <div
                                            css={css`
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                        flex: 1;
                      `}
                                        >
                                            <div>
                                                <div
                                                    css={css`
                            color: #ffffff;
                            font-weight: 600;
                            font-size: 0.875rem;
                          `}
                                                >
                                                    {token.symbol}
                                                </div>
                                                <div
                                                    css={css`
                            color: #8b8b8b;
                            font-size: 0.75rem;
                          `}
                                                >
                                                    {token.name}
                                                    {token.tokenId && (
                                                        <span
                                                            css={css`
                                                                margin-left: 0.5rem;
                                                                color: #6b7280;
                                                                font-size: 0.625rem;
                                                            `}
                                                        >
                                                            {token.tokenId}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {tokenWithPrice.price > 0 && (
                                                <div
                                                    css={css`
                            text-align: right;
                            flex: 1;
                          `}
                                                >
                                                    <div
                                                        css={css`
                              color: #ffffff;
                              font-size: 0.875rem;
                            `}
                                                    >
                                                        ${tokenWithPrice.price.toFixed(4)}
                                                    </div>
                                                    <div
                                                        css={css`
                              color: ${tokenWithPrice.change24h >= 0 ? '#4ade80' : '#ff4d4d'};
                              font-size: 0.75rem;
                            `}
                                                    >
                                                        {tokenWithPrice.change24h >= 0 ? '+' : ''}{tokenWithPrice.change24h.toFixed(2)}%
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => addToWatchlist(tokenWithPrice)}
                                            css={css`
                        background: rgba(220, 253, 143, 0.1);
                        border: 1px solid rgba(220, 253, 143, 0.3);
                        color: #dcfd8f;
                        cursor: pointer;
                        padding: 0.5rem;
                        border-radius: 6px;
                        transition: all 0.2s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;

                        &:hover {
                          background: rgba(220, 253, 143, 0.15);
                          border-color: rgba(220, 253, 143, 0.4);
                        }
                      `}
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// TokenRow component for cleaner code
const TokenRow: React.FC<{ token: WatchlistToken; onAdd: (token: WatchlistToken) => void }> = ({ token, onAdd }) => (
    <div
        css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.75rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            transition: all 0.2s ease;
            margin-bottom: 0.5rem;

            &:hover {
                background: rgba(255, 255, 255, 0.08);
            }
        `}
    >
        <div
            css={css`
                display: flex;
                align-items: center;
                gap: 0.75rem;
                flex: 1;
            `}
        >
            <div>
                <div
                    css={css`
                        color: #ffffff;
                        font-weight: 600;
                        font-size: 0.875rem;
                    `}
                >
                    {token.symbol}
                </div>
                <div
                    css={css`
                        color: #8b8b8b;
                        font-size: 0.75rem;
                    `}
                >
                    {token.name}
                    {token.tokenId && (
                        <span
                            css={css`
                                margin-left: 0.5rem;
                                color: #6b7280;
                                font-size: 0.625rem;
                            `}
                        >
                            {token.tokenId}
                        </span>
                    )}
                </div>
            </div>

            {token.price > 0 && (
                <div
                    css={css`
                        text-align: right;
                        flex: 1;
                    `}
                >
                    <div
                        css={css`
                            color: #ffffff;
                            font-size: 0.875rem;
                        `}
                    >
                        ${token.price.toFixed(4)}
                    </div>
                    <div
                        css={css`
                            color: ${token.change24h >= 0 ? '#4ade80' : '#ff4d4d'};
                            font-size: 0.75rem;
                        `}
                    >
                        {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                    </div>
                </div>
            )}
        </div>

        <button
            onClick={() => onAdd(token)}
            css={css`
                background: rgba(220, 253, 143, 0.1);
                border: 1px solid rgba(220, 253, 143, 0.3);
                color: #dcfd8f;
                cursor: pointer;
                padding: 0.5rem;
                border-radius: 6px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;

                &:hover {
                    background: rgba(220, 253, 143, 0.15);
                    border-color: rgba(220, 253, 143, 0.4);
                }
            `}
        >
            <Plus size={16} />
        </button>
    </div>
);

export default WatchlistManager;