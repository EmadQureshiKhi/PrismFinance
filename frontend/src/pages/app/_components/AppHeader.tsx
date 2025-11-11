import { css } from "@emotion/react";
import { Gear, MagnifyingGlass } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import WalletSidebar from "./WalletSidebar";
import AccountSidebar from "./AccountSidebar";
import { useWallet } from "@/contexts/WalletContext";

interface TokenPrice {
  price: number;
  change24h: number;
}

type NavItem = {
  id: string;
  label: string;
};

const navItems: NavItem[] = [
  { id: "swap", label: "Swap" },
  { id: "vault", label: "Vault" },
  { id: "assets", label: "Assets" },
  { id: "liquidity", label: "Liquidity" },
  { id: "governance", label: "Governance" },
];

interface AppHeaderProps {
  onPageChange: (page: string) => void;
}

const AppHeader = ({ onPageChange }: AppHeaderProps) => {
  // Sync with persisted page
  const [activeItem, setActiveItem] = useState(() => {
    return localStorage.getItem("prism_active_page") || "swap";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isWalletSidebarOpen, setIsWalletSidebarOpen] = useState(false);
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState(false);
  const { connection } = useWallet();
  const [hbarPrice, setHbarPrice] = useState<TokenPrice>({ price: 0, change24h: 0 });
  const [packPrice, setPackPrice] = useState<TokenPrice>({ price: 0, change24h: 0 });
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  
  const handleNavClick = (itemId: string) => {
    setActiveItem(itemId);
    onPageChange(itemId);
  };

  // Fetch real-time prices from CoinGecko
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setIsLoadingPrices(true);
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph,hashpack&vs_currencies=usd&include_24hr_change=true'
        );
        const data = await response.json();

        if (data['hedera-hashgraph']) {
          setHbarPrice({
            price: data['hedera-hashgraph'].usd || 0,
            change24h: data['hedera-hashgraph'].usd_24h_change || 0,
          });
        }

        if (data['hashpack']) {
          setPackPrice({
            price: data['hashpack'].usd || 0,
            change24h: data['hashpack'].usd_24h_change || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching watchlist prices:', error);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    // Fetch immediately
    fetchPrices();

    // Refresh every 30 seconds
    const interval = setInterval(fetchPrices, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleWalletButtonClick = () => {
    if (connection) {
      // If connected, open account sidebar
      setIsAccountSidebarOpen(true);
    } else {
      // If not connected, open wallet selection sidebar
      setIsWalletSidebarOpen(true);
    }
  };

  return (
    <>
      {/* Main Header */}
      <header
        css={css`
          background: #0c0d10;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding: 0.375rem 1.5rem;
          position: sticky;
          top: 0;
          z-index: 100;
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 2rem;
            max-width: 1600px;
            margin: 0 auto;
            width: 100%;
          `}
        >
          {/* Left: Logo + Navigation */}
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 1.5rem;
            `}
          >
            {/* Logo */}
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: #dcfd8f;
                font-size: 1.25rem;
                font-weight: 700;
              `}
            >
              <div
                css={css`
                  width: 28px;
                  height: 28px;
                  background: linear-gradient(135deg, #dcfd8f 0%, #a8d45f 100%);
                  border-radius: 6px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: 800;
                  color: #0a0e27;
                  font-size: 1rem;
                `}
              >
                P
              </div>
            </div>

            {/* Navigation */}
            <nav
              css={css`
                display: flex;
                align-items: center;
                height: 100%;
              `}
            >
              {navItems.map((item) => {
                const isActive = activeItem === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    css={css`
                      margin-top: 0.125rem;
                      display: flex;
                      height: 100%;
                      align-items: center;
                      justify-content: center;
                      font-size: 0.875rem;
                      line-height: 1.25rem;
                      font-weight: 500;
                      color: ${isActive ? "#dcfd8f" : "rgba(144, 161, 185, 1)"};
                      width: auto;
                      padding: 0.5rem 0.5rem;
                      background: transparent;
                      border: none;
                      outline: 2px solid transparent;
                      outline-offset: 2px;
                      cursor: pointer;
                      transition: color 0.15s;
                      white-space: nowrap;

                      &:hover {
                        color: #dcfd8f;
                      }
                    `}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Center: Search Bar */}
          <div
            css={css`
              position: absolute;
              left: 50%;
              transform: translateX(-50%);
              width: 100%;
              max-width: 480px;
              display: flex;
              justify-content: center;
            `}
          >
            <div
              css={css`
                width: 100%;
                position: relative;
              `}
            >
              <MagnifyingGlass
                size={14}
                css={css`
                  position: absolute;
                  left: 0.75rem;
                  top: 50%;
                  transform: translateY(-50%);
                  color: #6b6b6b;
                  pointer-events: none;
                `}
              />
              <input
                type="text"
                placeholder="Search for any Token, Wallet or Feature"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                css={css`
                  width: 100%;
                  background: transparent;
                  border: 1px solid rgba(255, 255, 255, 0.08);
                  color: rgba(144, 161, 185, 1);
                  padding: 0.4rem 0.75rem 0.4rem 2rem;
                  border-radius: 20px;
                  font-size: 0.75rem;
                  outline: none;
                  transition: all 0.15s;

                  &::placeholder {
                    color: rgba(144, 161, 185, 1);
                    font-size: 0.75rem;
                  }

                  &:focus {
                    border-color: rgba(255, 255, 255, 0.15);
                    background: rgba(255, 255, 255, 0.02);
                  }
                `}
              />
            </div>
          </div>

          {/* Right: Settings & Connect */}
          <div
            css={css`
              display: flex;
              align-items: center;
              height: 100%;
            `}
          >
            {/* Network Switcher */}
            <button
              onClick={() => {
                const current = localStorage.getItem('hedera_network') || 'mainnet';
                const newNetwork = current === 'mainnet' ? 'testnet' : 'mainnet';
                localStorage.setItem('hedera_network', newNetwork);
                // Don't clear cache - let it use network-specific cache
                window.location.reload();
              }}
              css={css`
                margin-top: 0.125rem;
                display: flex;
                height: 100%;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                line-height: 1.25rem;
                font-weight: 600;
                color: ${(localStorage.getItem('hedera_network') || 'mainnet') === 'mainnet' ? '#4ade80' : '#fbbf24'};
                padding: 0.375rem 0.75rem;
                background: ${(localStorage.getItem('hedera_network') || 'mainnet') === 'mainnet' 
                  ? 'rgba(74, 222, 128, 0.1)' 
                  : 'rgba(251, 191, 36, 0.1)'};
                border: 1px solid ${(localStorage.getItem('hedera_network') || 'mainnet') === 'mainnet' 
                  ? 'rgba(74, 222, 128, 0.3)' 
                  : 'rgba(251, 191, 36, 0.3)'};
                border-radius: 9999px;
                cursor: pointer;
                transition: all 0.15s;
                white-space: nowrap;
                gap: 0.375rem;

                &:hover {
                  background: ${(localStorage.getItem('hedera_network') || 'mainnet') === 'mainnet' 
                    ? 'rgba(74, 222, 128, 0.15)' 
                    : 'rgba(251, 191, 36, 0.15)'};
                }
              `}
            >
              <span css={css`
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: ${(localStorage.getItem('hedera_network') || 'mainnet') === 'mainnet' ? '#4ade80' : '#fbbf24'};
              `} />
              {(localStorage.getItem('hedera_network') || 'mainnet') === 'mainnet' ? 'Mainnet' : 'Testnet'}
            </button>

            <button
              css={css`
                margin-top: 0.125rem;
                display: flex;
                height: 100%;
                align-items: center;
                justify-content: center;
                font-size: 0.875rem;
                line-height: 1.25rem;
                font-weight: 500;
                color: rgba(144, 161, 185, 1);
                width: 2.75rem;
                padding: 0.5rem 0.75rem;
                background: transparent;
                border: none;
                outline: 2px solid transparent;
                outline-offset: 2px;
                cursor: pointer;
                transition: color 0.15s;

                &:hover {
                  color: #dcfd8f;
                }
              `}
            >
              <Gear size={20} weight="bold" />
            </button>

            <button
              onClick={handleWalletButtonClick}
              css={css`
                display: flex;
                height: 2rem;
                min-width: 2rem;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 600;
                color: #dcfd8f;
                width: auto;
                padding: 0 0.75rem;
                background: rgba(220, 253, 143, 0.1);
                border: 1px solid transparent;
                border-radius: 9999px;
                outline: 2px solid transparent;
                outline-offset: 2px;
                cursor: pointer;
                transition: all 0.15s;
                white-space: nowrap;

                &:hover {
                  background: rgba(220, 253, 143, 0.1);
                  border-color: #dcfd8f;
                  color: #dcfd8f;
                }

                &:focus-visible {
                  outline: 2px solid #dcfd8f;
                }

                @media (min-width: 768px) {
                  height: 2.25rem;
                  min-width: 2.25rem;
                }
              `}
            >
              {connection
                ? connection.account.accountId
                : 'Connect'}
            </button>
          </div>
        </div>
      </header>

      {/* Watchlist Bar */}
      <div
        css={css`
          background: #0c0d10;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding: 0.375rem 1.5rem;
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: 1rem;
            font-size: 0.75rem;
          `}
        >
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              color: #8b8b8b;
              padding-right: 1rem;
              border-right: 1px solid rgba(255, 255, 255, 0.1);
            `}
          >
            <span>Watchlist</span>
            <button
              css={css`
                background: transparent;
                border: none;
                color: #8b8b8b;
                cursor: pointer;
                padding: 0.125rem;
                display: flex;
                align-items: center;
                font-size: 0.875rem;

                &:hover {
                  color: #ffffff;
                }
              `}
            >
              ⋮
            </button>
          </div>

          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 1rem;
            `}
          >
            {/* HBAR Price */}
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding-right: 1rem;
                border-right: 1px solid rgba(255, 255, 255, 0.1);
              `}
            >
              <span css={css`color: #8b8b8b;`}>HBAR</span>
              <span css={css`color: #ffffff;`}>
                {isLoadingPrices ? '...' : `$${hbarPrice.price.toFixed(4)}`}
              </span>
              {!isLoadingPrices && (
                <span css={css`color: ${hbarPrice.change24h >= 0 ? '#4ade80' : '#ff4d4d'};`}>
                  {hbarPrice.change24h >= 0 ? '+' : ''}{hbarPrice.change24h.toFixed(2)}%
                </span>
              )}
            </div>

            {/* PACK Price */}
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
              `}
            >
              <span css={css`color: #8b8b8b;`}>PACK</span>
              <span css={css`color: #ffffff;`}>
                {isLoadingPrices ? '...' : `$${packPrice.price.toFixed(4)}`}
              </span>
              {!isLoadingPrices && (
                <span css={css`color: ${packPrice.change24h >= 0 ? '#4ade80' : '#ff4d4d'};`}>
                  {packPrice.change24h >= 0 ? '+' : ''}{packPrice.change24h.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Connect Sidebar */}
      <WalletSidebar
        isOpen={isWalletSidebarOpen}
        onClose={() => setIsWalletSidebarOpen(false)}
      />

      {/* Account Details Sidebar */}
      <AccountSidebar
        isOpen={isAccountSidebarOpen}
        onClose={() => setIsAccountSidebarOpen(false)}
      />
    </>
  );
};

export default AppHeader;
