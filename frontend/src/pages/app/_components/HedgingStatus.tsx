import { css } from "@emotion/react";
import { useEffect, useState } from "react";
import { ChartLineUp, CheckCircle, TrendUp, TrendDown } from "@phosphor-icons/react";
import { useVault } from "@/hooks/useVault";

interface HedgingStatusProps {
  userCollateral: number;
  userDebt: number;
}

interface HedgeInfo {
  isActive: boolean;
  hedgedAmount: string;
  entryPrice: string;
  currentPrice: string;
  pnl: string;
  effectiveCollateral: string;
}

const HedgingStatus = ({ userCollateral, userDebt }: HedgingStatusProps) => {
  const { getHedgeInfo } = useVault();
  const [hedgeInfo, setHedgeInfo] = useState<HedgeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHedgeInfo = async () => {
      try {
        const info = await getHedgeInfo();
        setHedgeInfo(info);
      } catch (error) {
        console.error("Error fetching hedge info:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (userCollateral > 0) {
      fetchHedgeInfo();
      // Refresh every 10 seconds
      const interval = setInterval(fetchHedgeInfo, 10000);
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
    }
  }, [getHedgeInfo, userCollateral]);

  const hedgeRatio = 90; // 90% hedge ratio
  const isActive = hedgeInfo?.isActive || false;
  const pnl = parseFloat(hedgeInfo?.pnl || "0");
  const isProfitable = pnl >= 0;

  return (
    <div
      css={css`
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid ${isActive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(220, 253, 143, 0.2)'};
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
        <ChartLineUp size={20} color={isActive ? "#22c55e" : "#dcfd8f"} weight="fill" />
        <h3
          css={css`
            font-size: 1rem;
            font-weight: 700;
            color: #ffffff;
            margin: 0;
          `}
        >
          Delta-Neutral Hedging
        </h3>
        {isActive && (
          <span
            css={css`
              margin-left: auto;
              font-size: 0.75rem;
              padding: 0.25rem 0.75rem;
              background: rgba(34, 197, 94, 0.1);
              border: 1px solid rgba(34, 197, 94, 0.3);
              border-radius: 6px;
              color: #22c55e;
              font-weight: 600;
            `}
          >
            LIVE
          </span>
        )}
      </div>

      <div
        css={css`
          display: grid;
          gap: 1rem;
        `}
      >
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
          `}
        >
          <span
            css={css`
              font-size: 0.875rem;
              color: #a0a0a0;
            `}
          >
            Hedging Status
          </span>
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            {isActive ? (
              <>
                <CheckCircle size={18} color="#22c55e" weight="fill" />
                <span
                  css={css`
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #22c55e;
                  `}
                >
                  Active
                </span>
              </>
            ) : (
              <span
                css={css`
                  font-size: 0.875rem;
                  font-weight: 600;
                  color: #a0a0a0;
                `}
              >
                Inactive
              </span>
            )}
          </div>
        </div>

        {isActive && hedgeInfo && (
          <>
            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}
            >
              <span
                css={css`
                  font-size: 0.875rem;
                  color: #a0a0a0;
                `}
              >
                Hedged Amount
              </span>
              <span
                css={css`
                  font-size: 1.25rem;
                  font-weight: 700;
                  color: #ffffff;
                `}
              >
                {parseFloat(hedgeInfo.hedgedAmount).toFixed(2)} HBAR
              </span>
            </div>

            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}
            >
              <span
                css={css`
                  font-size: 0.875rem;
                  color: #a0a0a0;
                `}
              >
                Hedge PnL
              </span>
              <span
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
              </span>
            </div>

            <div
              css={css`
                width: 100%;
                height: 8px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 4px;
                overflow: hidden;
              `}
            >
              <div
                css={css`
                  height: 100%;
                  width: ${hedgeRatio}%;
                  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
                  border-radius: 4px;
                  transition: width 0.3s ease;
                `}
              />
            </div>

            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.75rem;
                color: #a0a0a0;
              `}
            >
              <span>Protection Level</span>
              <span css={css` color: #22c55e; font-weight: 600; margin-left: 1rem; `}>
                {hedgeRatio}% Protected
              </span>
            </div>

            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-top: 0.75rem;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
              `}
            >
              <span
                css={css`
                  font-size: 0.875rem;
                  color: #a0a0a0;
                `}
              >
                Effective Collateral
              </span>
              <span
                css={css`
                  font-size: 1.125rem;
                  font-weight: 700;
                  color: #dcfd8f;
                  margin-left: 1rem;
                `}
              >
                {parseFloat(hedgeInfo.effectiveCollateral).toFixed(2)} HBAR
              </span>
            </div>
          </>
        )}
      </div>

      <div
        css={css`
          margin-top: 1rem;
          padding: 0.75rem;
          background: ${isActive ? 'rgba(34, 197, 94, 0.05)' : 'rgba(220, 253, 143, 0.05)'};
          border-radius: 8px;
          font-size: 0.75rem;
          color: #a0a0a0;
          line-height: 1.5;
        `}
      >
        {isActive ? (
          <>
            Your position is automatically hedged with a SHORT perpetual future, providing {hedgeRatio}% protection from HBAR price volatility.
          </>
        ) : (
          <>
            Delta-neutral hedging automatically opens when you deposit collateral, protecting you from HBAR price volatility.
          </>
        )}
      </div>
    </div>
  );
};

export default HedgingStatus;
