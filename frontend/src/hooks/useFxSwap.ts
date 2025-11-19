import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '@/contexts/WalletContext';
import poolsConfig from '@/config/deployments-production.json';

// FxPool ABI - only the functions we need
const FX_POOL_ABI = [
  'function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) external returns (uint256)',
  'function getVirtualReserves() external view returns (uint256, uint256)',
  'function getRealReserves() external view returns (uint256, uint256)',
  'function getPriceImpact(address tokenIn, uint256 amountIn) external view returns (uint256)',
  'function getPoolInfo() external view returns (uint256 realReserveA, uint256 realReserveB, uint256 virtualReserveA, uint256 virtualReserveB, uint256 oraclePrice, uint256 totalSupply, uint256 feesA, uint256 feesB)',
  'function maxTradeSize(bool isTokenA) external view returns (uint256)',
];

// HBAR Pool ABI - for HBAR/pUSD pool
const HBAR_POOL_ABI = [
  'function swap(bool isHBARIn, uint256 minAmountOut) external payable returns (uint256)',
  'function getExchangeRate() external view returns (uint256)',
  'function getRealReserves() external view returns (uint256, uint256)',
  'function getVirtualReserves() external view returns (uint256, uint256)',
];

// FxRouter ABI - for single-transaction multi-hop swaps
const FX_ROUTER_ABI = [
  'function multiHopSwap(address[] pools, address[] tokens, uint256 amountIn, uint256 minAmountOut) external returns (uint256)',
  'function multiHopSwapWithHBAR(address[] pools, address[] tokens, uint256 minAmountOut, bool isHBARIn) external payable returns (uint256)',
];

export interface FxCurrency {
  symbol: string;
  name: string;
  tokenId: string;
  solidityAddress: string;
}

export interface FxPool {
  pair: string;
  contractId: string;
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  exchangeRate?: number;
  tvl?: number;
}

export function useFxSwap() {
  const { connection } = useWallet();
  const [currencies, setCurrencies] = useState<FxCurrency[]>([]);
  const [pools, setPools] = useState<FxPool[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  // Load currencies and pools from config
  useEffect(() => {
    try {
      // Load all currencies including pPHP
      const currencyList: FxCurrency[] = Object.entries(poolsConfig.currencies)
        .map(([symbol, data]: [string, any]) => ({
          symbol,
          name: data.name,
          tokenId: data.tokenId,
          solidityAddress: data.solidityAddress,
        }));

      setCurrencies(currencyList);

      // Load all pools including pUSD/pPHP
      const poolList: FxPool[] = Object.entries(poolsConfig.pools)
        .map(([pair, data]: [string, any]) => ({
          pair,
          contractId: data.contractId,
          poolAddress: data.poolAddress,
          tokenA: data.tokenA,
          tokenB: data.tokenB,
        }));

      setPools(poolList);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading FxSwap config:', error);
      setIsLoading(false);
    }
  }, []);

  // Fetch exchange rates for all pools
  useEffect(() => {
    const fetchExchangeRates = async () => {
      if (!connection || pools.length === 0) {
        console.log('⏸️ Exchange rate fetch skipped:', { connection: !!connection, poolCount: pools.length });
        return;
      }

      console.log('🔄 Fetching exchange rates for', pools.length, 'pools...');
      const startTime = Date.now();

      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const rates: Record<string, number> = {};

        for (const pool of pools) {
          try {
            console.log(`  📊 Fetching rate for ${pool.pair}...`);
            
            // Check if it's HBAR pool (has getExchangeRate)
            if (pool.pair === 'HBAR/pUSD') {
              const poolContract = new ethers.Contract(
                pool.poolAddress,
                HBAR_POOL_ABI,
                provider
              );
              const rate = await poolContract.getExchangeRate();
              const rateFormatted = parseFloat(ethers.formatUnits(rate, 18));
              rates[pool.pair] = rateFormatted;
              console.log(`  ✅ ${pool.pair}: ${rateFormatted.toFixed(6)} pUSD per HBAR (from getExchangeRate)`);
            } else {
              // For HTS pools, calculate rate from virtual reserves
              const poolContract = new ethers.Contract(
                pool.poolAddress,
                FX_POOL_ABI,
                provider
              );
              const [virtualA, virtualB] = await poolContract.getVirtualReserves();
              
              const virtualAFormatted = parseFloat(ethers.formatUnits(virtualA, 8));
              const virtualBFormatted = parseFloat(ethers.formatUnits(virtualB, 8));
              
              // Calculate exchange rate: tokenB per tokenA
              // For pUSD/pEUR with EUR/USD = 1.1587:
              // virtualA (pUSD) is larger, virtualB (pEUR) is smaller
              // Rate = virtualB / virtualA = 0.863 pEUR per pUSD (CORRECT!)
              const rate = virtualBFormatted / virtualAFormatted;
              rates[pool.pair] = rate;
              
              console.log(`  ✅ ${pool.pair}: ${rate.toFixed(6)} ${pool.tokenB} per ${pool.tokenA}`);
              console.log(`     Virtual Reserves: ${virtualAFormatted.toFixed(2)} ${pool.tokenA}, ${virtualBFormatted.toFixed(2)} ${pool.tokenB}`);
            }
          } catch (error: any) {
            console.error(`  ❌ Error fetching rate for ${pool.pair}:`, error.message);
            rates[pool.pair] = 1.0; // Fallback
          }
        }

        setExchangeRates(rates);
        const elapsed = Date.now() - startTime;
        console.log(`✅ Exchange rates fetched in ${elapsed}ms:`, rates);
      } catch (error) {
        console.error('❌ Error fetching exchange rates:', error);
      }
    };

    fetchExchangeRates();

    // Refresh rates every 30 seconds
    const interval = setInterval(() => {
      console.log('🔄 Refreshing exchange rates (30s interval)...');
      fetchExchangeRates();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [connection, pools]);

  // Get pool for a currency pair
  const getPool = (fromSymbol: string, toSymbol: string): FxPool | null => {
    // Check for HBAR pools
    if (fromSymbol === 'HBAR' && toSymbol === 'pUSD') {
      return pools.find(p => p.pair === 'HBAR/pUSD') || null;
    } else if (fromSymbol === 'pUSD' && toSymbol === 'HBAR') {
      return pools.find(p => p.pair === 'HBAR/pUSD') || null;
    }
    
    // All other pools are paired with pUSD
    if (fromSymbol === 'pUSD') {
      return pools.find(p => p.pair === `pUSD/${toSymbol}`) || null;
    } else if (toSymbol === 'pUSD') {
      return pools.find(p => p.pair === `pUSD/${fromSymbol}`) || null;
    }
    
    // For non-pUSD pairs, we'd need to route through pUSD (multi-hop)
    return null;
  };

  // Check if multi-hop routing is needed
  const needsMultiHop = (fromSymbol: string, toSymbol: string): boolean => {
    // Direct pool exists
    if (getPool(fromSymbol, toSymbol)) return false;
    
    // Both are pUSD
    if (fromSymbol === 'pUSD' && toSymbol === 'pUSD') return false;
    
    // Need multi-hop if no direct pool
    return true;
  };

  // Get multi-hop route (always through pUSD)
  const getMultiHopRoute = (fromSymbol: string, toSymbol: string): FxPool[] | null => {
    if (!needsMultiHop(fromSymbol, toSymbol)) return null;
    
    const firstPool = getPool(fromSymbol, 'pUSD');
    const secondPool = getPool('pUSD', toSymbol);
    
    if (firstPool && secondPool) {
      return [firstPool, secondPool];
    }
    
    return null;
  };

  // Get exchange rate for a pair
  const getExchangeRate = (fromSymbol: string, toSymbol: string): number => {
    console.log(`💱 Getting exchange rate: ${fromSymbol} → ${toSymbol}`);
    
    // Check for direct pool
    const directPool = getPool(fromSymbol, toSymbol);
    if (directPool) {
      const rate = exchangeRates[directPool.pair];
      console.log(`  📊 Direct pool found: ${directPool.pair}, stored rate: ${rate}`);
      
      if (!rate) {
        console.log(`  ⚠️ No rate available, using fallback 1.0`);
        return 1.0;
      }

      // Handle HBAR pool
      if (directPool.pair === 'HBAR/pUSD') {
        const finalRate = fromSymbol === 'HBAR' ? rate : 1 / rate;
        console.log(`  ✅ HBAR pool: ${fromSymbol === 'HBAR' ? 'direct' : 'inverted'} = ${finalRate.toFixed(6)}`);
        return finalRate;
      }

      // For pUSD/X pools, the stored rate is "X per pUSD" (what contract gives)
      // So if swapping FROM pUSD TO X, use the rate directly
      // If swapping FROM X TO pUSD, invert it
      if (fromSymbol === 'pUSD') {
        // pUSD → pEUR: rate is pEUR per pUSD, use directly
        console.log(`  ✅ pUSD → ${toSymbol}: using direct rate = ${rate.toFixed(6)}`);
        return rate;
      } else {
        // pEUR → pUSD: rate is pEUR per pUSD, invert to get pUSD per pEUR
        const invertedRate = 1 / rate;
        console.log(`  ✅ ${fromSymbol} → pUSD: inverting rate = ${invertedRate.toFixed(6)}`);
        return invertedRate;
      }
    }

    // Multi-hop routing through pUSD
    console.log(`  🔀 No direct pool, checking multi-hop...`);
    const route = getMultiHopRoute(fromSymbol, toSymbol);
    if (route && route.length === 2) {
      const rate1 = exchangeRates[route[0].pair] || 1.0;
      const rate2 = exchangeRates[route[1].pair] || 1.0;
      
      console.log(`  🔀 Multi-hop route: ${route[0].pair} → ${route[1].pair}`);
      console.log(`     Rate 1: ${rate1.toFixed(6)}, Rate 2: ${rate2.toFixed(6)}`);
      
      // First hop: fromSymbol -> pUSD
      let toPUSD = 1.0;
      if (fromSymbol !== 'pUSD') {
        if (route[0].pair === 'HBAR/pUSD' && fromSymbol === 'HBAR') {
          toPUSD = rate1; // HBAR → pUSD
          console.log(`     Hop 1: HBAR → pUSD = ${toPUSD.toFixed(6)}`);
        } else {
          toPUSD = 1 / rate1; // Other → pUSD (invert)
          console.log(`     Hop 1: ${fromSymbol} → pUSD = ${toPUSD.toFixed(6)} (inverted)`);
        }
      }
      
      // Second hop: pUSD -> toSymbol
      let fromPUSD = 1.0;
      if (toSymbol !== 'pUSD') {
        if (route[1].pair === 'HBAR/pUSD' && toSymbol === 'HBAR') {
          fromPUSD = 1 / rate2; // pUSD → HBAR (invert)
          console.log(`     Hop 2: pUSD → HBAR = ${fromPUSD.toFixed(6)} (inverted)`);
        } else {
          fromPUSD = rate2; // pUSD → Other (direct)
          console.log(`     Hop 2: pUSD → ${toSymbol} = ${fromPUSD.toFixed(6)}`);
        }
      }
      
      const finalRate = toPUSD * fromPUSD;
      console.log(`  ✅ Multi-hop final rate: ${finalRate.toFixed(6)}`);
      return finalRate;
    }

    console.log(`  ⚠️ No route found, using fallback 1.0`);
    return 1.0;
  };

  // Calculate swap output
  const calculateSwapOutput = (
    fromSymbol: string,
    toSymbol: string,
    amountIn: string
  ): string => {
    if (!amountIn || parseFloat(amountIn) <= 0) return '0';

    const rate = getExchangeRate(fromSymbol, toSymbol);
    const amount = parseFloat(amountIn);
    const output = amount * rate;

    // Apply 0.3% fee per hop
    const isMultiHop = needsMultiHop(fromSymbol, toSymbol);
    const feeMultiplier = isMultiHop ? 0.006 : 0.003; // 0.6% for multi-hop, 0.3% for direct
    const fee = output * feeMultiplier;
    const outputAfterFee = output - fee;

    return outputAfterFee.toFixed(6);
  };

  // Execute swap (direct or multi-hop)
  const executeSwap = async (
    fromCurrency: FxCurrency,
    toCurrency: FxCurrency,
    amountIn: string,
    minAmountOut: string
  ): Promise<string> => {
    if (!connection) {
      throw new Error('Wallet not connected');
    }

    setIsExecuting(true);
    try {
      // Check if multi-hop is needed
      if (needsMultiHop(fromCurrency.symbol, toCurrency.symbol)) {
        return await executeMultiHopSwap(fromCurrency, toCurrency, amountIn, minAmountOut);
      }

      // Direct swap
      return await executeDirectSwap(fromCurrency, toCurrency, amountIn, minAmountOut);
    } finally {
      setIsExecuting(false);
    }
  };

  // Execute direct swap
  const executeDirectSwap = async (
    fromCurrency: FxCurrency,
    toCurrency: FxCurrency,
    amountIn: string,
    minAmountOut: string
  ): Promise<string> => {
    const pool = getPool(fromCurrency.symbol, toCurrency.symbol);
    if (!pool) {
      throw new Error('No pool available for this pair');
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      // Handle HBAR pool differently
      if (pool.pair === 'HBAR/pUSD') {
        return executeHBARSwap(fromCurrency, toCurrency, amountIn, minAmountOut, pool);
      }

      // Check if user is associated with output token (Hedera requirement)
      if (toCurrency.symbol !== 'HBAR') {
        console.log(`Checking association with ${toCurrency.symbol}...`);
        const tokenABI = ['function balanceOf(address owner) view returns (uint256)'];
        const tokenContract = new ethers.Contract(
          '0x' + toCurrency.solidityAddress,
          tokenABI,
          provider
        );
        
        try {
          await tokenContract.balanceOf(signerAddress);
          console.log(`✅ Already associated with ${toCurrency.symbol}`);
        } catch (error: any) {
          // Not associated - need to associate via HashPack
          console.log(`⚠️ Not associated with ${toCurrency.symbol}, requesting association...`);
          
          // Use HashPack's associate method
          if ((window as any).hashconnect) {
            throw new Error(`Please associate with ${toCurrency.symbol} token (${toCurrency.tokenId}) in your wallet first. You can do this in HashPack settings.`);
          } else {
            throw new Error(`You need to associate with ${toCurrency.symbol} token before receiving it. Token ID: ${toCurrency.tokenId}`);
          }
        }
      }

      // Regular HTS pool
      const poolContract = new ethers.Contract(
        pool.poolAddress,
        FX_POOL_ABI,
        signer
      );

      const tokenInAddress = fromCurrency.solidityAddress;
      const amountInWei = ethers.parseUnits(amountIn, 8);
      const minAmountOutWei = ethers.parseUnits(minAmountOut, 8);

      // Transfer tokens to pool (Hedera pattern)
      const tokenABI = ['function transfer(address to, uint256 amount) returns (bool)'];
      const tokenContract = new ethers.Contract(
        '0x' + fromCurrency.solidityAddress,
        tokenABI,
        signer
      );

      console.log('Transferring tokens to pool...');
      const transferTx = await tokenContract.transfer(pool.poolAddress, amountInWei);
      await transferTx.wait();

      // Execute swap
      console.log('Executing swap...');
      const swapTx = await poolContract.swap(
        '0x' + tokenInAddress,
        amountInWei,
        minAmountOutWei
      );

      const receipt = await swapTx.wait();
      return receipt.hash;
    } catch (error: any) {
      console.error('Swap error:', error);
      throw new Error(error.message || 'Swap failed');
    }
  };

  // Execute HBAR swap
  const executeHBARSwap = async (
    fromCurrency: FxCurrency,
    toCurrency: FxCurrency,
    amountIn: string,
    minAmountOut: string,
    pool: FxPool
  ): Promise<string> => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      const isHBARIn = fromCurrency.symbol === 'HBAR';
      const minAmountOutWei = ethers.parseUnits(minAmountOut, 8);

      if (isHBARIn) {
        // HBAR → pUSD: Send HBAR via JSON-RPC Relay
        // IMPORTANT: JSON-RPC Relay uses 18 decimals for msg.value, not 8!
        const amountInWei = ethers.parseEther(amountIn); // 18 decimals for relay
        
        console.log('Swapping HBAR → pUSD...', { 
          amountIn, 
          amountInWei: amountInWei.toString(),
          poolAddress: pool.poolAddress
        });
        
        // Encode the function call
        const iface = new ethers.Interface(HBAR_POOL_ABI);
        const data = iface.encodeFunctionData('swap', [true, minAmountOutWei]);
        
        // Send raw transaction with HBAR value (18 decimals)
        const tx = await signer.sendTransaction({
          to: pool.poolAddress,
          value: amountInWei, // 18 decimals for JSON-RPC Relay
          data: data,
          gasLimit: 800000
        });
        
        console.log('Transaction sent:', tx.hash);
        const receipt = await tx.wait();
        return receipt!.hash;
      } else {
        // pUSD → HBAR: transfer pUSD first
        const amountInWei = ethers.parseUnits(amountIn, 8);
        const tokenABI = ['function transfer(address to, uint256 amount) returns (bool)'];
        const tokenContract = new ethers.Contract(
          '0x' + fromCurrency.solidityAddress,
          tokenABI,
          signer
        );

        console.log('Transferring pUSD to pool...', {
          amount: amountIn,
          amountInWei: amountInWei.toString(),
          poolAddress: pool.poolAddress
        });
        const transferTx = await tokenContract.transfer(pool.poolAddress, amountInWei);
        await transferTx.wait();
        console.log('✅ pUSD transferred');

        console.log('Swapping pUSD → HBAR...');
        
        // Manually encode the swap call like we do for HBAR → pUSD
        const iface = new ethers.Interface(HBAR_POOL_ABI);
        const data = iface.encodeFunctionData('swap', [false, minAmountOutWei]);
        
        const tx = await signer.sendTransaction({
          to: pool.poolAddress,
          data: data,
          gasLimit: 800000
        });
        
        console.log('Transaction sent:', tx.hash);
        const receipt = await tx.wait();
        return receipt!.hash;
      }
    } catch (error: any) {
      console.error('HBAR swap error:', error);
      throw new Error(error.message || 'HBAR swap failed');
    }
  };

  // Execute multi-hop swap (single transaction via router)
  const executeMultiHopSwap = async (
    fromCurrency: FxCurrency,
    toCurrency: FxCurrency,
    amountIn: string,
    minAmountOut: string
  ): Promise<string> => {
    const route = getMultiHopRoute(fromCurrency.symbol, toCurrency.symbol);
    if (!route || route.length !== 2) {
      throw new Error('No multi-hop route available');
    }

    // Check if router is available
    const routerConfig = (poolsConfig as any).router;
    if (!routerConfig) {
      console.warn('Router not deployed, falling back to 2-transaction method');
      return executeMultiHopSwapLegacy(fromCurrency, toCurrency, amountIn, minAmountOut);
    }

    try {
      console.log(`Multi-hop swap via router: ${fromCurrency.symbol} → pUSD → ${toCurrency.symbol}`);

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const routerContract = new ethers.Contract(
        routerConfig.routerAddress,
        FX_ROUTER_ABI,
        signer
      );

      const pools = [route[0].poolAddress, route[1].poolAddress];
      const pUSDCurrency = currencies.find(c => c.symbol === 'pUSD');
      if (!pUSDCurrency) throw new Error('pUSD not found');

      const tokens = [
        '0x' + fromCurrency.solidityAddress,
        '0x' + pUSDCurrency.solidityAddress,
        '0x' + toCurrency.solidityAddress,
      ];

      const amountInWei = ethers.parseUnits(amountIn, 8);
      const minAmountOutWei = ethers.parseUnits(minAmountOut, 8);

      // Check if HBAR is involved
      const isHBARIn = fromCurrency.symbol === 'HBAR';
      const isHBAROut = toCurrency.symbol === 'HBAR';

      if (isHBARIn || isHBAROut) {
        // Use multiHopSwapWithHBAR
        console.log('Using multiHopSwapWithHBAR...');
        
        const tx = await routerContract.multiHopSwapWithHBAR(
          pools,
          tokens,
          minAmountOutWei,
          isHBARIn,
          {
            value: isHBARIn ? ethers.parseEther(amountIn) : 0,
            gasLimit: 1500000
          }
        );
        
        const receipt = await tx.wait();
        return receipt.hash;
      } else {
        // Regular HTS multi-hop via router
        console.log('Using multiHopSwap via router...');
        
        // Transfer input tokens to router first (Hedera pattern)
        const tokenABI = ['function transfer(address to, uint256 amount) returns (bool)'];
        const tokenContract = new ethers.Contract(
          '0x' + fromCurrency.solidityAddress,
          tokenABI,
          signer
        );

        console.log('Transferring tokens to router...');
        const transferTx = await tokenContract.transfer(routerConfig.routerAddress, amountInWei);
        await transferTx.wait();

        console.log('Executing multi-hop swap via router...');
        const swapTx = await routerContract.multiHopSwap(
          pools,
          tokens,
          amountInWei,
          minAmountOutWei,
          {
            gasLimit: 1500000
          }
        );

        const receipt = await swapTx.wait();
        return receipt.hash;
      }
    } catch (error: any) {
      console.error('Multi-hop swap error:', error);
      throw new Error(error.message || 'Multi-hop swap failed');
    }
  };

  // Legacy 2-transaction multi-hop (fallback)
  const executeMultiHopSwapLegacy = async (
    fromCurrency: FxCurrency,
    toCurrency: FxCurrency,
    amountIn: string,
    minAmountOut: string
  ): Promise<string> => {
    const route = getMultiHopRoute(fromCurrency.symbol, toCurrency.symbol);
    if (!route || route.length !== 2) {
      throw new Error('No multi-hop route available');
    }

    try {
      console.log(`Legacy multi-hop swap: ${fromCurrency.symbol} → pUSD → ${toCurrency.symbol}`);

      // First hop: fromCurrency → pUSD
      const pUSDCurrency = currencies.find(c => c.symbol === 'pUSD');
      if (!pUSDCurrency) throw new Error('pUSD not found');

      // Calculate intermediate amount (with some slippage tolerance)
      const intermediateAmount = calculateSwapOutput(fromCurrency.symbol, 'pUSD', amountIn);
      const minIntermediate = (parseFloat(intermediateAmount) * 0.99).toFixed(6); // 1% slippage

      console.log(`Hop 1: ${amountIn} ${fromCurrency.symbol} → ${intermediateAmount} pUSD`);
      await executeDirectSwap(fromCurrency, pUSDCurrency, amountIn, minIntermediate);

      // Wait a bit for the first swap to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Second hop: pUSD → toCurrency
      const finalMinAmount = (parseFloat(minAmountOut) * 0.99).toFixed(6); // Additional slippage
      console.log(`Hop 2: ${intermediateAmount} pUSD → ${toCurrency.symbol}`);
      const txHash = await executeDirectSwap(pUSDCurrency, toCurrency, intermediateAmount, finalMinAmount);

      return txHash;
    } catch (error: any) {
      console.error('Legacy multi-hop swap error:', error);
      throw new Error(error.message || 'Multi-hop swap failed');
    }
  };

  return {
    currencies,
    pools,
    isLoading,
    isExecuting,
    exchangeRates,
    getPool,
    getExchangeRate,
    calculateSwapOutput,
    executeSwap,
    needsMultiHop,
    getMultiHopRoute,
  };
}
