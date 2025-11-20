import { useState, useEffect } from "react";
import { css } from "@emotion/react";
import { ethers } from "ethers";
import { useAssetExchange } from "@/hooks/useAssetExchange";
import { useToast } from "@/contexts/ToastContext";
import { useWallet } from "@/contexts/WalletContext";
import TokenSelector from "./TokenSelector";
import ProfitLossDisplay from "./ProfitLossDisplay";

// Import asset logos
import bitcoinLogo from "@/assets/RWA/bitcoin.png";
import ethLogo from "@/assets/RWA/eth.png";
import teslaLogo from "@/assets/RWA/tesla-rwa-coin.png";
import appleLogo from "@/assets/RWA/apple.png";
import goldLogo from "@/assets/RWA/gold.png";
import spyLogo from "@/assets/RWA/s&p500.png";
import tbillLogo from "@/assets/RWA/TBILL.png";

// Assets for investment (ownership-based)
const assets = [
  { symbol: "pTSLA", name: "Tesla Stock", logo: teslaLogo, apy: "7.8%" },
  { symbol: "pAAPL", name: "Apple Stock", logo: appleLogo, apy: "7.5%" },
  { symbol: "pBTC", name: "Bitcoin", logo: bitcoinLogo, apy: "8.5%" },
  { symbol: "pETH", name: "Ethereum", logo: ethLogo, apy: "9.2%" },
  { symbol: "pGOLD", name: "Gold", logo: goldLogo, apy: "6.5%" },
  { symbol: "pSPY", name: "S&P 500 ETF", logo: spyLogo, apy: "8.0%" },
  { symbol: "pTBILL", name: "Treasury Bills", logo: tbillLogo, apy: "5.5%" },
];

export default function AssetsInterface() {
  console.log("AssetsInterface rendering");

  const { connection } = useWallet();
  const {
    balances,
    isLoading,
    error,
    buyAsset,
    sellAsset,
    getQuoteBuy,
    getQuoteSell,
    refreshBalances
  } = useAssetExchange();

  const { showSuccess, showError } = useToast();

  console.log("AssetsInterface state:", { balances, isLoading, error });

  // Fetch HBAR balance
  useEffect(() => {
    const fetchHbarBalance = async () => {
      if (!connection) {
        setHbarBalance("0");
        return;
      }

      try {
        // For MetaMask, use window.ethereum
        if (connection.wallet.id === 'metamask' && typeof window !== 'undefined' && (window as any).ethereum) {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          const balance = await provider.getBalance(address);
          setHbarBalance(ethers.formatEther(balance));
        }
      } catch (err) {
        console.error("Error fetching HBAR balance:", err);
        setHbarBalance("0");
      }
    };

    fetchHbarBalance();
  }, [connection]);

  // Form state
  const [selectedAsset, setSelectedAsset] = useState(assets[0]);
  const [isBuying, setIsBuying] = useState(true);
  const [hbarAmount, setHbarAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [quote, setQuote] = useState<{ output: string; fee: string } | null>(null);
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hbarBalance, setHbarBalance] = useState<string>("0");

  // Get quote when amounts change
  useEffect(() => {
    const getQuote = async () => {
      if (isBuying && hbarAmount && parseFloat(hbarAmount) > 0) {
        setIsGettingQuote(true);
        try {
          const result = await getQuoteBuy(selectedAsset.symbol, hbarAmount);
          setQuote({ output: result.tokensOut, fee: result.fee });
        } catch (err) {
          setQuote(null);
        }
        setIsGettingQuote(false);
      } else if (!isBuying && tokenAmount && parseFloat(tokenAmount) > 0) {
        setIsGettingQuote(true);
        try {
          const result = await getQuoteSell(selectedAsset.symbol, tokenAmount);
          setQuote({ output: result.hbarOut, fee: result.fee });
        } catch (err) {
          setQuote(null);
        }
        setIsGettingQuote(false);
      } else {
        setQuote(null);
      }
    };

    const timeoutId = setTimeout(getQuote, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [isBuying, hbarAmount, tokenAmount, selectedAsset.symbol, getQuoteBuy, getQuoteSell]);

  // Handle transaction
  const handleTransaction = async () => {
    try {
      // Trigger shimmer animation
      setIsRefreshing(true);

      if (isBuying) {
        if (!hbarAmount || parseFloat(hbarAmount) <= 0) {
          showError("Invalid Amount", "Please enter a valid HBAR amount");
          setIsRefreshing(false);
          return;
        }

        // Temporarily disable slippage protection for testing
        const minTokensOut = "0";
        const receipt = await buyAsset(selectedAsset.symbol, hbarAmount, minTokensOut);

        // Build detailed success message
        const tokensReceived = quote ? parseFloat(quote.output).toFixed(6) : "N/A";
        const fee = quote ? parseFloat(quote.fee).toFixed(4) : "N/A";
        const txHash = receipt.hash || receipt.transactionHash;

        console.log("Transaction receipt:", receipt);
        console.log("Transaction hash:", txHash);

        showSuccess(
          `Successfully bought ${tokensReceived} ${selectedAsset.symbol}`,
          `Spent ${hbarAmount} HBAR • Fee: ${fee} HBAR`,
          txHash
        );

        // Clear form
        setHbarAmount("");
        setTokenAmount("");
        setQuote(null);

      } else {
        if (!tokenAmount || parseFloat(tokenAmount) <= 0) {
          showError("Invalid Amount", "Please enter a valid token amount");
          setIsRefreshing(false);
          return;
        }

        // Temporarily disable slippage protection for testing
        const minHbarOut = "0";
        const receipt = await sellAsset(selectedAsset.symbol, tokenAmount, minHbarOut);

        // Build detailed success message
        const hbarReceived = quote ? parseFloat(quote.output).toFixed(4) : "N/A";
        const fee = quote ? parseFloat(quote.fee).toFixed(4) : "N/A";

        showSuccess(
          `Successfully sold ${tokenAmount} ${selectedAsset.symbol}`,
          `Received ${hbarReceived} HBAR • Fee: ${fee} HBAR`,
          receipt.hash || receipt.transactionHash
        );

        // Clear form
        setHbarAmount("");
        setTokenAmount("");
        setQuote(null);
      }

      // Keep shimmer animation for a bit longer to show the refresh
      setTimeout(() => setIsRefreshing(false), 2000);

    } catch (err: any) {
      console.error("Transaction failed:", err);

      // Extract user-friendly error message
      let errorMessage = "An error occurred during the transaction";

      if (err.message) {
        if (err.message.includes("user rejected")) {
          errorMessage = "Transaction was cancelled";
        } else if (err.message.includes("insufficient funds")) {
          errorMessage = "Insufficient HBAR balance";
        } else if (err.message.includes("execution reverted")) {
          errorMessage = "Transaction failed - asset may not be available";
        } else if (err.message.includes("Insufficient balance")) {
          errorMessage = "Insufficient token balance";
        } else if (err.message.includes("Slippage exceeded")) {
          errorMessage = "Price changed too much, try again";
        } else {
          // For other errors, show a shortened version
          const shortMessage = err.message.split("(")[0].trim();
          errorMessage = shortMessage.length > 60
            ? shortMessage.substring(0, 60) + "..."
            : shortMessage;
        }
      }

      showError("Transaction Failed", errorMessage);
      setIsRefreshing(false);
    }
  };

  // Get user balance for selected asset
  const userBalance = balances.find(b => b.symbol === selectedAsset.symbol);

  return (
    <div css={css`
      max-width: 1200px;
      margin: 0 auto;
      padding-top: 1rem;
    `}>
      <div css={css`
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.5rem;
        
        @media (min-width: 1024px) {
          grid-template-columns: 1fr 1fr;
        }
      `}>
        {/* Trading Interface */}
        <div css={css`
          background: rgba(12, 13, 16, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 1.25rem;
          position: relative;
          z-index: 5;
        `}>
          {/* Buy/Sell Toggle */}
          <div css={css`
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          `}>
            <div css={css`
              display: flex;
              gap: 0.375rem;
              background: rgba(0, 0, 0, 0.3);
              padding: 0.25rem;
              border-radius: 9999px;
            `}>
              <button
                onClick={() => setIsBuying(true)}
                css={css`
                  flex: 1;
                  padding: 0.5rem 0.75rem;
                  background: ${isBuying ? "rgba(220, 253, 143, 0.15)" : "transparent"};
                  border: ${isBuying ? "1px solid #dcfd8f" : "1px solid transparent"};
                  border-radius: 9999px;
                  color: ${isBuying ? "#dcfd8f" : "rgba(144, 161, 185, 1)"};
                  font-size: 0.8125rem;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.15s;

                  &:hover {
                    background: ${isBuying ? "rgba(220, 253, 143, 0.15)" : "rgba(255, 255, 255, 0.05)"};
                    border-color: ${isBuying ? "#dcfd8f" : "transparent"};
                    color: ${isBuying ? "#dcfd8f" : "#ffffff"};
                  }
                `}
              >
                Buy
              </button>
              <button
                onClick={() => setIsBuying(false)}
                css={css`
                  flex: 1;
                  padding: 0.5rem 0.75rem;
                  background: ${!isBuying ? "rgba(220, 253, 143, 0.15)" : "transparent"};
                  border: ${!isBuying ? "1px solid #dcfd8f" : "1px solid transparent"};
                  border-radius: 9999px;
                  color: ${!isBuying ? "#dcfd8f" : "rgba(144, 161, 185, 1)"};
                  font-size: 0.8125rem;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.15s;

                  &:hover {
                    background: ${!isBuying ? "rgba(220, 253, 143, 0.15)" : "rgba(255, 255, 255, 0.05)"};
                    border-color: ${!isBuying ? "#dcfd8f" : "transparent"};
                    color: ${!isBuying ? "#dcfd8f" : "#ffffff"};
                  }
                `}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Asset Selector with Info */}
          <div css={css`
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 0.875rem;
            margin-bottom: 0.75rem;
            position: relative;
            z-index: 10;
          `}>
            <div css={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 0.75rem;
            `}>
              <TokenSelector
                selectedToken={selectedAsset}
                onSelectToken={setSelectedAsset}
                currencies={[]}
                assets={assets}
              />
              {userBalance && (
                <div css={css`
                  text-align: right;
                `}>
                  <div css={css`
                    color: #dcfd8f;
                    font-size: 0.8125rem;
                    font-weight: 600;
                  `}>
                    Balance: {parseFloat(userBalance.balance).toFixed(4)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input Fields */}
          {isBuying ? (
            <>
              {/* HBAR Input */}
              <div css={css`
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 0.875rem;
                margin-bottom: 0.75rem;
              `}>
                <div css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 0.5rem;
                `}>
                  <span css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}>
                    HBAR to Spend
                  </span>
                  <button
                    onClick={() => {
                      // Leave a small amount for gas fees (0.1 HBAR)
                      const maxAmount = Math.max(0, parseFloat(hbarBalance) - 0.1);
                      setHbarAmount(maxAmount.toFixed(4));
                    }}
                    css={css`
                      font-size: 0.6875rem;
                      color: #dcfd8f;
                      background: transparent;
                      border: none;
                      cursor: pointer;
                      font-weight: 600;

                      &:hover {
                        text-decoration: underline;
                      }
                    `}
                  >
                    MAX
                  </button>
                </div>

                <div css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.75rem;
                `}>
                  <input
                    type="number"
                    value={hbarAmount}
                    onChange={(e) => setHbarAmount(e.target.value)}
                    placeholder="0.00"
                    css={css`
                      flex: 1;
                      background: transparent;
                      border: none;
                      color: #fff;
                      font-size: 1.5rem;
                      font-weight: 600;
                      outline: none;

                      &::placeholder {
                        color: rgba(255, 255, 255, 0.3);
                      }
                    `}
                  />

                  <div css={css`
                    display: flex;
                    align-items: center;
                    padding: 0.375rem 0.75rem;
                    background: rgba(220, 253, 143, 0.1);
                    border: 1px solid rgba(220, 253, 143, 0.3);
                    border-radius: 8px;
                    color: #dcfd8f;
                    font-weight: 600;
                    font-size: 0.8125rem;
                  `}>
                    <span>HBAR</span>
                  </div>
                </div>
              </div>

              {/* Output Preview */}
              {quote && (
                <div css={css`
                  background: rgba(220, 253, 143, 0.05);
                  border: 1px solid rgba(220, 253, 143, 0.2);
                  border-radius: 12px;
                  padding: 0.75rem;
                  margin-bottom: 0.75rem;
                `}>
                  <div css={css`
                    font-size: 0.6875rem;
                    color: #a0a0a0;
                    margin-bottom: 0.375rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  `}>You will receive</div>
                  <div css={css`
                    font-size: 1.25rem;
                    color: #dcfd8f;
                    font-weight: 700;
                    margin-bottom: 0.25rem;
                  `}>
                    {(() => {
                      const num = parseFloat(quote.output);
                      if (isNaN(num) || num === 0) return "0.00";
                      if (num < 0.000001) return num.toExponential(4);
                      if (num < 1) return num.toFixed(8);
                      return num.toFixed(6);
                    })()} {selectedAsset.symbol}
                  </div>
                  <div css={css`
                    font-size: 0.6875rem;
                    color: #a0a0a0;
                  `}>
                    Fee: {parseFloat(quote.fee).toFixed(4)} HBAR
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Token Input */}
              <div css={css`
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 0.875rem;
                margin-bottom: 0.75rem;
              `}>
                <div css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 0.5rem;
                `}>
                  <span css={css`
                    font-size: 0.75rem;
                    color: #a0a0a0;
                  `}>
                    {selectedAsset.symbol} to Sell
                  </span>
                  {userBalance && (
                    <button
                      onClick={() => setTokenAmount(userBalance.balance)}
                      css={css`
                        font-size: 0.6875rem;
                        color: #dcfd8f;
                        background: transparent;
                        border: none;
                        cursor: pointer;
                        font-weight: 600;

                        &:hover {
                          text-decoration: underline;
                        }
                      `}
                    >
                      MAX
                    </button>
                  )}
                </div>

                <div css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.75rem;
                `}>
                  <input
                    type="number"
                    value={tokenAmount}
                    onChange={(e) => setTokenAmount(e.target.value)}
                    placeholder="0.00"
                    css={css`
                      flex: 1;
                      background: transparent;
                      border: none;
                      color: #fff;
                      font-size: 1.5rem;
                      font-weight: 600;
                      outline: none;

                      &::placeholder {
                        color: rgba(255, 255, 255, 0.3);
                      }
                    `}
                  />

                  <div css={css`
                    display: flex;
                    align-items: center;
                    padding: 0.375rem 0.75rem;
                    background: rgba(220, 253, 143, 0.1);
                    border: 1px solid rgba(220, 253, 143, 0.3);
                    border-radius: 8px;
                    color: #dcfd8f;
                    font-weight: 600;
                    font-size: 0.8125rem;
                  `}>
                    <span>{selectedAsset.symbol}</span>
                  </div>
                </div>
              </div>

              {/* Output Preview */}
              {quote && (
                <div css={css`
                  background: rgba(220, 253, 143, 0.05);
                  border: 1px solid rgba(220, 253, 143, 0.2);
                  border-radius: 12px;
                  padding: 0.75rem;
                  margin-bottom: 0.75rem;
                `}>
                  <div css={css`
                    font-size: 0.6875rem;
                    color: #a0a0a0;
                    margin-bottom: 0.375rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  `}>You will receive</div>
                  <div css={css`
                    font-size: 1.25rem;
                    color: #dcfd8f;
                    font-weight: 700;
                    margin-bottom: 0.25rem;
                  `}>
                    {parseFloat(quote.output).toFixed(4)} HBAR
                  </div>
                  <div css={css`
                    font-size: 0.6875rem;
                    color: #a0a0a0;
                  `}>
                    Fee: {parseFloat(quote.fee).toFixed(4)} HBAR
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action Button */}
          <button
            onClick={handleTransaction}
            disabled={isLoading || isGettingQuote || !quote}
            css={css`
              width: 100%;
              padding: 0.75rem;
              border-radius: 12px;
              font-weight: 600;
              font-size: 0.9375rem;
              transition: all 0.15s;
              border: none;
              margin-top: ${quote ? '0' : '3rem'};
              cursor: ${isLoading || isGettingQuote || !quote ? "not-allowed" : "pointer"};
              background: ${isLoading || isGettingQuote || !quote
                ? "rgba(255, 255, 255, 0.1)"
                : "linear-gradient(135deg, #dcfd8f 0%, #a8d45f 100%)"
              };
              color: ${isLoading || isGettingQuote || !quote ? "#6b7280" : "#0a0e27"};
              opacity: ${isLoading || isGettingQuote || !quote ? 0.5 : 1};
              
              &:hover {
                opacity: ${isLoading || isGettingQuote || !quote ? 0.5 : 0.9};
              }
            `}
          >
            {isLoading
              ? "Processing..."
              : isGettingQuote
                ? "Getting Quote..."
                : isBuying
                  ? `Buy ${selectedAsset.symbol}`
                  : `Sell ${selectedAsset.symbol}`
            }
          </button>

          {error && (
            <div css={css`
              margin-top: 0.75rem;
              padding: 0.75rem;
              background: rgba(255, 100, 100, 0.1);
              border: 1px solid rgba(255, 100, 100, 0.3);
              border-radius: 8px;
            `}>
              <p css={css`
                color: #ff6464;
                font-size: 0.8125rem;
                margin: 0;
              `}>{error}</p>
            </div>
          )}
        </div>

        {/* Portfolio Overview */}
        <div css={css`
          background: rgba(12, 13, 16, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 1.25rem;
          position: relative;
          overflow: hidden;
          z-index: 1;
        `}>
          {isRefreshing && (
            <div css={css`
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 2px;
              background: linear-gradient(90deg, transparent, #dcfd8f, transparent);
              animation: shimmer 1.5s infinite;
              z-index: 10;
              
              @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
            `} />
          )}
          <div css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1rem;
            padding-bottom: 0.875rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          `}>
            <h2 css={css`
              font-size: 1.125rem;
              font-weight: 700;
              color: #ffffff;
              margin: 0;
            `}>Your Portfolio</h2>
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await refreshBalances();
                setTimeout(() => setIsRefreshing(false), 1500);
              }}
              disabled={isLoading}
              css={css`
                color: #dcfd8f;
                font-size: 0.6875rem;
                font-weight: 600;
                background: none;
                border: none;
                cursor: ${isLoading ? "not-allowed" : "pointer"};
                
                &:hover {
                  text-decoration: ${isLoading ? "none" : "underline"};
                }
              `}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {balances.length === 0 ? (
            <div css={css`
              text-align: center;
              padding: 2.5rem 1rem;
            `}>
              <div css={css`
                color: #a0a0a0;
                margin-bottom: 0.375rem;
                font-size: 0.9375rem;
              `}>No assets yet</div>
              <div css={css`
                color: #6b7280;
                font-size: 0.8125rem;
              `}>
                Buy your first synthetic asset to get started!
              </div>
            </div>
          ) : (
            <div css={css`
              display: flex;
              flex-direction: column;
              gap: 0.625rem;
              max-height: ${balances.length > 4 ? '320px' : 'auto'};
              overflow-y: ${balances.length > 4 ? 'auto' : 'visible'};
              padding-right: ${balances.length > 4 ? '0.5rem' : '0'};
              
              /* Custom scrollbar - hidden by default */
              &::-webkit-scrollbar {
                width: 8px;
                opacity: 0;
                transition: opacity 0.3s ease;
              }
              
              &::-webkit-scrollbar-track {
                background: transparent;
                border-radius: 10px;
              }
              
              &::-webkit-scrollbar-thumb {
                background: transparent;
                border-radius: 10px;
              }
              
              /* Show scrollbar on hover */
              &:hover::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
              }
              
              &:hover::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, #dcfd8f 0%, #a8d45f 100%);
                
                &:hover {
                  background: linear-gradient(180deg, #e8ffaa 0%, #b8e46f 100%);
                }
              }
            `}>
              {balances
                .sort((a, b) => parseFloat(b.valueHBAR) - parseFloat(a.valueHBAR))
                .map((balance) => {
                  const assetInfo = assets.find(a => a.symbol === balance.symbol);

                  return (
                    <div key={balance.symbol} css={css`
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      padding: 0.75rem;
                      background: rgba(0, 0, 0, 0.3);
                      border: 1px solid rgba(255, 255, 255, 0.08);
                      border-radius: 10px;
                      transition: all 0.15s;
                      
                      &:hover {
                        background: rgba(0, 0, 0, 0.4);
                        border-color: rgba(220, 253, 143, 0.2);
                      }
                    `}>
                      <div css={css`
                        display: flex;
                        align-items: center;
                        gap: 0.625rem;
                      `}>
                        {assetInfo && (
                          <img
                            src={assetInfo.logo}
                            alt={assetInfo.name}
                            css={css`
                              width: 2rem;
                              height: 2rem;
                              border-radius: 9999px;
                            `}
                          />
                        )}
                        <div>
                          <div css={css`
                            color: #ffffff;
                            font-weight: 600;
                            font-size: 0.875rem;
                          `}>{balance.symbol}</div>
                          <div css={css`
                            color: #a0a0a0;
                            font-size: 0.6875rem;
                          `}>
                            {assetInfo?.name || balance.symbol}
                          </div>
                        </div>
                      </div>
                      <div css={css`
                        text-align: right;
                      `}>
                        <div css={css`
                          color: #ffffff;
                          font-weight: 600;
                          font-size: 0.875rem;
                        `}>
                          {parseFloat(balance.balance).toFixed(4)}
                        </div>
                        <div css={css`
                          color: #a0a0a0;
                          font-size: 0.6875rem;
                        `}>
                          ≈ {parseFloat(balance.valueHBAR).toFixed(2)} HBAR
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Profit/Loss Display Section */}
      <div css={css`
        margin-top: 2rem;
      `}>
        <ProfitLossDisplay />
      </div>
    </div>
  );
}
