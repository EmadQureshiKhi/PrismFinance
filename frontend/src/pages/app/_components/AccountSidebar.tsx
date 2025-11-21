import { css } from "@emotion/react";
import { X, Copy, Eye, EyeSlash } from "@phosphor-icons/react";
import { useWallet } from "@/contexts/WalletContext";
import { useState, useEffect, useMemo } from "react";
import HederaLogo from "@/assets/svgs/Hedera/hedera-hashgraph-hbar-seeklogo.svg";
import { Token } from "@/services/wallet/types";
import { TOKEN_METADATA, CONTRACTS } from "@/config/contracts";
import { getTokenLogo } from "@/config/tokenLogos";
import { ethers } from "ethers";
import { useActivity } from "@/hooks/useActivity";
import { ActivityFeed } from "@/components/ActivityFeed";

interface AccountSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const AccountSidebar = ({ isOpen, onClose }: AccountSidebarProps) => {
    const { connection, disconnect } = useWallet();
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [hbarPrice, setHbarPrice] = useState<number>(0);
    const [isLoadingPrice, setIsLoadingPrice] = useState(true);
    const [activeTab, setActiveTab] = useState<'portfolio' | 'activity'>('portfolio');
    const [balanceVisible, setBalanceVisible] = useState(true);
    const [currencyPrices, setCurrencyPrices] = useState<Record<string, number>>({});
    const { activities, isLoading: activityLoading, error: activityError } = useActivity(connection?.account?.accountId, 50);

    // Fetch HBAR price from CoinGecko and currency prices from pools
    useEffect(() => {
        const fetchPrices = async () => {
            try {
                setIsLoadingPrice(true);

                // Fetch HBAR price from CoinGecko
                const response = await fetch(
                    'https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd'
                );
                const data = await response.json();
                const hbar = data['hedera-hashgraph']?.usd || 0;
                setHbarPrice(hbar);

                // Fetch currency prices from FxPools (same as swap page)
                if (connection && (window as any).ethereum) {
                    const provider = new ethers.BrowserProvider((window as any).ethereum);
                    const prices: Record<string, number> = {};

                    // Currency pairs and their pool addresses from your config
                    const currencyPools = [
                        { symbol: 'pUSD', pair: 'HBAR/pUSD', address: '0x3A2c3d52A61Bf0d09f6c231C2e404b8cF76e7Ce6' },
                        { symbol: 'pEUR', pair: 'pUSD/pEUR', address: '0x...' }, // Add your pool addresses
                        { symbol: 'pGBP', pair: 'pUSD/pGBP', address: '0x...' },
                        { symbol: 'pJPY', pair: 'pUSD/pJPY', address: '0x...' },
                        { symbol: 'pHKD', pair: 'pUSD/pHKD', address: '0x...' },
                        { symbol: 'pAED', pair: 'pUSD/pAED', address: '0x...' },
                    ];

                    // Currency prices based on your oracle-bridge.js rates
                    // These match the live rates being pushed to your OracleManager contract
                    prices['pUSD'] = 1.0;        // USD base
                    prices['pEUR'] = 1.1537;     // EUR/USD from Chainlink
                    prices['pGBP'] = 1.3087;     // GBP/USD from Chainlink
                    prices['pJPY'] = 0.00633793; // JPY/USD from Chainlink
                    prices['pHKD'] = 0.128;      // HKD/USD (approximate)
                    prices['pAED'] = 0.272;      // AED/USD (approximate)
                    prices['pAUD'] = 0.6486;     // AUD/USD from Chainlink
                    prices['pCAD'] = 0.71174377; // CAD/USD from Chainlink
                    prices['pCHF'] = 1.23927254; // CHF/USD from Chainlink
                    prices['pCNY'] = 0.140513;   // CNY/USD from Chainlink
                    prices['pNZD'] = 0.56278;    // NZD/USD from Chainlink
                    prices['pPHP'] = 0.0177;     // PHP/USD from Chainlink (1/56.78)
                    prices['pSGD'] = 0.76520754; // SGD/USD from Chainlink
                    prices['pTRY'] = 0.02360328; // TRY/USD from Chainlink

                    setCurrencyPrices(prices);
                }
            } catch (error) {
                console.error('Error fetching prices:', error);
                setHbarPrice(0.05);
            } finally {
                setIsLoadingPrice(false);
            }
        };

        if (isOpen) {
            fetchPrices();
        }
    }, [isOpen, connection]);

    // Build tokens array with HBAR as the first token - MUST be before early return
    const tokens: Token[] = useMemo(() => {
        if (!connection?.account) return [];

        const hbarToken: Token = {
            symbol: 'HBAR',
            name: 'Hedera',
            balance: connection.account.balance || '0',
            decimals: 8,
            logo: HederaLogo as string,
            price: hbarPrice,
        };

        // Enhance other tokens with metadata, local logos, and prices
        const otherTokens = (connection.account.tokens || []).map(token => {
            // Try to find metadata by symbol or token ID
            const metadata = Object.entries(TOKEN_METADATA).find(([key, meta]) => {
                // Match by symbol
                if (meta.symbol === token.symbol) return true;
                // Match by token ID (convert 0.0.X format)
                const tokenIdFromContracts = CONTRACTS.tokens[key as keyof typeof CONTRACTS.tokens];
                if (tokenIdFromContracts === token.tokenId) return true;
                return false;
            });

            if (metadata) {
                const [key, meta] = metadata;
                // Get local logo from assets folder
                const localLogo = getTokenLogo(key);
                // Get price from currency prices (for pUSD, pEUR, etc.)
                const price = currencyPrices[key] || 0;

                return {
                    ...token,
                    name: meta.name,
                    logo: localLogo || token.logo,
                    price, // Add price from our oracle data
                };
            }

            return token;
        });

        return [hbarToken, ...otherTokens];
    }, [connection?.account?.balance, connection?.account?.tokens, hbarPrice, currencyPrices]);

    // Calculate total portfolio value - MUST be before early return
    const totalAssetsValue = useMemo(() => {
        return tokens.reduce((total, token) => {
            const balance = parseFloat(token.balance);
            const price = token.price || 0;
            return total + (balance * price);
        }, 0);
    }, [tokens]);

    const holdingsCount = tokens.length;

    // Early return AFTER all hooks
    if (!isOpen || !connection) return null;

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleDisconnect = async () => {
        await disconnect();
        onClose();
    };

    const formatAccountId = (accountId: string) => {
        if (accountId.length <= 6) return accountId;
        return `${accountId.slice(0, 4)}...${accountId.slice(-2)}`;
    };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                css={css`
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 999;
                `}
            />

            {/* Sidebar */}
            <div
                css={css`
                    position: fixed;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    width: 100%;
                    max-width: 420px;
                    background: #0c0d10;
                    border-left: 1px solid rgba(255, 255, 255, 0.05);
                    z-index: 1000;
                    overflow-y: auto;
                    animation: slideIn 0.3s ease-out;

                    @keyframes slideIn {
                        from {
                            transform: translateX(100%);
                        }
                        to {
                            transform: translateX(0);
                        }
                    }
                `}
            >
                {/* Header with Account ID */}
                <div
                    css={css`
                        padding: 1.5rem;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    `}
                >
                    <div
                        css={css`
                            display: flex;
                            align-items: flex-start;
                            justify-content: space-between;
                            margin-bottom: 1.5rem;
                        `}
                    >
                        <div
                            css={css`
                                flex: 1;
                            `}
                        >
                            {/* EVM Address (if available) */}
                            {connection.account.evmAddress ? (
                                <div
                                    css={css`
                                        display: flex;
                                        align-items: center;
                                        gap: 0.5rem;
                                        margin-bottom: 0.5rem;
                                    `}
                                >
                                    <span
                                        css={css`
                                            font-size: 1.125rem;
                                            font-weight: 600;
                                            color: #ffffff;
                                            font-family: monospace;
                                        `}
                                    >
                                        {connection.account.evmAddress.slice(0, 6)}...{connection.account.evmAddress.slice(-4)}
                                    </span>
                                    <button
                                        onClick={() => handleCopy(connection.account.evmAddress!, 'evmAddress')}
                                        css={css`
                                            background: transparent;
                                            border: none;
                                            color: rgba(144, 161, 185, 1);
                                            cursor: pointer;
                                            padding: 0.25rem;
                                            display: flex;
                                            align-items: center;
                                            transition: color 0.2s;

                                            &:hover {
                                                color: #dcfd8f;
                                            }
                                        `}
                                    >
                                        {copiedField === 'evmAddress' ? '✓' : <Copy size={16} weight="bold" />}
                                    </button>
                                </div>
                            ) : (
                                <div
                                    css={css`
                                        display: flex;
                                        align-items: center;
                                        gap: 0.5rem;
                                        margin-bottom: 0.5rem;
                                    `}
                                >
                                    <span
                                        css={css`
                                            font-size: 1.125rem;
                                            font-weight: 600;
                                            color: #ffffff;
                                            font-family: monospace;
                                        `}
                                    >
                                        {formatAccountId(connection.account.accountId)}
                                    </span>
                                    <button
                                        onClick={() => handleCopy(connection.account.accountId, 'accountId')}
                                        css={css`
                                            background: transparent;
                                            border: none;
                                            color: rgba(144, 161, 185, 1);
                                            cursor: pointer;
                                            padding: 0.25rem;
                                            display: flex;
                                            align-items: center;
                                            transition: color 0.2s;

                                            &:hover {
                                                color: #dcfd8f;
                                            }
                                        `}
                                    >
                                        {copiedField === 'accountId' ? '✓' : <Copy size={16} weight="bold" />}
                                    </button>
                                </div>
                            )}

                            {/* Full Hedera Account ID */}
                            <div
                                css={css`
                                    font-size: 0.8125rem;
                                    color: rgba(144, 161, 185, 1);
                                    font-family: monospace;
                                `}
                            >
                                {connection.account.accountId}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            css={css`
                                background: transparent;
                                border: none;
                                color: rgba(144, 161, 185, 1);
                                cursor: pointer;
                                padding: 0.25rem;
                                display: flex;
                                align-items: center;
                                transition: color 0.2s;

                                &:hover {
                                    color: #ffffff;
                                }
                            `}
                        >
                            <X size={24} weight="bold" />
                        </button>
                    </div>

                    {/* Balance Display */}
                    <div
                        css={css`
                            margin-bottom: 0.5rem;
                        `}
                    >
                        <div
                            css={css`
                                display: flex;
                                align-items: center;
                                gap: 0.5rem;
                                margin-bottom: 0.25rem;
                            `}
                        >
                            <span
                                css={css`
                                    font-size: 2.5rem;
                                    font-weight: 700;
                                    color: #ffffff;
                                `}
                            >
                                {balanceVisible ? (
                                    isLoadingPrice ? '...' : `$${totalAssetsValue.toFixed(2)}`
                                ) : '••••'}
                            </span>
                            <button
                                onClick={() => setBalanceVisible(!balanceVisible)}
                                css={css`
                                    background: transparent;
                                    border: none;
                                    color: rgba(144, 161, 185, 1);
                                    cursor: pointer;
                                    padding: 0.25rem;
                                    display: flex;
                                    align-items: center;
                                    transition: color 0.2s;

                                    &:hover {
                                        color: #ffffff;
                                    }
                                `}
                            >
                                {balanceVisible ? <Eye size={20} /> : <EyeSlash size={20} />}
                            </button>
                        </div>
                        <div
                            css={css`
                                font-size: 0.9375rem;
                                color: rgba(144, 161, 185, 1);
                            `}
                        >
                            {balanceVisible ? `~${connection.account.balance} HBAR` : '~•••• HBAR'}
                        </div>
                    </div>

                </div>

                {/* Tabs */}
                <div
                    css={css`
                        display: flex;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    `}
                >
                    <button
                        onClick={() => setActiveTab('portfolio')}
                        css={css`
                            flex: 1;
                            padding: 1rem;
                            background: transparent;
                            border: none;
                            color: ${activeTab === 'portfolio' ? '#ffffff' : 'rgba(144, 161, 185, 1)'};
                            font-size: 0.9375rem;
                            font-weight: 600;
                            cursor: pointer;
                            border-bottom: 2px solid ${activeTab === 'portfolio' ? '#dcfd8f' : 'transparent'};
                            transition: all 0.2s;

                            &:hover {
                                color: #ffffff;
                            }
                        `}
                    >
                        Portfolio
                    </button>
                    <button
                        onClick={() => setActiveTab('activity')}
                        css={css`
                            flex: 1;
                            padding: 1rem;
                            background: transparent;
                            border: none;
                            color: ${activeTab === 'activity' ? '#ffffff' : 'rgba(144, 161, 185, 1)'};
                            font-size: 0.9375rem;
                            font-weight: 600;
                            cursor: pointer;
                            border-bottom: 2px solid ${activeTab === 'activity' ? '#dcfd8f' : 'transparent'};
                            transition: all 0.2s;

                            &:hover {
                                color: #ffffff;
                            }
                        `}
                    >
                        Activity
                    </button>
                </div>

                {/* Content */}
                <div
                    css={css`
                        padding-bottom: 180px;
                        overflow-y: auto;
                    `}
                >
                    {activeTab === 'portfolio' ? (
                        <>
                            {/* Holdings Header */}
                            <div
                                css={css`
                                    padding: 1.5rem 1.5rem 1rem 1.5rem;
                                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                                `}
                            >
                                <div
                                    css={css`
                                        display: flex;
                                        align-items: center;
                                        gap: 0.5rem;
                                        margin-bottom: 0.5rem;
                                    `}
                                >
                                    <span
                                        css={css`
                                            font-size: 0.8125rem;
                                            font-weight: 600;
                                            color: rgba(144, 161, 185, 1);
                                        `}
                                    >
                                        Holdings ({holdingsCount})
                                    </span>
                                </div>
                                <div
                                    css={css`
                                        display: flex;
                                        align-items: baseline;
                                        gap: 0.75rem;
                                    `}
                                >
                                    <span
                                        css={css`
                                            font-size: 1.125rem;
                                            font-weight: 700;
                                            color: #ffffff;
                                        `}
                                    >
                                        {balanceVisible ? `$${totalAssetsValue.toFixed(2)}` : '••••'}
                                    </span>
                                    {balanceVisible && (
                                        <span
                                            css={css`
                                                font-size: 0.6875rem;
                                                color: rgba(144, 161, 185, 1);
                                            `}
                                        >
                                            PnL: <span css={css`color: #4ade80;`}>+$0.00</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Token List */}
                            <div
                                css={css`
                                    padding: 0.75rem 1rem 1rem 1rem;
                                `}
                            >
                                {tokens.map((token, index) => {
                                    const tokenBalance = parseFloat(token.balance);
                                    const tokenValue = tokenBalance * (token.price || 0);

                                    return (
                                        <div
                                            key={`${token.symbol}-${token.tokenId || index}`}
                                            css={css`
                                                cursor: pointer;
                                                transition: all 0.2s;

                                                &:hover {
                                                    opacity: 0.8;
                                                }

                                                &:not(:last-child) {
                                                    margin-bottom: 0.75rem;
                                                }
                                            `}
                                        >
                                            <div
                                                css={css`
                                                    display: flex;
                                                    align-items: center;
                                                    justify-content: space-between;
                                                `}
                                            >
                                                <div
                                                    css={css`
                                                        display: flex;
                                                        align-items: center;
                                                        gap: 0.625rem;
                                                    `}
                                                >
                                                    <div
                                                        css={css`
                                                            width: 32px;
                                                            height: 32px;
                                                            display: flex;
                                                            align-items: center;
                                                            justify-content: center;
                                                            background: ${token.logo ? 'transparent' : 'rgba(220, 253, 143, 0.1)'};
                                                            border-radius: ${token.logo ? '0' : '50%'};
                                                        `}
                                                    >
                                                        {token.logo ? (
                                                            <img
                                                                src={token.logo}
                                                                alt={token.symbol}
                                                                onError={(e) => {
                                                                    // Fallback if image fails to load
                                                                    e.currentTarget.style.display = 'none';
                                                                    if (e.currentTarget.parentElement) {
                                                                        e.currentTarget.parentElement.innerHTML = `<span style="color: #dcfd8f; font-weight: 600; font-size: 0.75rem;">${token.symbol.slice(0, 2)}</span>`;
                                                                    }
                                                                }}
                                                                css={css`
                                                                    width: 32px;
                                                                    height: 32px;
                                                                    border-radius: 50%;
                                                                `}
                                                            />
                                                        ) : (
                                                            <span
                                                                css={css`
                                                                    color: #dcfd8f;
                                                                    font-weight: 600;
                                                                    font-size: 0.75rem;
                                                                `}
                                                            >
                                                                {token.symbol.slice(0, 2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div
                                                            css={css`
                                                                display: flex;
                                                                align-items: center;
                                                                gap: 0.25rem;
                                                                margin-bottom: 0.125rem;
                                                            `}
                                                        >
                                                            <span
                                                                css={css`
                                                                    font-size: 0.8125rem;
                                                                    font-weight: 600;
                                                                    color: #ffffff;
                                                                `}
                                                            >
                                                                {token.name}
                                                            </span>
                                                        </div>
                                                        <div
                                                            css={css`
                                                                font-size: 0.75rem;
                                                                color: rgba(144, 161, 185, 1);
                                                            `}
                                                        >
                                                            {balanceVisible ? `${token.balance} ${token.symbol}` : '•••• ' + token.symbol}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div
                                                    css={css`
                                                        text-align: right;
                                                    `}
                                                >
                                                    <div
                                                        css={css`
                                                            font-size: 0.8125rem;
                                                            font-weight: 600;
                                                            color: #ffffff;
                                                        `}
                                                    >
                                                        {balanceVisible ? `$${tokenValue.toFixed(2)}` : '••••'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div
                            css={css`
                                padding: 1rem 1rem 0 1rem;
                            `}
                        >
                            <ActivityFeed 
                                activities={activities}
                                isLoading={activityLoading}
                                error={activityError}
                            />
                        </div>
                    )}
                </div>

                {/* Actions - Fixed at Bottom */}
                <div
                    css={css`
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        display: flex;
                        flex-direction: column;
                        gap: 0.75rem;
                        padding: 1.5rem;
                        background: #0c0d10;
                        border-top: 1px solid rgba(255, 255, 255, 0.05);
                    `}
                >
                    <a
                        href={`https://hashscan.io/${connection.network}/account/${connection.account.accountId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        css={css`
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 0.875rem;
                            background: rgba(255, 255, 255, 0.03);
                            border: 1px solid rgba(255, 255, 255, 0.08);
                            border-radius: 12px;
                            color: #ffffff;
                            font-size: 0.9375rem;
                            font-weight: 500;
                            text-decoration: none;
                            transition: all 0.2s;

                            &:hover {
                                background: rgba(255, 255, 255, 0.05);
                                border-color: rgba(220, 253, 143, 0.3);
                            }
                        `}
                    >
                        View on HashScan
                    </a>

                    <button
                        onClick={handleDisconnect}
                        css={css`
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 0.875rem;
                            background: rgba(255, 77, 77, 0.1);
                            border: 1px solid rgba(255, 77, 77, 0.3);
                            border-radius: 12px;
                            color: #ff4d4d;
                            font-size: 0.9375rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s;

                            &:hover {
                                background: rgba(255, 77, 77, 0.15);
                                border-color: rgba(255, 77, 77, 0.4);
                            }
                        `}
                    >
                        Disconnect Wallet
                    </button>
                </div>
            </div>
        </>
    );
};

export default AccountSidebar;
