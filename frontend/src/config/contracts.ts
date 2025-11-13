// Contract addresses and configuration
export const CONTRACTS = {
  network: "testnet",
  vault: "0x16b53f394F945F8753a5F6d94014FF08fd9CC3CB",
  oracle: "0xd1394560fe24826918b55f041E0751b3f673b397",
  priceOracle: "0x739dD942065280A743DdfeF0De01A7B5FeD0f69B",
  // Asset Exchange contracts (ownership-based)
  pythOracle: "0xeDf3471eCb704063Ef872eD1C81c144ACBA4777c",
  assetExchange: "0x6bCdFAbDA95Adf6B5A2fE1Ab40c84a52B2f7ED59",
  hcsTopic: "0.0.7232509",
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
