/**
 * On-Demand Oracle Server
 * Sleeps by default, activates via API call for 1-2 hours
 * Perfect for testnet/demo - only costs money when actively used
 */

import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { Client, ContractExecuteTransaction, ContractFunctionParameters } from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.oracle.local' });

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://prismfinance-eta.vercel.app',
    'https://prismfinance-git-main-emadqureshikhis-projects.vercel.app',
    'https://prismfinance-8r2pf7lb1-emadqureshikhis-projects.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let isActive = false;
let activationTimer = null;
let updateInterval = null;
let activatedAt = null;
let expiresAt = null;

const ACTIVATION_DURATION = 2 * 60 * 60 * 1000; // 2 hours
const UPDATE_INTERVAL = 30 * 1000; // 30 seconds when active

// ============================================================================
// CHAINLINK CONFIGURATION (FxSwap Oracle)
// ============================================================================

const CHAINLINK_FEEDS = {
  'AUD/USD': '0x77F9710E7d0A19669A13c055F62cd80d313dF022',
  'CAD/USD': '0xa34317DB73e77d453b1B8d04550c44D10e981C8e',
  'CHF/USD': '0x449d117117838fFA61263B61dA6301AA2a88B13A',
  'CNY/USD': '0xeF8A4aF35cd47424672E3C590aBD37FBB7A7759a',
  'EUR/USD': '0xb49f677943BC038e9857d61E7d053CaA2C1734C1',
  'GBP/USD': '0x5c0Ab2d9b5a7ed9f470386e82BB36A3613cDd4b5',
  'JPY/USD': '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3',
  'NZD/USD': '0x3977CFc9e4f29C184D4675f4EB8e0013236e5f3e',
  'PHP/USD': '0x3C7dB4D25deAb7c89660512C5494Dc9A3FC40f78',
  'SGD/USD': '0xe25277fF4bbF9081C75Ab0EB13B4A13a721f3E13',
  'TRY/USD': '0xB09fC5fD3f11Cf9eb5E1C5Dba43114e3C9f477b5',
  'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
  'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  'XAU/USD': '0x214eD9Da11D2fbe465a6fc601a91E62EbEc1a0D6',
};

// ============================================================================
// PYTH CONFIGURATION (Asset Oracle)
// ============================================================================

const PYTH_HERMES_API = 'https://hermes.pyth.network';
const PYTH_PRICE_FEEDS = {
  'HBAR': {
    feedId: '0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd',
    exponent: -8,
    name: 'HBAR/USD'
  },
  'BTC': {
    feedId: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    exponent: -8,
    name: 'BTC/USD'
  },
  'ETH': {
    feedId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    exponent: -8,
    name: 'ETH/USD'
  },
  'TSLA': {
    feedId: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
    exponent: -5,
    name: 'TSLA/USD'
  },
  'AAPL': {
    feedId: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
    exponent: -5,
    name: 'AAPL/USD'
  },
  'SPY': {
    feedId: '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
    exponent: -5,
    name: 'SPY/USD'
  },
  'GOLD': {
    feedId: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
    exponent: -3,
    name: 'XAU/USD (Gold)'
  },
  'TBILL': {
    feedId: '0x84ff736dbf4339f4d353265c12774f6bf27551496c4c7ad89dd4ac30fa2f55f8',
    exponent: -8,
    name: 'MTBILL/USD (T-Bill)'
  }
};

// ============================================================================
// PROVIDERS
// ============================================================================

const ethProvider = new ethers.JsonRpcProvider(
  process.env.ETH_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY'
);

function getHederaClient() {
  const client = process.env.HEDERA_NETWORK === 'mainnet'
    ? Client.forMainnet()
    : Client.forTestnet();
  client.setOperator(process.env.HEDERA_ACCOUNT_ID, process.env.HEDERA_PRIVATE_KEY);
  return client;
}

// ============================================================================
// ORACLE FUNCTIONS (Combined from both scripts)
// ============================================================================

async function fetchChainlinkPrice(pair) {
  const aggregatorABI = [
    'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
  ];
  const aggregator = new ethers.Contract(CHAINLINK_FEEDS[pair], aggregatorABI, ethProvider);
  const [, answer, , updatedAt] = await aggregator.latestRoundData();
  return { price: answer.toString(), timestamp: updatedAt.toString() };
}

async function fetchPythPrice(symbol) {
  const feedConfig = PYTH_PRICE_FEEDS[symbol];
  const response = await fetch(`${PYTH_HERMES_API}/v2/updates/price/latest?ids[]=${feedConfig.feedId}`);
  const data = await response.json();

  if (data.parsed && data.parsed.length > 0) {
    const priceData = data.parsed[0].price;
    return {
      price: priceData.price,
      exponent: priceData.expo,
      publishTime: priceData.publish_time.toString()
    };
  }
  throw new Error(`No price data for ${symbol}`);
}

function convertChainlinkPrice(pair, chainlinkPrice) {
  const price = BigInt(chainlinkPrice);
  const forexPairs = ['AUD/USD', 'CAD/USD', 'CHF/USD', 'CNY/USD', 'EUR/USD', 'GBP/USD', 'JPY/USD', 'NZD/USD', 'PHP/USD', 'SGD/USD', 'TRY/USD'];

  if (forexPairs.includes(pair)) {
    return ((BigInt(10) ** BigInt(26)) / price).toString();
  }
  return (price * BigInt(1e10)).toString();
}

function convertPythPrice(symbol, pythPrice, pythExponent) {
  let price = BigInt(pythPrice);
  if (price < 0n) price = -price;

  const targetDecimals = 8;
  const currentDecimals = pythExponent < 0 ? -pythExponent : pythExponent;

  let adjustedPrice;
  if (currentDecimals === targetDecimals) {
    adjustedPrice = price;
  } else if (currentDecimals < targetDecimals) {
    const scaleFactor = BigInt(10) ** BigInt(targetDecimals - currentDecimals);
    adjustedPrice = price * scaleFactor;
  } else {
    const scaleFactor = BigInt(10) ** BigInt(currentDecimals - targetDecimals);
    adjustedPrice = price / scaleFactor;
  }

  return adjustedPrice.toString();
}

async function signFxPrice(pair, price, timestamp) {
  const wallet = new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY);
  const messageHash = ethers.solidityPackedKeccak256(
    ['bytes32', 'uint256', 'uint256'],
    [ethers.id(pair), price, timestamp]
  );
  return await wallet.signMessage(ethers.getBytes(messageHash));
}

async function signAssetPrice(symbol, price, timestamp) {
  const wallet = new ethers.Wallet(process.env.ASSET_ORACLE_PRIVATE_KEY);
  const messageHash = ethers.solidityPackedKeccak256(
    ['string', 'uint256', 'uint256'],
    [symbol, price, timestamp]
  );
  return await wallet.signMessage(ethers.getBytes(messageHash));
}

async function pushFxToHedera(pair, price, timestamp, signature) {
  const client = getHederaClient();
  const adjustedPrice = convertChainlinkPrice(pair, price);

  const tx = await new ContractExecuteTransaction()
    .setContractId(process.env.ORACLE_MANAGER_ADDRESS)
    .setGas(300000)
    .setFunction('pushPrice', new ContractFunctionParameters()
      .addBytes32(Array.from(ethers.getBytes(ethers.id(pair))))
      .addUint256(adjustedPrice)
      .addUint256(timestamp)
      .addBytes(Array.from(ethers.getBytes(signature)))
    )
    .execute(client);

  return await tx.getReceipt(client);
}

async function pushAssetToHedera(symbol, price, timestamp, signature) {
  const client = getHederaClient();
  const { ContractId } = await import('@hashgraph/sdk');
  const contractId = ContractId.fromEvmAddress(0, 0, process.env.ASSET_ORACLE_MANAGER_ADDRESS);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(300000)
    .setFunction('pushPrice', new ContractFunctionParameters()
      .addString(symbol)
      .addUint256(price)
      .addUint256(timestamp)
      .addBytes(Array.from(ethers.getBytes(signature)))
    )
    .execute(client);

  return await tx.getReceipt(client);
}

async function updatePythOracleFallback(symbol, price) {
  const client = getHederaClient();
  const pythOracleAddress = "0x1050eb5E510E6d9D747fEeD6E32B76D4061896F4";
  const { ContractId } = await import('@hashgraph/sdk');
  const contractId = ContractId.fromEvmAddress(0, 0, pythOracleAddress);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(200000)
    .setFunction('setFallbackPrice', new ContractFunctionParameters()
      .addString(symbol)
      .addUint256(price)
    )
    .execute(client);

  return await tx.getReceipt(client);
}

// ============================================================================
// UPDATE LOOP
// ============================================================================

async function updateAllPrices() {
  if (!isActive) return;

  console.log('🔄 Updating prices...');

  const hederaProvider = new ethers.JsonRpcProvider(
    process.env.HEDERA_NETWORK === 'mainnet'
      ? 'https://mainnet.hashio.io/api'
      : 'https://testnet.hashio.io/api'
  );

  // Helper to get fresh timestamp
  const getFreshTimestamp = async () => {
    const block = await hederaProvider.getBlock('latest');
    return block.timestamp;
  };

  // Update FxSwap prices
  for (const pair of Object.keys(CHAINLINK_FEEDS)) {
    try {
      const { price } = await fetchChainlinkPrice(pair);
      const adjustedPrice = convertChainlinkPrice(pair, price);

      // Get fresh timestamp for each update
      const timestamp = await getFreshTimestamp();
      const signature = await signFxPrice(pair, adjustedPrice, timestamp);

      if (process.env.ORACLE_MANAGER_ADDRESS) {
        await pushFxToHedera(pair, price, timestamp, signature);
      }
      console.log(`✅ FX ${pair}: ${(Number(price) / 1e8).toFixed(6)}`);
    } catch (error) {
      console.error(`❌ FX ${pair}:`, error.message);
    }
  }

  // Update Asset prices
  for (const symbol of Object.keys(PYTH_PRICE_FEEDS)) {
    try {
      const { price, exponent } = await fetchPythPrice(symbol);
      const adjustedPrice = convertPythPrice(symbol, price, exponent);

      // Get fresh timestamp for each update
      const timestamp = await getFreshTimestamp();
      const signature = await signAssetPrice(symbol, adjustedPrice, timestamp);

      if (process.env.ASSET_ORACLE_MANAGER_ADDRESS) {
        await pushAssetToHedera(symbol, adjustedPrice, timestamp, signature);
      }
      await updatePythOracleFallback(symbol, adjustedPrice);

      console.log(`✅ Asset ${symbol}: $${(Number(adjustedPrice) / 1e8).toFixed(6)}`);
    } catch (error) {
      console.error(`❌ Asset ${symbol}:`, error.message);
    }
  }

  console.log('✅ Update complete\n');
}

// ============================================================================
// ACTIVATION CONTROL
// ============================================================================

function startOracle() {
  if (isActive) {
    console.log('⚠️  Oracle already active');
    return;
  }

  isActive = true;
  activatedAt = Date.now();
  expiresAt = activatedAt + ACTIVATION_DURATION;

  console.log('🚀 Oracle activated for 2 hours');
  console.log(`   Expires at: ${new Date(expiresAt).toISOString()}`);

  // Run immediately
  updateAllPrices().catch(console.error);

  // Schedule regular updates
  updateInterval = setInterval(() => {
    updateAllPrices().catch(console.error);
  }, UPDATE_INTERVAL);

  // Auto-stop after duration
  activationTimer = setTimeout(() => {
    stopOracle();
  }, ACTIVATION_DURATION);
}

function stopOracle() {
  if (!isActive) {
    console.log('⚠️  Oracle already stopped');
    return;
  }

  isActive = false;
  activatedAt = null;
  expiresAt = null;

  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }

  if (activationTimer) {
    clearTimeout(activationTimer);
    activationTimer = null;
  }

  console.log('🛑 Oracle stopped');
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

app.get('/status', (req, res) => {
  res.json({
    active: isActive,
    activatedAt: activatedAt ? new Date(activatedAt).toISOString() : null,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    remainingMs: expiresAt ? Math.max(0, expiresAt - Date.now()) : 0,
    updateInterval: UPDATE_INTERVAL,
    activationDuration: ACTIVATION_DURATION
  });
});

app.post('/activate', (req, res) => {
  try {
    startOracle();
    res.json({
      success: true,
      message: 'Oracle activated for 2 hours',
      expiresAt: new Date(expiresAt).toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/deactivate', (req, res) => {
  try {
    stopOracle();
    res.json({
      success: true,
      message: 'Oracle deactivated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log('🌐 On-Demand Oracle Server');
  console.log(`   Port: ${PORT}`);
  console.log(`   Status: Sleeping (waiting for activation)`);
  console.log(`   Activation duration: ${ACTIVATION_DURATION / 1000 / 60} minutes`);
  console.log(`   Update interval: ${UPDATE_INTERVAL / 1000} seconds`);
  console.log('\n📡 Endpoints:');
  console.log(`   GET  /status      - Check oracle status`);
  console.log(`   POST /activate    - Start oracle for 2 hours`);
  console.log(`   POST /deactivate  - Stop oracle manually`);
  console.log(`   GET  /health      - Health check`);
  console.log('\n💤 Oracle is sleeping. Send POST to /activate to wake up.\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  Shutting down gracefully...');
  stopOracle();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  Shutting down gracefully...');
  stopOracle();
  process.exit(0);
});
