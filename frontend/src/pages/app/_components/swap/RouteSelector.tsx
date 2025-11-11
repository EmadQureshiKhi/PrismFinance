import { css } from "@emotion/react";
import { SwapRoute } from "@/services/dex/types";
import { Check, TrendUp } from "@phosphor-icons/react";

interface RouteSelectorProps {
  routes: SwapRoute[];
  selectedRoute: SwapRoute | null;
  onSelectRoute: (route: SwapRoute) => void;
  isOpen: boolean;
  onClose: () => void;
}

const RouteSelector = ({
  routes,
  selectedRoute,
  onSelectRoute,
  isOpen,
  onClose,
}: RouteSelectorProps) => {
  if (!isOpen || routes.length === 0) return null;

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

      {/* Modal */}
      <div
        css={css`
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 480px;
          background: #0c0d10;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 1.5rem;
          z-index: 1000;
          max-height: 80vh;
          overflow-y: auto;
        `}
      >
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
          `}
        >
          <h3
            css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: #ffffff;
            `}
          >
            Select Route
          </h3>
          <button
            onClick={onClose}
            css={css`
              background: transparent;
              border: none;
              color: #a0a0a0;
              font-size: 1.5rem;
              cursor: pointer;
              &:hover {
                color: #ffffff;
              }
            `}
          >
            ×
          </button>
        </div>

        {/* Routes List */}
        <div
          css={css`
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          `}
        >
          {routes.map((route, index) => (
            <button
              key={route.quote.dexName}
              onClick={() => {
                onSelectRoute(route);
                onClose();
              }}
              css={css`
                background: ${selectedRoute?.quote.dexName === route.quote.dexName
                  ? 'rgba(220, 253, 143, 0.1)'
                  : 'rgba(0, 0, 0, 0.3)'};
                border: 1px solid ${selectedRoute?.quote.dexName === route.quote.dexName
                  ? '#dcfd8f'
                  : 'rgba(255, 255, 255, 0.08)'};
                border-radius: 16px;
                padding: 1rem;
                cursor: pointer;
                transition: all 0.2s;
                text-align: left;

                &:hover {
                  background: rgba(220, 253, 143, 0.05);
                  border-color: rgba(220, 253, 143, 0.3);
                }
              `}
            >
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
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
                  <span
                    css={css`
                      font-size: 1rem;
                      font-weight: 600;
                      color: #ffffff;
                    `}
                  >
                    {route.quote.dexName}
                  </span>
                  {route.isBestPrice && (
                    <span
                      css={css`
                        background: rgba(220, 253, 143, 0.2);
                        color: #dcfd8f;
                        padding: 0.25rem 0.5rem;
                        border-radius: 6px;
                        font-size: 0.75rem;
                        font-weight: 600;
                      `}
                    >
                      Best Price
                    </span>
                  )}
                </div>
                {selectedRoute?.quote.dexName === route.quote.dexName && (
                  <Check size={20} color="#dcfd8f" weight="bold" />
                )}
              </div>

              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                `}
              >
                <div>
                  <div
                    css={css`
                      font-size: 1.125rem;
                      font-weight: 600;
                      color: #ffffff;
                    `}
                  >
                    {route.quote.outputAmount} {route.quote.outputToken.symbol}
                  </div>
                  <div
                    css={css`
                      font-size: 0.75rem;
                      color: #a0a0a0;
                      margin-top: 0.25rem;
                    `}
                  >
                    Fee: {route.quote.fee}% • Gas: ~{route.quote.estimatedGas} HBAR
                  </div>
                </div>
                {!route.isBestPrice && route.savingsVsBest && (
                  <div
                    css={css`
                      font-size: 0.875rem;
                      color: #ff4d4d;
                    `}
                  >
                    -{route.savingsVsBest}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default RouteSelector;
