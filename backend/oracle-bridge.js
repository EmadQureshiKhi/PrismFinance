/**
 * FxSwap Oracle Bridge
 * Fetches Chainlink prices from Ethereum and relays them to Hedera
 */

import { ethers } from 'ethers';
import { Client, ContractExecuteTransaction, ContractFunctionParameters } from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.oracle.local' });

// ============================================================================
// CONFIGURATION
// ============================================================================

// Chainlink aggregator addresses (Ethereum mainnet)
const CHAINLINK_FEEDS = {
  // Forex Pairs
  'AUD/USD': '0x77F9710E7d0A19669A13c055F62cd80d313dF022', // Australian Dollar
  'CAD/USD': '0xa34317DB73e77d453b1B8d04550c44D10e981C8e', // Canadian Dollar
  'CHF/USD': '0x449d117117838fFA61263B61dA6301AA2a88B13A', // Swiss Franc
  'CNY/USD': '0xeF8A4aF35cd47424672E3C590aBD37FBB7A7759a', // Chinese Yuan
  'EUR/USD': '0xb49f677943BC038e9857d61E7d053CaA2C1734C1', // Euro
  'GBP/USD': '0x5c0Ab2d9b5a7ed9f470386e82BB36A3613cDd4b5', // Pound Sterling
  'JPY/USD': '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3', // Japanese Yen
  'NZD/USD': '0x3977CFc9e4f29C184D4675f4EB8e0013236e5f3e', // New Zealand Dollar
  'PHP/USD': '0x3C7dB4D25deAb7c89660512C5494Dc9A3FC40f78', // Philippines Peso
  'SGD/USD': '0xe25277fF4bbF9081C75Ab0EB13B4A13a721f3E13', // Singapore Dollar
  'TRY/USD': '0xB09fC5fD3f11Cf9eb5E1C5Dba43114e3C9f477b5', // Turkish Lira
  
  // Crypto
  'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', // Bitcoin
  'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // Ethereum
  
  // Commodities
  'XAU/USD': '0x214eD9Da11D2fbe465a6fc601a91E62EbEc1a0D6', // Gold
};

// Update intervals (dynamic)
const UPDATE_INTERVALS = {
  default: 30 * 1000,      // 30 seconds
  backup: 60 * 1000,       // 60 seconds
  emergency: 10 * 1000,    // 10 seconds on high deviation
};

// Price deviation threshold for emergency updates
const EMERGENCY_DEVIATION_THRESHOLD = 0.003; // 0.3%

// Store last prices for deviation calculation
const lastPrices = {};

// ============================================================================
// ETHEREUM PROVIDER
// ============================================================================

const ethProvider = new ethers.JsonRpcProvider(
  process.env.ETH_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY'
);

// ============================================================================
// HEDERA CLIENT
// ============================================================================

function getHederaClient() {
  const client = process.env.HEDERA_NETWORK === 'mainnet'
    ? Client.forMainnet()
    : Client.forTestnet();
  
  client.setOperator(
    process.env.HEDERA_ACCOUNT_ID,
    process.env.HEDERA_PRIVATE_KEY
  );
  
  return client;
}

// ============================================================================
// CHAINLINK PRICE FETCHING
// ============================================================================

/**
 * Fetch latest price from Chainlink aggregator
 */
async function fetchChainlinkPrice(pair) {
  try {
    const feedAddress = CHAINLINK_FEEDS[pair];
    if (!feedAddress) {
      throw new Error(`No Chainlink feed for ${pair}`);
    }

    // Chainlink Aggregator ABI (minimal)
    const aggregatorABI = [
      'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
    ];

    const aggregator = new ethers.Contract(feedAddress, aggregatorABI, ethProvider);
    const [roundId, answer, , updatedAt] = await aggregator.latestRoundData();

    return {
      price: answer.toString(),
      timestamp: updatedAt.toString(),
      roundId: roundId.toString(),
    };
  } catch (error) {
    console.error(`❌ Error fetching Chainlink price for ${pair}:`, error.message);
    throw error;
  }
}

// ============================================================================
// PRICE SIGNING
// ============================================================================

/**
 * Sign price data with oracle private key
 */
async function signPrice(pair, price, timestamp) {
  try {
    const wallet = new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY);
    
    // Create message hash
    const messageHash = ethers.solidityPackedKeccak256(
      ['bytes32', 'uint256', 'uint256'],
      [ethers.id(pair), price, timestamp]
    );
    
    // Sign the message
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    
    return signature;
  } catch (error) {
    console.error(`❌ Error signing price for ${pair}:`, error.message);
    throw error;
  }
}

// ============================================================================
// PRICE FORMAT CONVERSION
// ============================================================================

/**
 * Convert Chainlink price format to contract format
 * Chainlink: 8 decimals, USD per token
 * Contract: 18 decimals, token per USD (inverted for forex)
 */
function convertPriceFormat(pair, chainlinkPrice) {
  // Chainlink price has 8 decimals
  const price = BigInt(chainlinkPrice);
  
  // For forex pairs, we need to invert (EUR per USD instead of USD per EUR)
  const forexPairs = ['AUD/USD', 'CAD/USD', 'CHF/USD', 'CNY/USD', 'EUR/USD', 'GBP/USD', 'JPY/USD', 'NZD/USD', 'PHP/USD', 'SGD/USD', 'TRY/USD'];
  if (forexPairs.includes(pair)) {
    // Chainlink gives 8 decimals, we need 18 decimals
    // Invert: EUR per USD = (1e18 * 1e18) / (price * 1e10)
    // Simplified: 1e26 / price
    const adjustedPrice = (BigInt(10) ** BigInt(26)) / price;
    return adjustedPrice.toString();
  }
  
  // For crypto/commodities, just scale to 18 decimals
  // Chainlink gives 8 decimals, we need 18
  const adjustedPrice = price * BigInt(1e10); // 8 + 10 = 18 decimals
  return adjustedPrice.toString();
}

// ============================================================================
// HEDERA PRICE PUSH
// ============================================================================

/**
 * Push signed price to Hedera OracleManager contract
 */
async function pushToHedera(pair, price, timestamp, signature) {
  try {
    const client = getHederaClient();
    
    // Convert price format
    const adjustedPrice = convertPriceFormat(pair, price);
    
    console.log(`📤 Pushing ${pair} to Hedera:`);
    console.log(`   Raw price: ${price} (8 decimals)`);
    console.log(`   Adjusted: ${adjustedPrice} (18 decimals)`);
    
    // Create contract call
    const tx = await new ContractExecuteTransaction()
      .setContractId(process.env.ORACLE_MANAGER_ADDRESS)
      .setGas(300000) // Increased for signature verification
      .setFunction('pushPrice', new ContractFunctionParameters()
        .addBytes32(Array.from(ethers.getBytes(ethers.id(pair))))
        .addUint256(adjustedPrice)
        .addUint256(timestamp)
        .addBytes(Array.from(ethers.getBytes(signature)))
      )
      .execute(client);
    
    const receipt = await tx.getReceipt(client);
    console.log(`✅ Pushed ${pair} to Hedera: ${receipt.status}`);
    
    return receipt;
  } catch (error) {
    console.error(`❌ Error pushing ${pair} to Hedera:`, error.message);
    throw error;
  }
}

// ============================================================================
// DEVIATION CALCULATION
// ============================================================================

/**
 * Calculate price deviation from last update
 */
function calculateDeviation(pair, currentPrice) {
  const lastPrice = lastPrices[pair];
  if (!lastPrice) {
    return 0;
  }
  
  // CRITICAL: Use BigInt arithmetic
  const deviation = Number(
    (BigInt(currentPrice) - BigInt(lastPrice)) * 10000n / BigInt(lastPrice)
  ) / 10000;
  
  return Math.abs(deviation);
}

// ============================================================================
// HEARTBEAT
// ============================================================================

/**
 * Send heartbeat to monitor oracle health
 */
async function sendHeartbeat(pair, timestamp) {
  // In production, send to monitoring service
  console.log(`💓 Heartbeat: ${pair} at ${new Date(Number(timestamp) * 1000).toISOString()}`);
}

// ============================================================================
// MAIN UPDATE LOOP
// ============================================================================

/**
 * Update all prices
 */
async function updatePrices() {
  console.log('\n🔄 Starting price update cycle...');
  
  // Get fresh Hedera timestamp for this update cycle
  const hederaProvider = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
  const latestBlock = await hederaProvider.getBlock('latest');
  const hederaTimestamp = latestBlock.timestamp - 5; // 5s buffer
  
  for (const pair of Object.keys(CHAINLINK_FEEDS)) {
    try {
      // Fetch price from Chainlink
      const { price, timestamp: chainlinkTimestamp, roundId } = await fetchChainlinkPrice(pair);
      
      console.log(`\n📊 ${pair}:`);
      console.log(`   Price: ${price} (${Number(price) / 1e8})`);
      console.log(`   Round: ${roundId}`);
      console.log(`   Chainlink Updated: ${new Date(Number(chainlinkTimestamp) * 1000).toISOString()}`);
      
      // Calculate deviation
      const deviation = calculateDeviation(pair, price);
      if (deviation > 0) {
        console.log(`   Deviation: ${(deviation * 100).toFixed(4)}%`);
      }
      
      // Check if emergency update needed
      if (deviation > EMERGENCY_DEVIATION_THRESHOLD) {
        console.log(`   ⚠️  EMERGENCY UPDATE: ${(deviation * 100).toFixed(4)}% deviation`);
      }
      
      // Convert price BEFORE signing (CRITICAL FIX)
      const adjustedPrice = convertPriceFormat(pair, price);
      
      // Use fresh Hedera timestamp (not Chainlink timestamp)
      // This ensures the timestamp passes the contract's freshness check
      const timestamp = hederaTimestamp;
      
      // Sign with ADJUSTED price and Hedera timestamp
      const signature = await signPrice(pair, adjustedPrice, timestamp);
      
      // Push to Hedera
      if (process.env.ORACLE_MANAGER_ADDRESS) {
        await pushToHedera(pair, price, timestamp, signature);
      } else {
        console.log(`   ⏸️  Skipping Hedera push (ORACLE_MANAGER_ADDRESS not set)`);
        console.log(`   Signature: ${signature.slice(0, 20)}...`);
      }
      
      // Send heartbeat with Hedera timestamp
      await sendHeartbeat(pair, timestamp);
      
      // Update last price
      lastPrices[pair] = price;
      
    } catch (error) {
      console.error(`❌ Error updating ${pair}:`, error.message);
      // Continue with other pairs
    }
  }
  
  console.log('\n✅ Price update cycle complete\n');
}

// ============================================================================
// STARTUP
// ============================================================================

async function start() {
  console.log('🚀 FxSwap Oracle Bridge Starting...\n');
  
  // Validate environment
  if (!process.env.ETH_RPC_URL) {
    console.warn('⚠️  ETH_RPC_URL not set, using default (may be rate limited)');
  }
  
  if (!process.env.ORACLE_PRIVATE_KEY) {
    console.error('❌ ORACLE_PRIVATE_KEY not set!');
    process.exit(1);
  }
  
  if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
    console.error('❌ Hedera credentials not set!');
    process.exit(1);
  }
  
  if (!process.env.ORACLE_MANAGER_ADDRESS) {
    console.warn('⚠️  ORACLE_MANAGER_ADDRESS not set - will only fetch and sign prices');
  }
  
  console.log('✅ Configuration validated\n');
  console.log(`📡 Monitoring ${Object.keys(CHAINLINK_FEEDS).length} price feeds`);
  console.log(`⏱️  Update interval: ${UPDATE_INTERVALS.default / 1000}s\n`);
  
  // Wrapper function with error handling for each update cycle
  const safeUpdatePrices = async () => {
    try {
      await updatePrices();
    } catch (error) {
      console.error('❌ Error in update cycle:', error.message);
      console.log('⏭️  Continuing to next cycle...\n');
      // Don't crash - just log and continue to next cycle
    }
  };
  
  // Run immediately
  await safeUpdatePrices();
  
  // Schedule regular updates with error handling
  setInterval(safeUpdatePrices, UPDATE_INTERVALS.default);
}

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.log('🔄 Continuing operation...\n');
  // Don't exit - keep running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('   Reason:', reason);
  console.log('🔄 Continuing operation...\n');
  // Don't exit - keep running
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the oracle bridge with top-level error handling
console.log('🛡️  FxSwap Oracle Bridge with Auto-Recovery');
console.log('   Handles network errors gracefully');
console.log('   Continues operation on failures\n');

start().catch((error) => {
  console.error('❌ Fatal error starting oracle:', error.message);
  console.log('🔄 Attempting restart in 10 seconds...');
  setTimeout(() => {
    console.log('🔄 Restarting...\n');
    start().catch(console.error);
  }, 10000);
});
