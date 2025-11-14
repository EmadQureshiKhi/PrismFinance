import { css } from "@emotion/react";
import { ClockCounterClockwise, ArrowDown, ArrowUp, Warning } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { db } from "@/services/database";

interface HistoryEntry {
  timestamp: Date;
  action: "deposit" | "withdraw" | "liquidation";
  hbarAmount?: number;
  tokenAmount?: number;
  tokenSymbol?: string;
  collateralRatio?: number;
  txHash?: string;
}

interface PositionHistoryProps {
  userCollateral: number;
  userDebt: number;
}

const PositionHistory = ({ userCollateral, userDebt }: PositionHistoryProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { connection } = useWallet();

  useEffect(() => {
    const fetchHistory = async () => {
      if (!connection?.account?.accountId) {
        setHistory([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const transactions = await db.getVaultTransactions(connection.account.accountId);

        const formattedHistory: HistoryEntry[] = transactions.map((tx: any) => {
          // Handle collateral ratio - check for max uint256 (infinite ratio)
          let ratio: number | undefined = undefined;
          if (tx.collateral_ratio) {
            const ratioStr = tx.collateral_ratio.toString();
            // Check if it's the max uint256 value (infinite ratio)
            if (ratioStr === "115792089237316195423570985008687907853269984665640564039457584007913129639935" ||
              parseFloat(ratioStr) > 1000000) {
              ratio = undefined; // Will display as "∞"
            } else {
              ratio = parseFloat(ratioStr);
            }
          }

          return {
            timestamp: new Date(tx.created_at),
            action: tx.type === 'deposit_mint' ? 'deposit' : 'withdraw',
            hbarAmount: parseFloat(tx.hbar_amount),
            tokenAmount: parseFloat(tx.token_amount),
            tokenSymbol: tx.token_symbol,
            collateralRatio: ratio,
            txHash: tx.tx_hash,
          };
        });

        setHistory(formattedHistory);
      } catch (error) {
        console.error('Error fetching transaction history:', error);
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [connection, userCollateral, userDebt]); // Refetch when position changes

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "deposit":
        return <ArrowDown size={16} color="#dcfd8f" weight="bold" />;
      case "withdraw":
        return <ArrowUp size={16} color="#6b9eff" weight="bold" />;
      case "liquidation":
        return <Warning size={16} color="#ff6464" weight="fill" />;
      default:
        return null;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "deposit":
        return "#dcfd8f";
      case "withdraw":
        return "#6b9eff";
      case "liquidation":
        return "#ff6464";
      default:
        return "#ffffff";
    }
  };

  return (
    <div
      css={css`
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(107, 158, 255, 0.2);
        border-radius: 16px;
        padding: 1.5rem;
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        `}
      >
        <ClockCounterClockwise size={20} color="#6b9eff" weight="fill" />
        <h3
          css={css`
            font-size: 1rem;
            font-weight: 700;
            color: #ffffff;
            margin: 0;
          `}
        >
          Position History
        </h3>
      </div>

      {isLoading ? (
        <div
          css={css`
            text-align: center;
            padding: 2rem 1rem;
            color: #a0a0a0;
            font-size: 0.875rem;
          `}
        >
          Loading transaction history...
        </div>
      ) : history.length === 0 ? (
        <div
          css={css`
            text-align: center;
            padding: 2rem 1rem;
            color: #a0a0a0;
            font-size: 0.875rem;
          `}
        >
          No position history yet. Make your first deposit to get started!
        </div>
      ) : (
        <div
          css={css`
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            max-height: ${history.length > 2 ? '280px' : 'auto'};
            overflow-y: ${history.length > 2 ? 'auto' : 'visible'};
            padding-right: ${history.length > 2 ? '0.5rem' : '0'};
            
            /* Custom scrollbar - hidden by default */
            &::-webkit-scrollbar {
              width: 8px;
              opacity: 0;
              transition: opacity 0.3s ease;
            }
            
            &::-webkit-scrollbar-track {
              background: transparent;
              border-radius: 10px;
            }
            
            &::-webkit-scrollbar-thumb {
              background: transparent;
              border-radius: 10px;
            }
            
            /* Show scrollbar on hover */
            &:hover::-webkit-scrollbar-track {
              background: rgba(0, 0, 0, 0.3);
            }
            
            &:hover::-webkit-scrollbar-thumb {
              background: linear-gradient(180deg, #dcfd8f 0%, #a8d45f 100%);
              
              &:hover {
                background: linear-gradient(180deg, #e8ffaa 0%, #b8e46f 100%);
              }
            }
          `}
        >
          {history.map((entry, index) => (
            <div
              key={index}
              css={css`
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                padding: 1rem;
                transition: all 0.2s;

                &:hover {
                  border-color: rgba(255, 255, 255, 0.1);
                  background: rgba(0, 0, 0, 0.4);
                }
              `}
            >
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: 0.5rem;
                `}
              >
                <div
                  css={css`
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                  `}
                >
                  {getActionIcon(entry.action)}
                  <span
                    css={css`
                      font-size: 0.875rem;
                      font-weight: 600;
                      color: ${getActionColor(entry.action)};
                      text-transform: capitalize;
                    `}
                  >
                    {entry.action}
                  </span>
                </div>
                <span
                  css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}
                >
                  {formatDate(entry.timestamp)}
                </span>
              </div>

              <div
                css={css`
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 0.5rem;
                  font-size: 0.75rem;
                `}
              >
                {entry.hbarAmount && (
                  <div>
                    <span css={css` color: #a0a0a0; `}>HBAR:</span>{" "}
                    <span css={css` color: #ffffff; font-weight: 600; `}>
                      {entry.hbarAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                {entry.tokenAmount && entry.tokenSymbol && (
                  <div>
                    <span css={css` color: #a0a0a0; `}>{entry.tokenSymbol}:</span>{" "}
                    <span css={css` color: #ffffff; font-weight: 600; `}>
                      {entry.tokenAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                {entry.collateralRatio !== undefined ? (
                  <div>
                    <span css={css` color: #a0a0a0; `}>Ratio:</span>{" "}
                    <span css={css` color: #dcfd8f; font-weight: 600; `}>
                      {entry.collateralRatio}%
                    </span>
                  </div>
                ) : entry.action === 'deposit' ? (
                  <div>
                    <span css={css` color: #a0a0a0; `}>Ratio:</span>{" "}
                    <span css={css` color: #dcfd8f; font-weight: 600; `}>
                      ∞
                    </span>
                  </div>
                ) : null}
                {entry.txHash && (
                  <div
                    css={css`
                      grid-column: 1 / -1;
                    `}
                  >
                    <a
                      href={`https://hashscan.io/testnet/transaction/${entry.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      css={css`
                        color: #6b9eff;
                        text-decoration: none;
                        font-size: 0.75rem;
                        
                        &:hover {
                          text-decoration: underline;
                        }
                      `}
                    >
                      View on HashScan →
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PositionHistory;
