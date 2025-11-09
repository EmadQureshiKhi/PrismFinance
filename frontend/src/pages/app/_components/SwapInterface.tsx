import { css } from "@emotion/react";
import { useState } from "react";
import { ArrowsDownUp, GearSix, Info } from "@phosphor-icons/react";

const currencies = [
  { symbol: "pUSD", name: "Prism USD", apy: "12.5%" },
  { symbol: "pEUR", name: "Prism EUR", apy: "11.8%" },
  { symbol: "pGBP", name: "Prism GBP", apy: "13.2%" },
  { symbol: "pJPY", name: "Prism JPY", apy: "10.5%" },
  { symbol: "pHKD", name: "Prism HKD", apy: "12.0%" },
  { symbol: "pAED", name: "Prism AED", apy: "11.5%" },
];

const SwapInterface = () => {
  const [fromCurrency, setFromCurrency] = useState(currencies[0]);
  const [toCurrency, setToCurrency] = useState(currencies[1]);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [swapMode, setSwapMode] = useState<"market" | "currency">("market");

  const handleSwapDirection = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  return (
    <div
      css={css`
        max-width: 480px;
        margin: 0 auto;
      `}
    >
      {/* Swap Card */}
      <div
        css={css`
          background: rgba(12, 13, 16, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 1.5rem;
        `}
      >
        {/* Mode Tabs */}
        <div
          css={css`
            margin-bottom: 1.5rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          `}
        >
          <div
            css={css`
              display: flex;
              gap: 0.5rem;
              background: rgba(0, 0, 0, 0.3);
              padding: 0.375rem;
              border-radius: 9999px;
            `}
          >
          <button
            onClick={() => setSwapMode("market")}
            css={css`
              flex: 1;
              padding: 0.625rem 1rem;
              background: ${swapMode === "market" ? "rgba(220, 253, 143, 0.15)" : "transparent"};
              border: ${swapMode === "market" ? "1px solid #dcfd8f" : "1px solid transparent"};
              border-radius: 9999px;
              color: ${swapMode === "market" ? "#dcfd8f" : "rgba(144, 161, 185, 1)"};
              font-size: 0.875rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.15s;

              &:hover {
                background: ${swapMode === "market" ? "rgba(220, 253, 143, 0.15)" : "rgba(255, 255, 255, 0.05)"};
                border-color: ${swapMode === "market" ? "#dcfd8f" : "transparent"};
                color: ${swapMode === "market" ? "#dcfd8f" : "#ffffff"};
              }
            `}
          >
            Market
          </button>
          <button
            onClick={() => setSwapMode("currency")}
            css={css`
              flex: 1;
              padding: 0.625rem 1rem;
              background: ${swapMode === "currency" ? "rgba(220, 253, 143, 0.15)" : "transparent"};
              border: ${swapMode === "currency" ? "1px solid #dcfd8f" : "1px solid transparent"};
              border-radius: 9999px;
              color: ${swapMode === "currency" ? "#dcfd8f" : "rgba(144, 161, 185, 1)"};
              font-size: 0.875rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.15s;

              &:hover {
                background: ${swapMode === "currency" ? "rgba(220, 253, 143, 0.15)" : "rgba(255, 255, 255, 0.05)"};
                border-color: ${swapMode === "currency" ? "#dcfd8f" : "transparent"};
                color: ${swapMode === "currency" ? "#dcfd8f" : "#ffffff"};
              }
            `}
          >
            Currency
          </button>
          </div>
        </div>

        {/* From Token */}
        <div
          css={css`
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 1.25rem;
            margin-bottom: 0.5rem;
          `}
        >
          <div
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 0.75rem;
            `}
          >
            <span
              css={css`
                font-size: 0.875rem;
                color: #a0a0a0;
              `}
            >
              You pay
            </span>
            <span
              css={css`
                font-size: 0.875rem;
                color: #a0a0a0;
              `}
            >
              Balance: 0.00
            </span>
          </div>

          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 1rem;
            `}
          >
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.00"
              css={css`
                flex: 1;
                background: transparent;
                border: none;
                color: #fff;
                font-size: 2rem;
                font-weight: 600;
                outline: none;

                &::placeholder {
                  color: rgba(255, 255, 255, 0.3);
                }
              `}
            />

            <button
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.625rem 1rem;
                background: rgba(220, 253, 143, 0.1);
                border: 1px solid rgba(220, 253, 143, 0.3);
                border-radius: 12px;
                color: #dcfd8f;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(220, 253, 143, 0.15);
                }
              `}
            >
              <span>{fromCurrency.symbol}</span>
            </button>
          </div>

          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-top: 0.75rem;
            `}
          >
            <Info size={14} color="#a0a0a0" />
            <span
              css={css`
                font-size: 0.75rem;
                color: #a0a0a0;
              `}
            >
              Earning {fromCurrency.apy} APY
            </span>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div
          css={css`
            display: flex;
            justify-content: center;
            margin: -0.75rem 0;
            position: relative;
            z-index: 1;
          `}
        >
          <button
            onClick={handleSwapDirection}
            css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              width: 40px;
              height: 40px;
              background: rgba(12, 13, 16, 1);
              border: 2px solid rgba(220, 253, 143, 0.2);
              border-radius: 12px;
              color: #dcfd8f;
              cursor: pointer;
              transition: all 0.2s;

              &:hover {
                background: rgba(220, 253, 143, 0.1);
                border-color: rgba(220, 253, 143, 0.4);
                transform: rotate(180deg);
              }
            `}
          >
            <ArrowsDownUp size={20} weight="bold" />
          </button>
        </div>

        {/* To Token */}
        <div
          css={css`
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 1.25rem;
            margin-bottom: 1.5rem;
          `}
        >
          <div
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 0.75rem;
            `}
          >
            <span
              css={css`
                font-size: 0.875rem;
                color: #a0a0a0;
              `}
            >
              You receive
            </span>
            <span
              css={css`
                font-size: 0.875rem;
                color: #a0a0a0;
              `}
            >
              Balance: 0.00
            </span>
          </div>

          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 1rem;
            `}
          >
            <input
              type="number"
              value={toAmount}
              onChange={(e) => setToAmount(e.target.value)}
              placeholder="0.00"
              css={css`
                flex: 1;
                background: transparent;
                border: none;
                color: #fff;
                font-size: 2rem;
                font-weight: 600;
                outline: none;

                &::placeholder {
                  color: rgba(255, 255, 255, 0.3);
                }
              `}
            />

            <button
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.625rem 1rem;
                background: rgba(220, 253, 143, 0.1);
                border: 1px solid rgba(220, 253, 143, 0.3);
                border-radius: 12px;
                color: #dcfd8f;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(220, 253, 143, 0.15);
                }
              `}
            >
              <span>{toCurrency.symbol}</span>
            </button>
          </div>

          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-top: 0.75rem;
            `}
          >
            <Info size={14} color="#a0a0a0" />
            <span
              css={css`
                font-size: 0.75rem;
                color: #a0a0a0;
              `}
            >
              Earning {toCurrency.apy} APY
            </span>
          </div>
        </div>

        {/* Swap Button */}
        <button
          css={css`
            width: 100%;
            padding: 1.125rem;
            background: linear-gradient(135deg, #dcfd8f 0%, #a8e063 100%);
            border: none;
            border-radius: 16px;
            color: #02302c;
            font-size: 1.125rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;

            &:hover {
              transform: translateY(-2px);
              box-shadow: 0 12px 24px rgba(220, 253, 143, 0.3);
            }

            &:disabled {
              opacity: 0.5;
              cursor: not-allowed;
              transform: none;
            }
          `}
          disabled={!fromAmount || parseFloat(fromAmount) <= 0}
        >
          {!fromAmount || parseFloat(fromAmount) <= 0
            ? "Enter an amount"
            : "Swap"}
        </button>
      </div>

      {/* Info Cards */}
      <div
        css={css`
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 1.5rem;
        `}
      >
        <div
          css={css`
            background: rgba(12, 13, 16, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 1rem;
          `}
        >
          <div
            css={css`
              font-size: 0.875rem;
              color: #a0a0a0;
              margin-bottom: 0.5rem;
            `}
          >
            Exchange Rate
          </div>
          <div
            css={css`
              font-size: 1.125rem;
              font-weight: 600;
              color: #fff;
            `}
          >
            1 {fromCurrency.symbol} = 0.92 {toCurrency.symbol}
          </div>
        </div>

        <div
          css={css`
            background: rgba(12, 13, 16, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 1rem;
          `}
        >
          <div
            css={css`
              font-size: 0.875rem;
              color: #a0a0a0;
              margin-bottom: 0.5rem;
            `}
          >
            Fee
          </div>
          <div
            css={css`
              font-size: 1.125rem;
              font-weight: 600;
              color: #fff;
            `}
          >
            0.3%
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwapInterface;
