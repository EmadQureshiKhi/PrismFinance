import { HashConnect } from 'hashconnect';
import { LedgerId } from '@hashgraph/sdk';
import { IWalletService, WalletConnection } from './types';
import hashpackLogo from '@/assets/MetaMask/hashpack logo.svg';

const env = 'testnet';
const appMetadata = {
  name: 'Prism Finance',
  description: 'Multi-Currency Stablecoin Platform on Hedera',
  icons: [
    typeof window !== 'undefined'
      ? `${window.location.origin}/logo.png`
      : 'https://prismfinance.io/logo.png',
  ],
  url: typeof window !== 'undefined' ? window.location.origin : 'https://prismfinance.io',
};

export class HashPackService implements IWalletService {
  private hashconnect: HashConnect | null = null;
  private initPromise: Promise<void> | null = null;
  private isConnecting: boolean = false;

  isInstalled(): boolean {
    return typeof window !== 'undefined';
  }

  async connect(): Promise<WalletConnection> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      throw new Error('Connection already in progress');
    }

    this.isConnecting = true;

    try {
      // Initialize HashConnect if not already done
      if (!this.hashconnect) {
        console.log('🔧 Creating HashConnect instance...');
        this.hashconnect = new HashConnect(
          LedgerId.fromString(env),
          'bfa190dbe93fcf30377b932b31129d05', // HashConnect project ID
          appMetadata,
          true // debug mode
        );
        console.log('⏳ Initializing HashConnect...');
        this.initPromise = this.hashconnect.init();
      }

      // Wait for initialization
      console.log('⏳ Waiting for initialization to complete...');
      await this.initPromise;
      console.log('✅ HashConnect initialized successfully');

      // Check if already connected (from previous session)
      const existingAccountIds = this.hashconnect.connectedAccountIds;
      if (existingAccountIds && existingAccountIds.length > 0) {
        console.log('🔄 Already connected, using existing session');
        const accountId = existingAccountIds[0].toString();
        const balance = await this.getBalance(accountId);

        this.isConnecting = false;
        return {
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
        };
      }

      console.log('🔗 Opening HashPack pairing modal...');

      // Open pairing modal
      this.hashconnect.openPairingModal();
      console.log('📱 Pairing modal opened');

      // Wait for pairing event
      return new Promise((resolve, reject) => {
        console.log('👂 Listening for pairing event...');

        this.hashconnect!.pairingEvent.once((pairingData: any) => {
          console.log('✅ Pairing successful:', pairingData);

          const accountIds = this.hashconnect!.connectedAccountIds;
          console.log('📋 Connected account IDs:', accountIds);

          if (accountIds && accountIds.length > 0) {
            const accountId = accountIds[0].toString();
            console.log('🔑 Using account:', accountId);

            this.getBalance(accountId)
              .then((balance) => {
                console.log('💰 Balance fetched:', balance);
                this.isConnecting = false;
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
              .catch((err) => {
                console.error('❌ Balance fetch error:', err);
                this.isConnecting = false;
                reject(err);
              });
          } else {
            console.error('❌ No accounts found in pairing data');
            this.isConnecting = false;
            reject(new Error('No accounts found'));
          }
        });

        // Timeout after 60 seconds
        setTimeout(() => {
          console.error('⏱️ Connection timeout');
          this.isConnecting = false;
          reject(new Error('Connection timeout: Make sure HashPack is installed'));
        }, 60000);
      });
    } catch (error: any) {
      console.error('❌ HashPack connection error:', error);
      this.isConnecting = false;
      throw new Error(error.message || 'Failed to connect to HashPack');
    }
  }

  async disconnect(): Promise<void> {
    if (this.hashconnect) {
      try {
        this.hashconnect.disconnect();
        this.hashconnect = null;
        this.initPromise = null;
      } catch (error) {
        console.error('HashPack disconnect error:', error);
      }
    }
  }

  async getBalance(accountId: string): Promise<string> {
    try {
      const response = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`
      );

      if (!response.ok) throw new Error('Failed to fetch balance');
      const data = await response.json();
      return (data.balance.balance / 1e8).toFixed(2);
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0.00';
    }
  }

  async switchNetwork(): Promise<void> {
    throw new Error('Network switching must be done through HashPack extension');
  }
}
