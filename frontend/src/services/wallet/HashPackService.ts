import { HashConnect, HashConnectTypes, MessageTypes } from 'hashconnect';
import { IWalletService, WalletConnection } from './types';
import hashpackLogo from '@/assets/MetaMask/hashpack logo.svg';

export class HashPackService implements IWalletService {
  private hashconnect: HashConnect;
  private appMetadata: HashConnectTypes.AppMetadata = {
    name: 'Prism Finance',
    description: 'Multi-Currency Stablecoin Platform on Hedera',
    icon: window.location.origin + '/logo.png',
    url: window.location.origin,
  };
  private topic: string = '';
  private pairingString: string = '';

  constructor() {
    this.hashconnect = new HashConnect();
  }

  isInstalled(): boolean {
    // HashPack is available if the extension injects the hashconnect object
    // or if it's installed (we'll detect during connection)
    return true; // Always show HashPack as it can be installed
  }

  async connect(): Promise<WalletConnection> {
    try {
      // Initialize HashConnect
      const initData = await this.hashconnect.init(this.appMetadata, 'testnet', false);

      this.topic = initData.topic;
      this.pairingString = initData.pairingString;

      // Connect and wait for pairing
      return new Promise((resolve, reject) => {
        // Set up pairing event listener
        this.hashconnect.pairingEvent.once(
          (pairingData: MessageTypes.ApprovePairing) => {
            if (!pairingData.accountIds || pairingData.accountIds.length === 0) {
              reject(new Error('No accounts found'));
              return;
            }

            const accountId = pairingData.accountIds[0];

            this.getBalance(accountId)
              .then((balance) => {
                resolve({
                  wallet: {
                    id: 'hashpack',
                    name: 'HashPack',
                    icon: hashpackLogo,
                    isInstalled: true,
                  },
                  account: {
                    accountId,
                    balance,
                  },
                  network: 'testnet',
                });
              })
              .catch((error) => {
                reject(error);
              });
          }
        );

        // Trigger the pairing
        this.hashconnect.connectToLocalWallet(this.pairingString);

        // Timeout after 60 seconds
        setTimeout(() => {
          reject(new Error('Connection timeout. Please make sure HashPack is installed.'));
        }, 60000);
      });
    } catch (error: any) {
      console.error('HashPack connection error:', error);
      throw new Error(error.message || 'Failed to connect to HashPack');
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.hashconnect.disconnect(this.topic);
    } catch (error) {
      console.error('HashPack disconnect error:', error);
    }
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
      // Convert tinybars to HBAR
      const hbarBalance = (data.balance.balance / 100000000).toFixed(2);
      return hbarBalance;
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0.00';
    }
  }

  async switchNetwork(network: 'testnet' | 'mainnet'): Promise<void> {
    // HashPack handles network switching through the extension
    throw new Error('Network switching must be done through HashPack extension settings');
  }
}
