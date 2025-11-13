import { useState } from 'react';
import { SwapQuote } from '@/services/dex/types';
import { SaucerSwapDex } from '@/services/dex/dexes/SaucerSwapDex';
import { ethers } from 'ethers';

interface SwapExecutionState {
  isExecuting: boolean;
  error: string | null;
  txHash: string | null;
  receipt: any | null;
}

export const useSwapExecution = () => {
  const [state, setState] = useState<SwapExecutionState>({
    isExecuting: false,
    error: null,
    txHash: null,
    receipt: null,
  });

  const executeSwap = async (
    quote: SwapQuote,
    slippageTolerance: number = 0.5
  ) => {
    setState({
      isExecuting: true,
      error: null,
      txHash: null,
      receipt: null,
    });

    try {
      // Get signer from wallet
      let signer: any;
      let walletType: 'hashpack' | 'metamask' | null = null;

      console.log('🔍 Checking for wallet providers...');
      console.log('   window.ethereum:', !!window.ethereum);
      if (window.ethereum) {
        console.log('   window.ethereum.isHashPack:', (window.ethereum as any)?.isHashPack);
        console.log('   window.ethereum.isMetaMask:', (window.ethereum as any)?.isMetaMask);
      }

      // Check for MetaMask first (prioritize if connected)
      const hashconnect =
        (window as any).hashConnectService?.hashconnect ||
        (window as any).hashconnect;
      const isHashPackConnected = hashconnect && hashconnect.connectedAccountIds?.length > 0;
      const isMetaMaskAvailable = window.ethereum && (window.ethereum as any).isMetaMask;

      console.log('🔍 Checking for wallet providers...');
      console.log('   HashConnect:', isHashPackConnected);
      console.log('   MetaMask:', isMetaMaskAvailable);

      try {
        // Prioritize MetaMask if available and connected
        if (isMetaMaskAvailable) {
          walletType = 'metamask';
          console.log('🦊 Using MetaMask for swap execution');

          const provider = new ethers.BrowserProvider(window.ethereum);
          
          // Check if already connected
          const accounts = await provider.send('eth_accounts', []);
          
          if (!accounts || accounts.length === 0) {
            // Request connection if not connected
            const requestedAccounts = await provider.send('eth_requestAccounts', []);
            if (!requestedAccounts || requestedAccounts.length === 0) {
              throw new Error('No MetaMask accounts available');
            }
          }

          signer = await provider.getSigner();
          const signerAddress = await signer.getAddress();
          console.log('✅ MetaMask signer ready:', signerAddress);

        } else if (isHashPackConnected) {
          // Fallback to HashPack if MetaMask not available
          walletType = 'hashpack';
          console.log('🔐 Using HashPack with HashConnect provider');

          const accountId = hashconnect.connectedAccountIds[0];
          console.log(`   Connected account: ${accountId.toString()}`);

          // 🩹 Restore topic if missing
          if (!hashconnect.hcData?.topic) {
            const saved = localStorage.getItem('hashconnect_pairing');
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                if (parsed.topic) {
                  hashconnect.hcData = { topic: parsed.topic };
                  console.log('🔁 Restored hcData.topic from saved pairing:', parsed.topic);
                }
              } catch (err) {
                console.warn('⚠️ Failed to restore hcData.topic from saved pairing', err);
              }
            }
          }

          // ✅ Fallback: try to read from pairingData if still missing
          if (!hashconnect.hcData?.topic && hashconnect.pairingData?.topic) {
            hashconnect.hcData = { topic: hashconnect.pairingData.topic };
            console.log('🔁 Recovered hcData.topic from in-memory pairingData:', hashconnect.hcData.topic);
          }

          console.log('🧩 Final HashConnect topic:', hashconnect.hcData?.topic);

          // Verify we have the topic
          if (!hashconnect.hcData?.topic) {
            throw new Error('Missing HashConnect topic. Please reconnect HashPack.');
          }

          const hashConnectProvider = hashconnect.getProvider(
            'testnet',
            hashconnect.hcData.topic,
            accountId.toString()
          );

          // Wrap in ethers provider to get a proper signer
          const provider = new ethers.BrowserProvider(hashConnectProvider);
          signer = await provider.getSigner();

          console.log('✅ HashPack ethers signer ready:', await signer.getAddress());

        } else {
          throw new Error('No wallet connected. Please connect MetaMask or HashPack.');
        }

      } catch (providerError: any) {
        console.error('❌ Provider error:', providerError);

        if (providerError.code === 4001) {
          throw new Error('Connection rejected. Please approve in your wallet.');
        } else if (providerError.message?.includes('User rejected')) {
          throw new Error('Connection rejected by user. Please try again.');
        } else {
          throw new Error(`Failed to connect wallet: ${providerError.message}`);
        }
      }

      if (!signer) {
        throw new Error('Failed to initialize wallet signer.');
      }

      console.log(`✅ Wallet ready for swap: ${walletType?.toUpperCase()}`);

      // Get fresh quote right before execution to avoid stale prices
      console.log('🔄 Fetching fresh quote before execution...');
      const dex = new SaucerSwapDex();
      const freshQuotes = await dex.getAllQuotes(
        quote.inputToken.tokenId,
        quote.outputToken.tokenId,
        quote.inputAmount
      );

      if (freshQuotes.length === 0) {
        throw new Error('No routes available for this swap');
      }

      // Use the best fresh quote (getAllQuotes returns SwapQuote[] directly)
      const freshQuote = freshQuotes[0];
      console.log(`✅ Fresh quote: ${freshQuote.outputAmount} ${freshQuote.outputToken.symbol}`);
      console.log(`   Original quote: ${quote.outputAmount} ${quote.outputToken.symbol}`);

      // Use very high slippage for testnet (20%) due to low liquidity
      const executionSlippage = Math.max(slippageTolerance, 20.0);
      console.log(`   Using ${executionSlippage}% slippage for execution (testnet)`);

      // Approve token spending first (if not HBAR)
      if (freshQuote.inputToken.tokenId !== 'HBAR') {
        console.log('📝 Approving token spending...');
        try {
          await approveToken(
            freshQuote.inputToken.tokenId,
            freshQuote.inputAmount,
            freshQuote.inputToken.decimals,
            signer
          );
        } catch (approvalError: any) {
          console.error('❌ Token approval failed:', approvalError);
          throw new Error(`Token approval failed: ${approvalError.message}`);
        }
      } else {
        console.log('💎 HBAR swap - no approval needed');
      }

      // Execute swap with fresh quote
      const receipt = await dex.executeSwap(freshQuote, executionSlippage, signer);

      setState({
        isExecuting: false,
        error: null,
        txHash: receipt.hash,
        receipt: receipt,
      });

      return receipt;
    } catch (error: any) {
      console.error('Swap execution error:', error);
      setState({
        isExecuting: false,
        error: error.message || 'Swap failed',
        txHash: null,
        receipt: null,
      });
      throw error;
    }
  };

  const reset = () => {
    setState({
      isExecuting: false,
      error: null,
      txHash: null,
      receipt: null,
    });
  };

  return {
    ...state,
    executeSwap,
    reset,
  };
};

/**
 * Approve token spending for router
 */
async function approveToken(
  tokenId: string,
  amount: string,
  decimals: number,
  signer: any
): Promise<void> {
  const tokenAddress = '0x' + toEvmAddress(tokenId);
  const routerAddress = '0x' + toEvmAddress('0.0.19264'); // V1 Router

  const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString();

  const abi = [
    'function approve(address spender, uint256 amount) external returns (bool)'
  ];

  const tokenContract = new ethers.Contract(tokenAddress, abi, signer);

  console.log(`   Approving ${amount} tokens for router...`);
  const tx = await tokenContract.approve(routerAddress, amountInSmallestUnit);
  await tx.wait();
  console.log('   ✅ Token approved');
}

function toEvmAddress(tokenId: string): string {
  const parts = tokenId.split('.');
  const num = parseInt(parts[parts.length - 1]);
  return num.toString(16).padStart(40, '0');
}
