import { useState, useEffect } from "react";
import { css } from "@emotion/react";
import { useWallet } from "@/contexts/WalletContext";
import { db } from "@/services/database";
import { useAssetExchange } from "@/hooks/useAssetExchange";
import { TrendUp, TrendDown, CurrencyDollar, Target, Trophy, ChartLine } from "@phosphor-icons/react";

// Import asset logos
import bitcoinLogo from "@/assets/RWA/bitcoin.png";
import ethLogo from "@/assets/RWA/eth.png";
import teslaLogo from "@/assets/RWA/tesla-rwa-coin.png";
import appleLogo from "@/assets/RWA/apple.png";
import goldLogo from "@/assets/RWA/gold.png";
import spyLogo from "@/assets/RWA/s&p500.png";
import tbillLogo from "@/assets/RWA/TBILL.png";

const assetLogos: { [key: string]: string } = {
  "pTSLA": teslaLogo,
  "pAAPL": appleLogo,
  "pBTC": bitcoinLogo,
  "pETH": ethLogo,
  "pGOLD": goldLogo,
  "pSPY": spyLogo,
  "pTBILL": tbillLogo,
};

const assetNames: { [key: string]: string } = {
  "pTSLA": "Tesla Stock",
  "pAAPL": "Apple Stock",
  "pBTC": "Bitcoin",
  "pETH": "Ethereum",
  "pGOLD": "Gold",
  "pSPY": "S&P 500 ETF",
  "pTBILL": "Treasury Bills",
};

const supportedAssets = ["pTSLA", "pAAPL", "pBTC", "pETH", "pGOLD", "pSPY", "pTBILL"];

interface AssetPosition {
  symbol: string;
  amount: string;
  average_price: string;
  currentPrice: number;
  totalInvested: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

export default function ProfitLossDisplay() {
  console.log('🚀 ProfitLossDisplay component mounted');

  const { connection } = useWallet();
  const { getQuoteBuy } = useAssetExchange();
  const [positions, setPositions] = useState<AssetPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    totalInvested: 0,
    totalValue: 0,
    totalProfitLoss: 0,
    totalProfitLossPercent: 0,
  });

  console.log('🔗 Connection state:', connection?.account?.accountId);

  // Get real-time HBAR price from oracle
  const fetchHbarPrice = async (): Promise<number> => {
    try {
      console.log('💰 Fetching real-time HBAR price from oracle...');
      
      // Use pTBILL as reference since it should be close to $1.00
      const quote = await getQuoteBuy("pTBILL", "1.0"); // 1 HBAR → X pTBILL
      const tbillTokensOut = parseFloat(quote.tokensOut);
      
      if (tbillTokensOut > 0) {
        // If 1 HBAR gets us X pTBILL tokens, and pTBILL ≈ $1.044 (from your oracle)
        const tbillPriceUsd = 1.044; // From your oracle: $1.044257
        const hbarPriceUsd = tbillTokensOut * tbillPriceUsd;
        
        console.log(`💰 Real-time HBAR price: $${hbarPriceUsd.toFixed(6)} (via ${tbillTokensOut.toFixed(6)} pTBILL)`);
        return hbarPriceUsd;
      }
    } catch (error) {
      console.error('❌ Failed to get real-time HBAR price:', error);
    }
    
    // Fallback to your oracle's last known HBAR price
    const fallbackPrice = 0.145330; // From your oracle: $0.145330
    console.log(`⚠️ Using fallback HBAR price: $${fallbackPrice}`);
    return fallbackPrice;
  };

  // Fetch current prices using the same method as buy/sell (via getQuoteBuy)
  const fetchCurrentPrices = async (): Promise<{ [key: string]: number }> => {
    try {
      const prices: { [key: string]: number } = {};

      console.log('🔍 Fetching prices using getQuoteBuy (same as buy/sell)...');

      // Use a small amount (0.1 HBAR) to get exchange rates
      const testHbarAmount = "0.1";
      const hbarPriceUsd = 0.145; // From your oracle: ~$0.145

      for (const asset of supportedAssets) {
        try {
          console.log(`📊 Getting quote for ${asset}...`);

          // Get quote: 0.1 HBAR → X tokens (same as buy/sell functions)
          const quote = await getQuoteBuy(asset, testHbarAmount);
          const tokensOut = parseFloat(quote.tokensOut);

          if (tokensOut > 0 && !isNaN(tokensOut)) {
            // Price per token = 0.1 HBAR / tokens received
            const priceInHbar = 0.1 / tokensOut;
            // Convert to USD
            const priceInUsd = priceInHbar * hbarPriceUsd;

            // Sanity check
            if (priceInUsd > 0 && priceInUsd < 1000000) {
              prices[asset] = priceInUsd;
              console.log(`✅ ${asset}: $${priceInUsd.toFixed(2)} (via getQuoteBuy)`);
            } else {
              throw new Error(`Price seems unreasonable: $${priceInUsd}`);
            }
          } else {
            throw new Error(`Invalid tokens out: ${tokensOut}`);
          }
        } catch (error) {
          console.error(`❌ Failed to get price for ${asset}:`, error);

          // Use your actual oracle prices as fallback
          const fallbackPrices: { [key: string]: number } = {
            "pTSLA": 403.99,  // From your oracle: $403.989820
            "pAAPL": 268.51,  // From your oracle: $268.513450  
            "pBTC": 91539.53, // From your oracle: $91539.528766
            "pETH": 2993.67,  // From your oracle: $2993.668752
            "pGOLD": 4063.80, // From your oracle: $4063.803000
            "pSPY": 662.62,   // From your oracle: $662.624440
            "pTBILL": 1.04,   // From your oracle: $1.044257
          };
          prices[asset] = fallbackPrices[asset] || 0;
          console.log(`⚠️ ${asset}: Using fallback price $${prices[asset]}`);
        }
      }

      console.log('💰 Final prices:', prices);
      return prices;
    } catch (error) {
      console.error('Error fetching prices:', error);
      // Return your oracle's actual prices as fallback
      return {
        "pTSLA": 403.99,  // From your oracle: $403.989820
        "pAAPL": 268.51,  // From your oracle: $268.513450  
        "pBTC": 91539.53, // From your oracle: $91539.528766
        "pETH": 2993.67,  // From your oracle: $2993.668752
        "pGOLD": 4063.80, // From your oracle: $4063.803000
        "pSPY": 662.62,   // From your oracle: $662.624440
        "pTBILL": 1.04,   // From your oracle: $1.044257
      };
    }
  };

  useEffect(() => {
    const fetchProfitLoss = async () => {
      console.log('⚡ useEffect triggered, connection:', connection);

      if (!connection?.account?.accountId) {
        console.log('❌ No wallet account ID found');
        setIsLoading(false);
        return;
      }

      try {
        console.log('🔍 Fetching profit/loss data for:', connection.account.accountId);

        // Fetch real-time HBAR price, positions, and current prices
        const [realTimeHbarPrice, currentPrices] = await Promise.all([
          fetchHbarPrice(),
          fetchCurrentPrices()
        ]);
        
        // Get positions (keep historical prices as-is)
        const dbPositions = await db.getAssetProfitLoss(connection.account.accountId);
        console.log('📊 Raw DB Positions:', dbPositions);

        console.log('📊 DB Positions found:', dbPositions);
        console.log('💰 Current prices:', currentPrices);

        const enrichedPositions: AssetPosition[] = dbPositions.map(pos => {
          const currentPrice = currentPrices[pos.symbol] || 0;
          const averagePrice = parseFloat(pos.average_price || '0');
          const amount = parseFloat(pos.amount || '0');

          console.log(`📈 ${pos.symbol}: amount=${amount}, avgPrice=${averagePrice}, currentPrice=${currentPrice}`);

          // Handle NaN values
          const safeAveragePrice = isNaN(averagePrice) ? 0 : averagePrice;
          const safeAmount = isNaN(amount) ? 0 : amount;
          const safeCurrentPrice = isNaN(currentPrice) ? 0 : currentPrice;

          const totalInvested = safeAveragePrice * safeAmount;
          const currentValue = safeCurrentPrice * safeAmount;
          const profitLoss = currentValue - totalInvested;
          const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

          // Mock 24h change (random between -5% to +5%)
          const dayChangePercent = (Math.random() - 0.5) * 10;
          const dayChange = (safeCurrentPrice * dayChangePercent) / 100;

          return {
            symbol: pos.symbol,
            amount: pos.amount,
            average_price: pos.average_price,
            currentPrice: safeCurrentPrice,
            totalInvested: isNaN(totalInvested) ? 0 : totalInvested,
            currentValue: isNaN(currentValue) ? 0 : currentValue,
            profitLoss: isNaN(profitLoss) ? 0 : profitLoss,
            profitLossPercent: isNaN(profitLossPercent) ? 0 : profitLossPercent,
            dayChange: isNaN(dayChange) ? 0 : dayChange,
            dayChangePercent: isNaN(dayChangePercent) ? 0 : dayChangePercent,
          };
        });

        console.log('✨ Enriched positions:', enrichedPositions);

        // Calculate total stats
        const totalInvested = enrichedPositions.reduce((sum, pos) => sum + pos.totalInvested, 0);
        const totalValue = enrichedPositions.reduce((sum, pos) => sum + pos.currentValue, 0);
        const totalProfitLoss = totalValue - totalInvested;
        const totalProfitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

        setPositions(enrichedPositions);
        setTotalStats({
          totalInvested,
          totalValue,
          totalProfitLoss,
          totalProfitLossPercent,
        });
      } catch (error) {
        console.error('Error fetching profit/loss data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfitLoss();
  }, [connection]);

  // Add a refresh function that can be called after transactions
  const refreshProfitLoss = async () => {
    setIsLoading(true);
    if (!connection?.account?.accountId) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔄 Refreshing profit/loss data...');

      // Fetch real-time HBAR price and current prices
      const [realTimeHbarPrice, currentPrices] = await Promise.all([
        fetchHbarPrice(),
        fetchCurrentPrices()
      ]);
      
      // Get positions (keep historical prices as-is)
      const dbPositions = await db.getAssetProfitLoss(connection.account.accountId);
      console.log('🔄 Background refresh - DB Positions:', dbPositions);

      console.log('🔄 Refresh - DB Positions:', dbPositions);

      const enrichedPositions: AssetPosition[] = dbPositions.map(pos => {
        const currentAssetPrice = currentPrices[pos.symbol] || 0;
        const amount = parseFloat(pos.amount || '0');
        const averageHbarPrice = parseFloat(pos.average_hbar_price || '0'); // HBAR price when bought
        const totalHbarCost = parseFloat(pos.total_hbar_cost || '0'); // Total HBAR spent (e.g., 100 HBAR)
        
        const safeAmount = isNaN(amount) ? 0 : amount;
        const safeCurrentAssetPrice = isNaN(currentAssetPrice) ? 0 : currentAssetPrice;
        const safeAverageHbarPrice = isNaN(averageHbarPrice) ? 0 : averageHbarPrice;
        const safeTotalHbarCost = isNaN(totalHbarCost) ? 0 : totalHbarCost;

        // Total Invested = 100 HBAR × $0.15 (HBAR price when bought) = $15 (FIXED, never changes)
        const totalInvested = safeTotalHbarCost * safeAverageHbarPrice;
        
        // Current Value = tokens × current asset price (updates every 30s)
        const currentValue = safeAmount * safeCurrentAssetPrice;
        
        const profitLoss = currentValue - totalInvested;
        const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

        const dayChangePercent = (Math.random() - 0.5) * 10;
        const dayChange = (safeCurrentAssetPrice * dayChangePercent) / 100;

        return {
          symbol: pos.symbol,
          amount: pos.amount,
          average_price: pos.average_price,
          currentPrice: safeCurrentAssetPrice,
          totalInvested: isNaN(totalInvested) ? 0 : totalInvested,
          currentValue: isNaN(currentValue) ? 0 : currentValue,
          profitLoss: isNaN(profitLoss) ? 0 : profitLoss,
          profitLossPercent: isNaN(profitLossPercent) ? 0 : profitLossPercent,
          dayChange: isNaN(dayChange) ? 0 : dayChange,
          dayChangePercent: isNaN(dayChangePercent) ? 0 : dayChangePercent,
        };
      });

      const totalInvested = enrichedPositions.reduce((sum, pos) => sum + pos.totalInvested, 0);
      const totalValue = enrichedPositions.reduce((sum, pos) => sum + pos.currentValue, 0);
      const totalProfitLoss = totalValue - totalInvested;
      const totalProfitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

      setPositions(enrichedPositions);
      setTotalStats({
        totalInvested,
        totalValue,
        totalProfitLoss,
        totalProfitLossPercent,
      });
    } catch (error) {
      console.error('Error refreshing profit/loss data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Background refresh every 30 seconds (no loading state)
  useEffect(() => {
    const interval = setInterval(() => {
      if (connection?.account?.accountId) {
        // Background refresh without showing loading
        backgroundRefresh();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [connection]);

  // Background refresh function (no loading state)
  const backgroundRefresh = async () => {
    if (!connection?.account?.accountId) return;

    try {
      console.log('🔄 Background refresh (no loading)...');
      
      // Fetch real-time HBAR price and current prices
      const [realTimeHbarPrice, currentPrices] = await Promise.all([
        fetchHbarPrice(),
        fetchCurrentPrices()
      ]);
      
      // Get positions (don't convert historical prices, keep them as-is)
      const dbPositions = await db.getAssetProfitLoss(connection.account.accountId);
      
      const enrichedPositions: AssetPosition[] = dbPositions.map(pos => {
        const currentAssetPrice = currentPrices[pos.symbol] || 0;
        const amount = parseFloat(pos.amount || '0');
        const averageHbarPrice = parseFloat(pos.average_hbar_price || '0'); // HBAR price when bought
        const totalHbarCost = parseFloat(pos.total_hbar_cost || '0'); // Total HBAR spent (e.g., 100 HBAR)
        
        const safeAmount = isNaN(amount) ? 0 : amount;
        const safeCurrentAssetPrice = isNaN(currentAssetPrice) ? 0 : currentAssetPrice;
        const safeAverageHbarPrice = isNaN(averageHbarPrice) ? 0 : averageHbarPrice;
        const safeTotalHbarCost = isNaN(totalHbarCost) ? 0 : totalHbarCost;

        // Total Invested = 100 HBAR × $0.15 (HBAR price when bought) = $15 (FIXED, never changes)
        const totalInvested = safeTotalHbarCost * safeAverageHbarPrice;
        
        // Current Value = tokens × current asset price (updates every 30s)
        const currentValue = safeAmount * safeCurrentAssetPrice;
        
        const profitLoss = currentValue - totalInvested;
        const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
        
        const dayChangePercent = (Math.random() - 0.5) * 10;
        const dayChange = (safeCurrentAssetPrice * dayChangePercent) / 100;

        return {
          symbol: pos.symbol,
          amount: pos.amount,
          average_price: pos.average_price,
          currentPrice: safeCurrentAssetPrice,
          totalInvested: isNaN(totalInvested) ? 0 : totalInvested,
          currentValue: isNaN(currentValue) ? 0 : currentValue,
          profitLoss: isNaN(profitLoss) ? 0 : profitLoss,
          profitLossPercent: isNaN(profitLossPercent) ? 0 : profitLossPercent,
          dayChange: isNaN(dayChange) ? 0 : dayChange,
          dayChangePercent: isNaN(dayChangePercent) ? 0 : dayChangePercent,
        };
      });

      const totalInvested = enrichedPositions.reduce((sum, pos) => sum + pos.totalInvested, 0);
      const totalValue = enrichedPositions.reduce((sum, pos) => sum + pos.currentValue, 0);
      const totalProfitLoss = totalValue - totalInvested;
      const totalProfitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

      // Update state without loading indicator
      setPositions(enrichedPositions);
      setTotalStats({
        totalInvested,
        totalValue,
        totalProfitLoss,
        totalProfitLossPercent,
      });
    } catch (error) {
      console.error('Error in background refresh:', error);
    }
  };

  if (isLoading) {
    return (
      <div css={css`
        background: rgba(12, 13, 16, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 24px;
        padding: 2rem;
        text-align: center;
        color: #a0a0a0;
      `}>
        Loading profit/loss data...
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div css={css`
        background: rgba(12, 13, 16, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 24px;
        padding: 2rem;
        text-align: center;
      `}>
        <Trophy size={48} color="#dcfd8f" css={css`margin-bottom: 1rem;`} />
        <div css={css`
          color: #ffffff;
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        `}>
          No Investment History Yet
        </div>
        <div css={css`
          color: #a0a0a0;
          font-size: 0.875rem;
        `}>
          Start buying assets to track your profit & loss
        </div>
      </div>
    );
  }

  return (
    <div css={css`
      display: grid;
      gap: 1.5rem;
    `}>
      {/* Portfolio Performance Summary */}
      <div css={css`
        background: linear-gradient(135deg, rgba(220, 253, 143, 0.1) 0%, rgba(168, 212, 95, 0.05) 100%);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(220, 253, 143, 0.2);
        border-radius: 24px;
        padding: 1.5rem;
        position: relative;
        overflow: hidden;
        
        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #dcfd8f, transparent);
          animation: shimmer 3s infinite;
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}>
        <div css={css`
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        `}>
          <div css={css`
            background: linear-gradient(135deg, #dcfd8f 0%, #a8d45f 100%);
            border-radius: 12px;
            padding: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
          `}>
            <ChartLine size={24} color="#02302c" weight="bold" />
          </div>
          <div css={css`
            flex: 1;
          `}>
            <h2 css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: #ffffff;
              margin: 0;
            `}>Portfolio Performance</h2>
            <p css={css`
              font-size: 0.875rem;
              color: #a0a0a0;
              margin: 0;
            `}>Track your investment gains & losses</p>
          </div>
          <button
            onClick={refreshProfitLoss}
            disabled={isLoading}
            css={css`
              background: rgba(220, 253, 143, 0.1);
              border: 1px solid rgba(220, 253, 143, 0.3);
              border-radius: 8px;
              color: #dcfd8f;
              padding: 0.5rem 1rem;
              font-size: 0.75rem;
              font-weight: 600;
              cursor: ${isLoading ? 'not-allowed' : 'pointer'};
              transition: all 0.2s ease;
              
              &:hover {
                background: ${isLoading ? 'rgba(220, 253, 143, 0.1)' : 'rgba(220, 253, 143, 0.2)'};
                border-color: ${isLoading ? 'rgba(220, 253, 143, 0.3)' : 'rgba(220, 253, 143, 0.5)'};
              }
            `}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div css={css`
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        `}>
          <div css={css`
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 1rem;
          `}>
            <div css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-bottom: 0.5rem;
            `}>
              <CurrencyDollar size={16} color="#dcfd8f" />
              <span css={css`
                font-size: 0.75rem;
                color: #a0a0a0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              `}>Total Invested</span>
            </div>
            <div css={css`
              font-size: 1.5rem;
              font-weight: 700;
              color: #ffffff;
            `}>
              ${totalStats.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div css={css`
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 1rem;
          `}>
            <div css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-bottom: 0.5rem;
            `}>
              <Target size={16} color="#dcfd8f" />
              <span css={css`
                font-size: 0.75rem;
                color: #a0a0a0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              `}>Current Value</span>
            </div>
            <div css={css`
              font-size: 1.5rem;
              font-weight: 700;
              color: #ffffff;
            `}>
              ${totalStats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div css={css`
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid ${totalStats.totalProfitLoss >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
            border-radius: 16px;
            padding: 1rem;
          `}>
            <div css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-bottom: 0.5rem;
            `}>
              {totalStats.totalProfitLoss >= 0 ? (
                <TrendUp size={16} color="#22c55e" />
              ) : (
                <TrendDown size={16} color="#ef4444" />
              )}
              <span css={css`
                font-size: 0.75rem;
                color: #a0a0a0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              `}>Total P&L</span>
            </div>
            <div css={css`
              display: flex;
              align-items: baseline;
              gap: 0.5rem;
            `}>
              <div css={css`
                font-size: 1.5rem;
                font-weight: 700;
                color: ${totalStats.totalProfitLoss >= 0 ? '#22c55e' : '#ef4444'};
              `}>
                {totalStats.totalProfitLoss >= 0 ? '+' : ''}${totalStats.totalProfitLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div css={css`
                font-size: 0.875rem;
                font-weight: 600;
                color: ${totalStats.totalProfitLoss >= 0 ? '#22c55e' : '#ef4444'};
                background: ${totalStats.totalProfitLoss >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
                padding: 0.25rem 0.5rem;
                border-radius: 6px;
              `}>
                {totalStats.totalProfitLossPercent >= 0 ? '+' : ''}{totalStats.totalProfitLossPercent.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Asset Performance */}
      <div css={css`
        background: rgba(12, 13, 16, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 24px;
        padding: 1.5rem;
      `}>
        <div css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        `}>
          <h3 css={css`
            font-size: 1.125rem;
            font-weight: 700;
            color: #ffffff;
            margin: 0;
          `}>Asset Performance</h3>
          <div css={css`
            font-size: 0.75rem;
            color: #a0a0a0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          `}>
            {positions.length} Asset{positions.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div css={css`
          display: grid;
          gap: 0.75rem;
        `}>
          {positions
            .sort((a, b) => Math.abs(b.profitLoss) - Math.abs(a.profitLoss))
            .map((position) => (
              <div key={position.symbol} css={css`
              background: rgba(0, 0, 0, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 16px;
              padding: 1rem;
              transition: all 0.2s ease;
              
              &:hover {
                background: rgba(0, 0, 0, 0.4);
                border-color: rgba(220, 253, 143, 0.2);
                transform: translateY(-1px);
              }
            `}>
                <div css={css`
                display: grid;
                grid-template-columns: auto 1fr auto auto;
                gap: 1rem;
                align-items: center;
              `}>
                  {/* Asset Info */}
                  <div css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.75rem;
                `}>
                    <img
                      src={assetLogos[position.symbol]}
                      alt={position.symbol}
                      css={css`
                      width: 2.5rem;
                      height: 2.5rem;
                      border-radius: 50%;
                      border: 2px solid rgba(255, 255, 255, 0.1);
                    `}
                    />
                    <div>
                      <div css={css`
                      font-weight: 700;
                      color: #ffffff;
                      font-size: 0.9375rem;
                    `}>{position.symbol}</div>
                      <div css={css`
                      font-size: 0.75rem;
                      color: #a0a0a0;
                    `}>{assetNames[position.symbol]}</div>
                    </div>
                  </div>

                  {/* Holdings */}
                  <div css={css`
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 1rem;
                `}>
                    <div>
                      <div css={css`
                      font-size: 0.6875rem;
                      color: #a0a0a0;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      margin-bottom: 0.25rem;
                    `}>Holdings</div>
                      <div css={css`
                      font-weight: 600;
                      color: #ffffff;
                      font-size: 0.875rem;
                    `}>
                        {parseFloat(position.amount).toFixed(4)} {position.symbol}
                      </div>
                    </div>
                    <div>
                      <div css={css`
                      font-size: 0.6875rem;
                      color: #a0a0a0;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      margin-bottom: 0.25rem;
                    `}>Avg Price</div>
                      <div css={css`
                      font-weight: 600;
                      color: #ffffff;
                      font-size: 0.875rem;
                    `}>
                        {isNaN(parseFloat(position.average_price)) ? 'N/A' : `$${parseFloat(position.average_price).toFixed(2)}`}
                      </div>
                    </div>
                  </div>

                  {/* Current Price & 24h Change */}
                  <div css={css`
                  text-align: right;
                `}>
                    <div css={css`
                    font-weight: 700;
                    color: #ffffff;
                    font-size: 0.9375rem;
                    margin-bottom: 0.25rem;
                  `}>
                      ${position.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div css={css`
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 0.25rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: ${position.dayChangePercent >= 0 ? '#22c55e' : '#ef4444'};
                  `}>
                      {position.dayChangePercent >= 0 ? (
                        <TrendUp size={12} />
                      ) : (
                        <TrendDown size={12} />
                      )}
                      {position.dayChangePercent >= 0 ? '+' : ''}{position.dayChangePercent.toFixed(2)}%
                    </div>
                  </div>

                  {/* Profit/Loss */}
                  <div css={css`
                  text-align: right;
                `}>
                    <div css={css`
                    font-weight: 700;
                    color: ${position.profitLoss >= 0 ? '#22c55e' : '#ef4444'};
                    font-size: 0.9375rem;
                    margin-bottom: 0.25rem;
                  `}>
                      {position.profitLoss >= 0 ? '+' : ''}${position.profitLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div css={css`
                    display: inline-block;
                    font-size: 0.6875rem;
                    font-weight: 600;
                    color: ${position.profitLoss >= 0 ? '#22c55e' : '#ef4444'};
                    background: ${position.profitLoss >= 0 ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)'};
                    border: 1px solid ${position.profitLoss >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
                    border-radius: 6px;
                    padding: 0.25rem 0.5rem;
                  `}>
                      {position.profitLossPercent >= 0 ? '+' : ''}{position.profitLossPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}