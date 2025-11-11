import { css } from "@emotion/react";
import React, { useState } from "react";
import { Vault as VaultIcon, TrendUp, Shield, Spinner } from "@phosphor-icons/react";
import { useVault } from "@/hooks/useVault";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/contexts/ToastContext";
import { TOKEN_METADATA } from "@/config/contracts";
import TokenSelector from "./TokenSelector";

// Import asset logos
import pUSDLogo from "@/assets/RWA/pUSD.png";
import pEURLogo from "@/assets/RWA/pEUR.png";
import pGBPLogo from "@/assets/RWA/pGBP.png";
import pJPYLogo from "@/assets/RWA/PJPY.png";
import pHKDLogo from "@/assets/RWA/pHKD.png";
import pAEDLogo from "@/assets/RWA/pAED.png";
import pBTCLogo from "@/assets/RWA/bitcoin.png";
import pETHLogo from "@/assets/RWA/eth.png";
import pTSLALogo from "@/assets/RWA/tesla-rwa-coin.png";
import pAAPLLogo from "@/assets/RWA/apple.png";
import pGOLDLogo from "@/assets/RWA/gold.png";
import pSPYLogo from "@/assets/RWA/s&p500.png";
import pTBILLLogo from "@/assets/RWA/TBILL.png";

// Prism tokens for vault
const currencies = [
  { symbol: "pUSD", name: "Prism USD", logo: pUSDLogo, apy: "12.5%" },
  { symbol: "pEUR", name: "Prism EUR", logo: pEURLogo, apy: "11.8%" },
  { symbol: "pGBP", name: "Prism GBP", logo: pGBPLogo, apy: "13.2%" },
  { symbol: "pJPY", name: "Prism JPY", logo: pJPYLogo, apy: "10.5%" },
  { symbol: "pHKD", name: "Prism HKD", logo: pHKDLogo, apy: "12.0%" },
  { symbol: "pAED", name: "Prism AED", logo: pAEDLogo, apy: "11.5%" },
];

const assets = [
  { symbol: "pBTC", name: "Prism Bitcoin", logo: pBTCLogo, apy: "8.5%" },
  { symbol: "pETH", name: "Prism Ethereum", logo: pETHLogo, apy: "9.2%" },
  { symbol: "pTSLA", name: "Prism Tesla", logo: pTSLALogo, apy: "7.8%" },
  { symbol: "pAAPL", name: "Prism Apple", logo: pAAPLLogo, apy: "7.5%" },
  { symbol: "pGOLD", name: "Prism Gold", logo: pGOLDLogo, apy: "6.5%" },
  { symbol: "pSPY", name: "Prism S&P 500", logo: pSPYLogo, apy: "8.0%" },
  { symbol: "pTBILL", name: "Prism T-Bill", logo: pTBILLLogo, apy: "5.5%" },
];

const allTokens = [...currencies, ...assets];

const VaultInterface = () => {
  const [vaultMode, setVaultMode] = useState<"deposit" | "withdraw">("deposit");
  const [selectedToken, setSelectedToken] = useState(currencies[0]);
  const [hbarAmount, setHbarAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");

  // Use vault hook for real data
  const { userPosition, isLoading, error, depositAndMint, burnAndWithdraw, getMaxMintable } = useVault();
  const { connection } = useWallet();
  const { showSuccess, showError } = useToast();

  const [maxMintable, setMaxMintable] = useState<string>("0");
  const [maxWithdrawable, setMaxWithdrawable] = useState<string>("0");
  const [validationError, setValidationError] = useState<string>("");
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);

  // Calculate max mintable based on HBAR input (with real prices)
  React.useEffect(() => {
    const calculateMaxWithDeposit = async () => {
      if (vaultMode === "deposit" && selectedToken) {
        const hbarInput = parseFloat(hbarAmount || "0");
        
        // If no HBAR entered, fetch from contract
        if (hbarInput === 0) {
          const max = await getMaxMintable(selectedToken.symbol);
          setMaxMintable(max);
          console.log("📊 Using contract max mintable:", max, selectedToken.symbol);
          return;
        }
        
        // Calculate with deposit amount
        const currentCollateral = parseFloat(userPosition?.collateral || "0");
        const currentDebt = parseFloat(userPosition?.debt || "0");
        const totalCollateral = currentCollateral + hbarInput;

        // Token prices (should match contract prices)
        const tokenPrices: Record<string, number> = {
          pUSD: 1.00,
          pEUR: 1.08,
          pGBP: 1.27,
          pJPY: 0.0067,
          pHKD: 0.128,
          pAED: 0.272,
          pBTC: 95000,
          pETH: 3500,
          pTSLA: 350,
          pAAPL: 230,
          pGOLD: 2700,
          pSPY: 580,
          pTBILL: 1.00,
        };
        
        const hbarPrice = 0.20;
        const tokenPrice = tokenPrices[selectedToken.symbol] || 1.00;
        
        // Calculate with real price conversion
        const maxDebtInHbar = totalCollateral / 1.5;
        const maxDebtInUsd = maxDebtInHbar * hbarPrice;
        const currentDebtInUsd = currentDebt * hbarPrice;
        const availableDebtInUsd = Math.max(0, maxDebtInUsd - currentDebtInUsd);
        
        // Convert USD to token amount
        const availableToMint = availableDebtInUsd / tokenPrice;

        setMaxMintable(availableToMint.toFixed(selectedToken.symbol.includes("BTC") || selectedToken.symbol.includes("ETH") ? 6 : 2));
        console.log("📊 Max Mintable Calculation:");
        console.log("  Current collateral:", currentCollateral, "HBAR");
        console.log("  Deposit amount:", hbarInput, "HBAR");
        console.log("  Total collateral:", totalCollateral, "HBAR");
        console.log("  Current debt:", currentDebt, "HBAR");
        console.log("  Max debt (HBAR):", maxDebtInHbar.toFixed(2));
        console.log("  Max debt (USD):", maxDebtInUsd.toFixed(2));
        console.log("  Token price:", `$${tokenPrice}`);
        console.log("  Available to mint:", availableToMint.toFixed(6), selectedToken.symbol);
      }
    };
    calculateMaxWithDeposit();
  }, [hbarAmount, userPosition, vaultMode, selectedToken, getMaxMintable]);

  // Calculate max withdrawable based on burn amount
  React.useEffect(() => {
    if (vaultMode === "withdraw" && selectedToken && userPosition) {
      const currentCollateral = parseFloat(userPosition.collateral || "0");
      const currentDebt = parseFloat(userPosition.debt || "0");
      const burnAmount = parseFloat(tokenAmount || "0");
      
      // Calculate remaining debt after burn
      // burnAmount in pUSD, convert to HBAR worth
      const burnValueInHbar = burnAmount * 5; // 1 pUSD = $1 / $0.20 = 5 HBAR
      const remainingDebt = Math.max(0, currentDebt - burnValueInHbar);
      
      // Min collateral needed for remaining debt
      const minCollateralNeeded = remainingDebt * 1.5; // 150% ratio
      
      // Max withdrawable
      const maxWithdraw = Math.max(0, currentCollateral - minCollateralNeeded);
      
      setMaxWithdrawable(maxWithdraw.toFixed(2));
      console.log("💰 Max Withdrawable Calculation:");
      console.log("  Current collateral:", currentCollateral, "HBAR");
      console.log("  Current debt:", currentDebt, "HBAR");
      console.log("  Burn amount:", burnAmount, "pUSD");
      console.log("  Burn value:", burnValueInHbar.toFixed(2), "HBAR");
      console.log("  Remaining debt:", remainingDebt.toFixed(2), "HBAR");
      console.log("  Min collateral needed:", minCollateralNeeded.toFixed(2), "HBAR");
      console.log("  Max withdrawable:", maxWithdraw.toFixed(2), "HBAR");
    }
  }, [tokenAmount, userPosition, vaultMode, selectedToken]);

  // Validate token amount
  React.useEffect(() => {
    if (vaultMode === "deposit" && tokenAmount) {
      const amount = parseFloat(tokenAmount);
      const max = parseFloat(maxMintable);

      if (isNaN(amount) || amount <= 0) {
        setValidationError("Please enter a valid amount");
      } else if (amount > max) {
        setValidationError(`Maximum mintable: ${max.toFixed(2)} ${selectedToken.symbol}`);
      } else {
        setValidationError("");
      }
    } else if (vaultMode === "withdraw" && tokenAmount) {
      const amount = parseFloat(tokenAmount);
      const balance = parseFloat(userPosition?.positions[selectedToken.symbol] || "0");

      if (isNaN(amount) || amount <= 0) {
        setValidationError("Please enter a valid amount");
      } else if (amount > balance) {
        setValidationError(`Insufficient ${selectedToken.symbol} balance. You have ${balance.toFixed(2)}`);
      } else {
        setValidationError("");
      }
    } else {
      setValidationError("");
    }
  }, [tokenAmount, maxMintable, vaultMode, selectedToken, userPosition]);

  const handleMaxHbar = () => {
    if (vaultMode === "deposit" && connection?.account) {
      // For deposit: use wallet HBAR balance
      console.log("Connection account:", connection.account);
      console.log("Balance object:", connection.account.balance);
      
      // Try different possible balance structures
      const hbarBalance = 
        connection.account.balance?.hbars?.toString() ||
        connection.account.balance?.toString() ||
        connection.account.hbarBalance?.toString() ||
        "0";
      
      console.log("HBAR balance:", hbarBalance);
      setHbarAmount(hbarBalance);
    } else if (vaultMode === "withdraw" && userPosition) {
      // For withdraw: use max withdrawable based on debt
      setHbarAmount(maxWithdrawable);
    }
  };

  const handleMaxToken = () => {
    if (userPosition) {
      const balance = userPosition.positions[selectedToken.symbol] || "0";
      setTokenAmount(balance);
    }
  };

  const handleAction = async () => {
    // Validate before submitting
    if (validationError) {
      return; // Don't submit if there's a validation error
    }

    // Additional validation for empty inputs
    if (!hbarAmount || parseFloat(hbarAmount) <= 0) {
      setValidationError("Please enter HBAR amount");
      return;
    }

    if (vaultMode === "deposit" && (!tokenAmount || parseFloat(tokenAmount) <= 0)) {
      setValidationError("Please enter token amount to mint");
      return;
    }

    if (vaultMode === "withdraw" && (!tokenAmount || parseFloat(tokenAmount) <= 0)) {
      setValidationError("Please enter token amount to burn");
      return;
    }

    try {
      let txHash: string | undefined;
      
      if (vaultMode === "deposit") {
        const result = await depositAndMint(hbarAmount, selectedToken.symbol, tokenAmount);
        txHash = result?.hash;
        
        // Show success toast
        showSuccess(
          "Deposit & Mint Successful!",
          `Deposited ${hbarAmount} HBAR and minted ${tokenAmount} ${selectedToken.symbol}`,
          txHash
        );
      } else {
        const result = await burnAndWithdraw(selectedToken.symbol, tokenAmount, hbarAmount);
        txHash = result?.hash;
        
        // Show success toast
        showSuccess(
          "Burn & Withdraw Successful!",
          `Burned ${tokenAmount} ${selectedToken.symbol} and withdrew ${hbarAmount} HBAR`,
          txHash
        );
      }
      
      // Clear inputs on success
      setHbarAmount("");
      setTokenAmount("");
      setValidationError("");
    } catch (err: any) {
      console.error("Transaction failed:", err);
      
      // Show error toast
      if (err.message?.includes("Insufficient collateral")) {
        showError("Insufficient Collateral", "Try minting less or depositing more HBAR");
      } else if (err.message?.includes("user rejected")) {
        showError("Transaction Cancelled", "You rejected the transaction");
      } else {
        showError("Transaction Failed", err.message || "An error occurred");
      }
    }
  };

  return (
    <div
      css={css`
        max-width: 480px;
        margin: 0 auto;
        padding-top: 1rem;
      `}
    >
      {/* Position Overview Card */}
      <div
        css={css`
          background: rgba(12, 13, 16, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
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
          <VaultIcon size={24} color="#dcfd8f" weight="fill" />
          <h2
            css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: #ffffff;
              margin: 0;
            `}
          >
            Your Vault Position
          </h2>
        </div>

        <div
          css={css`
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
          `}
        >
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
                font-size: 0.75rem;
                color: #a0a0a0;
                margin-bottom: 0.5rem;
              `}
            >
              Collateral
            </div>
            <div
              css={css`
                font-size: 1.5rem;
                font-weight: 700;
                color: #ffffff;
              `}
            >
              {userPosition?.collateral || "0.0"} HBAR
            </div>
          </div>

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
                font-size: 0.75rem;
                color: #a0a0a0;
                margin-bottom: 0.5rem;
              `}
            >
              Debt
            </div>
            <div
              css={css`
                font-size: 1.5rem;
                font-weight: 700;
                color: #ffffff;
              `}
            >
              {userPosition?.debt || "0.0"} HBAR
            </div>
          </div>
        </div>

        <div
          css={css`
            margin-top: 1rem;
            padding: 1rem;
            background: ${userPosition?.healthy
              ? "rgba(220, 253, 143, 0.1)"
              : "rgba(255, 100, 100, 0.1)"};
            border: 1px solid ${userPosition?.healthy
              ? "rgba(220, 253, 143, 0.3)"
              : "rgba(255, 100, 100, 0.3)"};
            border-radius: 12px;
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
              <Shield size={16} color={userPosition?.healthy ? "#dcfd8f" : "#ff6464"} weight="fill" />
              <span
                css={css`
                  font-size: 0.875rem;
                  color: #a0a0a0;
                `}
              >
                Collateral Ratio
              </span>
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
                  font-size: 1.25rem;
                  font-weight: 700;
                  color: ${userPosition?.healthy ? "#dcfd8f" : "#ff6464"};
                `}
              >
                {(() => {
                  const ratio = userPosition?.ratio || "0";
                  // If ratio is max uint256, user has no debt (infinite ratio)
                  if (ratio === "115792089237316195423570985008687907853269984665640564039457584007913129639935") {
                    return "∞";
                  }
                  return `${ratio}%`;
                })()}
              </span>
              <span
                css={css`
                  font-size: 0.75rem;
                  padding: 0.25rem 0.5rem;
                  background: ${userPosition?.healthy
                    ? "rgba(220, 253, 143, 0.2)"
                    : "rgba(255, 100, 100, 0.2)"};
                  border-radius: 6px;
                  color: ${userPosition?.healthy ? "#dcfd8f" : "#ff6464"};
                  font-weight: 600;
                `}
              >
                {userPosition?.healthy ? "HEALTHY" : "AT RISK"}
              </span>
            </div>
          </div>
          <div
            css={css`
              margin-top: 0.5rem;
              font-size: 0.75rem;
              color: #a0a0a0;
            `}
          >
            Minimum required: 150%
          </div>
        </div>
      </div>

      {/* Main Vault Card */}
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
              onClick={() => {
                setVaultMode("deposit");
                setHbarAmount("");
                setTokenAmount("");
                setValidationError("");
              }}
              css={css`
                flex: 1;
                padding: 0.625rem 1rem;
                background: ${vaultMode === "deposit" ? "rgba(220, 253, 143, 0.15)" : "transparent"};
                border: ${vaultMode === "deposit" ? "1px solid #dcfd8f" : "1px solid transparent"};
                border-radius: 9999px;
                color: ${vaultMode === "deposit" ? "#dcfd8f" : "rgba(144, 161, 185, 1)"};
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;

                &:hover {
                  background: ${vaultMode === "deposit" ? "rgba(220, 253, 143, 0.15)" : "rgba(255, 255, 255, 0.05)"};
                  border-color: ${vaultMode === "deposit" ? "#dcfd8f" : "transparent"};
                  color: ${vaultMode === "deposit" ? "#dcfd8f" : "#ffffff"};
                }
              `}
            >
              Deposit & Mint
            </button>
            <button
              onClick={() => {
                setVaultMode("withdraw");
                setHbarAmount("");
                setTokenAmount("");
                setValidationError("");
              }}
              css={css`
                flex: 1;
                padding: 0.625rem 1rem;
                background: ${vaultMode === "withdraw" ? "rgba(220, 253, 143, 0.15)" : "transparent"};
                border: ${vaultMode === "withdraw" ? "1px solid #dcfd8f" : "1px solid transparent"};
                border-radius: 9999px;
                color: ${vaultMode === "withdraw" ? "#dcfd8f" : "rgba(144, 161, 185, 1)"};
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;

                &:hover {
                  background: ${vaultMode === "withdraw" ? "rgba(220, 253, 143, 0.15)" : "rgba(255, 255, 255, 0.05)"};
                  border-color: ${vaultMode === "withdraw" ? "#dcfd8f" : "transparent"};
                  color: ${vaultMode === "withdraw" ? "#dcfd8f" : "#ffffff"};
                }
              `}
            >
              Burn & Withdraw
            </button>
          </div>
        </div>

        {vaultMode === "deposit" ? (
          <>
            {/* HBAR Input */}
            <div
              css={css`
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 16px;
                padding: 1.25rem;
                margin-bottom: 1rem;
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
                  Deposit HBAR
                </span>
                <button
                  onClick={handleMaxHbar}
                  css={css`
                    font-size: 0.75rem;
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

              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 1rem;
                `}
              >
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
                    font-size: 2rem;
                    font-weight: 600;
                    outline: none;

                    &::placeholder {
                      color: rgba(255, 255, 255, 0.3);
                    }
                  `}
                />

                <div
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
                  `}
                >
                  <span>HBAR</span>
                </div>
              </div>
            </div>

            {/* Token Selection & Amount */}
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
                  Mint Token
                </span>
              </div>

              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 1rem;
                  margin-bottom: 1rem;
                `}
              >
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
                    font-size: 2rem;
                    font-weight: 600;
                    outline: none;

                    &::placeholder {
                      color: rgba(255, 255, 255, 0.3);
                    }
                  `}
                />

                <TokenSelector
                  selectedToken={selectedToken}
                  onSelectToken={setSelectedToken}
                  currencies={currencies}
                  assets={assets}
                />
              </div>

              <div
                css={css`
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 0.5rem;
                `}
              >
                <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
                  <TrendUp size={14} color="#dcfd8f" />
                  <span
                    css={css`
                      font-size: 0.75rem;
                      color: #dcfd8f;
                      font-weight: 600;
                    `}
                  >
                    Earning {selectedToken.apy} APY
                  </span>
                </div>
                <span
                  css={css`
                    font-size: 0.75rem;
                    color: ${hbarAmount && parseFloat(hbarAmount) > 0 ? "#dcfd8f" : "#a0a0a0"};
                    font-weight: ${hbarAmount && parseFloat(hbarAmount) > 0 ? "600" : "400"};
                  `}
                >
                  {hbarAmount && parseFloat(hbarAmount) > 0
                    ? `Max after deposit: ${parseFloat(maxMintable).toFixed(2)}`
                    : `Max: ${parseFloat(maxMintable).toFixed(2)}`
                  }
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Burn Token Input */}
            <div
              css={css`
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 16px;
                padding: 1.25rem;
                margin-bottom: 1rem;
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
                  Burn Token
                </span>
                <button
                  onClick={handleMaxToken}
                  css={css`
                    font-size: 0.75rem;
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

              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 1rem;
                `}
              >
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
                    font-size: 2rem;
                    font-weight: 600;
                    outline: none;

                    &::placeholder {
                      color: rgba(255, 255, 255, 0.3);
                    }
                  `}
                />

                <TokenSelector
                  selectedToken={selectedToken}
                  onSelectToken={setSelectedToken}
                  currencies={currencies}
                  assets={assets}
                />
              </div>
            </div>

            {/* Withdraw HBAR */}
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
                  Withdraw HBAR
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
                  value={hbarAmount}
                  onChange={(e) => setHbarAmount(e.target.value)}
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

                <div
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
                  `}
                >
                  <span>HBAR</span>
                </div>
              </div>
              
              {/* Max Withdrawable Display */}
              <div
                css={css`
                  display: flex;
                  justify-content: flex-end;
                  margin-top: 0.75rem;
                `}
              >
                <span
                  css={css`
                    font-size: 0.75rem;
                    color: ${tokenAmount && parseFloat(tokenAmount) > 0 ? "#dcfd8f" : "#a0a0a0"};
                    font-weight: ${tokenAmount && parseFloat(tokenAmount) > 0 ? "600" : "400"};
                  `}
                >
                  {tokenAmount && parseFloat(tokenAmount) > 0 
                    ? `Max withdrawable: ${parseFloat(maxWithdrawable).toFixed(2)} HBAR`
                    : `Max withdrawable: ${parseFloat(userPosition?.collateral || "0").toFixed(2)} HBAR`
                  }
                </span>
              </div>
            </div>
          </>
        )}

        {/* Validation Error Display */}
        {validationError && (
          <div
            css={css`
              margin-bottom: 1rem;
              padding: 1rem;
              background: rgba(255, 100, 100, 0.1);
              border: 1px solid rgba(255, 100, 100, 0.3);
              border-radius: 12px;
              color: #ff6464;
              font-size: 0.875rem;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            <span>⚠️</span>
            <span>{validationError}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleAction}
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
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;

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
          disabled={
            !hbarAmount ||
            !tokenAmount ||
            parseFloat(hbarAmount) <= 0 ||
            parseFloat(tokenAmount) <= 0 ||
            isLoading ||
            !!validationError
          }
        >
          {isLoading && (
            <Spinner 
              size={20} 
              css={css`
                animation: spin 1s linear infinite;
                @keyframes spin {
                  from {
                    transform: rotate(0deg);
                  }
                  to {
                    transform: rotate(360deg);
                  }
                }
              `}
            />
          )}
          {isLoading
            ? "Processing..."
            : vaultMode === "deposit" ? "Deposit & Mint" : "Burn & Withdraw"}
        </button>

        {/* Error Display */}
        {error && (
          <div
            css={css`
              margin-top: 1rem;
              padding: 0.75rem;
              background: rgba(255, 100, 100, 0.1);
              border: 1px solid rgba(255, 100, 100, 0.3);
              border-radius: 12px;
              color: #ff6464;
              font-size: 0.875rem;
            `}
          >
            {error}
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
            New Ratio
          </div>
          <div
            css={css`
              font-size: 1.125rem;
              font-weight: 600;
              color: #fff;
            `}
          >
            {hbarAmount && tokenAmount && parseFloat(hbarAmount) > 0 && parseFloat(tokenAmount) > 0
              ? `${((parseFloat(hbarAmount) / parseFloat(tokenAmount)) * 100).toFixed(0)}%`
              : "---"}
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
            Liquidation Price
          </div>
          <div
            css={css`
              font-size: 1.125rem;
              font-weight: 600;
              color: #fff;
            `}
          >
            $0.75
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultInterface;
