// Token logo imports
import pUSD from '@/assets/rwa/pUSD.png';
import pEUR from '@/assets/rwa/pEUR.png';
import pGBP from '@/assets/rwa/pGBP.png';
import pJPY from '@/assets/rwa/PJPY.png';
import pHKD from '@/assets/rwa/pHKD.png';
import pAED from '@/assets/rwa/pAED.png';
import pTSLA from '@/assets/rwa/tesla-rwa-coin.png';
import pAAPL from '@/assets/rwa/apple.png';
import pBTC from '@/assets/rwa/bitcoin.png';
import pETH from '@/assets/rwa/eth.png';
import pGOLD from '@/assets/rwa/gold.png';
import pSPY from '@/assets/rwa/s&p500.png';
import pTBILL from '@/assets/rwa/TBILL.png';
import prismIcon from '@/assets/logo/prism-icon.png';

// Contract addresses and configuration
export const CONTRACTS = {
  network: "testnet",
  vault: "0x3A2c3d52A61Bf0d09f6c231C2e404b8cF76e7Ce6", // Updated with Delta-Neutral Hedging
  oracle: "0xb1C70B19082d470829e88D784bA05C105300047a",
  priceOracle: "0x1050eb5E510E6d9D747fEeD6E32B76D4061896F4",
  // Perps contracts for delta-neutral hedging
  perpsVault: "0x0756B2586E18A5Fe98dc909d43fcD162C803a455",
  perpsEngine: "0xC19B79cFc317CB9364dcAf2cFf899207Ad423C6c",
  // Asset Exchange contracts (ownership-based)
  pythOracle: "0x1050eb5E510E6d9D747fEeD6E32B76D4061896F4",
  assetExchange: "0x2b5a0C2F1004fb9a9039bee910694C0a57e30a59",
  hcsTopic: "0.0.7255836",
  tokens: {
    pUSD: "0.0.7228971",
    pEUR: "0.0.7228972",
    pGBP: "0.0.7228973",
    pJPY: "0.0.7228974",
    pHKD: "0.0.7228975",
    pAED: "0.0.7228976",
    pTSLA: "0.0.7228977",
    pAAPL: "0.0.7228978",
    pTBILL: "0.0.7228979",
    pGOLD: "0.0.7228980",
    pSPY: "0.0.7228982",
    pBTC: "0.0.7228984",
    pETH: "0.0.7228985",
    PRISM: "0.0.7228986",
  },
};

// Token metadata with local logos
export const TOKEN_METADATA = {
  pUSD: {
    name: "Prism USD",
    symbol: "pUSD",
    decimals: 6,
    logo: pUSD,
    type: "CURRENCY",
    apy: "12.5%",
  },
  pEUR: {
    name: "Prism EUR",
    symbol: "pEUR",
    decimals: 6,
    logo: pEUR,
    type: "CURRENCY",
    apy: "11.8%",
  },
  pGBP: {
    name: "Prism GBP",
    symbol: "pGBP",
    decimals: 6,
    logo: pGBP,
    type: "CURRENCY",
    apy: "13.2%",
  },
  pJPY: {
    name: "Prism JPY",
    symbol: "pJPY",
    decimals: 6,
    logo: pJPY,
    type: "CURRENCY",
    apy: "10.5%",
  },
  pHKD: {
    name: "Prism HKD",
    symbol: "pHKD",
    decimals: 6,
    logo: pHKD,
    type: "CURRENCY",
    apy: "12.0%",
  },
  pAED: {
    name: "Prism AED",
    symbol: "pAED",
    decimals: 6,
    logo: pAED,
    type: "CURRENCY",
    apy: "11.5%",
  },
  pAUD: {
    name: "Prism AUD",
    symbol: "pAUD",
    decimals: 6,
    logo: pUSD, // Using pUSD logo as placeholder - add pAUD.png if you have it
    type: "CURRENCY",
    apy: "11.2%",
  },
  pCAD: {
    name: "Prism CAD",
    symbol: "pCAD",
    decimals: 6,
    logo: pUSD, // Using pUSD logo as placeholder - add pCAD.png if you have it
    type: "CURRENCY",
    apy: "11.0%",
  },
  pTSLA: {
    name: "Prism Tesla",
    symbol: "pTSLA",
    decimals: 6,
    logo: pTSLA,
    type: "ASSET",
    apy: "7.8%",
  },
  pAAPL: {
    name: "Prism Apple",
    symbol: "pAAPL",
    decimals: 6,
    logo: pAAPL,
    type: "ASSET",
    apy: "7.5%",
  },
  pTBILL: {
    name: "Prism Treasury Bill",
    symbol: "pTBILL",
    decimals: 6,
    logo: pTBILL,
    type: "ASSET",
    apy: "5.5%",
  },
  pGOLD: {
    name: "Prism Gold",
    symbol: "pGOLD",
    decimals: 6,
    logo: pGOLD,
    type: "ASSET",
    apy: "6.5%",
  },
  pSPY: {
    name: "Prism S&P 500",
    symbol: "pSPY",
    decimals: 6,
    logo: pSPY,
    type: "ASSET",
    apy: "8.0%",
  },
  pBTC: {
    name: "Prism Bitcoin",
    symbol: "pBTC",
    decimals: 6,
    logo: pBTC,
    type: "ASSET",
    apy: "8.5%",
  },
  pETH: {
    name: "Prism Ethereum",
    symbol: "pETH",
    decimals: 6,
    logo: pETH,
    type: "ASSET",
    apy: "9.2%",
  },
  PRISM: {
    name: "Prism Governance Token",
    symbol: "PRISM",
    decimals: 8,
    logo: prismIcon,
    type: "GOVERNANCE",
    apy: "15.0%",
  },
};

// Separate currencies (debt-based) from assets (ownership-based)
export const CURRENCIES = ["pUSD", "pEUR", "pGBP", "pJPY", "pHKD", "pAED", "pAUD", "pCAD"];
export const ASSETS = ["pTSLA", "pAAPL", "pBTC", "pETH", "pGOLD", "pSPY", "pTBILL"];

// HashScan links
export const getHashScanLink = (address: string, type: "contract" | "token" | "topic" = "contract") => {
  const network = CONTRACTS.network;
  return `https://hashscan.io/${network}/${type}/${address}`;
};
