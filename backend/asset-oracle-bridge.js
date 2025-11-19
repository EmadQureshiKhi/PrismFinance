/**
 * Asset Oracle Bridge
 * Fetches Pyth prices from Ethereum and relays them to Hedera AssetOracleManager
 */

import { ethers } from 'ethers';
import { Client, ContractExecuteTransaction, ContractFunctionParameters } from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.asset-oracle' });

// ============================================================================
// CONFIGURATION
// ============================================================================

// Pyth Network contract on Ethereum mainnet
// Note: Using Hermes API is more reliable than on-chain contract
const PYTH_CONTRACT_ADDRESS = '0x4305FB66699C3B2702D4d05CF36551390A4c69C6';
const PYTH_HERMES_API = 'https://hermes.pyth.network';

// Pyth price feed IDs with exponents
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
// PYTH PRICE FETCHING
// ============================================================================

/**
 * Fetch latest price from Pyth Network (with Hermes API fallback)
 */
async function fetchPythPrice(symbol) {
  const feedConfig = PYTH_PRICE_FEEDS[symbol];
  if (!feedConfig) {
    throw new Error(`No Pyth feed for ${symbol}`);
  }

  // Try Hermes API first (more reliable)
  try {
    const response = await fetch(`${PYTH_HERMES_API}/v2/updates/price/latest?ids[]=${feedConfig.feedId}`);
    const data = await response.json();
    
    if (data.parsed && data.parsed.length > 0) {
      const priceData = data.parsed[0].price;
      return {
        price: priceData.price,
        confidence: priceData.conf,
        exponent: priceData.expo,
        publishTime: priceData.publish_time.toString(),
        configExponent: feedConfig.exponent
      };
    }
  } catch (hermesError) {
    console.warn(`⚠️  Hermes API failed for ${symbol}, trying on-chain...`);
  }

  // Fallback to on-chain contract
  try {
    const pythABI = [
      'function getPriceUnsafe(bytes32 id) view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)'
    ];

    const pythContract = new ethers.Contract(PYTH_CONTRACT_ADDRESS, pythABI, ethProvider);
    const priceData = await pythContract.getPriceUnsafe(feedConfig.feedId);

    return {
      price: priceData.price.toString(),
      confidence: priceData.conf.toString(),
      exponent: priceData.expo,
      publishTime: priceData.publishTime.toString(),
      configExponent: feedConfig.exponent
    };
  } catch (error) {
    console.error(`❌ Error fetching Pyth price for ${symbol}:`, error.message);
    throw error;
  }
}

// ============================================================================
// PRICE SIGNING
// ============================================================================

/**
 * Sign price data with oracle private key
 */
async function signPrice(symbol, price, timestamp) {
  try {
    const wallet = new ethers.Wallet(process.env.ASSET_ORACLE_PRIVATE_KEY);
    
    // Create message hash (matching Solidity: keccak256(abi.encodePacked(symbol, price, timestamp)))
    const messageHash = ethers.solidityPackedKeccak256(
      ['string', 'uint256', 'uint256'],
      [symbol, price, timestamp]
    );
    
    // Sign the message
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    
    return signature;
  } catch (error) {
    console.error(`❌ Error signing price for ${symbol}:`, error.message);
    throw error;
  }
}

// ============================================================================
// PRICE FORMAT CONVERSION
// ============================================================================

/**
 * Convert Pyth price format to contract format (8 decimals)
 * Pyth returns: price * 10^exponent
 * We need: price with 8 decimals
 */
function convertPriceFormat(symbol, pythPrice, pythExponent, configExponent) {
  try {
    let price = BigInt(pythPrice);
    
    // Ensure positive
    if (price < 0n) {
      price = -price;
    }
    
    // Pyth exponent is the actual exponent from the feed
    // Target is always 8 decimals
    const targetDecimals = 8;
    const currentDecimals = pythExponent < 0 ? -pythExponent : pythExponent;
    
    let adjustedPrice;
    
    if (currentDecimals === targetDecimals) {
      // Already 8 decimals
      adjustedPrice = price;
    } else if (currentDecimals < targetDecimals) {
      // Need to scale up (e.g., -3 to -8: multiply by 10^5)
      const scaleFactor = BigInt(10) ** BigInt(targetDecimals - currentDecimals);
      adjustedPrice = price * scaleFactor;
    } else {
      // Need to scale down (e.g., -10 to -8: divide by 10^2)
      const scaleFactor = BigInt(10) ** BigInt(currentDecimals - targetDecimals);
      adjustedPrice = price / scaleFactor;
    }
    
    return adjustedPrice.toString();
  } catch (error) {
    console.error(`❌ Error converting price format for ${symbol}:`, error);
    throw error;
  }
}

// ============================================================================
// HEDERA PRICE PUSH
// ============================================================================

/**
 * Push signed price to Hedera AssetOracleManager contract
 */
async function pushToHedera(symbol, price, timestamp, signature) {
  try {
    const client = getHederaClient();
    
    console.log(`📤 Pushing ${symbol} to Hedera:`);
    console.log(`   Price: ${price} (8 decimals = $${(Number(price) / 1e8).toFixed(6)})`);
    console.log(`   Timestamp: ${timestamp}`);
    
    // Use EVM address directly - Hedera SDK will handle conversion
    const contractAddress = process.env.ASSET_ORACLE_MANAGER_ADDRESS;
    
    // Create contract call using ContractId.fromEvmAddress
    const { ContractId } = await import('@hashgraph/sdk');
    const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);
    
    // Create contract call
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
    
    const receipt = await tx.getReceipt(client);
    console.log(`✅ Pushed ${symbol} to Hedera: ${receipt.status}`);
    
    return receipt;
  } catch (error) {
    console.error(`❌ Error pushing ${symbol} to Hedera:`, error.message);
    throw error;
  }
}

// ============================================================================
// DEVIATION CALCULATION
// ============================================================================

/**
 * Calculate price deviation from last update
 */
function calculateDeviation(symbol, currentPrice) {
  const lastPrice = lastPrices[symbol];
  if (!lastPrice) {
    return 0;
  }
  
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
async function sendHeartbeat(symbol, timestamp) {
  console.log(`💓 Heartbeat: ${symbol} at ${new Date(Number(timestamp) * 1000).toISOString()}`);
}

// ============================================================================
// MAIN UPDATE LOOP
// ============================================================================

/**
 * Update all prices
 */
async function updatePrices() {
  console.log('\n🔄 Starting asset price update cycle...');
  
  // Get fresh Hedera timestamp for this update cycle
  const hederaProvider = new ethers.JsonRpcProvider(
    process.env.HEDERA_NETWORK === 'mainnet' 
      ? 'https://mainnet.hashio.io/api'
      : 'https://testnet.hashio.io/api'
  );
  const latestBlock = await hederaProvider.getBlock('latest');
  const hederaTimestamp = latestBlock.timestamp - 5; // 5s buffer
  
  for (const symbol of Object.keys(PYTH_PRICE_FEEDS)) {
    try {
      const feedConfig = PYTH_PRICE_FEEDS[symbol];
      
      // Fetch price from Pyth
      const { price, confidence, exponent, publishTime, configExponent } = await fetchPythPrice(symbol);
      
      console.log(`\n📊 ${symbol} (${feedConfig.name}):`);
      console.log(`   Raw Price: ${price}`);
      console.log(`   Exponent: ${exponent} (expected: ${configExponent})`);
      console.log(`   Confidence: ${confidence}`);
      console.log(`   Pyth Updated: ${new Date(Number(publishTime) * 1000).toISOString()}`);
      
      // Convert price to 8 decimals
      const adjustedPrice = convertPriceFormat(symbol, price, exponent, configExponent);
      console.log(`   Adjusted Price: ${adjustedPrice} (8 decimals = $${(Number(adjustedPrice) / 1e8).toFixed(6)})`);
      
      // Calculate deviation
      const deviation = calculateDeviation(symbol, adjustedPrice);
      if (deviation > 0) {
        console.log(`   Deviation: ${(deviation * 100).toFixed(4)}%`);
      }
      
      // Check if emergency update needed
      if (deviation > EMERGENCY_DEVIATION_THRESHOLD) {
        console.log(`   ⚠️  EMERGENCY UPDATE: ${(deviation * 100).toFixed(4)}% deviation`);
      }
      
      // Use fresh Hedera timestamp
      const timestamp = hederaTimestamp;
      
      // Sign with adjusted price and Hedera timestamp
      const signature = await signPrice(symbol, adjustedPrice, timestamp);
      
      // Push to Hedera
      if (process.env.ASSET_ORACLE_MANAGER_ADDRESS) {
        await pushToHedera(symbol, adjustedPrice, timestamp, signature);
      } else {
        console.log(`   ⏸️  Skipping Hedera push (ASSET_ORACLE_MANAGER_ADDRESS not set)`);
        console.log(`   Signature: ${signature.slice(0, 20)}...`);
      }
      
      // Send heartbeat
      await sendHeartbeat(symbol, timestamp);
      
      // Update last price
      lastPrices[symbol] = adjustedPrice;
      
    } catch (error) {
      console.error(`❌ Error updating ${symbol}:`, error.message);
      // Continue with other assets
    }
  }
  
  console.log('\n✅ Asset price update cycle complete\n');
}

// ============================================================================
// STARTUP
// ============================================================================

async function start() {
  console.log('🚀 Asset Oracle Bridge Starting...\n');
  
  // Validate environment
  if (!process.env.ETH_RPC_URL) {
    console.warn('⚠️  ETH_RPC_URL not set, using default (may be rate limited)');
  }
  
  if (!process.env.ASSET_ORACLE_PRIVATE_KEY) {
    console.error('❌ ASSET_ORACLE_PRIVATE_KEY not set!');
    process.exit(1);
  }
  
  if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
    console.error('❌ Hedera credentials not set!');
    process.exit(1);
  }
  
  if (!process.env.ASSET_ORACLE_MANAGER_ADDRESS) {
    console.warn('⚠️  ASSET_ORACLE_MANAGER_ADDRESS not set - will only fetch and sign prices');
  }
  
  console.log('✅ Configuration validated\n');
  console.log(`📡 Monitoring ${Object.keys(PYTH_PRICE_FEEDS).length} asset price feeds`);
  console.log(`⏱️  Update interval: ${UPDATE_INTERVALS.default / 1000}s\n`);
  
  // Display oracle address
  const wallet = new ethers.Wallet(process.env.ASSET_ORACLE_PRIVATE_KEY);
  console.log(`🔑 Oracle Address: ${wallet.address}\n`);
  
  // Run immediately
  await updatePrices();
  
  // Schedule regular updates
  setInterval(updatePrices, UPDATE_INTERVALS.default);
}

// Start the oracle bridge
start().catch(console.error);
