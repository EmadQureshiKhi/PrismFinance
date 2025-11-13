import { css } from "@emotion/react";
import { ChartLineUp, CheckCircle } from "@phosphor-icons/react";

interface HedgingStatusProps {
  userCollateral: number;
  userDebt: number;
}

const HedgingStatus = ({ userCollateral, userDebt }: HedgingStatusProps) => {
  // Simulated hedge ratio (typically 90-100%)
  const hedgeRatio = 90 + Math.random() * 10;
  const isActive = userCollateral > 0 && userDebt > 0;

  return (
    <div
      css={css`
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(220, 253, 143, 0.2);
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
        <ChartLineUp size={20} color="#dcfd8f" weight="fill" />
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
        <span
          css={css`
            margin-left: auto;
            font-size: 0.75rem;
            padding: 0.25rem 0.75rem;
            background: rgba(220, 253, 143, 0.1);
            border: 1px solid rgba(220, 253, 143, 0.3);
            border-radius: 6px;
            color: #dcfd8f;
            font-weight: 600;
          `}
        >
          SIMULATED
        </span>
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
                <CheckCircle size={18} color="#dcfd8f" weight="fill" />
                <span
                  css={css`
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #dcfd8f;
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

        {isActive && (
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
                Current Hedge Ratio
              </span>
              <span
                css={css`
                  font-size: 1.25rem;
                  font-weight: 700;
                  color: #ffffff;
                `}
              >
                {hedgeRatio.toFixed(1)}%
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
                  background: linear-gradient(90deg, #dcfd8f 0%, #a8d96f 100%);
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
              <span>Volatility Reduction</span>
              <span css={css` color: #dcfd8f; font-weight: 600; `}>
                ~{(hedgeRatio * 0.8).toFixed(0)}%
              </span>
            </div>
          </>
        )}
      </div>

      <div
        css={css`
          margin-top: 1rem;
          padding: 0.75rem;
          background: rgba(220, 253, 143, 0.05);
          border-radius: 8px;
          font-size: 0.75rem;
          color: #a0a0a0;
          line-height: 1.5;
        `}
      >
        Delta-neutral hedging reduces exposure to HBAR price volatility by maintaining balanced
        long/short positions. This feature is currently simulated.
      </div>
    </div>
  );
};

export default HedgingStatus;
