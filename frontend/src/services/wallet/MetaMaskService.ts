import { IWalletService, WalletConnection } from './types';
import metamaskLogo from '@/assets/MetaMask/MetaMask-icon-fox.svg';

export class MetaMaskService implements IWalletService {
  private readonly HEDERA_TESTNET_CHAIN_ID = '0x128'; // 296 in hex
  private readonly HEDERA_MAINNET_CHAIN_ID = '0x127'; // 295 in hex

  isInstalled(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.ethereum !== 'undefined' &&
      window.ethereum.isMetaMask === true
    );
  }

  async connect(): Promise<WalletConnection> {
    if (!this.isInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask extension.');
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Switch to Hedera testnet
      await this.switchNetwork('testnet');

      const evmAddress = accounts[0];

      // Convert EVM address to Hedera account ID
      const accountId = await this.evmToHederaAccountId(evmAddress);

      const balance = await this.getBalance(accountId);

      return {
        wallet: {
          id: 'metamask',
          name: 'MetaMask',
          icon: metamaskLogo,
          isInstalled: true,
          isRecommended: true,
        },
        account: {
          accountId,
          evmAddress,
          balance,
        },
        network: 'testnet',
      };
    } catch (error: any) {
      console.error('MetaMask connection error:', error);
      if (error.code === 4001) {
        throw new Error('Connection rejected by user');
      }
      throw new Error(error.message || 'Failed to connect to MetaMask');
    }
  }

  async switchNetwork(network: 'testnet' | 'mainnet'): Promise<void> {
    const chainId =
      network === 'testnet'
        ? this.HEDERA_TESTNET_CHAIN_ID
        : this.HEDERA_MAINNET_CHAIN_ID;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
    } catch (switchError: any) {
      // Chain not added, add it
      if (switchError.code === 4902) {
        await this.addHederaNetwork(network);
      } else {
        throw switchError;
      }
    }
  }

  private async addHederaNetwork(network: 'testnet' | 'mainnet'): Promise<void> {
    const networkConfig =
      network === 'testnet'
        ? {
            chainId: this.HEDERA_TESTNET_CHAIN_ID,
            chainName: 'Hedera Testnet',
            rpcUrls: ['https://testnet.hashio.io/api'],
            nativeCurrency: {
              name: 'HBAR',
              symbol: 'HBAR',
              decimals: 18,
            },
            blockExplorerUrls: ['https://hashscan.io/testnet'],
          }
        : {
            chainId: this.HEDERA_MAINNET_CHAIN_ID,
            chainName: 'Hedera Mainnet',
            rpcUrls: ['https://mainnet.hashio.io/api'],
            nativeCurrency: {
              name: 'HBAR',
              symbol: 'HBAR',
              decimals: 18,
            },
            blockExplorerUrls: ['https://hashscan.io/mainnet'],
          };

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [networkConfig],
    });
  }

  async getBalance(accountId: string): Promise<string> {
    try {
      const response = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }

      const data = await response.json();
      // Convert tinybars to HBAR (1 HBAR = 100,000,000 tinybars)
      const hbarBalance = (data.balance.balance / 100000000).toFixed(2);
      return hbarBalance;
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0.00';
    }
  }

  async disconnect(): Promise<void> {
    // MetaMask doesn't have a disconnect method
    // State is managed in the context
  }

  private async evmToHederaAccountId(evmAddress: string): Promise<string> {
    try {
      // Query Hedera Mirror Node to get account ID from EVM address
      const response = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${evmAddress}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch account info');
      }

      const data = await response.json();
      return data.account;
    } catch (error) {
      console.error('Error converting EVM address to Hedera account ID:', error);
      // Fallback: return a placeholder
      return '0.0.0';
    }
  }
}
