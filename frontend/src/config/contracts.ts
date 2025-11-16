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

// Token metadata
export const TOKEN_METADATA = {
  pUSD: {
    name: "Prism USD",
    symbol: "pUSD",
    decimals: 6,
    logo: "ipfs://bafybeicbsjse6o2us46qtjuefydgravzcvcotnoiy5n2emyp2aegiyunn4",
    type: "CURRENCY",
    apy: "12.5%",
  },
  pEUR: {
    name: "Prism EUR",
    symbol: "pEUR",
    decimals: 6,
    logo: "ipfs://bafybeig7lyei7linw4d5xnvveqwmdg45l5ike5i5qmi5cjtznkqa7clsvy",
    type: "CURRENCY",
    apy: "11.8%",
  },
  pGBP: {
    name: "Prism GBP",
    symbol: "pGBP",
    decimals: 6,
    logo: "ipfs://bafybeieku5ljn75cejuv6fqw6zu2tcdpgrtlggq3t4cjafsrkykp56heyi",
    type: "CURRENCY",
    apy: "13.2%",
  },
  pJPY: {
    name: "Prism JPY",
    symbol: "pJPY",
    decimals: 6,
    logo: "ipfs://bafybeiagpik5ito7bocyxkmfom4ht4uthzfjb6yklv2ctdjn7k2ezn7kw4",
    type: "CURRENCY",
    apy: "10.5%",
  },
  pHKD: {
    name: "Prism HKD",
    symbol: "pHKD",
    decimals: 6,
    logo: "ipfs://bafybeiflieb3qddxe6bg6vllwokgl57v3vcywl7y6c4l55nunqf7aygpve",
    type: "CURRENCY",
    apy: "12.0%",
  },
  pAED: {
    name: "Prism AED",
    symbol: "pAED",
    decimals: 6,
    logo: "ipfs://bafybeiawbq4kv5zaoy5ljifmr5zd4g77w6nncyd34witpp2ojbhuxtca5y",
    type: "CURRENCY",
    apy: "11.5%",
  },
  pTSLA: {
    name: "Prism Tesla",
    symbol: "pTSLA",
    decimals: 6,
    logo: "ipfs://bafkreifzomk37opwdlygqfuugmqqtw37r573dysdxjqzod36usvsu4ctsm",
    type: "ASSET",
    apy: "7.8%",
  },
  pAAPL: {
    name: "Prism Apple",
    symbol: "pAAPL",
    decimals: 6,
    logo: "ipfs://bafkreic5hlcdjwoxkg64p25ialfccnvl4cychmqshah5k5jqmnwodwowm4",
    type: "ASSET",
    apy: "7.5%",
  },
  pTBILL: {
    name: "Prism Treasury Bill",
    symbol: "pTBILL",
    decimals: 6,
    logo: "ipfs://bafkreicjh2tcfiuvrwafowlxsfnx6lisxbqaq23yclaavszsxxsddb4ea4",
    type: "ASSET",
    apy: "5.5%",
  },
  pGOLD: {
    name: "Prism Gold",
    symbol: "pGOLD",
    decimals: 6,
    logo: "ipfs://bafkreihxcyin2fqonw7zgdv7iuhzfdy4dsj7zn3rs6tvej2kvrtf2brjam",
    type: "ASSET",
    apy: "6.5%",
  },
  pSPY: {
    name: "Prism S&P 500",
    symbol: "pSPY",
    decimals: 6,
    logo: "ipfs://bafkreicl4phymn74up2lc4kxqntcwwdjouysn5iqnoxpvqnl7vmf4bkkaa",
    type: "ASSET",
    apy: "8.0%",
  },
  pBTC: {
    name: "Prism Bitcoin",
    symbol: "pBTC",
    decimals: 6,
    logo: "ipfs://bafkreialyycjrt7ofjb3o462lwxa2xs7tgnen242y6it43appphznygfkq",
    type: "ASSET",
    apy: "8.5%",
  },
  pETH: {
    name: "Prism Ethereum",
    symbol: "pETH",
    decimals: 6,
    logo: "ipfs://bafkreib5yy4rtep3u2ktmfyqgqsviwj3kqwqgxtnntzs25rzrwvlejlm6qa",
    type: "ASSET",
    apy: "9.2%",
  },
  PRISM: {
    name: "Prism Governance Token",
    symbol: "PRISM",
    decimals: 8,
    logo: "ipfs://bafybeicbsjse6o2us46qtjuefydgravzcvcotnoiy5n2emyp2aegiyunn4",
    type: "GOVERNANCE",
    apy: "15.0%",
  },
};

// Separate currencies (debt-based) from assets (ownership-based)
export const CURRENCIES = ["pUSD", "pEUR", "pGBP", "pJPY", "pHKD", "pAED"];
export const ASSETS = ["pTSLA", "pAAPL", "pBTC", "pETH", "pGOLD", "pSPY", "pTBILL"];

// HashScan links
export const getHashScanLink = (address: string, type: "contract" | "token" | "topic" = "contract") => {
  const network = CONTRACTS.network;
  return `https://hashscan.io/${network}/${type}/${address}`;
};
