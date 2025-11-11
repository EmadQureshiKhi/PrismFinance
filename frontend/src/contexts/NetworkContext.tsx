import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Network = 'mainnet' | 'testnet';

interface NetworkContextType {
  network: Network;
  setNetwork: (network: Network) => void;
  toggleNetwork: () => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider = ({ children }: { children: ReactNode }) => {
  const [network, setNetworkState] = useState<Network>(() => {
    // Load from localStorage or default to mainnet
    const saved = localStorage.getItem('hedera_network');
    return (saved === 'testnet' ? 'testnet' : 'mainnet') as Network;
  });

  const setNetwork = (newNetwork: Network) => {
    setNetworkState(newNetwork);
    localStorage.setItem('hedera_network', newNetwork);
    
    // Don't clear cache - each network has its own cache
    console.log(`🔄 Switched to ${newNetwork}`);
  };

  const toggleNetwork = () => {
    setNetwork(network === 'mainnet' ? 'testnet' : 'mainnet');
  };

  return (
    <NetworkContext.Provider value={{ network, setNetwork, toggleNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
};
