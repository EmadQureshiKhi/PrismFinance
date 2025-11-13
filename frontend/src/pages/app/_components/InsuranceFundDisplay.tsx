import { css } from "@emotion/react";
import { Shield, Info } from "@phosphor-icons/react";
import { useState } from "react";

interface InsuranceFundDisplayProps {
  userCollateral: number;
  userDebt: number;
}

const InsuranceFundDisplay = ({ userCollateral, userDebt }: InsuranceFundDisplayProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Simulated insurance fund data
  const totalFund = 50000 + Math.random() * 10000; // 50k-60k HBAR
  const userContribution = userCollateral * 0.025; // 2.5% of collateral
  const coverageRatio = (totalFund / (userDebt * 100)) * 100; // How much of total debt can be covered
  const userCoveragePercent = (userContribution / totalFund) * 100;

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
          justify-content: space-between;
          margin-bottom: 1.25rem;
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: 0.75rem;
          `}
        >
          <Shield size={20} color="#6b9eff" weight="fill" />
          <h3
            css={css`
              font-size: 1rem;
              font-weight: 700;
              color: #ffffff;
              margin: 0;
            `}
          >
            Insurance Fund
          </h3>
        </div>
        <div
          css={css`
            position: relative;
          `}
        >
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            css={css`
              background: transparent;
              border: none;
              cursor: pointer;
              padding: 0;
              display: flex;
              align-items: center;
            `}
          >
            <Info size={18} color="#a0a0a0" />
          </button>
          {showTooltip && (
            <div
              css={css`
                position: absolute;
                right: 0;
                top: 100%;
                margin-top: 0.5rem;
                width: 280px;
                background: rgba(12, 13, 16, 0.98);
                border: 1px solid rgba(107, 158, 255, 0.3);
                border-radius: 12px;
                padding: 1rem;
                font-size: 0.75rem;
                color: #a0a0a0;
                line-height: 1.5;
                z-index: 100;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
              `}
            >
              The insurance fund protects against bad debt from liquidations. A small portion of
              your collateral contributes to this shared safety net, ensuring protocol stability.
            </div>
          )}
        </div>
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
            Total Fund Balance
          </span>
          <span
            css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: #ffffff;
            `}
          >
            {totalFund.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} HBAR
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
            Your Contribution
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
                font-size: 1rem;
                font-weight: 600;
                color: #ffffff;
              `}
            >
              {userContribution.toFixed(2)} HBAR
            </span>
            <span
              css={css`
                font-size: 0.75rem;
                color: #6b9eff;
              `}
            >
              ({userCoveragePercent.toFixed(3)}%)
            </span>
          </div>
        </div>

        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 1rem;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          `}
        >
          <span
            css={css`
              font-size: 0.875rem;
              color: #a0a0a0;
            `}
          >
            Protection Status
          </span>
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            <div
              css={css`
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #dcfd8f;
                box-shadow: 0 0 8px rgba(220, 253, 143, 0.5);
              `}
            />
            <span
              css={css`
                font-size: 0.875rem;
                font-weight: 600;
                color: #dcfd8f;
              `}
            >
              Active
            </span>
          </div>
        </div>
      </div>

      <div
        css={css`
          margin-top: 1rem;
          padding: 0.75rem;
          background: rgba(107, 158, 255, 0.05);
          border-radius: 8px;
          font-size: 0.75rem;
          color: #a0a0a0;
          line-height: 1.5;
        `}
      >
        Coverage ratio: {coverageRatio.toFixed(1)}% • Simulated values
      </div>
    </div>
  );
};

export default InsuranceFundDisplay;
