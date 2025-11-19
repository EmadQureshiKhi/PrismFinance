import { useState } from 'react';
import { ethers } from 'ethers';
import poolsConfig from '@/config/deployments-production.json';

const POOL_ABI = [
  'function addLiquidity(uint256 amountA, uint256 amountB) returns (uint256)',
  'function removeLiquidity(uint256 lpTokens) returns (uint256, uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function realReserveA() view returns (uint256)',
  'function realReserveB() view returns (uint256)',
];

const TOKEN_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];

// Convert Hedera ID to EVM address
function hederaIdToEvmAddress(hederaId: string): string {
  const parts = hederaId.split('.');
  const num = parseInt(parts[parts.length - 1]);
  return '0x' + num.toString(16).padStart(40, '0');
}

export function useLiquidity() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Calculate correct amountB based on CURRENT virtual reserves
  const calculateCorrectAmountB = async (
    poolPair: string,
    amountA: string
  ): Promise<string> => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      
      // Get pool config
      const poolConfig = (poolsConfig.pools as any)[poolPair];
      if (!poolConfig) {
        throw new Error(`Pool ${poolPair} not found`);
      }

      const poolAddress = poolConfig.poolAddress;
      const checkPoolABI = [
        'function virtualReserveA() view returns (uint256)',
        'function virtualReserveB() view returns (uint256)',
      ];
      const checkContract = new ethers.Contract(poolAddress, checkPoolABI, provider);
      
      const [virtualA, virtualB] = await Promise.all([
        checkContract.virtualReserveA(),
        checkContract.virtualReserveB(),
      ]);

      const amountAWei = ethers.parseUnits(amountA, 8);

      // Calculate amountB to match current virtual reserve ratio
      // amountB = amountA * (virtualB / virtualA)
      const amountBWei = (amountAWei * virtualB) / virtualA;
      
      return ethers.formatUnits(amountBWei, 8);
    } catch (err) {
      console.error('Error calculating correct amountB:', err);
      return '0';
    }
  };

  // Calculate expected LP tokens for adding liquidity
  const calculateExpectedLP = async (
    poolAddress: string,
    amountA: string,
    amountB: string
  ): Promise<string> => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

      const [totalSupply, reserveA, reserveB] = await Promise.all([
        poolContract.totalSupply(),
        poolContract.realReserveA(),
        poolContract.realReserveB(),
      ]);

      // Reserves and LP tokens are BOTH in 8 decimal format (not 18!)
      // Convert input amounts to 8 decimal format
      const amountAWei = ethers.parseUnits(amountA, 8);
      const amountBWei = ethers.parseUnits(amountB, 8);

      console.log('LP Calculation:', {
        amountA,
        amountB,
        amountAWei: amountAWei.toString(),
        amountBWei: amountBWei.toString(),
        totalSupply: ethers.formatUnits(totalSupply, 8),
        reserveA: ethers.formatUnits(reserveA, 8),
        reserveB: ethers.formatUnits(reserveB, 8),
      });

      if (totalSupply === 0n) {
        // First liquidity provider: LP = sqrt(amountA * amountB) - MIN_LIQUIDITY
        const lpTokens = sqrt(amountAWei * amountBWei);
        const MIN_LIQUIDITY = 1000n;
        const result = ethers.formatUnits(lpTokens - MIN_LIQUIDITY, 8);
        console.log('First LP provider, LP tokens:', result);
        return result;
      } else {
        // Subsequent providers: LP = min(amountA * totalSupply / reserveA, amountB * totalSupply / reserveB)
        // All values are in 8 decimals: (8 + 8 - 8) = 8 decimals ✓
        const lpFromA = (amountAWei * totalSupply) / reserveA;
        const lpFromB = (amountBWei * totalSupply) / reserveB;
        const lpTokens = lpFromA < lpFromB ? lpFromA : lpFromB;
        const result = ethers.formatUnits(lpTokens, 8);
        console.log('Subsequent LP provider, LP tokens:', result, {
          lpFromA: ethers.formatUnits(lpFromA, 8),
          lpFromB: ethers.formatUnits(lpFromB, 8),
        });
        return result;
      }
    } catch (err) {
      console.error('Error calculating LP tokens:', err);
      return '0';
    }
  };

  // Calculate amounts to receive when removing liquidity
  const calculateRemoveAmounts = async (
    poolAddress: string,
    lpTokenAmount: string
  ): Promise<{ amountA: string; amountB: string }> => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

      const [totalSupply, reserveA, reserveB] = await Promise.all([
        poolContract.totalSupply(),
        poolContract.realReserveA(),
        poolContract.realReserveB(),
      ]);

      // LP tokens are in 8 decimals (not 18!)
      const lpTokensWei = ethers.parseUnits(lpTokenAmount, 8);

      const amountA = (lpTokensWei * reserveA) / totalSupply;
      const amountB = (lpTokensWei * reserveB) / totalSupply;

      return {
        amountA: ethers.formatUnits(amountA, 8),
        amountB: ethers.formatUnits(amountB, 8),
      };
    } catch (err) {
      console.error('Error calculating remove amounts:', err);
      return { amountA: '0', amountB: '0' };
    }
  };

  // Add liquidity to a pool
  const addLiquidity = async (
    poolPair: string,
    amountA: string,
    amountB: string
  ): Promise<string> => {
    setIsExecuting(true);
    setError(null);
    setTxHash(null);

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      // Get pool config
      const poolConfig = (poolsConfig.pools as any)[poolPair];
      if (!poolConfig) {
        throw new Error(`Pool ${poolPair} not found`);
      }

      const poolAddress = poolConfig.poolAddress;
      const tokenAId = (poolsConfig.currencies as any)[poolConfig.tokenA].tokenId;
      const tokenBId = (poolsConfig.currencies as any)[poolConfig.tokenB].tokenId;

      // Convert amounts to wei (8 decimals for HTS tokens)
      const amountAWei = ethers.parseUnits(amountA, 8);
      const amountBWei = ethers.parseUnits(amountB, 8);

      console.log('Adding liquidity:', {
        pool: poolPair,
        amountA,
        amountB,
        poolAddress,
        tokenAId,
        tokenBId,
      });

      // Check CURRENT virtual reserves (contract checks against these, not future ones!)
      const checkPoolABI = [
        'function virtualReserveA() view returns (uint256)',
        'function virtualReserveB() view returns (uint256)',
        'function oraclePrice() view returns (uint256)',
      ];
      const checkContract = new ethers.Contract(poolAddress, checkPoolABI, provider);
      
      const [virtualA, virtualB, oraclePrice] = await Promise.all([
        checkContract.virtualReserveA(),
        checkContract.virtualReserveB(),
        checkContract.oraclePrice(),
      ]);

      // Calculate ratios with CURRENT virtual reserves (what contract actually checks!)
      const ratioA = (amountAWei * 1000000000000000000n) / virtualA;
      const ratioB = (amountBWei * 1000000000000000000n) / virtualB;
      const deviation = ratioA > ratioB 
        ? ((ratioA - ratioB) * 100n) / ratioB
        : ((ratioB - ratioA) * 100n) / ratioA;

      // Calculate what the correct amountB should be based on current virtual reserves
      const correctAmountBWei = (amountAWei * virtualB) / virtualA;
      const correctAmountB = ethers.formatUnits(correctAmountBWei, 8);

      console.log('📊 Ratio Check (Current Virtual Reserves):', {
        virtualReserveA: ethers.formatUnits(virtualA, 8),
        virtualReserveB: ethers.formatUnits(virtualB, 8),
        oraclePrice: ethers.formatUnits(oraclePrice, 18),
        yourAmountA: amountA,
        yourAmountB: amountB,
        correctAmountB: correctAmountB,
        ratioA: ratioA.toString(),
        ratioB: ratioB.toString(),
        ratioAFormatted: ethers.formatUnits(ratioA, 18),
        ratioBFormatted: ethers.formatUnits(ratioB, 18),
        deviation: deviation.toString() + '%',
        willPass: deviation < 2n ? '✅ YES' : '❌ NO - Will revert!',
      });

      if (deviation >= 2n) {
        throw new Error(
          `Ratio deviation is ${deviation}% (max 2%). ` +
          `Try using amountB = ${correctAmountB} instead of ${amountB}`
        );
      }

      // Step 1: Transfer tokenA to pool
      const tokenAAddress = hederaIdToEvmAddress(tokenAId);
      const tokenAContract = new ethers.Contract(tokenAAddress, TOKEN_ABI, signer);

      console.log('Transferring tokenA to pool...');
      const transferATx = await tokenAContract.transfer(poolAddress, amountAWei, {
        gasLimit: 300000,
      });
      await transferATx.wait();
      console.log('✅ TokenA transferred');

      // Step 2: Transfer tokenB to pool
      const tokenBAddress = hederaIdToEvmAddress(tokenBId);
      const tokenBContract = new ethers.Contract(tokenBAddress, TOKEN_ABI, signer);

      console.log('Transferring tokenB to pool...');
      const transferBTx = await tokenBContract.transfer(poolAddress, amountBWei, {
        gasLimit: 300000,
      });
      await transferBTx.wait();
      console.log('✅ TokenB transferred');

      // Step 3: Call addLiquidity
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, signer);

      console.log('Adding liquidity to pool...');
      const addLiqTx = await poolContract.addLiquidity(amountAWei, amountBWei, {
        gasLimit: 800000,
      });
      const receipt = await addLiqTx.wait();
      console.log('✅ Liquidity added!');

      const hash = receipt.hash;
      setTxHash(hash);
      return hash;
    } catch (err: any) {
      console.error('Add liquidity error:', err);
      const errorMsg = err.message || 'Failed to add liquidity';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  // Remove liquidity from a pool
  const removeLiquidity = async (
    poolPair: string,
    lpTokenAmount: string
  ): Promise<string> => {
    setIsExecuting(true);
    setError(null);
    setTxHash(null);

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      // Get pool config
      const poolConfig = (poolsConfig.pools as any)[poolPair];
      if (!poolConfig) {
        throw new Error(`Pool ${poolPair} not found`);
      }

      const poolAddress = poolConfig.poolAddress;

      // Convert LP tokens to wei (8 decimals, not 18!)
      const lpTokensWei = ethers.parseUnits(lpTokenAmount, 8);

      console.log('Removing liquidity:', {
        pool: poolPair,
        lpTokenAmount,
        poolAddress,
      });

      // Call removeLiquidity
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, signer);

      console.log('Removing liquidity from pool...');
      const removeLiqTx = await poolContract.removeLiquidity(lpTokensWei, {
        gasLimit: 800000,
      });
      const receipt = await removeLiqTx.wait();
      console.log('✅ Liquidity removed!');

      const hash = receipt.hash;
      setTxHash(hash);
      return hash;
    } catch (err: any) {
      console.error('Remove liquidity error:', err);
      const errorMsg = err.message || 'Failed to remove liquidity';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  const reset = () => {
    setError(null);
    setTxHash(null);
  };

  return {
    isExecuting,
    error,
    txHash,
    addLiquidity,
    removeLiquidity,
    calculateExpectedLP,
    calculateRemoveAmounts,
    calculateCorrectAmountB,
    reset,
  };
}

// Helper function for square root (for LP token calculation)
function sqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error('Square root of negative numbers is not supported');
  }

  if (value < 2n) {
    return value;
  }

  function newtonIteration(n: bigint, x0: bigint): bigint {
    const x1 = (n / x0 + x0) >> 1n;
    if (x0 === x1 || x0 === x1 - 1n) {
      return x0;
    }
    return newtonIteration(n, x1);
  }

  return newtonIteration(value, 1n);
}
