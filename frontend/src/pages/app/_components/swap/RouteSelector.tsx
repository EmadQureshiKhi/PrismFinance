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
          max-width: 420px;
          background: #0c0d10;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 1rem;
          z-index: 1000;
          max-height: 70vh;
          overflow-y: auto;
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
          <h3
            css={css`
              font-size: 1rem;
              font-weight: 600;
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
              font-size: 1.25rem;
              cursor: pointer;
              padding: 0;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
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
            gap: 0.5rem;
          `}
        >
          {routes.map((route, index) => {
            // Create unique key from route path
            const routeKey = `${route.quote.dexName}-${route.quote.route.join('-')}`;
            const isSelected = selectedRoute && 
              selectedRoute.quote.dexName === route.quote.dexName &&
              selectedRoute.quote.route.join('-') === route.quote.route.join('-');
            
            // Format route path for display
            const routePath = route.quote.route
              .map(tokenId => {
                if (tokenId === 'HBAR') return 'HBAR';
                const symbol = tokenId.split('.').pop();
                // Map known token IDs to symbols
                if (tokenId === '0.0.15058') return 'WHBAR';
                if (tokenId === '0.0.5449') return 'USDC';
                if (tokenId === '0.0.1183558') return 'SAUCE';
                return symbol;
              })
              .join(' → ');

            return (
              <button
                key={routeKey}
                onClick={() => {
                  onSelectRoute(route);
                  onClose();
                }}
                css={css`
                  background: ${isSelected
                    ? 'rgba(220, 253, 143, 0.08)'
                    : 'rgba(0, 0, 0, 0.3)'};
                  border: 1px solid ${isSelected
                    ? '#dcfd8f'
                    : 'rgba(255, 255, 255, 0.08)'};
                  border-radius: 12px;
                  padding: 0.75rem;
                  cursor: pointer;
                  transition: all 0.15s;
                  text-align: left;

                  &:hover {
                    background: rgba(220, 253, 143, 0.05);
                    border-color: rgba(220, 253, 143, 0.3);
                  }
                `}
              >
                {/* Header Row */}
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
                        font-size: 0.875rem;
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
                          padding: 0.125rem 0.375rem;
                          border-radius: 4px;
                          font-size: 0.625rem;
                          font-weight: 600;
                          text-transform: uppercase;
                        `}
                      >
                        Best
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check size={16} color="#dcfd8f" weight="bold" />
                  )}
                </div>

                {/* Output Amount */}
                <div
                  css={css`
                    font-size: 1rem;
                    font-weight: 600;
                    color: #ffffff;
                    margin-bottom: 0.375rem;
                  `}
                >
                  {parseFloat(route.quote.outputAmount).toFixed(4)} {route.quote.outputToken.symbol}
                  {!route.isBestPrice && route.savingsVsBest && (
                    <span
                      css={css`
                        font-size: 0.75rem;
                        color: #ff6b6b;
                        margin-left: 0.5rem;
                      `}
                    >
                      (-{route.savingsVsBest})
                    </span>
                  )}
                </div>

                {/* Route Path & Details */}
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  `}
                >
                  <div
                    css={css`
                      font-size: 0.75rem;
                      color: #808080;
                    `}
                  >
                    {routePath}
                  </div>
                  <div
                    css={css`
                      font-size: 0.625rem;
                      color: #606060;
                      text-align: right;
                    `}
                  >
                    {route.quote.fee}% fee
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default RouteSelector;
