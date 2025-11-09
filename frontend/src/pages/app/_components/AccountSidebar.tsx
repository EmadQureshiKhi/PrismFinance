import { css } from "@emotion/react";
import { X, Copy, Eye, EyeSlash } from "@phosphor-icons/react";
import { useWallet } from "@/contexts/WalletContext";
import { useState, useEffect, useMemo } from "react";
import HederaLogo from "@/assets/svgs/Hedera/hedera-hashgraph-hbar-seeklogo.svg";
import { Token } from "@/services/wallet/types";

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

    // Fetch HBAR price from CoinGecko
    useEffect(() => {
        const fetchHbarPrice = async () => {
            try {
                setIsLoadingPrice(true);
                const response = await fetch(
                    'https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd'
                );
                const data = await response.json();
                const price = data['hedera-hashgraph']?.usd || 0;
                setHbarPrice(price);
            } catch (error) {
                console.error('Error fetching HBAR price:', error);
                setHbarPrice(0.05);
            } finally {
                setIsLoadingPrice(false);
            }
        };

        if (isOpen) {
            fetchHbarPrice();
        }
    }, [isOpen]);

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

        // Combine HBAR with any other tokens from the account
        const otherTokens = connection.account.tokens || [];
        return [hbarToken, ...otherTokens];
    }, [connection?.account?.balance, connection?.account?.tokens, hbarPrice]);

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
                                                        `}
                                                    >
                                                        <img 
                                                            src={token.logo} 
                                                            alt={token.symbol} 
                                                            css={css`
                                                                width: 32px;
                                                                height: 32px;
                                                            `}
                                                        />
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
                                text-align: center;
                                padding: 3rem 1.5rem;
                                color: rgba(144, 161, 185, 1);
                            `}
                        >
                            <div
                                css={css`
                                    font-size: 2rem;
                                    margin-bottom: 1rem;
                                `}
                            >
                                📜
                            </div>
                            <div
                                css={css`
                                    font-size: 0.9375rem;
                                    font-weight: 500;
                                `}
                            >
                                No activity yet
                            </div>
                            <div
                                css={css`
                                    font-size: 0.8125rem;
                                    margin-top: 0.5rem;
                                `}
                            >
                                Your transactions will appear here
                            </div>
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
