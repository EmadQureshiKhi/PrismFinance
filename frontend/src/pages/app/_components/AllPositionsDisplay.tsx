import { css } from "@emotion/react";
import { TrendUp, TrendDown, X } from "@phosphor-icons/react";

interface Position {
    id: string;
    isLong: boolean;
    size: string;
    collateral: string;
    leverage: number;
    entryPrice: string;
    currentPrice: string;
    unrealizedPnL: string;
    liquidationPrice: string;
    marginRatio: string;
}

interface AllPositionsDisplayProps {
    positions: Position[];
    onClose: (positionId: string) => void;
    closingPositionId: string | null;
}

const AllPositionsDisplay = ({ positions, onClose, closingPositionId }: AllPositionsDisplayProps) => {
    if (positions.length === 0) {
        return null;
    }

    return (
        <div
            css={css`
                margin-top: 2rem;
            `}
        >
            <h3
                css={css`
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #ffffff;
                    margin-bottom: 1rem;
                `}
            >
                All Positions ({positions.length})
            </h3>

            <div
                css={css`
                    display: grid;
                    gap: 1rem;
                `}
            >
                {positions.map((pos, index) => {
                    const pnl = parseFloat(pos.unrealizedPnL);
                    const isProfitable = pnl >= 0;

                    return (
                        <div
                            key={pos.id}
                            css={css`
                                background: rgba(12, 13, 16, 0.95);
                                backdrop-filter: blur(20px);
                                border: 1px solid ${pos.isLong ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
                                border-radius: 16px;
                                padding: 1.5rem;
                            `}
                        >
                            <div
                                css={css`
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    margin-bottom: 1rem;
                                `}
                            >
                                <div
                                    css={css`
                                        display: flex;
                                        align-items: center;
                                        gap: 0.75rem;
                                    `}
                                >
                                    <span
                                        css={css`
                                            font-size: 0.875rem;
                                            font-weight: 600;
                                            padding: 0.25rem 0.75rem;
                                            background: ${pos.isLong ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
                                            color: ${pos.isLong ? '#22c55e' : '#ef4444'};
                                            border-radius: 6px;
                                        `}
                                    >
                                        {pos.isLong ? 'LONG' : 'SHORT'}
                                    </span>
                                    <span
                                        css={css`
                                            font-size: 0.875rem;
                                            color: #a0a0a0;
                                        `}
                                    >
                                        Position #{index + 1}
                                    </span>
                                </div>

                                <button
                                    onClick={() => onClose(pos.id)}
                                    disabled={closingPositionId === pos.id}
                                    css={css`
                                        padding: 0.5rem 1rem;
                                        background: rgba(239, 68, 68, 0.1);
                                        border: 1px solid rgba(239, 68, 68, 0.3);
                                        border-radius: 8px;
                                        color: #ef4444;
                                        font-size: 0.875rem;
                                        font-weight: 600;
                                        cursor: pointer;
                                        display: flex;
                                        align-items: center;
                                        gap: 0.5rem;
                                        transition: all 0.2s;

                                        &:hover:not(:disabled) {
                                            background: rgba(239, 68, 68, 0.2);
                                            border-color: rgba(239, 68, 68, 0.5);
                                        }

                                        &:disabled {
                                            opacity: 0.5;
                                            cursor: not-allowed;
                                        }
                                    `}
                                >
                                    <X size={16} />
                                    {closingPositionId === pos.id ? "Closing..." : "Close"}
                                </button>
                            </div>

                            <div
                                css={css`
                                    display: grid;
                                    grid-template-columns: repeat(2, 1fr);
                                    gap: 1rem;
                                `}
                            >
                                <div>
                                    <div
                                        css={css`
                                            font-size: 0.75rem;
                                            color: #a0a0a0;
                                            margin-bottom: 0.25rem;
                                        `}
                                    >
                                        Size
                                    </div>
                                    <div
                                        css={css`
                                            font-size: 1rem;
                                            font-weight: 600;
                                            color: #ffffff;
                                        `}
                                    >
                                        {parseFloat(pos.size).toFixed(2)} HBAR
                                    </div>
                                </div>

                                <div>
                                    <div
                                        css={css`
                                            font-size: 0.75rem;
                                            color: #a0a0a0;
                                            margin-bottom: 0.25rem;
                                        `}
                                    >
                                        Collateral
                                    </div>
                                    <div
                                        css={css`
                                            font-size: 1rem;
                                            font-weight: 600;
                                            color: #ffffff;
                                        `}
                                    >
                                        {parseFloat(pos.collateral).toFixed(2)} HBAR
                                    </div>
                                </div>

                                <div>
                                    <div
                                        css={css`
                                            font-size: 0.75rem;
                                            color: #a0a0a0;
                                            margin-bottom: 0.25rem;
                                        `}
                                    >
                                        Leverage
                                    </div>
                                    <div
                                        css={css`
                                            font-size: 1rem;
                                            font-weight: 600;
                                            color: #dcfd8f;
                                        `}
                                    >
                                        {pos.leverage}x
                                    </div>
                                </div>

                                <div>
                                    <div
                                        css={css`
                                            font-size: 0.75rem;
                                            color: #a0a0a0;
                                            margin-bottom: 0.25rem;
                                        `}
                                    >
                                        Entry Price
                                    </div>
                                    <div
                                        css={css`
                                            font-size: 1rem;
                                            font-weight: 600;
                                            color: #ffffff;
                                        `}
                                    >
                                        ${parseFloat(pos.entryPrice).toFixed(4)}
                                    </div>
                                </div>

                                <div>
                                    <div
                                        css={css`
                                            font-size: 0.75rem;
                                            color: #a0a0a0;
                                            margin-bottom: 0.25rem;
                                        `}
                                    >
                                        Current Price
                                    </div>
                                    <div
                                        css={css`
                                            font-size: 1rem;
                                            font-weight: 600;
                                            color: #ffffff;
                                        `}
                                    >
                                        ${parseFloat(pos.currentPrice).toFixed(4)}
                                    </div>
                                </div>

                                <div>
                                    <div
                                        css={css`
                                            font-size: 0.75rem;
                                            color: #a0a0a0;
                                            margin-bottom: 0.25rem;
                                        `}
                                    >
                                        Unrealized PnL
                                    </div>
                                    <div
                                        css={css`
                                            font-size: 1rem;
                                            font-weight: 700;
                                            color: ${isProfitable ? '#22c55e' : '#ef4444'};
                                            display: flex;
                                            align-items: center;
                                            gap: 0.25rem;
                                        `}
                                    >
                                        {isProfitable ? <TrendUp size={16} /> : <TrendDown size={16} />}
                                        {isProfitable ? '+' : ''}{pnl.toFixed(4)} HBAR
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AllPositionsDisplay;
