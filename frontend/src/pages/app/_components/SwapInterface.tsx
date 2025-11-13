import { css } from "@emotion/react";
import { useState, useEffect } from "react";
import { ArrowsDownUp, GearSix, Info, CaretDown } from "@phosphor-icons/react";
import { useDexAggregator } from "@/hooks/useDexAggregator";
import { useSwapExecution } from "@/hooks/useSwapExecution";
import { useWallet } from "@/contexts/WalletContext";
import RouteSelector from "./swap/RouteSelector";
import TokenSelector from "./swap/TokenSelector";
import { SwapRoute, HederaToken } from "@/services/dex/types";
import { ethers } from "ethers";

// Hedera native tokens for Market swap
const tokens = [
  { symbol: "HBAR", name: "Hedera", logo: "ℏ" },
  { symbol: "USDC", name: "USD Coin", logo: "💵" },
  { symbol: "USDT", name: "Tether", logo: "₮" },
  { symbol: "SAUCE", name: "SaucerSwap", logo: "🍯" },
  { symbol: "PACK", name: "HashPack", logo: "📦" },
];

// Prism stablecoins for Currency swap
const currencies = [
  { symbol: "pUSD", name: "Prism USD", apy: "12.5%" },
  { symbol: "pEUR", name: "Prism EUR", apy: "11.8%" },
  { symbol: "pGBP", name: "Prism GBP", apy: "13.2%" },
  { symbol: "pJPY", name: "Prism JPY", apy: "10.5%" },
  { symbol: "pHKD", name: "Prism HKD", apy: "12.0%" },
  { symbol: "pAED", name: "Prism AED", apy: "11.5%" },
];

// Helper functions for token balance
function toEvmAddress(tokenId: string): string {
  const parts = tokenId.split('.');
  const num = parseInt(parts[parts.length - 1]);
  return num.toString(16).padStart(40, '0');
}

async function getTokenBalance(
  provider: any,
  address: string,
  tokenId: string,
  decimals: number
): Promise<string> {
  try {
    const tokenAddress = '0x' + toEvmAddress(tokenId);
    const abi = ['function balanceOf(address owner) view returns (uint256)'];
    const tokenContract = new ethers.Contract(tokenAddress, abi, provider);
    const balance = await tokenContract.balanceOf(address);
    const balanceFormatted = ethers.formatUnits(balance, decimals);
    return parseFloat(balanceFormatted).toFixed(2);
  } catch (error) {
    console.error(`Error fetching balance for ${tokenId}:`, error);
    return '0.00';
  }
}

const SwapInterface = () => {
  const [swapMode, setSwapMode] = useState<"market" | "currency">("market");

  // Wallet context
  const { connection } = useWallet();

  // DEX Aggregator hook
  const { tokens: hederaTokens, routes, getQuotes, isLoadingRoutes } = useDexAggregator();
  const [selectedRoute, setSelectedRoute] = useState<SwapRoute | null>(null);
  const [showRoutes, setShowRoutes] = useState(false);
  const [autoRoute, setAutoRoute] = useState(true);

  // Swap execution hook
  const { isExecuting, error: swapError, txHash, executeSwap, reset: resetSwap } = useSwapExecution();
  const [slippage, setSlippage] = useState(2.0); // 2% default slippage for testnet volatility

  // Token selector state
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
  const [showToTokenSelector, setShowToTokenSelector] = useState(false);

  // Market mode state (token swap with DEX aggregator)
  const [fromToken, setFromToken] = useState<HederaToken | null>(null);
  const [toToken, setToToken] = useState<HederaToken | null>(null);
  const [fromTokenAmount, setFromTokenAmount] = useState("");
  const [toTokenAmount, setToTokenAmount] = useState("");

  // Wallet balance state
  const [fromBalance, setFromBalance] = useState<string>("0.00");
  const [toBalance, setToBalance] = useState<string>("0.00");

  // Set default tokens when loaded
  useEffect(() => {
    if (hederaTokens.length > 0 && !fromToken) {
      setFromToken(hederaTokens.find(t => t.symbol === 'HBAR') || hederaTokens[0]);
      setToToken(hederaTokens.find(t => t.symbol === 'USDC') || hederaTokens[1]);
    }
  }, [hederaTokens, fromToken]);

  // Fetch wallet balances using existing wallet connection
  useEffect(() => {
    const fetchBalances = async () => {
      if (!connection) {
        setFromBalance("0.00");
        setToBalance("0.00");
        return;
      }

      try {
        const accountId = connection.account.accountId;
        const network = connection.network || 'testnet';
        const mirrorNodeUrl = network === 'mainnet'
          ? 'https://mainnet-public.mirrornode.hedera.com'
          : 'https://testnet.mirrornode.hedera.com';

        // Fetch from token balance
        if (fromToken?.tokenId === 'HBAR') {
          // Fetch HBAR balance from Mirror Node
          const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}`);
          if (response.ok) {
            const data = await response.json();
            const hbarBalance = (data.balance.balance / 1e8).toFixed(2);
            setFromBalance(hbarBalance);
          }
        } else if (fromToken) {
          // Fetch HTS token balance from Mirror Node
          const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}/tokens?token.id=${fromToken.tokenId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.tokens && data.tokens.length > 0) {
              const tokenBalance = (data.tokens[0].balance / Math.pow(10, fromToken.decimals)).toFixed(2);
              setFromBalance(tokenBalance);
            } else {
              setFromBalance("0.00");
            }
          }
        }

        // Fetch to token balance
        if (toToken?.tokenId === 'HBAR') {
          // Fetch HBAR balance from Mirror Node
          const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}`);
          if (response.ok) {
            const data = await response.json();
            const hbarBalance = (data.balance.balance / 1e8).toFixed(2);
            setToBalance(hbarBalance);
          }
        } else if (toToken) {
          // Fetch HTS token balance from Mirror Node
          const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}/tokens?token.id=${toToken.tokenId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.tokens && data.tokens.length > 0) {
              const tokenBalance = (data.tokens[0].balance / Math.pow(10, toToken.decimals)).toFixed(2);
              setToBalance(tokenBalance);
            } else {
              setToBalance("0.00");
            }
          }
        }
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    };

    fetchBalances();

    // Refresh balances every 10 seconds
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [connection, fromToken, toToken]);

  // Currency mode state (stablecoin swap)
  const [fromCurrency, setFromCurrency] = useState(currencies[0]);
  const [toCurrency, setToCurrency] = useState(currencies[1]);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");

  // Fetch quotes when amount changes in Market mode
  useEffect(() => {
    if (swapMode === "market" && fromToken && toToken && fromTokenAmount && parseFloat(fromTokenAmount) > 0) {
      const timer = setTimeout(() => {
        getQuotes(fromToken.tokenId, toToken.tokenId, fromTokenAmount, autoRoute);
      }, 500); // Debounce for 500ms

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapMode, fromToken, toToken, fromTokenAmount, autoRoute]);

  // Auto-select best route
  useEffect(() => {
    if (routes.length > 0 && autoRoute) {
      setSelectedRoute(routes[0]); // Best route
      setToTokenAmount(routes[0].quote.outputAmount);
    }
  }, [routes, autoRoute]);

  const handleSwapDirection = () => {
    if (swapMode === "market") {
      const tempToken = fromToken;
      setFromToken(toToken);
      setToToken(tempToken);
      setFromTokenAmount(toTokenAmount);
      setToTokenAmount(fromTokenAmount);
    } else {
      setFromCurrency(toCurrency);
      setToCurrency(fromCurrency);
      setFromAmount(toAmount);
      setToAmount(fromAmount);
    }
  };

  // Get current from/to based on mode
  const currentFrom = swapMode === "market" ? fromToken : fromCurrency;
  const currentTo = swapMode === "market" ? toToken : toCurrency;
  const currentFromAmount = swapMode === "market" ? fromTokenAmount : fromAmount;
  const currentToAmount = swapMode === "market" ? toTokenAmount : toAmount;

  const setCurrentFromAmount = swapMode === "market" ? setFromTokenAmount : setFromAmount;
  const setCurrentToAmount = swapMode === "market" ? setToTokenAmount : setToAmount;

  // Get symbol safely
  const getSymbol = (item: any) => {
    if (!item) return '...';
    return item.symbol || '...';
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
              Balance: {fromBalance}
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
              value={currentFromAmount}
              onChange={(e) => setCurrentFromAmount(e.target.value)}
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
              onClick={() => swapMode === "market" && setShowFromTokenSelector(true)}
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
              <span>{getSymbol(currentFrom)}</span>
              <CaretDown size={16} />
            </button>
          </div>

          {swapMode === "currency" && 'apy' in currentFrom && (
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
                Earning {currentFrom.apy} APY
              </span>
            </div>
          )}
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
              Balance: {toBalance}
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
              value={currentToAmount}
              onChange={(e) => setCurrentToAmount(e.target.value)}
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
              onClick={() => swapMode === "market" && setShowToTokenSelector(true)}
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
              <span>{getSymbol(currentTo)}</span>
              <CaretDown size={16} />
            </button>
          </div>

          {swapMode === "currency" && 'apy' in currentTo && (
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
                Earning {currentTo.apy} APY
              </span>
            </div>
          )}
        </div>

        {/* Route Selector (Market mode only) */}
        {swapMode === "market" && routes.length > 0 && (
          <button
            onClick={() => setShowRoutes(true)}
            css={css`
              width: 100%;
              padding: 1rem;
              background: rgba(0, 0, 0, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 12px;
              margin-bottom: 1rem;
              cursor: pointer;
              transition: all 0.2s;

              &:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(220, 253, 143, 0.3);
              }
            `}
          >
            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}
            >
              <div
                css={css`
                  text-align: left;
                `}
              >
                <div
                  css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                    margin-bottom: 0.25rem;
                  `}
                >
                  Route via
                </div>
                <div
                  css={css`
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                  `}
                >
                  {selectedRoute?.quote.dexName || 'Select Route'}
                  {selectedRoute?.isBestPrice && (
                    <span
                      css={css`
                        background: rgba(220, 253, 143, 0.2);
                        color: #dcfd8f;
                        padding: 0.125rem 0.375rem;
                        border-radius: 4px;
                        font-size: 0.625rem;
                        font-weight: 600;
                      `}
                    >
                      BEST
                    </span>
                  )}
                </div>
              </div>
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
                    color: #a0a0a0;
                  `}
                >
                  {routes.length} routes
                </span>
                <CaretDown size={16} color="#a0a0a0" />
              </div>
            </div>
          </button>
        )}

        {/* Swap Button */}
        <button
          onClick={async () => {
            if (swapMode === "market" && selectedRoute) {
              try {
                await executeSwap(selectedRoute.quote, slippage);
                alert(`✅ Swap successful! Transaction: ${txHash}`);
                // Reset form
                setFromTokenAmount("");
                setToTokenAmount("");
              } catch (error: any) {
                alert(`❌ Swap failed: ${error.message}`);
              }
            }
          }}
          css={css`
            width: 100%;
            padding: 1.125rem;
            background: ${isExecuting
              ? 'linear-gradient(135deg, #808080 0%, #606060 100%)'
              : 'linear-gradient(135deg, #dcfd8f 0%, #a8e063 100%)'};
            border: none;
            border-radius: 16px;
            color: #02302c;
            font-size: 1.125rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;

            &:hover {
              transform: ${isExecuting ? 'none' : 'translateY(-2px)'};
              box-shadow: ${isExecuting ? 'none' : '0 12px 24px rgba(220, 253, 143, 0.3)'};
            }

            &:disabled {
              opacity: 0.5;
              cursor: not-allowed;
              transform: none;
            }
          `}
          disabled={
            isExecuting ||
            !currentFromAmount ||
            parseFloat(currentFromAmount) <= 0 ||
            (swapMode === "market" && (isLoadingRoutes || !selectedRoute))
          }
        >
          {isExecuting
            ? "⏳ Swapping..."
            : isLoadingRoutes && swapMode === "market"
              ? "Finding best route..."
              : !currentFromAmount || parseFloat(currentFromAmount) <= 0
                ? "Enter an amount"
                : swapMode === "market" && !selectedRoute
                  ? "No route available"
                  : swapMode === "market" ? "Swap Tokens" : "Swap Currency"}
        </button>

        {/* Swap Error */}
        {swapError && (
          <div
            css={css`
              padding: 0.75rem;
              background: rgba(255, 77, 77, 0.1);
              border: 1px solid rgba(255, 77, 77, 0.3);
              border-radius: 12px;
              color: #ff4d4d;
              font-size: 0.875rem;
              margin-top: 0.5rem;
            `}
          >
            ❌ {swapError}
          </div>
        )}

        {/* Swap Success */}
        {txHash && (
          <div
            css={css`
              padding: 0.75rem;
              background: rgba(220, 253, 143, 0.1);
              border: 1px solid rgba(220, 253, 143, 0.3);
              border-radius: 12px;
              color: #dcfd8f;
              font-size: 0.875rem;
              margin-top: 0.5rem;
            `}
          >
            ✅ Swap successful!
            <a
              href={`https://hashscan.io/testnet/transaction/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              css={css`
                color: #dcfd8f;
                text-decoration: underline;
                margin-left: 0.5rem;
              `}
            >
              View on HashScan
            </a>
          </div>
        )}
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
            border-radius: 14px;
            padding: 0.875rem 1rem;
          `}
        >
          <div
            css={css`
              font-size: 0.8125rem;
              color: #909090;
              margin-bottom: 0.375rem;
            `}
          >
            Exchange Rate
          </div>
          <div
            css={css`
              font-size: 0.9375rem;
              font-weight: 600;
              color: #fff;
            `}
          >
            1 {getSymbol(currentFrom)} = {swapMode === "market" && selectedRoute
              ? selectedRoute.quote.exchangeRate.toFixed(4)
              : swapMode === "market" ? "1.02" : "0.92"} {getSymbol(currentTo)}
          </div>
        </div>

        <div
          css={css`
            background: rgba(12, 13, 16, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 14px;
            padding: 0.875rem 1rem;
          `}
        >
          <div
            css={css`
              font-size: 0.8125rem;
              color: #909090;
              margin-bottom: 0.375rem;
            `}
          >
            Fee
          </div>
          <div
            css={css`
              font-size: 0.9375rem;
              font-weight: 600;
              color: #fff;
            `}
          >
            {swapMode === "market" && selectedRoute
              ? `${selectedRoute.quote.fee}%`
              : "0.3%"}
          </div>
        </div>
      </div>

      {/* Route Selector Modal */}
      <RouteSelector
        routes={routes}
        selectedRoute={selectedRoute}
        onSelectRoute={(route) => {
          setSelectedRoute(route);
          setToTokenAmount(route.quote.outputAmount);
        }}
        isOpen={showRoutes}
        onClose={() => setShowRoutes(false)}
      />

      {/* Token Selector Modals */}
      <TokenSelector
        tokens={hederaTokens}
        selectedToken={fromToken}
        onSelectToken={(token) => {
          setFromToken(token);
          setShowFromTokenSelector(false);
        }}
        isOpen={showFromTokenSelector}
        onClose={() => setShowFromTokenSelector(false)}
      />

      <TokenSelector
        tokens={hederaTokens}
        selectedToken={toToken}
        onSelectToken={(token) => {
          setToToken(token);
          setShowToTokenSelector(false);
        }}
        isOpen={showToTokenSelector}
        onClose={() => setShowToTokenSelector(false)}
      />
    </div>
  );
};

export default SwapInterface;
