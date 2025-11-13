import { css } from "@emotion/react";
import { TrendUp, Coins } from "@phosphor-icons/react";

interface YieldDisplayProps {
  userCollateral: number;
  userDebt: number;
}

const YieldDisplay = ({ userCollateral }: YieldDisplayProps) => {
  // Simulated APY between 8-15%
  const baseAPY = 8 + Math.random() * 7;
  const lstBonus = 2 + Math.random() * 3;
  const totalAPY = baseAPY + lstBonus;

  // Calculate accrued yield based on collateral (simulated)
  const accruedYield = userCollateral * (totalAPY / 100) * (30 / 365); // 30 days worth

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
        <TrendUp size={20} color="#dcfd8f" weight="fill" />
        <h3
          css={css`
            font-size: 1rem;
            font-weight: 700;
            color: #ffffff;
            margin: 0;
          `}
        >
          Yield & Rewards
        </h3>
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
            Current APY
          </span>
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            <span
              css={css`
                font-size: 1.25rem;
                font-weight: 700;
                color: #dcfd8f;
              `}
            >
              {totalAPY.toFixed(2)}%
            </span>
            <span
              css={css`
                font-size: 0.75rem;
                color: #a0a0a0;
              `}
            >
              ({baseAPY.toFixed(1)}% base + {lstBonus.toFixed(1)}% LST)
            </span>
          </div>
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
            Accrued Yield (30d)
          </span>
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            <Coins size={16} color="#dcfd8f" />
            <span
              css={css`
                font-size: 1.25rem;
                font-weight: 700;
                color: #ffffff;
              `}
            >
              {accruedYield.toFixed(2)} HBAR
            </span>
          </div>
        </div>

        <button
          disabled
          css={css`
            width: 100%;
            padding: 0.875rem;
            background: rgba(220, 253, 143, 0.1);
            border: 1px solid rgba(220, 253, 143, 0.3);
            border-radius: 12px;
            color: rgba(220, 253, 143, 0.5);
            font-size: 0.875rem;
            font-weight: 600;
            cursor: not-allowed;
            transition: all 0.2s;
          `}
        >
          Claim Yield (Coming Soon)
        </button>
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
        Yield is generated from LST staking rewards and protocol fees. Simulated values shown.
      </div>
    </div>
  );
};

export default YieldDisplay;
