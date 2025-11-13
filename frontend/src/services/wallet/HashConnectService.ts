/**
 * HashConnect Service (v3)
 * Connection: HashConnect for wallet pairing
 * Swaps: Hedera JSON-RPC Relay for EVM operations
 */

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

export class HashConnectService implements IWalletService {
    private hashconnect: HashConnect | null = null;
    private initPromise: Promise<void> | null = null;
    private isConnecting: boolean = false;
    private pairingEventListener: any = null;
    private pairingData: any = null;

    isInstalled(): boolean {
        return typeof window !== 'undefined';
    }

    getHashConnect(): HashConnect | null {
        return this.hashconnect;
    }

    getPairingData(): any {
        return this.pairingData;
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.hashconnect) {
            console.log('🔧 Creating HashConnect instance...');
            this.hashconnect = new HashConnect(
                LedgerId.fromString(env),
                'bfa190dbe93fcf30377b932b31129d05',
                appMetadata,
                true
            );

            console.log('⏳ Initializing HashConnect...');
            this.initPromise = this.hashconnect.init();

            // Expose globally for swap execution
            if (typeof window !== 'undefined') {
                (window as any).hashconnect = this.hashconnect;
            }
        }

        if (this.initPromise) {
            await this.initPromise;
            console.log('✅ HashConnect initialized');
        }
    }

    async connect(): Promise<WalletConnection> {
        if (this.isConnecting) {
            throw new Error('Connection already in progress');
        }

        this.isConnecting = true;

        try {
            await this.ensureInitialized();

            // Check if already connected
            const existingAccountIds = this.hashconnect!.connectedAccountIds;
            if (existingAccountIds && existingAccountIds.length > 0) {
                console.log('🔄 Already connected, using existing session');

                // Restore pairing data from localStorage
                const saved = localStorage.getItem('hashconnect_pairing');
                if (saved && !this.pairingData) {
                    try {
                        this.pairingData = JSON.parse(saved);
                        console.log('🔁 Restored pairing data from storage');
                    } catch (err) {
                        console.warn('⚠️ Failed to parse stored pairing data', err);
                    }
                }

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

            // Wait for pairing event
            return new Promise((resolve, reject) => {
                console.log('👂 Setting up pairing event listener...');

                // Clean up any existing listener
                if (this.pairingEventListener) {
                    this.hashconnect!.pairingEvent.off(this.pairingEventListener);
                }

                // Create new listener
                this.pairingEventListener = (pairingData: any) => {
                    console.log('✅ Pairing successful:', pairingData);

                    // Store pairing data for provider creation
                    this.pairingData = pairingData;

                    // Persist to localStorage for reconnection
                    localStorage.setItem('hashconnect_pairing', JSON.stringify(pairingData));

                    const accountIds = this.hashconnect!.connectedAccountIds;
                    console.log('📋 Connected account IDs:', accountIds);

                    if (accountIds && accountIds.length > 0) {
                        const accountId = accountIds[0].toString();
                        console.log('🔑 Using account:', accountId);

                        this.getBalance(accountId)
                            .then((balance) => {
                                console.log('💰 Balance fetched:', balance);
                                this.isConnecting = false;

                                // Clean up listener
                                if (this.pairingEventListener) {
                                    this.hashconnect!.pairingEvent.off(this.pairingEventListener);
                                    this.pairingEventListener = null;
                                }

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

                                if (this.pairingEventListener) {
                                    this.hashconnect!.pairingEvent.off(this.pairingEventListener);
                                    this.pairingEventListener = null;
                                }

                                reject(err);
                            });
                    } else {
                        console.error('❌ No accounts found in pairing data');
                        this.isConnecting = false;

                        if (this.pairingEventListener) {
                            this.hashconnect!.pairingEvent.off(this.pairingEventListener);
                            this.pairingEventListener = null;
                        }

                        reject(new Error('No accounts found'));
                    }
                };

                // Attach listener
                this.hashconnect!.pairingEvent.on(this.pairingEventListener);

                // Open pairing modal AFTER listener is set up
                this.hashconnect!.openPairingModal();
                console.log('📱 Pairing modal opened');

                // Timeout after 60 seconds
                setTimeout(() => {
                    if (this.isConnecting) {
                        console.error('⏱️ Connection timeout');
                        this.isConnecting = false;

                        if (this.pairingEventListener) {
                            this.hashconnect!.pairingEvent.off(this.pairingEventListener);
                            this.pairingEventListener = null;
                        }

                        reject(new Error('Connection timeout: Please try again'));
                    }
                }, 60000);
            });
        } catch (error: any) {
            console.error('❌ HashPack connection error:', error);
            this.isConnecting = false;

            if (this.pairingEventListener) {
                this.hashconnect!.pairingEvent.off(this.pairingEventListener);
                this.pairingEventListener = null;
            }

            throw new Error(error.message || 'Failed to connect to HashPack');
        }
    }

    async disconnect(): Promise<void> {
        if (this.hashconnect) {
            try {
                if (this.pairingEventListener) {
                    this.hashconnect.pairingEvent.off(this.pairingEventListener);
                    this.pairingEventListener = null;
                }

                this.hashconnect.disconnect();
                this.hashconnect = null;
                this.initPromise = null;
                this.pairingData = null;

                // Clear stored pairing data
                localStorage.removeItem('hashconnect_pairing');

                if (typeof window !== 'undefined') {
                    delete (window as any).hashconnect;
                }
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
