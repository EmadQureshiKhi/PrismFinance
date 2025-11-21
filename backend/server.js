import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { TokenId } from '@hashgraph/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Hedera JSON-RPC Relay
const JSON_RPC_RELAY = 'https://mainnet.hashio.io/api';
const provider = new ethers.JsonRpcProvider(JSON_RPC_RELAY, undefined, {
    batchMaxCount: 1,
});

// SaucerSwap Contract Addresses (Mainnet) - Verified from SaucerSwap docs
const ROUTER_V1_ADDRESS = '0x00000000000000000000000000000000004c5463'; // 0.0.5002339
const QUOTER_V2_ADDRESS = '0x00000000000000000000000000000000004c5469'; // 0.0.5002345

// Router V1 ABI
const ROUTER_V1_ABI = [
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
];

// QuoterV2 ABI
const QUOTER_V2_ABI = [
    'function quoteExactInput(bytes memory path, uint256 amountIn) external returns (uint256 amountOut, uint160[] memory sqrtPriceX96AfterList, uint32[] memory initializedTicksCrossedList, uint256 gasEstimate)',
];

/**
 * Convert Hedera token ID to EVM address
 * WHBAR mainnet: 0.0.8840785 (official Hedera WHBAR contract)
 * EVM Address: 0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed
 * 
 * Note: 0.0.1456986 is an OLD/INCORRECT WHBAR address - DO NOT USE
 */
function tokenIdToEvmAddress(tokenId) {
    // Map HBAR and old WHBAR addresses to correct WHBAR
    const WHBAR_TOKEN_ID = '0.0.8840785'; // Official Hedera WHBAR mainnet
    const OLD_WHBAR_IDS = ['0.0.1456986', '0.0.1062664']; // Old/incorrect WHBAR addresses

    if (tokenId === 'HBAR' || OLD_WHBAR_IDS.includes(tokenId)) {
        console.log(`  🔄 Mapping ${tokenId} → WHBAR (${WHBAR_TOKEN_ID})`);
        tokenId = WHBAR_TOKEN_ID;
    }

    try {
        const evmAddress = '0x' + TokenId.fromString(tokenId).toSolidityAddress();
        console.log(`  📍 ${tokenId} → ${evmAddress}`);
        return evmAddress;
    } catch (error) {
        console.error(`❌ Invalid token ID: ${tokenId}`);
        throw new Error(`Invalid token ID: ${tokenId}`);
    }
}

/**
 * Get V1 quote
 */
app.post('/api/quote/v1', async (req, res) => {
    try {
        const { inputToken, outputToken, amount, decimals = 8 } = req.body;

        console.log(`📡 V1 Quote: ${amount} ${inputToken} → ${outputToken}`);

        // Convert to EVM addresses
        const tokenInAddress = tokenIdToEvmAddress(inputToken);
        const tokenOutAddress = tokenIdToEvmAddress(outputToken);

        // Convert amount to smallest unit
        const amountInSmallestUnit = ethers.parseUnits(amount.toString(), decimals);

        // Call getAmountsOut
        const iface = new ethers.Interface(ROUTER_V1_ABI);
        const data = iface.encodeFunctionData('getAmountsOut', [
            amountInSmallestUnit,
            [tokenInAddress, tokenOutAddress],
        ]);

        const result = await provider.call({
            to: ROUTER_V1_ADDRESS,
            data: data,
        });

        // Check if result is empty (no liquidity pool)
        if (result === '0x' || result === '0x0') {
            throw new Error('No liquidity pool found for this pair on V1');
        }

        const decoded = iface.decodeFunctionResult('getAmountsOut', result);
        const amounts = decoded.amounts;

        const outputAmountRaw = amounts[amounts.length - 1];
        const outputAmount = ethers.formatUnits(outputAmountRaw, decimals);

        console.log(`✅ V1 Quote: ${outputAmount} ${outputToken}`);

        res.json({
            success: true,
            version: 'v1',
            inputAmount: amount,
            outputAmount: outputAmount,
            route: [inputToken, outputToken],
            fee: 0.3,
        });
    } catch (error) {
        console.error('❌ V1 Quote error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Get V2 quote
 */
app.post('/api/quote/v2', async (req, res) => {
    try {
        const { inputToken, outputToken, amount, fee = '0x000BB8', decimals = 8 } = req.body;

        console.log(`📡 V2 Quote: ${amount} ${inputToken} → ${outputToken}`);

        // Convert to EVM addresses
        const tokenInAddress = tokenIdToEvmAddress(inputToken);
        const tokenOutAddress = tokenIdToEvmAddress(outputToken);

        // Encode path: [tokenIn, fee, tokenOut]
        const pathData = ethers.solidityPacked(
            ['address', 'uint24', 'address'],
            [tokenInAddress, parseInt(fee, 16), tokenOutAddress]
        );

        // Convert amount to smallest unit
        const amountInSmallestUnit = ethers.parseUnits(amount.toString(), decimals);

        // Call quoteExactInput
        const iface = new ethers.Interface(QUOTER_V2_ABI);
        const data = iface.encodeFunctionData('quoteExactInput', [
            pathData,
            amountInSmallestUnit,
        ]);

        const result = await provider.call({
            to: QUOTER_V2_ADDRESS,
            data: data,
        });

        const decoded = iface.decodeFunctionResult('quoteExactInput', result);
        const outputAmountRaw = decoded.amountOut;
        const outputAmount = ethers.formatUnits(outputAmountRaw, decimals);
        const gasEstimate = decoded.gasEstimate.toString();

        console.log(`✅ V2 Quote: ${outputAmount} ${outputToken}`);

        res.json({
            success: true,
            version: 'v2',
            inputAmount: amount,
            outputAmount: outputAmount,
            route: [inputToken, outputToken],
            fee: parseInt(fee, 16) / 10000, // Convert to percentage
            gasEstimate: gasEstimate,
        });
    } catch (error) {
        console.error('❌ V2 Quote error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Pool cache for routing
 */
let poolCache = null;
let poolCacheTimestamp = 0;
const POOL_CACHE_DURATION = 60 * 60 * 1000; // 1 hour (longer cache to avoid rate limits)
let isFetchingPools = false; // Prevent concurrent fetches

/**
 * Fetch available pools from SaucerSwap API
 */
async function fetchPools() {
    // Return cached pools if fresh
    if (poolCache && Date.now() - poolCacheTimestamp < POOL_CACHE_DURATION) {
        console.log(`✅ Using cached pools (${Math.round((Date.now() - poolCacheTimestamp) / 1000 / 60)} minutes old)`);
        return poolCache;
    }

    // If already fetching, wait and return cached data
    if (isFetchingPools) {
        console.log('⏳ Pool fetch already in progress, using cached data');
        return poolCache || { pools: [], poolMap: new Map() };
    }

    isFetchingPools = true;

    try {
        console.log('📡 Fetching pools from SaucerSwap API...');

        // Add API key if available
        const headers = {};
        const apiKey = process.env.SAUCERSWAP_API_KEY;

        if (apiKey) {
            console.log('🔑 Using SaucerSwap API key');
            headers['x-api-key'] = apiKey;
        } else {
            console.warn('⚠️ No SAUCERSWAP_API_KEY found in environment');
        }

        const response = await fetch('https://api.saucerswap.finance/pools/', { headers });

        if (!response.ok) {
            console.warn(`⚠️ SaucerSwap API returned ${response.status}`);
            if (response.status === 401) {
                console.warn('💡 Tip: SaucerSwap API requires authentication. Set SAUCERSWAP_API_KEY env variable.');
            } else if (response.status === 429) {
                console.warn('⚠️ Rate limit exceeded. Using cached data. Cache will refresh in 1 hour.');
                // Keep old cache valid for longer when rate limited
                if (poolCache) {
                    poolCacheTimestamp = Date.now(); // Reset cache timer
                }
            }
            return poolCache || { pools: [], poolMap: new Map() }; // Return empty structure
        }

        const pools = await response.json();

        // Build pool map: tokenA-tokenB -> pool info
        const poolMap = new Map();
        for (const pool of pools) {
            const tokenA = pool.tokenA.id;
            const tokenB = pool.tokenB.id;

            // Store both directions
            poolMap.set(`${tokenA}-${tokenB}`, pool);
            poolMap.set(`${tokenB}-${tokenA}`, pool);
        }

        poolCache = { pools, poolMap };
        poolCacheTimestamp = Date.now();
        console.log(`✅ Loaded ${pools.length} pools from SaucerSwap`);

        return poolCache;
    } catch (error) {
        console.error('❌ Failed to fetch pools:', error.message);
        return poolCache || { pools: [], poolMap: new Map() };
    } finally {
        isFetchingPools = false;
    }
}

/**
 * Find a route between two tokens using available pools
 */
function findRoute(inputToken, outputToken, poolMap) {
    // If poolMap is empty or undefined, return null
    if (!poolMap || poolMap.size === 0) {
        console.log('⚠️ No pool data available - cannot find routes');
        return null;
    }

    // Direct pool
    if (poolMap.has(`${inputToken}-${outputToken}`)) {
        return [inputToken, outputToken];
    }

    // Try common intermediate tokens
    const intermediates = [
        '0.0.456858',  // USDC
        '0.0.731861',  // SAUCE  
        '0.0.8840785', // WHBAR
        '0.0.834116',  // HBARX
    ];

    for (const intermediate of intermediates) {
        if (intermediate === inputToken || intermediate === outputToken) continue;

        if (poolMap.has(`${inputToken}-${intermediate}`) &&
            poolMap.has(`${intermediate}-${outputToken}`)) {
            return [inputToken, intermediate, outputToken];
        }
    }

    return null; // No route found
}

/**
 * Get both V1 and V2 quotes with multi-hop routing support
 */
app.post('/api/quote/all', async (req, res) => {
    try {
        const { inputToken, outputToken, amount, inputDecimals = 8, outputDecimals = 8 } = req.body;

        console.log(`\n📡 Getting all quotes: ${amount} ${inputToken} (${inputDecimals} decimals) → ${outputToken} (${outputDecimals} decimals)`);

        const quotes = [];

        // Fetch available pools
        const { poolMap } = await fetchPools();

        // Map HBAR to WHBAR for routing
        const inputTokenForRouting = inputToken === 'HBAR' || inputToken === '0.0.1456986' || inputToken === '0.0.1062664'
            ? '0.0.8840785'
            : inputToken;
        const outputTokenForRouting = outputToken === 'HBAR' || outputToken === '0.0.1456986' || outputToken === '0.0.1062664'
            ? '0.0.8840785'
            : outputToken;

        // Find route using actual pools
        const route = findRoute(inputTokenForRouting, outputTokenForRouting, poolMap);

        if (!route) {
            console.log(`❌ No route found between ${inputToken} and ${outputToken}`);
            return res.json({
                success: false,
                quotes: [],
                bestQuote: null,
                message: 'No liquidity pools found for this trading pair.',
            });
        }

        console.log(`🛣️  Found route: ${route.join(' → ')}`);

        // Convert route to EVM addresses and prepare for contract calls
        const tokenInAddress = tokenIdToEvmAddress(inputToken);
        const tokenOutAddress = tokenIdToEvmAddress(outputToken);
        const amountInSmallestUnit = ethers.parseUnits(amount.toString(), inputDecimals);

        const routePath = route.map(tokenId => tokenIdToEvmAddress(tokenId));
        const routesToTry = [
            { path: routePath, name: route.length === 2 ? 'Direct' : `via ${route.slice(1, -1).join(', ')}` },
        ];

        // Try V1 with different routes
        for (const route of routesToTry) {
            try {
                console.log(`  🔍 Trying V1 route: ${route.name}`);
                const iface = new ethers.Interface(ROUTER_V1_ABI);
                const data = iface.encodeFunctionData('getAmountsOut', [
                    amountInSmallestUnit,
                    route.path,
                ]);

                const result = await provider.call({
                    to: ROUTER_V1_ADDRESS,
                    data: data,
                });

                // Check if result is empty (no liquidity pool)
                if (result === '0x' || result === '0x0') {
                    console.log(`  ⚠️ V1 (${route.name}): No pool (0x response)`);
                    continue;
                }

                const decoded = iface.decodeFunctionResult('getAmountsOut', result);
                const amounts = decoded.amounts;
                const outputAmountRaw = amounts[amounts.length - 1];
                const outputAmount = ethers.formatUnits(outputAmountRaw, outputDecimals);

                quotes.push({
                    version: 'v1',
                    route: route.name,
                    outputAmount: outputAmount,
                    fee: 0.3,
                });

                console.log(`✅ V1 (${route.name}): ${outputAmount}`);
                break; // Use first successful route
            } catch (error) {
                console.log(`  ⚠️ V1 (${route.name}): ${error.message.substring(0, 80)}`);
            }
        }

        // Try V2 with different fee tiers and routes
        const feeTiers = [
            { name: '0.05%', hex: 0x0001F4 },
            { name: '0.30%', hex: 0x000BB8 },
            { name: '1.00%', hex: 0x002710 },
        ];

        // Try V2 routes
        for (const route of routesToTry) {
            for (const feeTier of feeTiers) {
                try {
                    let pathData;

                    if (route.path.length === 2) {
                        // Direct route: [token, fee, token]
                        pathData = ethers.solidityPacked(
                            ['address', 'uint24', 'address'],
                            [route.path[0], feeTier.hex, route.path[1]]
                        );
                    } else if (route.path.length === 3) {
                        // Multi-hop: [token, fee, token, fee, token]
                        pathData = ethers.solidityPacked(
                            ['address', 'uint24', 'address', 'uint24', 'address'],
                            [route.path[0], feeTier.hex, route.path[1], feeTier.hex, route.path[2]]
                        );
                    } else {
                        continue;
                    }

                    const iface = new ethers.Interface(QUOTER_V2_ABI);
                    const data = iface.encodeFunctionData('quoteExactInput', [
                        pathData,
                        amountInSmallestUnit,
                    ]);

                    const result = await provider.call({
                        to: QUOTER_V2_ADDRESS,
                        data: data,
                    });

                    // Check if result is empty (no liquidity pool)
                    if (result === '0x' || result === '0x0') {
                        continue;
                    }

                    const decoded = iface.decodeFunctionResult('quoteExactInput', result);
                    const outputAmountRaw = decoded.amountOut;
                    const outputAmount = ethers.formatUnits(outputAmountRaw, outputDecimals);

                    quotes.push({
                        version: 'v2',
                        route: route.name,
                        feeTier: feeTier.name,
                        outputAmount: outputAmount,
                        fee: feeTier.hex / 10000,
                    });

                    console.log(`✅ V2 (${route.name}, ${feeTier.name}): ${outputAmount}`);
                } catch (error) {
                    // Try next combination
                }
            }
        }

        // Sort by best output
        quotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount));

        if (quotes.length === 0) {
            console.log('❌ No valid routes found for this pair');
            console.log('💡 Tip: SaucerSwap may require routing through tokens like $LAB, WOJAK, or QNT');
        }

        res.json({
            success: quotes.length > 0,
            quotes: quotes,
            bestQuote: quotes[0] || null,
            message: quotes.length === 0 ? 'No liquidity pools found for this trading pair. Try a different pair or check SaucerSwap.finance for available routes.' : undefined,
        });
    } catch (error) {
        console.error('❌ Quote error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// Debug endpoint to check token addresses
app.post('/api/debug/addresses', (req, res) => {
    try {
        const { inputToken, outputToken } = req.body;
        const inputAddress = tokenIdToEvmAddress(inputToken);
        const outputAddress = tokenIdToEvmAddress(outputToken);

        res.json({
            inputToken,
            inputAddress,
            outputToken,
            outputAddress,
            routerV1: ROUTER_V1_ADDRESS,
            quoterV2: QUOTER_V2_ADDRESS,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
    console.log(`🚀 Prism Finance Backend running on http://localhost:${PORT}`);
    console.log(`📡 Connected to Hedera JSON-RPC: ${JSON_RPC_RELAY}`);

    // Pre-fetch pools on startup
    console.log('🔄 Pre-fetching SaucerSwap pools...');
    await fetchPools();
});
