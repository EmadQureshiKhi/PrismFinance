export interface WalletInfo {
  id: 'metamask' | 'hashpack';
  name: string;
  icon: string;
  isInstalled: boolean;
  isRecommended?: boolean;
}

export interface Token {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  logo: string;
  price?: number;
  tokenId?: string;
}

export interface WalletAccount {
  accountId: string;
  evmAddress?: string;
  balance: string;
  tokens?: Token[];
}

export interface WalletConnection {
  wallet: WalletInfo;
  account: WalletAccount;
  network: 'testnet' | 'mainnet';
}

export interface IWalletService {
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  getBalance(accountId: string): Promise<string>;
  isInstalled(): boolean;
  switchNetwork(network: 'testnet' | 'mainnet'): Promise<void>;
}

// Extend Window interface for wallet detection
declare global {
  interface Window {
    ethereum?: any;
    hashconnect?: any;
  }
}
