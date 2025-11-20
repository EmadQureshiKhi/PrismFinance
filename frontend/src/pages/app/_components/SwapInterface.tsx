import { css } from "@emotion/react";
import { useState, useEffect } from "react";
import { ArrowsDownUp, GearSix, Info, CaretDown, CircleNotch, Plus, Minus, TrendUp } from "@phosphor-icons/react";
import { useDexAggregator } from "@/hooks/useDexAggregator";
import { useSwapExecution } from "@/hooks/useSwapExecution";
import { useFxSwap } from "@/hooks/useFxSwap";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/contexts/ToastContext";
import { usePoolData } from "@/hooks/usePoolData";
import { useLiquidity } from "@/hooks/useLiquidity";
import RouteSelector from "./swap/RouteSelector";
import TokenSelector from "./swap/TokenSelector";
import CurrencySelector from "./swap/CurrencySelector";
import { SwapRoute, HederaToken } from "@/services/dex/types";
import { ethers } from "ethers";
import React from "react";

// Import currency logos for the main interface
import HBARLogo from "@/assets/svgs/hedera/hedera-hashgraph-hbar-seeklogo.svg";
import pUSDLogo from "@/assets/RWA/pUSD.png";
import pEURLogo from "@/assets/RWA/pEUR.png";
import pGBPLogo from "@/assets/RWA/pGBP.png";
import pJPYLogo from "@/assets/RWA/PJPY.png";
import pHKDLogo from "@/assets/RWA/pHKD.png";
import pAEDLogo from "@/assets/RWA/pAED.png";

// Hedera native tokens for Market swap
const tokens = [
  { symbol: "HBAR", name: "Hedera", logo: "ℏ" },
  { symbol: "USDC", name: "USD Coin", logo: "💵" },
  { symbol: "USDT", name: "Tether", logo: "₮" },
  { symbol: "SAUCE", name: "SaucerSwap", logo: "🍯" },
  { symbol: "PACK", name: "HashPack", logo: "📦" },
];

// Prism stablecoins for Currency swap - will be loaded from FxSwap hook
// const currencies = [
//   { symbol: "pUSD", name: "Prism USD", apy: "12.5%" },
//   { symbol: "pEUR", name: "Prism EUR", apy: "11.8%" },
//   { symbol: "pGBP", name: "Prism GBP", apy: "13.2%" },
//   { symbol: "pJPY", name: "Prism JPY", apy: "10.5%" },
//   { symbol: "pHKD", name: "Prism HKD", apy: "12.0%" },
//   { symbol: "pAED", name: "Prism AED", apy: "11.5%" },
// ];

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

  // DEX Aggregator hook (for Market mode)
  const { tokens: hederaTokens, routes, getQuotes, isLoadingRoutes } = useDexAggregator();
  const [selectedRoute, setSelectedRoute] = useState<SwapRoute | null>(null);
  const [showRoutes, setShowRoutes] = useState(false);
  const [autoRoute, setAutoRoute] = useState(true);

  // FxSwap hook (for Currency mode)
  const {
    currencies: fxCurrencies,
    pools: fxPools,
    isLoading: isFxLoading,
    isExecuting: isFxExecuting,
    getExchangeRate: getFxRate,
    calculateSwapOutput: calculateFxOutput,
    executeSwap: executeFxSwap,
    needsMultiHop,
    getMultiHopRoute,
  } = useFxSwap();

  // Swap execution hook (for Market mode)
  const { isExecuting: isMarketExecuting, error: swapError, txHash, executeSwap, reset: resetSwap } = useSwapExecution();
  const [slippage, setSlippage] = useState(0.5); // 0.5% default slippage
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [priceImpact, setPriceImpact] = useState<number>(0);

  // Toast notifications
  const { showSuccess, showError } = useToast();

  // Pool data hook
  const { pools: poolData, isLoading: isLoadingPools, isFetchingFresh, lastUpdated, refetch: refetchPools } = usePoolData();

  // Liquidity hook
  const {
    isExecuting: isExecutingLiquidity,
    addLiquidity: executeAddLiquidity,
    removeLiquidity: executeRemoveLiquidity,
    calculateExpectedLP,
    calculateRemoveAmounts,
    calculateCorrectAmountB,
  } = useLiquidity();

  // Add Liquidity state
  const [selectedPoolForLiquidity, setSelectedPoolForLiquidity] = useState<string | null>(null);
  const [liquidityAmountA, setLiquidityAmountA] = useState("");
  const [liquidityAmountB, setLiquidityAmountB] = useState("");
  const [expectedLP, setExpectedLP] = useState("");

  // Remove Liquidity state
  const [showRemoveLiquidity, setShowRemoveLiquidity] = useState(false);
  const [selectedPoolForRemoval, setSelectedPoolForRemoval] = useState<string | null>(null);
  const [removeAmount, setRemoveAmount] = useState("");
  const [expectedRemoveA, setExpectedRemoveA] = useState("");
  const [expectedRemoveB, setExpectedRemoveB] = useState("");

  // Token selector state
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
  const [showToTokenSelector, setShowToTokenSelector] = useState(false);

  // Currency selector state
  const [showFromCurrencySelector, setShowFromCurrencySelector] = useState(false);
  const [showToCurrencySelector, setShowToCurrencySelector] = useState(false);

  // Market mode state (token swap with DEX aggregator)
  const [fromToken, setFromToken] = useState<HederaToken | null>(null);
  const [toToken, setToToken] = useState<HederaToken | null>(null);
  const [fromTokenAmount, setFromTokenAmount] = useState("");
  const [toTokenAmount, setToTokenAmount] = useState("");

  // Wallet balance state
  const [fromBalance, setFromBalance] = useState<string>("0.00");
  const [toBalance, setToBalance] = useState<string>("0.00");
  const [fromCurrencyBalance, setFromCurrencyBalance] = useState<string>("0.00");
  const [toCurrencyBalance, setToCurrencyBalance] = useState<string>("0.00");

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
  const [fromCurrency, setFromCurrency] = useState<any>(null);
  const [toCurrency, setToCurrency] = useState<any>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");

  // Set default currencies when loaded
  useEffect(() => {
    if (fxCurrencies.length > 0 && !fromCurrency) {
      setFromCurrency(fxCurrencies.find(c => c.symbol === 'HBAR') || fxCurrencies[0]);
      setToCurrency(fxCurrencies.find(c => c.symbol === 'pUSD') || fxCurrencies[1]);
    }
  }, [fxCurrencies, fromCurrency]);

  // Fetch currency balances (for FxSwap mode)
  useEffect(() => {
    const fetchCurrencyBalances = async () => {
      if (!connection || swapMode !== 'currency') {
        setFromCurrencyBalance("0.00");
        setToCurrencyBalance("0.00");
        return;
      }

      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        // Fetch from currency balance
        if (fromCurrency) {
          if (fromCurrency.symbol === 'HBAR') {
            // Get HBAR balance (18 decimals from JSON-RPC Relay)
            const balance = await provider.getBalance(address);
            const balanceFormatted = ethers.formatEther(balance);
            setFromCurrencyBalance(parseFloat(balanceFormatted).toFixed(2));
          } else {
            // Get HTS token balance (8 decimals)
            const balance = await getTokenBalance(provider, address, fromCurrency.tokenId, 8);
            setFromCurrencyBalance(balance);
          }
        }

        // Fetch to currency balance
        if (toCurrency) {
          if (toCurrency.symbol === 'HBAR') {
            // Get HBAR balance (18 decimals from JSON-RPC Relay)
            const balance = await provider.getBalance(address);
            const balanceFormatted = ethers.formatEther(balance);
            setToCurrencyBalance(parseFloat(balanceFormatted).toFixed(2));
          } else {
            // Get HTS token balance (8 decimals)
            const balance = await getTokenBalance(provider, address, toCurrency.tokenId, 8);
            setToCurrencyBalance(balance);
          }
        }
      } catch (error) {
        console.error('Error fetching currency balances:', error);
      }
    };

    fetchCurrencyBalances();

    // Refresh balances every 10 seconds
    const interval = setInterval(fetchCurrencyBalances, 10000);
    return () => clearInterval(interval);
  }, [connection, fromCurrency, toCurrency, swapMode]);

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

  // Calculate output for Currency mode and price impact
  useEffect(() => {
    if (swapMode === "currency" && fromCurrency && toCurrency && fromAmount && parseFloat(fromAmount) > 0) {
      const output = calculateFxOutput(fromCurrency.symbol, toCurrency.symbol, fromAmount);
      setToAmount(output);

      // Calculate price impact (simplified: amountIn / reserve)
      // This is an approximation - actual impact depends on virtual reserves
      const impact = (parseFloat(fromAmount) / 1000) * 100; // Assuming ~1000 tokens in pool
      setPriceImpact(Math.min(impact, 100));
    } else if (swapMode === "currency") {
      setToAmount("");
      setPriceImpact(0);
    }
  }, [swapMode, fromCurrency, toCurrency, fromAmount, calculateFxOutput]);

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

  // Get currency logo
  const getCurrencyLogo = (symbol: string): string => {
    const logoMap: { [key: string]: string } = {
      'HBAR': HBARLogo,
      'pUSD': pUSDLogo,
      'pEUR': pEURLogo,
      'pGBP': pGBPLogo,
      'pJPY': pJPYLogo,
      'pHKD': pHKDLogo,
      'pAED': pAEDLogo,
    };
    
    return logoMap[symbol] || '';
  };

  // Auto-calculate amountB and expected LP when adding liquidity
  useEffect(() => {
    if (selectedPoolForLiquidity && liquidityAmountA && parseFloat(liquidityAmountA) > 0) {
      const pool = poolData.find(p => p.pair === selectedPoolForLiquidity);
      if (pool && pool.poolAddress) {
        // Use the hook's calculateCorrectAmountB which uses BigInt sqrt (same as contract)
        calculateCorrectAmountB(selectedPoolForLiquidity, liquidityAmountA).then(calculatedB => {
          setLiquidityAmountB(calculatedB);

          // Calculate expected LP tokens
          calculateExpectedLP(pool.poolAddress, liquidityAmountA, calculatedB).then(lp => {
            setExpectedLP(lp);
          });
        });
      }
    } else {
      // Reset when input is cleared or invalid
      setLiquidityAmountB("");
      setExpectedLP("");
    }
  }, [liquidityAmountA, selectedPoolForLiquidity, poolData, calculateExpectedLP, calculateCorrectAmountB]);

  // Calculate expected amounts when removing liquidity
  useEffect(() => {
    if (selectedPoolForRemoval && removeAmount && parseFloat(removeAmount) > 0) {
      const pool = poolData.find(p => p.pair === selectedPoolForRemoval);
      if (pool && pool.poolAddress) {
        calculateRemoveAmounts(pool.poolAddress, removeAmount).then(amounts => {
          setExpectedRemoveA(amounts.amountA);
          setExpectedRemoveB(amounts.amountB);
        });
      }
    }
  }, [removeAmount, selectedPoolForRemoval, poolData, calculateRemoveAmounts]);

  return (
    <div>
      {/* Swap Card - Centered and Narrow */}
      <div
        css={css`
          max-width: 480px;
          margin: 0 auto 3rem;
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
          {/* Header with Settings */}
          <div
            css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          `}
          >
            <h2
              css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: #ffffff;
            `}
            >
              Swap
            </h2>
            <button
              onClick={() => setShowSlippageSettings(!showSlippageSettings)}
              css={css`
              padding: 0.5rem;
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;

              &:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(220, 253, 143, 0.3);
              }
            `}
            >
              <GearSix size={20} color="#a0a0a0" />
            </button>
          </div>

          {/* Slippage Settings */}
          {showSlippageSettings && (
            <div
              css={css`
              background: rgba(0, 0, 0, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 12px;
              padding: 1rem;
              margin-bottom: 1rem;
            `}
            >
              <div
                css={css`
                font-size: 0.875rem;
                font-weight: 600;
                color: #ffffff;
                margin-bottom: 0.75rem;
              `}
              >
                Slippage Tolerance
              </div>
              <div
                css={css`
                display: flex;
                gap: 0.5rem;
              `}
              >
                {[0.5, 1, 2, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    css={css`
                    flex: 1;
                    padding: 0.5rem;
                    background: ${slippage === value ? 'rgba(220, 253, 143, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
                    border: 1px solid ${slippage === value ? '#dcfd8f' : 'rgba(255, 255, 255, 0.1)'};
                    border-radius: 8px;
                    color: ${slippage === value ? '#dcfd8f' : '#a0a0a0'};
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;

                    &:hover {
                      background: rgba(220, 253, 143, 0.1);
                      border-color: rgba(220, 253, 143, 0.3);
                    }
                  `}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>
          )}

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
                  Balance: {swapMode === 'market' ? fromBalance : fromCurrencyBalance}
                </span>
                <button
                  onClick={() => {
                    const balance = swapMode === 'market' ? fromBalance : fromCurrencyBalance;
                    setCurrentFromAmount(balance);
                  }}
                  css={css`
                  padding: 0.25rem 0.5rem;
                  background: rgba(220, 253, 143, 0.1);
                  border: 1px solid rgba(220, 253, 143, 0.3);
                  border-radius: 6px;
                  color: #dcfd8f;
                  font-size: 0.75rem;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover {
                    background: rgba(220, 253, 143, 0.2);
                  }
                `}
                >
                  MAX
                </button>
              </div>
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
                onClick={() => {
                  if (swapMode === "market") {
                    setShowFromTokenSelector(true);
                  } else {
                    setShowFromCurrencySelector(true);
                  }
                }}
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
                {swapMode === "currency" && currentFrom && getCurrencyLogo(getSymbol(currentFrom)) && (
                  <img
                    src={getCurrencyLogo(getSymbol(currentFrom))}
                    alt={getSymbol(currentFrom)}
                    css={css`
                      width: 24px;
                      height: 24px;
                      object-fit: contain;
                      border-radius: 6px;
                    `}
                  />
                )}
                <span>{getSymbol(currentFrom)}</span>
                <CaretDown size={16} />
              </button>
            </div>

            {swapMode === "currency" && currentFrom && (
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
                  {currentFrom.name || 'Prism Currency'}
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
                Balance: {swapMode === 'market' ? toBalance : toCurrencyBalance}
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
                onClick={() => {
                  if (swapMode === "market") {
                    setShowToTokenSelector(true);
                  } else {
                    setShowToCurrencySelector(true);
                  }
                }}
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
                {swapMode === "currency" && currentTo && getCurrencyLogo(getSymbol(currentTo)) && (
                  <img
                    src={getCurrencyLogo(getSymbol(currentTo))}
                    alt={getSymbol(currentTo)}
                    css={css`
                      width: 24px;
                      height: 24px;
                      object-fit: contain;
                      border-radius: 6px;
                    `}
                  />
                )}
                <span>{getSymbol(currentTo)}</span>
                <CaretDown size={16} />
              </button>
            </div>

            {swapMode === "currency" && currentTo && (
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
                  {currentTo.name || 'Prism Currency'}
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

          {/* Route Display (Currency mode) */}
          {swapMode === "currency" && fromCurrency && toCurrency && (
            <div
              css={css`
              width: 100%;
              padding: 1rem;
              background: rgba(0, 0, 0, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 12px;
              margin-bottom: 1rem;
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
                    {needsMultiHop(fromCurrency.symbol, toCurrency.symbol) ? 'Multi-hop Route' : 'Direct Swap'}
                  </div>
                  <div
                    css={css`
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                  `}
                  >
                    {needsMultiHop(fromCurrency.symbol, toCurrency.symbol) ? (
                      <>
                        <span>{fromCurrency.symbol}</span>
                        <span css={css` color: #dcfd8f; font-size: 0.875rem; `}>→</span>
                        <span css={css` color: #a0a0a0; font-size: 0.875rem; `}>pUSD</span>
                        <span css={css` color: #dcfd8f; font-size: 0.875rem; `}>→</span>
                        <span>{toCurrency.symbol}</span>
                      </>
                    ) : (
                      <>
                        <span>{fromCurrency.symbol}</span>
                        <span css={css` color: #dcfd8f; font-size: 0.875rem; `}>→</span>
                        <span>{toCurrency.symbol}</span>
                      </>
                    )}
                  </div>
                </div>
                <div
                  css={css`
                  text-align: right;
                `}
                >
                  <div
                    css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                    margin-bottom: 0.25rem;
                  `}
                  >
                    Rate
                  </div>
                  <div
                    css={css`
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #dcfd8f;
                  `}
                  >
                    1 {fromCurrency.symbol} = {getFxRate(fromCurrency.symbol, toCurrency.symbol).toFixed(6)} {toCurrency.symbol}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Price Impact Warning */}
          {swapMode === "currency" && priceImpact > 0 && (
            <div
              css={css`
              padding: 0.75rem 1rem;
              background: ${priceImpact > 5 ? 'rgba(255, 77, 77, 0.1)' : priceImpact > 1 ? 'rgba(255, 165, 0, 0.1)' : 'rgba(220, 253, 143, 0.1)'};
              border: 1px solid ${priceImpact > 5 ? 'rgba(255, 77, 77, 0.3)' : priceImpact > 1 ? 'rgba(255, 165, 0, 0.3)' : 'rgba(220, 253, 143, 0.3)'};
              border-radius: 12px;
              margin-bottom: 1rem;
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
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                `}
                >
                  <Info size={16} color={priceImpact > 5 ? '#ff4d4d' : priceImpact > 1 ? '#ffa500' : '#dcfd8f'} />
                  <span
                    css={css`
                    font-size: 0.875rem;
                    color: ${priceImpact > 5 ? '#ff4d4d' : priceImpact > 1 ? '#ffa500' : '#dcfd8f'};
                    font-weight: 600;
                  `}
                  >
                    Price Impact
                  </span>
                </div>
                <span
                  css={css`
                  font-size: 0.875rem;
                  font-weight: 700;
                  color: ${priceImpact > 5 ? '#ff4d4d' : priceImpact > 1 ? '#ffa500' : '#dcfd8f'};
                `}
                >
                  ~{priceImpact.toFixed(2)}%
                </span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={async () => {
              if (swapMode === "market" && selectedRoute) {
                try {
                  await executeSwap(selectedRoute.quote, slippage);
                  showSuccess(
                    'Swap Successful!',
                    `Swapped ${fromTokenAmount} ${fromToken?.symbol} for ${toTokenAmount} ${toToken?.symbol}`,
                    txHash
                  );
                  // Reset form
                  setFromTokenAmount("");
                  setToTokenAmount("");
                } catch (error: any) {
                  showError(
                    'Swap Failed',
                    error.message || 'An error occurred during the swap'
                  );
                }
              } else if (swapMode === "currency" && fromCurrency && toCurrency && fromAmount) {
                try {
                  // Calculate minimum output with slippage
                  const minOutput = (parseFloat(toAmount) * (1 - slippage / 100)).toFixed(6);

                  const txHash = await executeFxSwap(
                    fromCurrency,
                    toCurrency,
                    fromAmount,
                    minOutput
                  );

                  showSuccess(
                    'Currency Swap Successful!',
                    `Swapped ${fromAmount} ${fromCurrency.symbol} for ${toAmount} ${toCurrency.symbol}`,
                    txHash
                  );
                  // Reset form
                  setFromAmount("");
                  setToAmount("");
                } catch (error: any) {
                  showError(
                    'Currency Swap Failed',
                    error.message || 'An error occurred during the currency swap'
                  );
                }
              }
            }}
            css={css`
            width: 100%;
            padding: 1.125rem;
            background: ${(swapMode === "market" ? isMarketExecuting : isFxExecuting)
                ? 'linear-gradient(135deg, #808080 0%, #606060 100%)'
                : 'linear-gradient(135deg, #dcfd8f 0%, #a8e063 100%)'};
            border: none;
            border-radius: 16px;
            color: #02302c;
            font-size: 1.125rem;
            font-weight: 700;
            cursor: ${(swapMode === "market" ? isMarketExecuting : isFxExecuting) ? 'not-allowed' : 'pointer'};
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;

            &:hover {
              transform: ${(swapMode === "market" ? isMarketExecuting : isFxExecuting) ? 'none' : 'translateY(-2px)'};
              box-shadow: ${(swapMode === "market" ? isMarketExecuting : isFxExecuting) ? 'none' : '0 12px 24px rgba(220, 253, 143, 0.3)'};
            }

            &:disabled {
              opacity: 0.5;
              cursor: not-allowed;
              transform: none;
            }
          `}
            disabled={
              (swapMode === "market" ? isMarketExecuting : isFxExecuting) ||
              !currentFromAmount ||
              parseFloat(currentFromAmount) <= 0 ||
              (swapMode === "market" && (isLoadingRoutes || !selectedRoute)) ||
              (swapMode === "currency" && (isFxLoading || !fromCurrency || !toCurrency))
            }
          >
            {(swapMode === "market" ? isMarketExecuting : isFxExecuting) && (
              <CircleNotch
                size={20}
                weight="bold"
                css={css`
                animation: spin 1s linear infinite;
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}
              />
            )}
            {(swapMode === "market" ? isMarketExecuting : isFxExecuting)
              ? "Swapping..."
              : isFxLoading && swapMode === "currency"
                ? "Loading pools..."
                : isLoadingRoutes && swapMode === "market"
                  ? "Finding best route..."
                  : !currentFromAmount || parseFloat(currentFromAmount) <= 0
                    ? "Enter an amount"
                    : swapMode === "market" && !selectedRoute
                      ? "No route available"
                      : swapMode === "currency" && (!fromCurrency || !toCurrency)
                        ? "Select currencies"
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
                : swapMode === "currency" && fromCurrency && toCurrency
                  ? getFxRate(fromCurrency.symbol, toCurrency.symbol).toFixed(4)
                  : "..."} {getSymbol(currentTo)}
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

        {/* Currency Selector Modals */}
        <CurrencySelector
          currencies={fxCurrencies}
          selectedCurrency={fromCurrency}
          onSelectCurrency={(currency) => {
            setFromCurrency(currency);
            setShowFromCurrencySelector(false);
          }}
          isOpen={showFromCurrencySelector}
          onClose={() => setShowFromCurrencySelector(false)}
        />

        <CurrencySelector
          currencies={fxCurrencies}
          selectedCurrency={toCurrency}
          onSelectCurrency={(currency) => {
            setToCurrency(currency);
            setShowToCurrencySelector(false);
          }}
          isOpen={showToCurrencySelector}
          onClose={() => setShowToCurrencySelector(false)}
        />
      </div>

      {/* Pool List Section - Full Width */}
      <div
        css={css`
          margin-top: 0;
          background: rgba(12, 13, 16, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 2rem;
        `}
      >
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
          `}
        >
          <div>
            <h2
              css={css`
                font-size: 1.75rem;
                font-weight: 700;
                color: #ffffff;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 0.5rem;
              `}
            >
              <TrendUp size={28} color="#dcfd8f" weight="bold" />
              Liquidity Pools
            </h2>
            <p
              css={css`
                font-size: 0.875rem;
                color: #a0a0a0;
              `}
            >
              {poolData.length} active pools • Real-time oracle pricing
            </p>
          </div>
          <button
            onClick={() => refetchPools()}
            disabled={isFetchingFresh}
            css={css`
              padding: 0.625rem 1.25rem;
              background: rgba(220, 253, 143, 0.1);
              border: 1px solid rgba(220, 253, 143, 0.3);
              border-radius: 10px;
              color: #dcfd8f;
              font-size: 0.875rem;
              font-weight: 600;
              cursor: ${isFetchingFresh ? 'not-allowed' : 'pointer'};
              transition: all 0.2s;
              display: flex;
              align-items: center;
              gap: 0.5rem;

              &:hover {
                background: ${isFetchingFresh ? 'rgba(220, 253, 143, 0.1)' : 'rgba(220, 253, 143, 0.2)'};
                transform: ${isFetchingFresh ? 'none' : 'translateY(-1px)'};
              }

              &:disabled {
                opacity: 0.7;
              }
            `}
          >
            {isFetchingFresh && (
              <CircleNotch
                size={16}
                css={css`
                  animation: spin 1s linear infinite;
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                `}
              />
            )}
            {isFetchingFresh ? 'Updating...' : 'Refresh Data'}
          </button>
        </div>

        {isLoadingPools ? (
          <div
            css={css`
              text-align: center;
              padding: 4rem;
              color: #a0a0a0;
            `}
          >
            <CircleNotch
              size={40}
              css={css`
                animation: spin 1s linear infinite;
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}
            />
            <div css={css` margin-top: 1rem; font-size: 0.875rem; `}>Loading pool data...</div>
          </div>
        ) : (
          <div
            css={css`
              background: rgba(0, 0, 0, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 16px;
              overflow: hidden;
            `}
          >
            {/* Table Header */}
            <div
              css={css`
                display: grid;
                grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr 1fr 1fr 1.2fr;
                gap: 1rem;
                padding: 1rem 1.5rem;
                background: rgba(0, 0, 0, 0.4);
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                font-size: 0.75rem;
                font-weight: 600;
                color: #a0a0a0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              `}
            >
              <div>Pool</div>
              <div>Liquidity</div>
              <div>Virtual Reserves</div>
              <div>Oracle Price</div>
              <div>Fees (24h)</div>
              <div>Status</div>
              <div>Action</div>
            </div>

            {/* Table Body */}
            {poolData.map((pool, index) => (
              <React.Fragment key={pool.pair}>
                <div
                  css={css`
                  display: grid;
                  grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr 1fr 1fr 1.2fr;
                  gap: 1rem;
                  padding: 1.25rem 1.5rem;
                  border-bottom: ${selectedPoolForLiquidity === pool.pair ? 'none' : index < poolData.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'};
                  transition: all 0.2s;
                  align-items: center;
                  background: ${selectedPoolForLiquidity === pool.pair ? 'rgba(220, 253, 143, 0.05)' : 'transparent'};

                  &:hover {
                    background: ${selectedPoolForLiquidity === pool.pair ? 'rgba(220, 253, 143, 0.05)' : 'rgba(255, 255, 255, 0.03)'};
                  }
                `}
                >
                  {/* Pool Name */}
                  <div>
                    <div
                      css={css`
                      font-size: 1rem;
                      font-weight: 700;
                      color: #ffffff;
                      margin-bottom: 0.25rem;
                    `}
                    >
                      {pool.pair}
                    </div>
                    <div
                      css={css`
                      font-size: 0.75rem;
                      color: #a0a0a0;
                    `}
                    >
                      {pool.tokenA} / {pool.tokenB}
                    </div>
                  </div>

                  {/* Real Liquidity */}
                  <div>
                    <div
                      css={css`
                      font-size: 0.875rem;
                      font-weight: 600;
                      color: #dcfd8f;
                      margin-bottom: 0.25rem;
                    `}
                    >
                      {parseFloat(pool.realReserveA).toFixed(2)}
                    </div>
                    <div
                      css={css`
                      font-size: 0.75rem;
                      color: #a0a0a0;
                    `}
                    >
                      {parseFloat(pool.realReserveB).toFixed(2)}
                    </div>
                  </div>

                  {/* Virtual Reserves */}
                  <div>
                    <div
                      css={css`
                      font-size: 0.875rem;
                      font-weight: 600;
                      color: #ffffff;
                      margin-bottom: 0.25rem;
                    `}
                    >
                      {parseFloat(pool.virtualReserveA).toFixed(2)}
                    </div>
                    <div
                      css={css`
                      font-size: 0.75rem;
                      color: #a0a0a0;
                    `}
                    >
                      {parseFloat(pool.virtualReserveB).toFixed(2)}
                    </div>
                  </div>

                  {/* Oracle Price */}
                  <div>
                    <div
                      css={css`
                      font-size: 0.875rem;
                      font-weight: 600;
                      color: #ffffff;
                    `}
                    >
                      {parseFloat(pool.oraclePrice) > 0 ? parseFloat(pool.oraclePrice).toFixed(6) : 'N/A'}
                    </div>
                    <div
                      css={css`
                      font-size: 0.75rem;
                      color: #a0a0a0;
                    `}
                    >
                      {pool.lastUpdate > 0 ? `${Math.floor((Date.now() / 1000 - pool.lastUpdate) / 60)}m ago` : 'No data'}
                    </div>
                  </div>

                  {/* Fees */}
                  <div>
                    <div
                      css={css`
                      font-size: 0.875rem;
                      font-weight: 600;
                      color: #dcfd8f;
                    `}
                    >
                      {(parseFloat(pool.feesA) + parseFloat(pool.feesB)).toFixed(2)}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      css={css`
                      padding: 0.25rem 0.625rem;
                      background: ${pool.paused ? 'rgba(255, 77, 77, 0.1)' : 'rgba(34, 197, 94, 0.1)'};
                      border: 1px solid ${pool.paused ? 'rgba(255, 77, 77, 0.3)' : 'rgba(34, 197, 94, 0.3)'};
                      border-radius: 6px;
                      color: ${pool.paused ? '#ff4d4d' : '#22c55e'};
                      font-size: 0.75rem;
                      font-weight: 600;
                    `}
                    >
                      {pool.paused ? 'Paused' : 'Active'}
                    </span>
                  </div>

                  {/* Action */}
                  <div>
                    <button
                      onClick={() => {
                        if (selectedPoolForLiquidity === pool.pair) {
                          setSelectedPoolForLiquidity(null);
                          setLiquidityAmountA("");
                          setLiquidityAmountB("");
                          setExpectedLP("");
                        } else {
                          setSelectedPoolForLiquidity(pool.pair);
                        }
                      }}
                      css={css`
                      padding: 0.5rem 0.875rem;
                      background: ${selectedPoolForLiquidity === pool.pair ? 'rgba(220, 253, 143, 0.2)' : 'rgba(220, 253, 143, 0.1)'};
                      border: 1px solid rgba(220, 253, 143, 0.3);
                      border-radius: 8px;
                      color: #dcfd8f;
                      font-size: 0.8125rem;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s;
                      display: flex;
                      align-items: center;
                      gap: 0.375rem;
                      white-space: nowrap;

                      &:hover {
                        background: rgba(220, 253, 143, 0.25);
                        transform: translateY(-1px);
                      }
                    `}
                    >
                      {selectedPoolForLiquidity === pool.pair ? (
                        <>
                          <Minus size={14} weight="bold" />
                          Close
                        </>
                      ) : (
                        <>
                          <Plus size={14} weight="bold" />
                          Add
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Inline Add Liquidity Form */}
                {selectedPoolForLiquidity === pool.pair && (
                  <div
                    css={css`
                    padding: 1.5rem;
                    background: rgba(220, 253, 143, 0.03);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                  `}
                  >
                    <div
                      css={css`
                      display: grid;
                      grid-template-columns: 1fr 1fr;
                      gap: 1rem;
                      max-width: 800px;
                    `}
                    >
                      {/* Amount A Input */}
                      <div>
                        <div
                          css={css`
                          font-size: 0.75rem;
                          color: #a0a0a0;
                          margin-bottom: 0.5rem;
                        `}
                        >
                          {pool.tokenA} Amount
                        </div>
                        <input
                          type="number"
                          value={liquidityAmountA}
                          onChange={(e) => setLiquidityAmountA(e.target.value)}
                          placeholder="0.00"
                          css={css`
                          width: 100%;
                          padding: 0.75rem;
                          background: rgba(0, 0, 0, 0.3);
                          border: 1px solid rgba(255, 255, 255, 0.1);
                          border-radius: 8px;
                          color: #fff;
                          font-size: 1rem;
                          font-weight: 600;
                          outline: none;

                          &:focus {
                            border-color: rgba(220, 253, 143, 0.5);
                          }

                          &::placeholder {
                            color: rgba(255, 255, 255, 0.2);
                          }
                        `}
                        />
                      </div>

                      {/* Amount B Input */}
                      <div>
                        <div
                          css={css`
                          font-size: 0.75rem;
                          color: #a0a0a0;
                          margin-bottom: 0.5rem;
                        `}
                        >
                          {pool.tokenB} Amount
                        </div>
                        <input
                          type="number"
                          value={liquidityAmountB}
                          onChange={(e) => setLiquidityAmountB(e.target.value)}
                          placeholder="0.00"
                          css={css`
                          width: 100%;
                          padding: 0.75rem;
                          background: rgba(0, 0, 0, 0.3);
                          border: 1px solid rgba(255, 255, 255, 0.1);
                          border-radius: 8px;
                          color: #fff;
                          font-size: 1rem;
                          font-weight: 600;
                          outline: none;

                          &:focus {
                            border-color: rgba(220, 253, 143, 0.5);
                          }

                          &::placeholder {
                            color: rgba(255, 255, 255, 0.2);
                          }
                        `}
                        />
                      </div>
                    </div>

                    {/* Expected LP and Button */}
                    <div
                      css={css`
                      display: flex;
                      align-items: center;
                      gap: 1rem;
                      margin-top: 1rem;
                      max-width: 800px;
                    `}
                    >
                      {expectedLP && parseFloat(expectedLP) > 0 && (
                        <div
                          css={css`
                          flex: 1;
                          padding: 0.75rem 1rem;
                          background: rgba(220, 253, 143, 0.1);
                          border: 1px solid rgba(220, 253, 143, 0.3);
                          border-radius: 8px;
                          font-size: 0.875rem;
                        `}
                        >
                          <span css={css` color: #a0a0a0; `}>LP Tokens: </span>
                          <span css={css` color: #dcfd8f; font-weight: 700; `}>
                            {parseFloat(expectedLP).toFixed(6)}
                          </span>
                        </div>
                      )}

                      <button
                        onClick={async () => {
                          if (!selectedPoolForLiquidity || !liquidityAmountA || !liquidityAmountB) return;

                          try {
                            const txHash = await executeAddLiquidity(
                              selectedPoolForLiquidity,
                              liquidityAmountA,
                              liquidityAmountB
                            );

                            showSuccess(
                              'Liquidity Added!',
                              `Added ${liquidityAmountA} + ${liquidityAmountB} to ${selectedPoolForLiquidity}`,
                              txHash
                            );

                            setLiquidityAmountA("");
                            setLiquidityAmountB("");
                            setExpectedLP("");

                            // Refresh pool data immediately so next add uses updated ratio
                            await refetchPools();

                            // Keep form open for another add
                            // setSelectedPoolForLiquidity(null);
                          } catch (error: any) {
                            // Parse error for better UX
                            let errorMsg = error.message || 'Failed to add liquidity';
                            if (errorMsg.includes('Liquidity ratio mismatch')) {
                              errorMsg = 'Ratio mismatch: Pool ratio changed. Amounts have been recalculated - please try again.';
                              // Refresh to get new ratio
                              await refetchPools();
                            } else if (errorMsg.includes('Insufficient')) {
                              errorMsg = 'Insufficient token balance';
                            }

                            showError('Add Liquidity Failed', errorMsg);
                          }
                        }}
                        disabled={isExecutingLiquidity || !liquidityAmountA || !liquidityAmountB}
                        css={css`
                        padding: 0.75rem 1.5rem;
                        background: ${isExecutingLiquidity
                            ? 'linear-gradient(135deg, #808080 0%, #606060 100%)'
                            : 'linear-gradient(135deg, #dcfd8f 0%, #a8e063 100%)'};
                        border: none;
                        border-radius: 8px;
                        color: #02302c;
                        font-size: 0.875rem;
                        font-weight: 700;
                        cursor: ${isExecutingLiquidity ? 'not-allowed' : 'pointer'};
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        white-space: nowrap;

                        &:hover {
                          transform: ${isExecutingLiquidity ? 'none' : 'translateY(-1px)'};
                        }

                        &:disabled {
                          opacity: 0.5;
                          cursor: not-allowed;
                        }
                      `}
                      >
                        {isExecutingLiquidity && (
                          <CircleNotch
                            size={16}
                            weight="bold"
                            css={css`
                            animation: spin 1s linear infinite;
                            @keyframes spin {
                              from { transform: rotate(0deg); }
                              to { transform: rotate(360deg); }
                            }
                          `}
                          />
                        )}
                        {isExecutingLiquidity ? 'Adding...' : 'Add Liquidity'}
                      </button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Last Updated Timestamp */}
        {!isLoadingPools && lastUpdated > 0 && (
          <div
            css={css`
              margin-top: 1.5rem;
              padding-top: 1.5rem;
              border-top: 1px solid rgba(255, 255, 255, 0.05);
              text-align: center;
              font-size: 0.75rem;
              color: #a0a0a0;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.5rem;
            `}
          >
            <span>Last updated: {new Date(lastUpdated).toLocaleTimeString()}</span>
            {isFetchingFresh && (
              <>
                <span>•</span>
                <span css={css` color: #dcfd8f; `}>Refreshing...</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Old Add Liquidity Section - Removed, now inline */}
      {false && (
        <div
          css={css`
            margin-top: 2rem;
            background: rgba(12, 13, 16, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 24px;
            padding: 1.5rem;
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
            <h2
              css={css`
                font-size: 1.25rem;
                font-weight: 700;
                color: #ffffff;
                display: flex;
                align-items: center;
                gap: 0.5rem;
              `}
            >
              <Plus size={24} color="#dcfd8f" />
              Add Liquidity to {selectedPoolForLiquidity}
            </h2>
            <button
              onClick={() => {
                setShowAddLiquidity(false);
                setSelectedPoolForLiquidity(null);
                setLiquidityAmountA("");
                setLiquidityAmountB("");
                setExpectedLP("");
              }}
              css={css`
                padding: 0.5rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: #a0a0a0;
                font-size: 1.25rem;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(255, 255, 255, 0.1);
                }
              `}
            >
              ×
            </button>
          </div>

          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            {/* Amount A Input */}
            <div
              css={css`
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
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
                {selectedPoolForLiquidity.split('/')[0]} Amount
              </div>
              <input
                type="number"
                value={liquidityAmountA}
                onChange={(e) => setLiquidityAmountA(e.target.value)}
                placeholder="0.00"
                css={css`
                  width: 100%;
                  background: transparent;
                  border: none;
                  color: #fff;
                  font-size: 1.5rem;
                  font-weight: 600;
                  outline: none;

                  &::placeholder {
                    color: rgba(255, 255, 255, 0.2);
                  }
                `}
              />
            </div>

            {/* Amount B Input */}
            <div
              css={css`
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
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
                {selectedPoolForLiquidity.split('/')[1]} Amount
              </div>
              <input
                type="number"
                value={liquidityAmountB}
                onChange={(e) => setLiquidityAmountB(e.target.value)}
                placeholder="0.00"
                css={css`
                  width: 100%;
                  background: transparent;
                  border: none;
                  color: #fff;
                  font-size: 1.5rem;
                  font-weight: 600;
                  outline: none;

                  &::placeholder {
                    color: rgba(255, 255, 255, 0.2);
                  }
                `}
              />
            </div>

            {/* Expected LP Tokens */}
            {expectedLP && parseFloat(expectedLP) > 0 && (
              <div
                css={css`
                  background: rgba(220, 253, 143, 0.1);
                  border: 1px solid rgba(220, 253, 143, 0.3);
                  border-radius: 12px;
                  padding: 1rem;
                `}
              >
                <div
                  css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                    margin-bottom: 0.25rem;
                  `}
                >
                  You will receive
                </div>
                <div
                  css={css`
                    font-size: 1.125rem;
                    font-weight: 700;
                    color: #dcfd8f;
                  `}
                >
                  {parseFloat(expectedLP).toFixed(6)} LP Tokens
                </div>
              </div>
            )}

            {/* Add Liquidity Button */}
            <button
              onClick={async () => {
                if (!selectedPoolForLiquidity || !liquidityAmountA || !liquidityAmountB) return;

                try {
                  const txHash = await executeAddLiquidity(
                    selectedPoolForLiquidity,
                    liquidityAmountA,
                    liquidityAmountB
                  );

                  showSuccess(
                    'Liquidity Added!',
                    `Added ${liquidityAmountA} + ${liquidityAmountB} to ${selectedPoolForLiquidity}`,
                    txHash
                  );

                  // Reset form and close
                  setLiquidityAmountA("");
                  setLiquidityAmountB("");
                  setExpectedLP("");
                  setShowAddLiquidity(false);
                  setSelectedPoolForLiquidity(null);

                  // Refresh pool data
                  refetchPools();
                } catch (error: any) {
                  showError(
                    'Add Liquidity Failed',
                    error.message || 'Failed to add liquidity'
                  );
                }
              }}
              disabled={isExecutingLiquidity || !liquidityAmountA || !liquidityAmountB}
              css={css`
                width: 100%;
                padding: 1.125rem;
                background: ${isExecutingLiquidity
                  ? 'linear-gradient(135deg, #808080 0%, #606060 100%)'
                  : 'linear-gradient(135deg, #dcfd8f 0%, #a8e063 100%)'};
                border: none;
                border-radius: 16px;
                color: #02302c;
                font-size: 1.125rem;
                font-weight: 700;
                cursor: ${isExecutingLiquidity ? 'not-allowed' : 'pointer'};
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;

                &:hover {
                  transform: ${isExecutingLiquidity ? 'none' : 'translateY(-2px)'};
                  box-shadow: ${isExecutingLiquidity ? 'none' : '0 12px 24px rgba(220, 253, 143, 0.3)'};
                }

                &:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                  transform: none;
                }
              `}
            >
              {isExecutingLiquidity && (
                <CircleNotch
                  size={20}
                  weight="bold"
                  css={css`
                    animation: spin 1s linear infinite;
                    @keyframes spin {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                  `}
                />
              )}
              {isExecutingLiquidity ? 'Adding Liquidity...' : 'Add Liquidity'}
            </button>
          </div>
        </div>
      )}

      {/* My Positions Section - Full Width */}
      <div
        css={css`
          margin-top: 2rem;
          background: rgba(12, 13, 16, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 2rem;
        `}
      >
        <div
          css={css`
            margin-bottom: 2rem;
          `}
        >
          <h2
            css={css`
              font-size: 1.75rem;
              font-weight: 700;
              color: #ffffff;
              display: flex;
              align-items: center;
              gap: 0.75rem;
              margin-bottom: 0.5rem;
            `}
          >
            <TrendUp size={28} color="#dcfd8f" weight="bold" />
            My Portfolio
          </h2>
          <p
            css={css`
              font-size: 0.875rem;
              color: #a0a0a0;
            `}
          >
            Your liquidity positions and earnings
          </p>
        </div>

        {isLoadingPools ? (
          <div
            css={css`
              text-align: center;
              padding: 4rem;
              color: #a0a0a0;
            `}
          >
            <CircleNotch
              size={40}
              css={css`
                animation: spin 1s linear infinite;
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}
            />
            <div css={css` margin-top: 1rem; font-size: 0.875rem; `}>Loading positions...</div>
          </div>
        ) : poolData.filter(pool => parseFloat(pool.userLPBalance) > 0).length === 0 ? (
          <div
            css={css`
              text-align: center;
              padding: 4rem;
              background: rgba(0, 0, 0, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 16px;
            `}
          >
            <div
              css={css`
                font-size: 3rem;
                margin-bottom: 1rem;
              `}
            >
              💼
            </div>
            <div
              css={css`
                font-size: 1.125rem;
                font-weight: 600;
                color: #ffffff;
                margin-bottom: 0.5rem;
              `}
            >
              No Positions Yet
            </div>
            <div
              css={css`
                font-size: 0.875rem;
                color: #a0a0a0;
              `}
            >
              Add liquidity to a pool above to start earning fees
            </div>
          </div>
        ) : (
          <div
            css={css`
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
              gap: 1.5rem;
            `}
          >
            {poolData
              .filter(pool => parseFloat(pool.userLPBalance) > 0)
              .map((pool) => {
                const userShareA = parseFloat(pool.realReserveA) * (pool.userPoolShare / 100);
                const userShareB = parseFloat(pool.realReserveB) * (pool.userPoolShare / 100);
                const userFeesA = parseFloat(pool.feesA) * (pool.userPoolShare / 100);
                const userFeesB = parseFloat(pool.feesB) * (pool.userPoolShare / 100);

                return (
                  <div
                    key={pool.pair}
                    css={css`
                      background: rgba(0, 0, 0, 0.3);
                      border: 1px solid rgba(255, 255, 255, 0.08);
                      border-radius: 16px;
                      padding: 1.5rem;
                      transition: all 0.2s;

                      &:hover {
                        background: rgba(255, 255, 255, 0.03);
                        border-color: rgba(220, 253, 143, 0.2);
                        transform: translateY(-2px);
                      }
                    `}
                  >
                    <div
                      css={css`
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 1.5rem;
                      `}
                    >
                      <div>
                        <div
                          css={css`
                            font-size: 1.125rem;
                            font-weight: 700;
                            color: #ffffff;
                            margin-bottom: 0.25rem;
                          `}
                        >
                          {pool.pair}
                        </div>
                        <div
                          css={css`
                            font-size: 0.75rem;
                            color: #a0a0a0;
                          `}
                        >
                          {pool.tokenA} / {pool.tokenB}
                        </div>
                      </div>
                      <span
                        css={css`
                          padding: 0.375rem 0.75rem;
                          background: rgba(220, 253, 143, 0.1);
                          border: 1px solid rgba(220, 253, 143, 0.3);
                          border-radius: 8px;
                          color: #dcfd8f;
                          font-size: 0.75rem;
                          font-weight: 700;
                        `}
                      >
                        {pool.userPoolShare.toFixed(3)}%
                      </span>
                    </div>

                    <div
                      css={css`
                        display: flex;
                        flex-direction: column;
                        gap: 0.75rem;
                        margin-bottom: 1.5rem;
                      `}
                    >
                      <div>
                        <div
                          css={css`
                            font-size: 0.75rem;
                            color: #a0a0a0;
                            margin-bottom: 0.25rem;
                          `}
                        >
                          Your Liquidity
                        </div>
                        <div
                          css={css`
                            font-size: 0.875rem;
                            font-weight: 600;
                            color: #ffffff;
                          `}
                        >
                          {userShareA.toFixed(4)} {pool.tokenA} + {userShareB.toFixed(4)} {pool.tokenB}
                        </div>
                      </div>

                      <div>
                        <div
                          css={css`
                            font-size: 0.75rem;
                            color: #a0a0a0;
                            margin-bottom: 0.25rem;
                          `}
                        >
                          LP Tokens
                        </div>
                        <div
                          css={css`
                            font-size: 0.875rem;
                            font-weight: 600;
                            color: #dcfd8f;
                          `}
                        >
                          {parseFloat(pool.userLPBalance).toFixed(6)}
                        </div>
                      </div>

                      <div>
                        <div
                          css={css`
                            font-size: 0.75rem;
                            color: #a0a0a0;
                            margin-bottom: 0.25rem;
                          `}
                        >
                          Earned Fees
                        </div>
                        <div
                          css={css`
                            font-size: 0.875rem;
                            font-weight: 600;
                            color: #22c55e;
                          `}
                        >
                          {userFeesA.toFixed(4)} {pool.tokenA} + {userFeesB.toFixed(4)} {pool.tokenB}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedPoolForRemoval(pool.pair);
                        setRemoveAmount(pool.userLPBalance);
                        setShowRemoveLiquidity(true);
                      }}
                      css={css`
                        width: 100%;
                        padding: 0.75rem;
                        background: rgba(255, 77, 77, 0.1);
                        border: 1px solid rgba(255, 77, 77, 0.3);
                        border-radius: 10px;
                        color: #ff4d4d;
                        font-size: 0.875rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.5rem;

                        &:hover {
                          background: rgba(255, 77, 77, 0.2);
                          transform: translateY(-1px);
                        }
                      `}
                    >
                      <Minus size={16} weight="bold" />
                      Remove Liquidity
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Remove Liquidity Modal */}
      {showRemoveLiquidity && selectedPoolForRemoval && (
        <div
          css={css`
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 1rem;
          `}
          onClick={() => {
            setShowRemoveLiquidity(false);
            setSelectedPoolForRemoval(null);
            setRemoveAmount("");
            setExpectedRemoveA("");
            setExpectedRemoveB("");
          }}
        >
          <div
            css={css`
              background: rgba(12, 13, 16, 0.98);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 24px;
              padding: 2rem;
              max-width: 480px;
              width: 100%;
            `}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
              `}
            >
              <h2
                css={css`
                  font-size: 1.5rem;
                  font-weight: 700;
                  color: #ffffff;
                  display: flex;
                  align-items: center;
                  gap: 0.75rem;
                `}
              >
                <Minus size={28} color="#ff4d4d" weight="bold" />
                Remove Liquidity
              </h2>
              <button
                onClick={() => {
                  setShowRemoveLiquidity(false);
                  setSelectedPoolForRemoval(null);
                  setRemoveAmount("");
                }}
                css={css`
                  padding: 0.5rem;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 8px;
                  color: #a0a0a0;
                  font-size: 1.5rem;
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover {
                    background: rgba(255, 255, 255, 0.1);
                  }
                `}
              >
                ×
              </button>
            </div>

            <div
              css={css`
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 1rem;
                margin-bottom: 1rem;
              `}
            >
              <div
                css={css`
                  font-size: 0.875rem;
                  color: #a0a0a0;
                  margin-bottom: 0.5rem;
                `}
              >
                Pool: {selectedPoolForRemoval}
              </div>
              <div
                css={css`
                  font-size: 0.875rem;
                  color: #a0a0a0;
                  margin-bottom: 0.5rem;
                `}
              >
                LP Tokens to Remove
              </div>
              <input
                type="number"
                value={removeAmount}
                onChange={(e) => setRemoveAmount(e.target.value)}
                placeholder="0.00"
                css={css`
                  width: 100%;
                  background: transparent;
                  border: none;
                  color: #fff;
                  font-size: 1.5rem;
                  font-weight: 600;
                  outline: none;

                  &::placeholder {
                    color: rgba(255, 255, 255, 0.2);
                  }
                `}
              />
            </div>

            {/* Expected Amounts */}
            {expectedRemoveA && expectedRemoveB && (
              <div
                css={css`
                  background: rgba(255, 77, 77, 0.1);
                  border: 1px solid rgba(255, 77, 77, 0.3);
                  border-radius: 12px;
                  padding: 1rem;
                  margin-bottom: 1rem;
                `}
              >
                <div
                  css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                    margin-bottom: 0.75rem;
                  `}
                >
                  You will receive
                </div>
                <div
                  css={css`
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                  `}
                >
                  <div
                    css={css`
                      font-size: 0.9375rem;
                      font-weight: 600;
                      color: #ffffff;
                    `}
                  >
                    {parseFloat(expectedRemoveA).toFixed(6)} {selectedPoolForRemoval.split('/')[0]}
                  </div>
                  <div
                    css={css`
                      font-size: 0.9375rem;
                      font-weight: 600;
                      color: #ffffff;
                    `}
                  >
                    {parseFloat(expectedRemoveB).toFixed(6)} {selectedPoolForRemoval.split('/')[1]}
                  </div>
                </div>
              </div>
            )}

            {/* Remove Button */}
            <button
              onClick={async () => {
                if (!selectedPoolForRemoval || !removeAmount) return;

                try {
                  const txHash = await executeRemoveLiquidity(
                    selectedPoolForRemoval,
                    removeAmount
                  );

                  showSuccess(
                    'Liquidity Removed!',
                    `Removed ${removeAmount} LP tokens from ${selectedPoolForRemoval}`,
                    txHash
                  );

                  // Reset and close
                  setRemoveAmount("");
                  setShowRemoveLiquidity(false);
                  setSelectedPoolForRemoval(null);

                  // Refresh pool data
                  refetchPools();
                } catch (error: any) {
                  showError(
                    'Remove Liquidity Failed',
                    error.message || 'Failed to remove liquidity'
                  );
                }
              }}
              disabled={isExecutingLiquidity || !removeAmount || parseFloat(removeAmount) <= 0}
              css={css`
                width: 100%;
                padding: 1.125rem;
                background: ${isExecutingLiquidity
                  ? 'linear-gradient(135deg, #808080 0%, #606060 100%)'
                  : 'linear-gradient(135deg, #ff4d4d 0%, #ee5a6f 100%)'};
                border: none;
                border-radius: 16px;
                color: #ffffff;
                font-size: 1.125rem;
                font-weight: 700;
                cursor: ${isExecutingLiquidity ? 'not-allowed' : 'pointer'};
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;

                &:hover {
                  transform: ${isExecutingLiquidity ? 'none' : 'translateY(-2px)'};
                  box-shadow: ${isExecutingLiquidity ? 'none' : '0 12px 24px rgba(255, 77, 77, 0.3)'};
                }

                &:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                  transform: none;
                }
              `}
            >
              {isExecutingLiquidity && (
                <CircleNotch
                  size={20}
                  weight="bold"
                  css={css`
                    animation: spin 1s linear infinite;
                    @keyframes spin {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                  `}
                />
              )}
              {isExecutingLiquidity ? 'Removing Liquidity...' : 'Remove Liquidity'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default SwapInterface;
