import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { MetaMaskService } from '@/services/wallet/MetaMaskService';
import { HashConnectService } from '@/services/wallet/HashConnectService';
import { HederaTokenService } from '@/services/wallet/HederaTokenService';
import { WalletConnection, WalletInfo } from '@/services/wallet/types';
import { db } from '@/services/database';

interface WalletContextType {
  connection: WalletConnection | null;
  isConnecting: boolean;
  error: string | null;
  installedWallets: WalletInfo[];
  connect: (walletId: 'metamask' | 'hashpack') => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installedWallets, setInstalledWallets] = useState<WalletInfo[]>([]);
  const [, setTokenService] = useState<HederaTokenService | null>(null);

  // Initialize services safely in browser only
  const metamaskService = useMemo(() => new MetaMaskService(), []);
  const hashpackService = useMemo(() => {
    if (typeof window !== 'undefined') {
      return new HashConnectService();
    }
    return null;
  }, []);

  // Detect installed wallets on mount
  useEffect(() => {
    const detectWallets = () => {
      const detected: WalletInfo[] = [];

      if (metamaskService.isInstalled()) {
        detected.push({
          id: 'metamask',
          name: 'MetaMask',
          icon: '/assets/MetaMask/MetaMask-icon-fox.svg',
          isInstalled: true,
          isRecommended: true,
        });
      }

      // HashPack is always shown as it can be installed
      if (hashpackService && hashpackService.isInstalled()) {
        detected.push({
          id: 'hashpack',
          name: 'HashPack',
          icon: '/assets/MetaMask/hashpack logo.svg',
          isInstalled: true,
        });
      }

      setInstalledWallets(detected);
    };

    // Detect immediately
    detectWallets();

    // Re-detect after a short delay (in case extensions load slowly)
    const timer = setTimeout(detectWallets, 1000);

    return () => clearTimeout(timer);
  }, [metamaskService, hashpackService]);

  const connect = async (walletId: 'metamask' | 'hashpack') => {
    setIsConnecting(true);
    setError(null);

    try {
      const service = walletId === 'metamask' ? metamaskService : hashpackService;

      if (!service) {
        throw new Error('HashPack is not available in this environment.');
      }
      const walletConnection = await service.connect();

      // For HashPack, expose both HashConnect and the service globally
      if (walletId === 'hashpack' && hashpackService) {
        if (typeof window !== 'undefined') {
          (window as any).hashConnectService = hashpackService;

          // Ensure pairing data is available in the global instance
          const pairingData = hashpackService.getPairingData();
          if (!pairingData) {
            const saved = localStorage.getItem('hashconnect_pairing');
            if (saved) {
              try {
                (hashpackService as any).pairingData = JSON.parse(saved);
                console.log('🔁 Restored pairing data into global HashConnectService');
              } catch (err) {
                console.warn('⚠️ Failed to restore pairing data to global service', err);
              }
            }
          }
        }
        console.log('✅ HashConnect ready for swap execution');
      }

      // Initialize token service for the network
      const hederaTokenService = new HederaTokenService(walletConnection.network);
      setTokenService(hederaTokenService);

      // Fetch tokens for the account
      const tokens = await hederaTokenService.fetchAccountTokens(walletConnection.account.accountId);
      walletConnection.account.tokens = tokens;

      // Fetch token prices
      const symbols = tokens.map(t => t.symbol);
      const prices = await hederaTokenService.fetchTokenPrices(symbols);

      // Update token prices
      tokens.forEach(token => {
        if (prices[token.symbol]) {
          token.price = prices[token.symbol];
        }
      });

      setConnection(walletConnection);

      // Store in localStorage for persistence
      localStorage.setItem('prism_wallet', walletId);
      localStorage.setItem('prism_account', walletConnection.account.accountId);

      // Create user in database if first time connecting
      try {
        const evmAddress = walletConnection.account.evmAddress ||
          (walletId === 'metamask' && typeof window !== 'undefined' && window.ethereum
            ? await window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => accounts[0])
            : undefined);

        await db.ensureUser(walletConnection.account.accountId, evmAddress);
        console.log('✅ User registered in database');
      } catch (dbError) {
        console.error('⚠️ Failed to register user in database:', dbError);
        // Don't throw - wallet connection should still work
      }

      console.log('Wallet connected:', walletConnection);
      console.log('Tokens loaded:', tokens);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!connection) return;

    try {
      const service =
        connection.wallet.id === 'metamask' ? metamaskService : hashpackService;

      if (!service) {
        throw new Error('Wallet service not available');
      }

      await service.disconnect();
      setConnection(null);

      // Clear localStorage
      localStorage.removeItem('prism_wallet');
      localStorage.removeItem('prism_account');

      console.log('Wallet disconnected');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to disconnect wallet';
      setError(errorMessage);
      console.error('Wallet disconnect error:', err);
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Auto-reconnect on page load
  useEffect(() => {
    const savedWallet = localStorage.getItem('prism_wallet') as
      | 'metamask'
      | 'hashpack'
      | null;

    if (savedWallet && !connection && !isConnecting) {
      console.log('🔄 Auto-reconnecting to:', savedWallet);
      // Attempt to reconnect silently
      connect(savedWallet).catch((err) => {
        console.log('❌ Auto-reconnect failed:', err);
        // Clear saved wallet if auto-reconnect fails
        localStorage.removeItem('prism_wallet');
        localStorage.removeItem('prism_account');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return (
    <WalletContext.Provider
      value={{
        connection,
        isConnecting,
        error,
        installedWallets,
        connect,
        disconnect,
        clearError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};
