import { css } from "@emotion/react";
import { X, MagnifyingGlass } from "@phosphor-icons/react";
import { useState } from "react";
import { FxCurrency } from "@/hooks/useFxSwap";

interface CurrencySelectorProps {
  currencies: FxCurrency[];
  selectedCurrency: FxCurrency | null;
  onSelectCurrency: (currency: FxCurrency) => void;
  isOpen: boolean;
  onClose: () => void;
}

const CurrencySelector = ({
  currencies,
  selectedCurrency,
  onSelectCurrency,
  isOpen,
  onClose,
}: CurrencySelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const filteredCurrencies = currencies.filter(
    (currency) =>
      currency.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      currency.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      css={css`
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
      `}
      onClick={onClose}
    >
      <div
        css={css`
          background: rgba(12, 13, 16, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          width: 100%;
          max-width: 420px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          `}
        >
          <h3
            css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: #fff;
              margin: 0;
            `}
          >
            Select Currency
          </h3>
          <button
            onClick={onClose}
            css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              background: rgba(255, 255, 255, 0.05);
              border: none;
              border-radius: 8px;
              color: #a0a0a0;
              cursor: pointer;
              transition: all 0.2s;

              &:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
              }
            `}
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Search */}
        <div
          css={css`
            padding: 1rem 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          `}
        >
          <div
            css={css`
              position: relative;
            `}
          >
            <MagnifyingGlass
              size={20}
              css={css`
                position: absolute;
                left: 1rem;
                top: 50%;
                transform: translateY(-50%);
                color: #a0a0a0;
              `}
            />
            <input
              type="text"
              placeholder="Search currency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              css={css`
                width: 100%;
                padding: 0.875rem 1rem 0.875rem 3rem;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                color: #fff;
                font-size: 0.9375rem;
                outline: none;
                transition: all 0.2s;

                &::placeholder {
                  color: #a0a0a0;
                }

                &:focus {
                  border-color: rgba(220, 253, 143, 0.3);
                  background: rgba(0, 0, 0, 0.4);
                }
              `}
            />
          </div>
        </div>

        {/* Currency List */}
        <div
          css={css`
            flex: 1;
            overflow-y: auto;
            padding: 0.5rem;

            &::-webkit-scrollbar {
              width: 8px;
            }

            &::-webkit-scrollbar-track {
              background: transparent;
            }

            &::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.1);
              border-radius: 4px;
            }

            &::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.2);
            }
          `}
        >
          {filteredCurrencies.length === 0 ? (
            <div
              css={css`
                padding: 3rem 1.5rem;
                text-align: center;
                color: #a0a0a0;
              `}
            >
              No currencies found
            </div>
          ) : (
            filteredCurrencies.map((currency) => (
              <button
                key={currency.symbol}
                onClick={() => onSelectCurrency(currency)}
                css={css`
                  width: 100%;
                  display: flex;
                  align-items: center;
                  gap: 1rem;
                  padding: 1rem;
                  background: ${selectedCurrency?.symbol === currency.symbol
                    ? "rgba(220, 253, 143, 0.1)"
                    : "transparent"};
                  border: 1px solid
                    ${selectedCurrency?.symbol === currency.symbol
                      ? "rgba(220, 253, 143, 0.3)"
                      : "transparent"};
                  border-radius: 12px;
                  cursor: pointer;
                  transition: all 0.2s;
                  margin-bottom: 0.5rem;

                  &:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.1);
                  }
                `}
              >
                {/* Currency Icon */}
                <div
                  css={css`
                    width: 40px;
                    height: 40px;
                    background: ${currency.symbol === "HBAR"
                      ? "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)"
                      : "linear-gradient(135deg, #dcfd8f 0%, #a8e063 100%)"};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: ${currency.symbol === "HBAR" ? "#fff" : "#02302c"};
                  `}
                >
                  {currency.symbol === "HBAR" ? "Ħ" : currency.symbol.slice(1, 2)}
                </div>

                {/* Currency Info */}
                <div
                  css={css`
                    flex: 1;
                    text-align: left;
                  `}
                >
                  <div
                    css={css`
                      font-size: 0.9375rem;
                      font-weight: 600;
                      color: #fff;
                      margin-bottom: 0.125rem;
                    `}
                  >
                    {currency.symbol}
                  </div>
                  <div
                    css={css`
                      font-size: 0.8125rem;
                      color: #a0a0a0;
                    `}
                  >
                    {currency.name}
                  </div>
                </div>

                {/* Selected Indicator */}
                {selectedCurrency?.symbol === currency.symbol && (
                  <div
                    css={css`
                      width: 20px;
                      height: 20px;
                      background: #dcfd8f;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: #02302c;
                      font-size: 0.75rem;
                      font-weight: 700;
                    `}
                  >
                    ✓
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CurrencySelector;
