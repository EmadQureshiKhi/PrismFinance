import { css } from "@emotion/react";
import { TrendUp, Coins, Spinner } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import { useVault } from "@/hooks/useVault";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/contexts/ToastContext";

interface YieldDisplayProps {
  userCollateral: number;
  userDebt: number;
}

const YieldDisplay = ({ userCollateral }: YieldDisplayProps) => {
  const { getCurrentAPY, calculateYield, claimYield } = useVault();
  const { connection } = useWallet();
  const { showSuccess, showError } = useToast();

  const [yieldData, setYieldData] = useState({
    baseAPY: 0,
    lstBonus: 0,
    totalAPY: 0,
    accruedYield: 0,
    canClaim: false,
    isLoading: true,
  });

  const [isClaiming, setIsClaiming] = useState(false);

  // Fetch yield data
  useEffect(() => {
    const fetchYieldData = async () => {
      if (!connection?.account?.evmAddress) {
        setYieldData(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        // Get APY rates
        const { base, bonus } = await getCurrentAPY();
        
        // Get accrued yield using EVM address
        const accrued = await calculateYield(connection.account.evmAddress);
        const accruedYield = parseFloat(accrued);

        setYieldData({
          baseAPY: base,
          lstBonus: bonus,
          totalAPY: base + bonus,
          accruedYield,
          canClaim: accruedYield > 0,
          isLoading: false,
        });
      } catch (error) {
        console.error("Error fetching yield data:", error);
        setYieldData(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchYieldData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchYieldData, 30000);
    return () => clearInterval(interval);
  }, [connection, getCurrentAPY, calculateYield, userCollateral]);

  // Handle claim yield
  const handleClaimYield = async () => {
    if (!yieldData.canClaim || isClaiming) return;

    setIsClaiming(true);
    try {
      const tx = await claimYield();
      showSuccess(
        "Yield Claimed!",
        `Successfully claimed ${yieldData.accruedYield.toFixed(6)} HBAR`,
        tx.hash
      );
      
      // Reset yield data after claim (it's now 0)
      setYieldData(prev => ({
        ...prev,
        accruedYield: 0,
        canClaim: false,
      }));
    } catch (error: any) {
      console.error("Error claiming yield:", error);
      showError("Claim Failed", error.message || "Failed to claim yield");
    } finally {
      setIsClaiming(false);
    }
  };

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
            {yieldData.isLoading ? (
              <Spinner size={20} color="#dcfd8f" className="animate-spin" />
            ) : (
              <>
                <span
                  css={css`
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #dcfd8f;
                  `}
                >
                  {yieldData.totalAPY.toFixed(1)}%
                </span>
                <span
                  css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}
                >
                  ({yieldData.baseAPY.toFixed(0)}% base + {yieldData.lstBonus.toFixed(0)}% LST)
                </span>
              </>
            )}
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
            Accrued Yield
          </span>
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            {yieldData.isLoading ? (
              <Spinner size={16} color="#dcfd8f" className="animate-spin" />
            ) : (
              <>
                <Coins size={16} color="#dcfd8f" />
                <span
                  css={css`
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #ffffff;
                  `}
                >
                  {yieldData.accruedYield.toFixed(6)} HBAR
                </span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleClaimYield}
          disabled={!yieldData.canClaim || isClaiming || yieldData.isLoading}
          css={css`
            width: 100%;
            padding: 0.875rem;
            background: ${yieldData.canClaim && !isClaiming
              ? "rgba(220, 253, 143, 0.15)"
              : "rgba(220, 253, 143, 0.05)"};
            border: 1px solid ${yieldData.canClaim && !isClaiming
              ? "rgba(220, 253, 143, 0.5)"
              : "rgba(220, 253, 143, 0.2)"};
            border-radius: 12px;
            color: ${yieldData.canClaim && !isClaiming
              ? "#dcfd8f"
              : "rgba(220, 253, 143, 0.4)"};
            font-size: 0.875rem;
            font-weight: 600;
            cursor: ${yieldData.canClaim && !isClaiming ? "pointer" : "not-allowed"};
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;

            &:hover {
              background: ${yieldData.canClaim && !isClaiming
                ? "rgba(220, 253, 143, 0.2)"
                : "rgba(220, 253, 143, 0.05)"};
            }

            @keyframes spin {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }

            svg {
              animation: ${isClaiming ? "spin 1s linear infinite" : "none"};
            }
          `}
        >
          {isClaiming ? (
            <>
              <Spinner size={16} />
              Claiming...
            </>
          ) : yieldData.canClaim ? (
            "Claim Yield"
          ) : (
            "No Yield to Claim"
          )}
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
        Yield is generated from LST staking rewards and protocol fees. Earn {yieldData.totalAPY.toFixed(1)}% APY on your HBAR collateral.
      </div>
    </div>
  );
};

export default YieldDisplay;
