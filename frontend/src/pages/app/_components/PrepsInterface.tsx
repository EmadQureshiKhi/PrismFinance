import { css } from "@emotion/react";
import { useState, useEffect, useRef } from "react";
import { TrendUp, TrendDown, CaretDown, Lightning } from "@phosphor-icons/react";
import { useWallet } from "@/contexts/WalletContext";
import { usePerps } from "@/hooks/usePerps";
import { useToast } from "@/contexts/ToastContext";
import { ethers } from "ethers";

interface Position {
    id: string;
    asset: string;
    side: "long" | "short";
    size: number;
    entryPrice: number;
    currentPrice: number;
    leverage: number;
    pnl: number;
    pnlPercent: number;
    liquidationPrice: number;
}

interface MarketData {
    markPrice: number;
    priceChange24h: number;
    priceChangePercent24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    availableLiquidity: number;
    borrowRate: number;
}

import AllPositionsDisplay from "./AllPositionsDisplay";

const PrepsInterface = () => {
    const { connection } = useWallet();
    const { position, allPositions, balance, isLoading, depositCollateral, withdrawCollateral, openPosition, closePosition } = usePerps();
    const { showSuccess, showError } = useToast();
    const [selectedAsset, setSelectedAsset] = useState("HBAR");
    const [orderType, setOrderType] = useState<"market" | "limit">("market");
    const [side, setSide] = useState<"long" | "short">("long");
    const [leverage, setLeverage] = useState(10);
    const [amount, setAmount] = useState("");
    const [limitPrice, setLimitPrice] = useState("");
    const [showAssetSelector, setShowAssetSelector] = useState(false);
    const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
    const [hasManuallyClosedOverlay, setHasManuallyClosedOverlay] = useState(false);
    const [showDepositForm, setShowDepositForm] = useState(false);
    const [showWithdrawForm, setShowWithdrawForm] = useState(false);
    const [depositAmount, setDepositAmount] = useState("");
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [walletBalance, setWalletBalance] = useState<string>("0");
    
    // Separate loading states for each action
    const [isDepositing, setIsDepositing] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [isOpeningLong, setIsOpeningLong] = useState(false);
    const [isOpeningShort, setIsOpeningShort] = useState(false);
    const [isClosingSinglePosition, setIsClosingSinglePosition] = useState(false);
    const [closingPositionId, setClosingPositionId] = useState<string | null>(null);

    // Auto-select position when it opens (but not if user manually closed it)
    useEffect(() => {
        if (position && !selectedPositionId && !hasManuallyClosedOverlay) {
            setSelectedPositionId(position.id); // Use actual position ID
        } else if (!position) {
            setSelectedPositionId(null);
            setHasManuallyClosedOverlay(false);
        }
    }, [position, selectedPositionId, hasManuallyClosedOverlay]);

    // Fetch wallet balance when deposit form is shown
    useEffect(() => {
        const fetchWalletBalance = async () => {
            if (!connection || !showDepositForm) return;

            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const address = await signer.getAddress();
                const balanceWei = await provider.getBalance(address);
                const balanceHbar = ethers.formatEther(balanceWei);
                setWalletBalance(balanceHbar);
            } catch (error) {
                console.error("Failed to fetch wallet balance:", error);
                setWalletBalance("0");
            }
        };

        fetchWalletBalance();
    }, [connection, showDepositForm]);
    const [marketData, setMarketData] = useState<MarketData>({
        markPrice: 0,
        priceChange24h: 0,
        priceChangePercent24h: 0,
        volume24h: 0,
        high24h: 0,
        low24h: 0,
        availableLiquidity: 10000000,
        borrowRate: 0.0016,
    });

    // Real positions from contract - use allPositions for multiple position support
    const positions: Position[] = allPositions.map((pos, index) => ({
        id: pos.id,
        asset: "HBAR",
        side: pos.isLong ? "long" : "short",
        size: parseFloat(pos.size),
        entryPrice: parseFloat(pos.entryPrice),
        currentPrice: parseFloat(pos.currentPrice),
        leverage: pos.leverage,
        pnl: parseFloat(pos.unrealizedPnL),
        pnlPercent: parseFloat(pos.collateral) > 0
            ? (parseFloat(pos.unrealizedPnL) / parseFloat(pos.collateral)) * 100
            : 0,
        liquidationPrice: parseFloat(pos.liquidationPrice),
    }));

    // Get the selected position from the positions array
    const selectedPosition = positions.find(p => p.id === selectedPositionId);
    // Fallback to the contract position data if needed
    const displayPosition = selectedPosition ? allPositions.find(p => p.id === selectedPosition.id) : null;

    const assets = ["HBAR", "BTC", "ETH", "SOL"];
    const leverageOptions = [2, 5, 10, 20, 50, 100];

    // TradingView widget container
    const tradingViewRef = useRef<HTMLDivElement>(null);

    // Fetch market data from Binance APIs
    useEffect(() => {
        const fetchMarketData = async () => {
            try {
                const symbol = `${selectedAsset}USDT`;

                // Use multiple Binance API endpoints for redundancy (spot API only - CORS friendly)
                const apis = [
                    'https://api.binance.com',
                    'https://api1.binance.com',
                    'https://api2.binance.com',
                    'https://api3.binance.com',
                ];

                let tickerData = null;

                // Try each API until one succeeds
                for (const apiUrl of apis) {
                    try {
                        // Fetch 24hr ticker data (spot market)
                        const ticker24hrResponse = await fetch(
                            `${apiUrl}/api/v3/ticker/24hr?symbol=${symbol}`,
                            { signal: AbortSignal.timeout(5000) }
                        );

                        if (ticker24hrResponse.ok) {
                            tickerData = await ticker24hrResponse.json();
                            break; // Success, exit loop
                        }
                    } catch (error) {
                        console.log(`Failed to fetch from ${apiUrl}, trying next...`);
                        continue;
                    }
                }

                if (tickerData) {
                    // Calculate estimated funding rate based on price volatility
                    const volatility = Math.abs(parseFloat(tickerData.priceChangePercent));
                    const estimatedFundingRate = (volatility / 100) * 0.01; // Simple estimation

                    setMarketData({
                        markPrice: parseFloat(tickerData.lastPrice),
                        priceChange24h: parseFloat(tickerData.priceChange),
                        priceChangePercent24h: parseFloat(tickerData.priceChangePercent),
                        volume24h: parseFloat(tickerData.quoteVolume), // Volume in USDT
                        high24h: parseFloat(tickerData.highPrice),
                        low24h: parseFloat(tickerData.lowPrice),
                        availableLiquidity: 10000000, // Mock data - would need separate API
                        borrowRate: estimatedFundingRate,
                    });
                }
            } catch (error) {
                console.error('Error fetching market data:', error);
            }
        };

        fetchMarketData();

        // Refresh every 10 seconds
        const interval = setInterval(fetchMarketData, 10000);

        return () => clearInterval(interval);
    }, [selectedAsset]);

    useEffect(() => {
        // Load TradingView widget
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => {
            if (tradingViewRef.current && (window as any).TradingView) {
                new (window as any).TradingView.widget({
                    autosize: true,
                    symbol: "BINANCE:HBARUSDT",
                    interval: "15",
                    timezone: "Etc/UTC",
                    theme: "dark",
                    style: "1",
                    locale: "en",
                    toolbar_bg: "#0c0d10",
                    enable_publishing: false,
                    hide_top_toolbar: false,
                    hide_legend: false,
                    save_image: false,
                    container_id: "tradingview_chart",
                    backgroundColor: "#0c0d10",
                    gridColor: "rgba(255, 255, 255, 0.05)",
                    studies: ["MASimple@tv-basicstudies"],
                });
            }
        };
        document.head.appendChild(script);

        return () => {
            if (document.head.contains(script)) {
                document.head.removeChild(script);
            }
        };
    }, [selectedAsset]);

    const calculatePnL = () => {
        if (!amount || parseFloat(amount) <= 0) return { pnl: 0, pnlPercent: 0 };
        const size = parseFloat(amount);
        const mockPnl = size * 0.05 * leverage;
        const mockPnlPercent = 5 * leverage;
        return { pnl: mockPnl, pnlPercent: mockPnlPercent };
    };

    return (
        <div
            css={css`
        max-width: 1400px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr 380px;
        gap: 1.5rem;
      `}
        >
            {/* Left Column - Chart & Positions */}
            <div
                css={css`
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        `}
            >
                {/* Chart */}
                <div
                    css={css`
            background: rgba(12, 13, 16, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 24px;
            padding: 1.5rem;
            height: 500px;
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
                        <button
                            onClick={() => setShowAssetSelector(!showAssetSelector)}
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
                font-size: 1.125rem;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(220, 253, 143, 0.15);
                }
              `}
                        >
                            {selectedAsset}/USDT
                            <CaretDown size={16} />
                        </button>

                        <div
                            css={css`
                display: flex;
                gap: 1.5rem;
                align-items: center;
                flex-wrap: wrap;
              `}
                        >
                            <div>
                                <div
                                    css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}
                                >
                                    Mark Price
                                </div>
                                <div
                                    css={css`
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: ${marketData.priceChangePercent24h >= 0 ? "#4ade80" : "#ff4d4d"};
                  `}
                                >
                                    ${marketData.markPrice > 0 ? marketData.markPrice.toFixed(4) : "..."}
                                </div>
                            </div>
                            <div>
                                <div
                                    css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}
                                >
                                    24h Change
                                </div>
                                <div
                                    css={css`
                    font-size: 1rem;
                    font-weight: 600;
                    color: ${marketData.priceChangePercent24h >= 0 ? "#4ade80" : "#ff4d4d"};
                  `}
                                >
                                    {marketData.priceChangePercent24h >= 0 ? "+" : ""}
                                    {marketData.priceChangePercent24h.toFixed(2)}%
                                </div>
                            </div>
                            <div>
                                <div
                                    css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}
                                >
                                    24h Vol
                                </div>
                                <div
                                    css={css`
                    font-size: 1rem;
                    font-weight: 600;
                    color: #ffffff;
                  `}
                                >
                                    ${marketData.volume24h > 0
                                        ? (marketData.volume24h / 1000000).toFixed(2) + "M"
                                        : "..."}
                                </div>
                            </div>
                            <div>
                                <div
                                    css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}
                                >
                                    24h High
                                </div>
                                <div
                                    css={css`
                    font-size: 1rem;
                    font-weight: 600;
                    color: #ffffff;
                  `}
                                >
                                    ${marketData.high24h > 0 ? marketData.high24h.toFixed(4) : "..."}
                                </div>
                            </div>
                            <div>
                                <div
                                    css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}
                                >
                                    24h Low
                                </div>
                                <div
                                    css={css`
                    font-size: 1rem;
                    font-weight: 600;
                    color: #ffffff;
                  `}
                                >
                                    ${marketData.low24h > 0 ? marketData.low24h.toFixed(4) : "..."}
                                </div>
                            </div>
                            <div>
                                <div
                                    css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}
                                >
                                    Available Liq.
                                </div>
                                <div
                                    css={css`
                    font-size: 1rem;
                    font-weight: 600;
                    color: #dcfd8f;
                  `}
                                >
                                    ${(marketData.availableLiquidity / 1000000).toFixed(2)}M
                                </div>
                            </div>
                            <div>
                                <div
                                    css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}
                                >
                                    Borrow Rate
                                </div>
                                <div
                                    css={css`
                    font-size: 1rem;
                    font-weight: 600;
                    color: #ffffff;
                  `}
                                >
                                    {marketData.borrowRate.toFixed(4)}% / hr
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TradingView Chart */}
                    <div
                        css={css`
              position: relative;
              height: calc(100% - 60px);
            `}
                    >
                        <div
                            id="tradingview_chart"
                            ref={tradingViewRef}
                            css={css`
              height: 100%;
              border-radius: 12px;
              overflow: hidden;
            `}
                        />

                        {/* Position Overlay on Chart */}
                        {displayPosition && selectedPositionId && (
                            <div
                                css={css`
                  position: absolute;
                  top: 12px;
                  left: 12px;
                  background: rgba(12, 13, 16, 0.95);
                  backdrop-filter: blur(20px);
                  border: 2px solid ${displayPosition.isLong ? "rgba(74, 222, 128, 0.5)" : "rgba(255, 77, 77, 0.5)"};
                  border-radius: 10px;
                  padding: 0.75rem;
                  width: 260px;
                  z-index: 10;
                  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                  animation: slideIn 0.3s ease-out;
                  
                  @keyframes slideIn {
                    from {
                      opacity: 0;
                      transform: translateX(-20px);
                    }
                    to {
                      opacity: 1;
                      transform: translateX(0);
                    }
                  }
                `}
                            >
                                {/* Header Row */}
                                <div
                                    css={css`
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 0.625rem;
                  `}
                                >
                                    <div
                                        css={css`
                      display: flex;
                      align-items: center;
                      gap: 0.375rem;
                    `}
                                    >
                                        {displayPosition.isLong ? (
                                            <TrendUp size={16} weight="bold" color="#4ade80" />
                                        ) : (
                                            <TrendDown size={16} weight="bold" color="#ff4d4d" />
                                        )}
                                        <span
                                            css={css`
                        font-size: 0.875rem;
                        font-weight: 700;
                        color: ${displayPosition.isLong ? "#4ade80" : "#ff4d4d"};
                        text-transform: uppercase;
                      `}
                                        >
                                            {displayPosition.isLong ? "LONG" : "SHORT"} {displayPosition.leverage}x
                                        </span>
                                    </div>

                                    <div
                                        css={css`
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                    `}
                                    >
                                        <div
                                            css={css`
                        display: flex;
                        flex-direction: column;
                        align-items: flex-end;
                      `}
                                        >
                                            <div
                                                css={css`
                          font-size: 0.75rem;
                          font-weight: 700;
                          color: ${parseFloat(displayPosition.unrealizedPnL) >= 0 ? "#4ade80" : "#ff4d4d"};
                        `}
                                            >
                                                {parseFloat(displayPosition.unrealizedPnL) >= 0 ? "+" : ""}
                                                {parseFloat(displayPosition.unrealizedPnL).toFixed(2)} HBAR
                                            </div>
                                            <div
                                                css={css`
                          font-size: 0.625rem;
                          font-weight: 600;
                          color: ${parseFloat(displayPosition.unrealizedPnL) >= 0 ? "#4ade80" : "#ff4d4d"};
                        `}
                                            >
                                                {parseFloat(displayPosition.collateral) > 0
                                                    ? `(${((parseFloat(displayPosition.unrealizedPnL) / parseFloat(displayPosition.collateral)) * 100).toFixed(2)}%)`
                                                    : "(0%)"}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedPositionId(null);
                                                setHasManuallyClosedOverlay(true);
                                            }}
                                            css={css`
                        background: rgba(255, 255, 255, 0.05);
                        border: none;
                        border-radius: 4px;
                        width: 20px;
                        height: 20px;
                        color: #a0a0a0;
                        font-size: 0.875rem;
                        line-height: 1;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                        
                        &:hover {
                          background: rgba(255, 255, 255, 0.1);
                          color: #ffffff;
                        }
                      `}
                                        >
                                            −
                                        </button>
                                    </div>
                                </div>

                                <div
                                    css={css`
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem;
                    font-size: 0.6875rem;
                    margin-bottom: 0.625rem;
                  `}
                                >
                                    <div>
                                        <div css={css` color: #a0a0a0; `}>Entry Price</div>
                                        <div css={css` color: #ffffff; font-weight: 600; `}>
                                            ${parseFloat(displayPosition.entryPrice).toFixed(4)}
                                        </div>
                                    </div>
                                    <div>
                                        <div css={css` color: #a0a0a0; `}>Mark Price</div>
                                        <div css={css` color: #ffffff; font-weight: 600; `}>
                                            ${parseFloat(displayPosition.currentPrice).toFixed(4)}
                                        </div>
                                    </div>
                                    <div>
                                        <div css={css` color: #a0a0a0; `}>Liq. Price</div>
                                        <div css={css` color: #ff4d4d; font-weight: 600; `}>
                                            ${parseFloat(displayPosition.liquidationPrice).toFixed(4)}
                                        </div>
                                    </div>
                                    <div>
                                        <div css={css` color: #a0a0a0; `}>Size</div>
                                        <div css={css` color: #ffffff; font-weight: 600; `}>
                                            {parseFloat(displayPosition.size).toFixed(2)} HBAR
                                        </div>
                                    </div>
                                </div>

                                {/* Margin Health Bar */}
                                <div
                                    css={css`
                    padding-top: 0.625rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
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
                                        <span css={css` font-size: 0.75rem; color: #a0a0a0; `}>
                                            Margin Health
                                        </span>
                                        <span
                                            css={css`
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: ${parseFloat(displayPosition.marginRatio) > 20 ? "#4ade80" : parseFloat(displayPosition.marginRatio) > 10 ? "#fbbf24" : "#ff4d4d"};
                      `}
                                        >
                                            {displayPosition.marginRatio}%
                                        </span>
                                    </div>
                                    <div
                                        css={css`
                      width: 100%;
                      height: 6px;
                      background: rgba(255, 255, 255, 0.1);
                      border-radius: 3px;
                      overflow: hidden;
                    `}
                                    >
                                        <div
                                            css={css`
                        height: 100%;
                        width: ${Math.min(parseFloat(displayPosition.marginRatio), 100)}%;
                        background: ${parseFloat(displayPosition.marginRatio) > 20
                                                    ? "linear-gradient(90deg, #4ade80, #22c55e)"
                                                    : parseFloat(displayPosition.marginRatio) > 10
                                                        ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                                                        : "linear-gradient(90deg, #ff4d4d, #dc2626)"};
                        transition: all 0.3s ease;
                      `}
                                        />
                                    </div>
                                </div>

                                <div
                                    css={css`
                    margin-top: 0.625rem;
                    display: flex;
                    gap: 0.5rem;
                  `}
                                >
                                    <button
                                        onClick={async () => {
                                            setIsClosingSinglePosition(true);
                                            try {
                                                const txHash = await closePosition();
                                                showSuccess("Position Closed!", "Your position has been closed", txHash);
                                            } catch (error: any) {
                                                showError("Failed to Close Position", error.message || "Transaction failed");
                                            } finally {
                                                setIsClosingSinglePosition(false);
                                            }
                                        }}
                                        disabled={isClosingSinglePosition}
                                        css={css`
                      flex: 1;
                      padding: 0.5rem;
                      background: rgba(255, 77, 77, 0.2);
                      border: 1px solid rgba(255, 77, 77, 0.5);
                      border-radius: 6px;
                      color: #ff4d4d;
                      font-weight: 600;
                      font-size: 0.6875rem;
                      cursor: pointer;
                      transition: all 0.2s;

                      &:hover:not(:disabled) {
                        background: rgba(255, 77, 77, 0.3);
                      }

                      &:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                      }
                    `}
                                    >
                                        {isClosingSinglePosition ? "Closing..." : "Close Position"}
                                    </button>
                                </div>
                            </div>
                        )}


                    </div>


                </div>

                {/* Positions */}
                <div
                    css={css`
            background: rgba(12, 13, 16, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 24px;
            padding: 1.5rem;
          `}
                >
                    <h3
                        css={css`
              font-size: 1.125rem;
              font-weight: 700;
              color: #ffffff;
              margin-bottom: 1rem;
            `}
                    >
                        Open Positions
                    </h3>

                    {positions.length === 0 ? (
                        <div
                            css={css`
                text-align: center;
                padding: 2rem;
                color: #a0a0a0;
              `}
                        >
                            No open positions
                        </div>
                    ) : (
                        <div
                            css={css`
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
              `}
                        >
                            {positions.map((position) => (
                                <div
                                    key={position.id}
                                    onClick={() => {
                                        setSelectedPositionId(position.id);
                                        setHasManuallyClosedOverlay(false);
                                    }}
                                    css={css`
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid ${selectedPositionId === position.id ? "rgba(220, 253, 143, 0.3)" : "rgba(255, 255, 255, 0.08)"};
                    border-radius: 12px;
                    padding: 1rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    
                    &:hover {
                      background: rgba(0, 0, 0, 0.4);
                      border-color: rgba(220, 253, 143, 0.2);
                    }
                  `}
                                >
                                    <div
                                        css={css`
                      display: grid;
                      grid-template-columns: repeat(6, 1fr);
                      gap: 1rem;
                      align-items: center;
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
                                                Asset
                                            </div>
                                            <div
                                                css={css`
                          font-weight: 600;
                          color: #ffffff;
                          display: flex;
                          align-items: center;
                          gap: 0.375rem;
                        `}
                                            >
                                                {position.asset}
                                                <span
                                                    css={css`
                            background: ${position.side === "long"
                                                            ? "rgba(74, 222, 128, 0.2)"
                                                            : "rgba(255, 77, 77, 0.2)"};
                            color: ${position.side === "long" ? "#4ade80" : "#ff4d4d"};
                            padding: 0.125rem 0.375rem;
                            border-radius: 4px;
                            font-size: 0.625rem;
                            font-weight: 700;
                            text-transform: uppercase;
                          `}
                                                >
                                                    {position.side}
                                                </span>
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
                                                Size
                                            </div>
                                            <div
                                                css={css`
                          font-weight: 600;
                          color: #ffffff;
                        `}
                                            >
                                                {position.size.toLocaleString()}
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
                                                Entry
                                            </div>
                                            <div
                                                css={css`
                          font-weight: 600;
                          color: #ffffff;
                        `}
                                            >
                                                ${position.entryPrice.toFixed(4)}
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
                                                Mark Price
                                            </div>
                                            <div
                                                css={css`
                          font-weight: 600;
                          color: #ffffff;
                        `}
                                            >
                                                ${position.currentPrice.toFixed(4)}
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
                                                PnL
                                            </div>
                                            <div
                                                css={css`
                          font-weight: 700;
                          color: ${position.pnl >= 0 ? "#4ade80" : "#ff4d4d"};
                        `}
                                            >
                                                ${position.pnl.toFixed(2)} ({position.pnlPercent >= 0 ? "+" : ""}
                                                {position.pnlPercent.toFixed(2)}%)
                                            </div>
                                        </div>

                                        <div>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    setClosingPositionId(position.id);
                                                    try {
                                                        const txHash = await closePosition(position.id);
                                                        showSuccess("Position Closed!", "Your position has been closed successfully", txHash);
                                                    } catch (error: any) {
                                                        showError("Failed to Close Position", error.message || "Transaction failed");
                                                    } finally {
                                                        setClosingPositionId(null);
                                                    }
                                                }}
                                                disabled={closingPositionId === position.id}
                                                css={css`
                          width: 100%;
                          padding: 0.5rem 1rem;
                          background: rgba(255, 77, 77, 0.1);
                          border: 1px solid rgba(255, 77, 77, 0.3);
                          border-radius: 8px;
                          color: #ff4d4d;
                          font-weight: 600;
                          font-size: 0.875rem;
                          cursor: pointer;
                          transition: all 0.2s;

                          &:hover {
                            background: rgba(255, 77, 77, 0.2);
                          }

                          &:disabled {
                            opacity: 0.5;
                            cursor: not-allowed;
                          }
                        `}
                                            >
                                                {closingPositionId === position.id ? "Closing..." : "Close"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column - Trading Panel */}
            <div
                css={css`
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        `}
            >
                {/* Order Panel */}
                <div
                    css={css`
            background: rgba(12, 13, 16, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 24px;
            padding: 1.5rem;
          `}
                >
                    {/* Order Type Tabs */}
                    <div
                        css={css`
              display: flex;
              gap: 0.5rem;
              background: rgba(0, 0, 0, 0.3);
              padding: 0.375rem;
              border-radius: 12px;
              margin-bottom: 1.5rem;
            `}
                    >
                        <button
                            onClick={() => setOrderType("market")}
                            css={css`
                flex: 1;
                padding: 0.625rem;
                background: ${orderType === "market"
                                    ? "rgba(220, 253, 143, 0.15)"
                                    : "transparent"};
                border: ${orderType === "market"
                                    ? "1px solid #dcfd8f"
                                    : "1px solid transparent"};
                border-radius: 8px;
                color: ${orderType === "market" ? "#dcfd8f" : "rgba(144, 161, 185, 1)"};
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;

                &:hover {
                  background: ${orderType === "market"
                                    ? "rgba(220, 253, 143, 0.15)"
                                    : "rgba(255, 255, 255, 0.05)"};
                }
              `}
                        >
                            Market
                        </button>
                        <button
                            onClick={() => setOrderType("limit")}
                            css={css`
                flex: 1;
                padding: 0.625rem;
                background: ${orderType === "limit"
                                    ? "rgba(220, 253, 143, 0.15)"
                                    : "transparent"};
                border: ${orderType === "limit"
                                    ? "1px solid #dcfd8f"
                                    : "1px solid transparent"};
                border-radius: 8px;
                color: ${orderType === "limit" ? "#dcfd8f" : "rgba(144, 161, 185, 1)"};
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;

                &:hover {
                  background: ${orderType === "limit"
                                    ? "rgba(220, 253, 143, 0.15)"
                                    : "rgba(255, 255, 255, 0.05)"};
                }
              `}
                        >
                            Limit
                        </button>
                    </div>

                    {/* Leverage Selector */}
                    <div
                        css={css`
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
                                Leverage
                            </span>
                            <span
                                css={css`
                  font-size: 1rem;
                  font-weight: 700;
                  color: #dcfd8f;
                `}
                            >
                                {leverage}x
                            </span>
                        </div>
                        <div
                            css={css`
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 0.5rem;
              `}
                        >
                            {leverageOptions.map((lev) => (
                                <button
                                    key={lev}
                                    onClick={() => setLeverage(lev)}
                                    css={css`
                    padding: 0.5rem;
                    background: ${leverage === lev
                                            ? "rgba(220, 253, 143, 0.15)"
                                            : "rgba(0, 0, 0, 0.3)"};
                    border: 1px solid
                      ${leverage === lev
                                            ? "rgba(220, 253, 143, 0.3)"
                                            : "rgba(255, 255, 255, 0.08)"};
                    border-radius: 8px;
                    color: ${leverage === lev ? "#dcfd8f" : "#ffffff"};
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
                                    {lev}x
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Limit Price (only for limit orders) */}
                    {orderType === "limit" && (
                        <div
                            css={css`
                margin-bottom: 1.5rem;
              `}
                        >
                            <label
                                css={css`
                  display: block;
                  font-size: 0.875rem;
                  color: #a0a0a0;
                  margin-bottom: 0.5rem;
                `}
                            >
                                Limit Price
                            </label>
                            <input
                                type="number"
                                value={limitPrice}
                                onChange={(e) => setLimitPrice(e.target.value)}
                                placeholder="0.00"
                                css={css`
                  width: 100%;
                  background: rgba(0, 0, 0, 0.3);
                  border: 1px solid rgba(255, 255, 255, 0.08);
                  border-radius: 12px;
                  padding: 0.875rem;
                  color: #ffffff;
                  font-size: 1rem;
                  outline: none;
                  transition: all 0.2s;

                  &:focus {
                    border-color: rgba(220, 253, 143, 0.3);
                    background: rgba(0, 0, 0, 0.4);
                  }

                  &::placeholder {
                    color: rgba(255, 255, 255, 0.3);
                  }
                `}
                            />
                        </div>
                    )}

                    {/* Amount Input */}
                    <div
                        css={css`
              margin-bottom: 1.5rem;
            `}
                    >
                        <label
                            css={css`
                display: block;
                font-size: 0.875rem;
                color: #a0a0a0;
                margin-bottom: 0.5rem;
              `}
                        >
                            Position Size (HBAR)
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            css={css`
                width: 100%;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 0.875rem;
                color: #ffffff;
                font-size: 1rem;
                outline: none;
                transition: all 0.2s;

                &:focus {
                  border-color: rgba(220, 253, 143, 0.3);
                  background: rgba(0, 0, 0, 0.4);
                }

                &::placeholder {
                  color: rgba(255, 255, 255, 0.3);
                }
              `}
                        />
                    </div>

                    {/* Long/Short Buttons */}
                    <div
                        css={css`
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 0.75rem;
            `}
                    >
                        <button
                            onClick={async () => {
                                setIsOpeningLong(true);
                                try {
                                    if (!amount || parseFloat(amount) <= 0) return;

                                    // Check if user has enough balance
                                    const positionSize = parseFloat(amount);
                                    const availableBalance = parseFloat(balance.available);

                                    if (availableBalance === 0) {
                                        showError("No Balance", "Please deposit HBAR first using the Deposit button above");
                                        return;
                                    }

                                    if (positionSize > availableBalance) {
                                        showError("Insufficient Balance", `You need ${positionSize.toFixed(2)} HBAR but only have ${availableBalance.toFixed(2)} HBAR available`);
                                        return;
                                    }

                                    const txHash = await openPosition(true, amount, leverage);
                                    showSuccess("Position Opened!", `Opened LONG position with ${leverage}x leverage`, txHash);
                                    setAmount("");
                                } catch (error: any) {
                                    const errorMsg = error.message || "Transaction failed";
                                    if (errorMsg.includes("Insufficient available balance")) {
                                        showError("Insufficient Balance", "Please deposit more HBAR to your perps account");
                                    } else {
                                        showError("Failed to Open Position", errorMsg);
                                    }
                                } finally {
                                    setIsOpeningLong(false);
                                }
                            }}
                            css={css`
                padding: 0.875rem;
                background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
                border: none;
                border-radius: 10px;
                color: #ffffff;
                font-size: 0.875rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.4rem;

                &:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 12px 24px rgba(74, 222, 128, 0.3);
                }

                &:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                  transform: none;
                }
              `}
                            disabled={!connection || !amount || parseFloat(amount) <= 0 || isOpeningLong}
                        >
                            <TrendUp size={18} weight="bold" />
                            {isOpeningLong ? "Opening Long..." : "Long"}
                        </button>

                        <button
                            onClick={async () => {
                                setIsOpeningShort(true);
                                try {
                                    if (!amount || parseFloat(amount) <= 0) return;

                                    // Check if user has enough balance
                                    const positionSize = parseFloat(amount);
                                    const availableBalance = parseFloat(balance.available);

                                    if (availableBalance === 0) {
                                        showError("No Balance", "Please deposit HBAR first using the Deposit button above");
                                        return;
                                    }

                                    if (positionSize > availableBalance) {
                                        showError("Insufficient Balance", `You need ${positionSize.toFixed(2)} HBAR but only have ${availableBalance.toFixed(2)} HBAR available`);
                                        return;
                                    }

                                    const txHash = await openPosition(false, amount, leverage);
                                    showSuccess("Position Opened!", `Opened SHORT position with ${leverage}x leverage`, txHash);
                                    setAmount("");
                                } catch (error: any) {
                                    const errorMsg = error.message || "Transaction failed";
                                    if (errorMsg.includes("Insufficient available balance")) {
                                        showError("Insufficient Balance", "Please deposit more HBAR to your perps account");
                                    } else {
                                        showError("Failed to Open Position", errorMsg);
                                    }
                                } finally {
                                    setIsOpeningShort(false);
                                }
                            }}
                            css={css`
                padding: 0.875rem;
                background: linear-gradient(135deg, #ff4d4d 0%, #dc2626 100%);
                border: none;
                border-radius: 10px;
                color: #ffffff;
                font-size: 0.875rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.4rem;

                &:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 12px 24px rgba(255, 77, 77, 0.3);
                }

                &:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                  transform: none;
                }
              `}
                            disabled={!connection || !amount || parseFloat(amount) <= 0 || isOpeningShort}
                        >
                            <TrendDown size={18} weight="bold" />
                            {isOpeningShort ? "Opening Short..." : "Short"}
                        </button>
                    </div>

                    {/* Order Info */}
                    {amount && parseFloat(amount) > 0 && (
                        <div
                            css={css`
                margin-top: 1.5rem;
                padding: 1rem;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
              `}
                        >
                            <div
                                css={css`
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 0.5rem;
                `}
                            >
                                <span
                                    css={css`
                    font-size: 0.875rem;
                    color: #a0a0a0;
                  `}
                                >
                                    Position Size
                                </span>
                                <span
                                    css={css`
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #ffffff;
                  `}
                                >
                                    {(parseFloat(amount) * leverage).toFixed(2)} HBAR
                                </span>
                            </div>
                            <div
                                css={css`
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 0.5rem;
                `}
                            >
                                <span
                                    css={css`
                    font-size: 0.875rem;
                    color: #a0a0a0;
                  `}
                                >
                                    Est. Liquidation Price
                                </span>
                                <span
                                    css={css`
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #ff4d4d;
                  `}
                                >
                                    $0.0471
                                </span>
                            </div>
                            <div
                                css={css`
                  display: flex;
                  justify-content: space-between;
                `}
                            >
                                <span
                                    css={css`
                    font-size: 0.875rem;
                    color: #a0a0a0;
                  `}
                                >
                                    Trading Fee
                                </span>
                                <span
                                    css={css`
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #ffffff;
                  `}
                                >
                                    {(parseFloat(amount) * 0.001).toFixed(4)} HBAR
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Account Info */}
                <div
                    css={css`
            background: rgba(12, 13, 16, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 24px;
            padding: 1.5rem;
          `}
                >
                    <h3
                        css={css`
              font-size: 1.125rem;
              font-weight: 700;
              color: #ffffff;
              margin-bottom: 1rem;
            `}
                    >
                        Account
                    </h3>

                    <div
                        css={css`
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
            `}
                    >
                        <div
                            css={css`
                display: flex;
                justify-content: space-between;
              `}
                        >
                            <span
                                css={css`
                  font-size: 0.875rem;
                  color: #a0a0a0;
                `}
                            >
                                Available Balance
                            </span>
                            <span
                                css={css`
                  font-size: 0.875rem;
                  font-weight: 600;
                  color: #ffffff;
                `}
                            >
                                {parseFloat(balance.available).toFixed(2)} HBAR
                            </span>
                        </div>

                        <div
                            css={css`
                display: flex;
                justify-content: space-between;
              `}
                        >
                            <span
                                css={css`
                  font-size: 0.875rem;
                  color: #a0a0a0;
                `}
                            >
                                Total Equity
                            </span>
                            <span
                                css={css`
                  font-size: 0.875rem;
                  font-weight: 600;
                  color: #ffffff;
                `}
                            >
                                {(parseFloat(balance.total) + (position ? parseFloat(position.unrealizedPnL) : 0)).toFixed(2)} HBAR
                            </span>
                        </div>

                        <div
                            css={css`
                display: flex;
                justify-content: space-between;
              `}
                        >
                            <span
                                css={css`
                  font-size: 0.875rem;
                  color: #a0a0a0;
                `}
                            >
                                Unrealized PnL
                            </span>
                            <span
                                css={css`
                  font-size: 0.875rem;
                  font-weight: 700;
                  color: ${position && parseFloat(position.unrealizedPnL) >= 0 ? "#4ade80" : "#ff4d4d"};
                `}
                            >
                                {position ? (parseFloat(position.unrealizedPnL) >= 0 ? "+" : "") + parseFloat(position.unrealizedPnL).toFixed(2) + " HBAR" : "0.00 HBAR"}
                            </span>
                        </div>

                        <div
                            css={css`
                display: flex;
                justify-content: space-between;
              `}
                        >
                            <span
                                css={css`
                  font-size: 0.875rem;
                  color: #a0a0a0;
                `}
                            >
                                Margin Ratio
                            </span>
                            <span
                                css={css`
                  font-size: 0.875rem;
                  font-weight: 600;
                  color: #4ade80;
                `}
                            >
                                {position ? position.marginRatio + "%" : "N/A"}
                            </span>
                        </div>

                        {/* Deposit/Withdraw Buttons */}
                        <div
                            css={css`
                display: flex;
                gap: 0.75rem;
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
              `}
                        >
                            <button
                                onClick={() => {
                                    setShowDepositForm(!showDepositForm);
                                    setShowWithdrawForm(false);
                                    setDepositAmount("");
                                }}
                                disabled={!connection || isDepositing}
                                css={css`
                  flex: 1;
                  padding: 0.75rem;
                  background: ${showDepositForm ? "rgba(220, 253, 143, 0.15)" : "rgba(220, 253, 143, 0.05)"};
                  border: 1px solid ${showDepositForm ? "rgba(220, 253, 143, 0.4)" : "rgba(220, 253, 143, 0.2)"};
                  border-radius: 8px;
                  color: #dcfd8f;
                  font-weight: 600;
                  font-size: 0.875rem;
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover:not(:disabled) {
                    background: rgba(220, 253, 143, 0.15);
                    border-color: rgba(220, 253, 143, 0.4);
                  }

                  &:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                  }
                `}
                            >
                                {isDepositing ? "Depositing..." : "Deposit"}
                            </button>

                            <button
                                onClick={() => {
                                    const maxWithdraw = parseFloat(balance.available);
                                    if (maxWithdraw <= 0) {
                                        showError("No Balance", "No HBAR available to withdraw");
                                        return;
                                    }
                                    setShowWithdrawForm(!showWithdrawForm);
                                    setShowDepositForm(false);
                                    setWithdrawAmount("");
                                }}
                                disabled={!connection || isWithdrawing || parseFloat(balance.available) <= 0}
                                css={css`
                  flex: 1;
                  padding: 0.75rem;
                  background: ${showWithdrawForm ? "rgba(220, 253, 143, 0.15)" : "rgba(220, 253, 143, 0.05)"};
                  border: 1px solid ${showWithdrawForm ? "rgba(220, 253, 143, 0.4)" : "rgba(220, 253, 143, 0.2)"};
                  border-radius: 8px;
                  color: #dcfd8f;
                  font-weight: 600;
                  font-size: 0.875rem;
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover:not(:disabled) {
                    background: rgba(220, 253, 143, 0.15);
                    border-color: rgba(220, 253, 143, 0.4);
                  }

                  &:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                  }
                `}
                            >
                                {isWithdrawing ? "Withdrawing..." : "Withdraw"}
                            </button>
                        </div>

                        {/* Deposit Form */}
                        {showDepositForm && (
                            <div
                                css={css`
                  margin-top: 1rem;
                  padding: 1rem;
                  background: rgba(220, 253, 143, 0.05);
                  border: 1px solid rgba(220, 253, 143, 0.2);
                  border-radius: 12px;
                  animation: slideDown 0.2s ease-out;

                  @keyframes slideDown {
                    from {
                      opacity: 0;
                      transform: translateY(-10px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
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
                                        Wallet Balance
                                    </span>
                                    <span
                                        css={css`
                      font-size: 0.875rem;
                      font-weight: 600;
                      color: #dcfd8f;
                    `}
                                    >
                                        {parseFloat(walletBalance).toFixed(2)} HBAR
                                    </span>
                                </div>

                                <div
                                    css={css`
                    position: relative;
                    margin-bottom: 0.75rem;
                  `}
                                >
                                    <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        placeholder="0.00"
                                        css={css`
                      width: 100%;
                      background: rgba(0, 0, 0, 0.3);
                      border: 1px solid rgba(220, 253, 143, 0.3);
                      border-radius: 8px;
                      padding: 0.75rem;
                      padding-right: 4rem;
                      color: #ffffff;
                      font-size: 1rem;
                      font-weight: 600;
                      outline: none;
                      transition: all 0.2s;

                      &:focus {
                        border-color: rgba(220, 253, 143, 0.5);
                        background: rgba(0, 0, 0, 0.5);
                      }

                      &::placeholder {
                        color: rgba(255, 255, 255, 0.3);
                      }
                    `}
                                    />
                                    <button
                                        onClick={() => {
                                            const maxDeposit = Math.max(0, parseFloat(walletBalance) - 0.1); // Leave 0.1 for gas
                                            setDepositAmount(maxDeposit.toFixed(2));
                                        }}
                                        css={css`
                      position: absolute;
                      right: 12px;
                      top: 50%;
                      transform: translateY(-50%);
                      background: rgba(220, 253, 143, 0.2);
                      border: 1px solid rgba(220, 253, 143, 0.4);
                      border-radius: 6px;
                      padding: 0.25rem 0.75rem;
                      color: #dcfd8f;
                      font-size: 0.75rem;
                      font-weight: 700;
                      cursor: pointer;
                      transition: all 0.2s;

                      &:hover {
                        background: rgba(220, 253, 143, 0.3);
                      }
                    `}
                                    >
                                        MAX
                                    </button>
                                </div>

                                <button
                                    onClick={async () => {
                                        if (!depositAmount || parseFloat(depositAmount) <= 0) return;
                                        setIsDepositing(true);
                                        try {
                                            const txHash = await depositCollateral(depositAmount);
                                            showSuccess("Deposit Successful!", `Deposited ${depositAmount} HBAR`, txHash);
                                            setShowDepositForm(false);
                                            setDepositAmount("");
                                        } catch (error: any) {
                                            showError("Deposit Failed", error.message || "Transaction failed");
                                        } finally {
                                            setIsDepositing(false);
                                        }
                                    }}
                                    disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isDepositing}
                                    css={css`
                    width: 100%;
                    padding: 0.75rem;
                    background: linear-gradient(135deg, #dcfd8f 0%, #c5e87a 100%);
                    border: none;
                    border-radius: 8px;
                    color: #0c0d10;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;

                    &:hover:not(:disabled) {
                      transform: translateY(-2px);
                      box-shadow: 0 8px 16px rgba(220, 253, 143, 0.3);
                    }

                    &:disabled {
                      opacity: 0.5;
                      cursor: not-allowed;
                      transform: none;
                    }
                  `}
                                >
                                    {isDepositing ? "Depositing..." : "Confirm Deposit"}
                                </button>
                            </div>
                        )}

                        {/* Withdraw Form */}
                        {showWithdrawForm && (
                            <div
                                css={css`
                  margin-top: 1rem;
                  padding: 1rem;
                  background: rgba(220, 253, 143, 0.05);
                  border: 1px solid rgba(220, 253, 143, 0.2);
                  border-radius: 12px;
                  animation: slideDown 0.2s ease-out;

                  @keyframes slideDown {
                    from {
                      opacity: 0;
                      transform: translateY(-10px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
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
                                        Available to Withdraw
                                    </span>
                                    <span
                                        css={css`
                      font-size: 0.875rem;
                      font-weight: 600;
                      color: #dcfd8f;
                    `}
                                    >
                                        {parseFloat(balance.available).toFixed(2)} HBAR
                                    </span>
                                </div>

                                <div
                                    css={css`
                    position: relative;
                    margin-bottom: 0.75rem;
                  `}
                                >
                                    <input
                                        type="number"
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        placeholder="0.00"
                                        css={css`
                      width: 100%;
                      background: rgba(0, 0, 0, 0.3);
                      border: 1px solid rgba(220, 253, 143, 0.3);
                      border-radius: 8px;
                      padding: 0.75rem;
                      padding-right: 4rem;
                      color: #ffffff;
                      font-size: 1rem;
                      font-weight: 600;
                      outline: none;
                      transition: all 0.2s;

                      &:focus {
                        border-color: rgba(220, 253, 143, 0.5);
                        background: rgba(0, 0, 0, 0.5);
                      }

                      &::placeholder {
                        color: rgba(255, 255, 255, 0.3);
                      }
                    `}
                                    />
                                    <button
                                        onClick={() => setWithdrawAmount(balance.available)}
                                        css={css`
                      position: absolute;
                      right: 12px;
                      top: 50%;
                      transform: translateY(-50%);
                      background: rgba(220, 253, 143, 0.2);
                      border: 1px solid rgba(220, 253, 143, 0.4);
                      border-radius: 6px;
                      padding: 0.25rem 0.75rem;
                      color: #dcfd8f;
                      font-size: 0.75rem;
                      font-weight: 700;
                      cursor: pointer;
                      transition: all 0.2s;

                      &:hover {
                        background: rgba(255, 77, 77, 0.3);
                      }
                    `}
                                    >
                                        MAX
                                    </button>
                                </div>

                                <button
                                    onClick={async () => {
                                        if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
                                        if (parseFloat(withdrawAmount) > parseFloat(balance.available)) {
                                            showError("Insufficient Balance", "Amount exceeds available balance");
                                            return;
                                        }
                                        setIsWithdrawing(true);
                                        try {
                                            const txHash = await withdrawCollateral(withdrawAmount);
                                            showSuccess("Withdrawal Successful!", `Withdrew ${withdrawAmount} HBAR`, txHash);
                                            setShowWithdrawForm(false);
                                            setWithdrawAmount("");
                                        } catch (error: any) {
                                            showError("Withdrawal Failed", error.message || "Transaction failed");
                                        } finally {
                                            setIsWithdrawing(false);
                                        }
                                    }}
                                    disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > parseFloat(balance.available) || isWithdrawing}
                                    css={css`
                    width: 100%;
                    padding: 0.75rem;
                    background: linear-gradient(135deg, #dcfd8f 0%, #c5e87a 100%);
                    border: none;
                    border-radius: 8px;
                    color: #0c0d10;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;

                    &:hover:not(:disabled) {
                      transform: translateY(-2px);
                      box-shadow: 0 8px 16px rgba(220, 253, 143, 0.3);
                    }

                    &:disabled {
                      opacity: 0.5;
                      cursor: not-allowed;
                      transform: none;
                    }
                  `}
                                >
                                    {isWithdrawing ? "Withdrawing..." : "Confirm Withdrawal"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Asset Selector Dropdown */}
            {showAssetSelector && (
                <div
                    css={css`
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
          `}
                    onClick={() => setShowAssetSelector(false)}
                >
                    <div
                        css={css`
              background: #0c0d10;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 24px;
              padding: 1.5rem;
              max-width: 400px;
              width: 90%;
            `}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3
                            css={css`
                font-size: 1.25rem;
                font-weight: 700;
                color: #ffffff;
                margin-bottom: 1rem;
              `}
                        >
                            Select Asset
                        </h3>

                        <div
                            css={css`
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
              `}
                        >
                            {assets.map((asset) => (
                                <button
                                    key={asset}
                                    onClick={() => {
                                        setSelectedAsset(asset);
                                        setShowAssetSelector(false);
                                    }}
                                    css={css`
                    padding: 1rem;
                    background: ${selectedAsset === asset
                                            ? "rgba(220, 253, 143, 0.1)"
                                            : "rgba(0, 0, 0, 0.3)"};
                    border: 1px solid
                      ${selectedAsset === asset
                                            ? "rgba(220, 253, 143, 0.3)"
                                            : "rgba(255, 255, 255, 0.08)"};
                    border-radius: 12px;
                    color: #ffffff;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;

                    &:hover {
                      background: rgba(220, 253, 143, 0.1);
                      border-color: rgba(220, 253, 143, 0.3);
                    }
                  `}
                                >
                                    {asset}/USDT
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* All Positions Display */}
            {allPositions && allPositions.length > 0 && (
                <AllPositionsDisplay
                    positions={allPositions}
                    onClose={async (positionId) => {
                        console.log('Setting closingPositionId to:', positionId);
                        setClosingPositionId(positionId);
                        try {
                            await closePosition(positionId);
                            showSuccess("Position closed successfully!");
                        } catch (error: any) {
                            showError(error.message || "Failed to close position");
                        } finally {
                            console.log('Clearing closingPositionId');
                            setClosingPositionId(null);
                        }
                    }}
                    closingPositionId={closingPositionId}
                />
            )}
        </div>
    );
};

export default PrepsInterface;
