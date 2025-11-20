import { css } from "@emotion/react";
import { Gear, MagnifyingGlass, Shield } from "@phosphor-icons/react";
import { useState, useEffect, useRef } from "react";
import WalletSidebar from "./WalletSidebar";
import AccountSidebar from "./AccountSidebar";
import WatchlistManager from "./WatchlistManager";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate, useLocation } from "react-router-dom";
import prismIcon from "@/assets/logo/prism-icon.png";

interface WatchlistToken {
  id: string;
  symbol: string;
  name: string;
  coingeckoId?: string;
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
  { id: "liquidity", label: "Preps" },
  { id: "governance", label: "Governance" },
];

interface AppHeaderProps {
  onPageChange: (page: string) => void;
}

const AppHeader = ({ onPageChange }: AppHeaderProps) => {
  const location = useLocation();

  // Sync with persisted page
  const [activeItem, setActiveItem] = useState(() => {
    return localStorage.getItem("prism_active_page") || "swap";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isWalletSidebarOpen, setIsWalletSidebarOpen] = useState(false);
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showWatchlistManager, setShowWatchlistManager] = useState(false);
  const { connection } = useWallet();
  const navigate = useNavigate();
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);

  // Watchlist state
  const [watchlistTokens, setWatchlistTokens] = useState<WatchlistToken[]>(() => {
    const saved = localStorage.getItem('prism_watchlist');
    return saved ? JSON.parse(saved) : [
      { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera', coingeckoId: 'hedera-hashgraph', price: 0, change24h: 0 },
      { id: 'hashpack', symbol: 'PACK', name: 'HashPack', coingeckoId: 'hashpack', price: 0, change24h: 0 },
    ];
  });

  // Clear active nav item when on reserves page
  useEffect(() => {
    if (location.pathname === '/app/reserves') {
      setActiveItem('');
    }
  }, [location.pathname]);

  const handleNavClick = (itemId: string) => {
    if (itemId === "governance") return; // Don't handle governance clicks
    setActiveItem(itemId);
    onPageChange(itemId);
    // Navigate to /app to ensure we're on the main app page
    if (window.location.pathname !== '/app') {
      navigate('/app');
    }
  };

  // Close settings dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('prism_watchlist', JSON.stringify(watchlistTokens));
  }, [watchlistTokens]);

  // Fetch real-time prices from CoinGecko for watchlist tokens
  useEffect(() => {
    const fetchPrices = async () => {
      if (watchlistTokens.length === 0) return;

      try {
        setIsLoadingPrices(true);
        const coingeckoIds = watchlistTokens
          .filter(token => token.coingeckoId)
          .map(token => token.coingeckoId)
          .join(',');

        if (!coingeckoIds) {
          setIsLoadingPrices(false);
          return;
        }

        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds}&vs_currencies=usd&include_24hr_change=true`
        );
        const data = await response.json();

        // Update watchlist tokens with new prices
        const updatedTokens = watchlistTokens.map(token => ({
          ...token,
          price: data[token.coingeckoId!]?.usd || token.price,
          change24h: data[token.coingeckoId!]?.usd_24h_change || token.change24h,
        }));

        setWatchlistTokens(updatedTokens);
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
  }, [watchlistTokens.length]); // Only depend on length to avoid infinite loops

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
          padding: 0.375rem 0.75rem;
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
            margin: 0;
            width: 100%;
          `}
        >
          {/* Left: Logo + Navigation */}
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
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
              <img
                src={prismIcon}
                alt="Prism Finance"
                css={css`
                  width: 40px;
                  height: 40px;
                  object-fit: contain;
                `}
              />
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
                const isGovernance = item.id === "governance";

                return (
                  <button
                    key={item.id}
                    onClick={isGovernance ? undefined : () => handleNavClick(item.id)}
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
                      position: relative;

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

            {/* Settings Dropdown */}
            <div ref={settingsRef} css={css`position: relative;`}>
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                css={css`
                  margin-top: 0.125rem;
                  display: flex;
                  height: 100%;
                  align-items: center;
                  justify-content: center;
                  font-size: 0.875rem;
                  line-height: 1.25rem;
                  font-weight: 500;
                  color: ${showSettingsMenu ? '#dcfd8f' : 'rgba(144, 161, 185, 1)'};
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

              {showSettingsMenu && (
                <div css={css`
                  position: absolute;
                  top: calc(100% + 0.5rem);
                  right: 0;
                  background: #0c0d10;
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 12px;
                  padding: 0.5rem;
                  min-width: 200px;
                  z-index: 1000;
                  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                `}>
                  <button
                    onClick={() => {
                      navigate('/app/reserves');
                      setShowSettingsMenu(false);
                    }}
                    css={css`
                      width: 100%;
                      background: transparent;
                      border: none;
                      color: #ffffff;
                      padding: 0.75rem 1rem;
                      border-radius: 8px;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      display: flex;
                      align-items: center;
                      gap: 0.75rem;
                      font-size: 0.875rem;
                      text-align: left;
                      
                      &:hover {
                        background: rgba(220, 253, 143, 0.1);
                        color: #dcfd8f;
                      }
                    `}
                  >
                    <Shield size={18} weight="bold" />
                    Proof of Reserves
                  </button>
                </div>
              )}
            </div>

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
              onClick={() => setShowWatchlistManager(true)}
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
              overflow-x: auto;
              scrollbar-width: none;
              -ms-overflow-style: none;
              
              &::-webkit-scrollbar {
                display: none;
              }
            `}
          >
            {watchlistTokens.map((token, index) => (
              <div
                key={token.id}
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  padding-right: ${index < watchlistTokens.length - 1 ? '1rem' : '0'};
                  border-right: ${index < watchlistTokens.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'};
                  white-space: nowrap;
                  flex-shrink: 0;
                `}
              >
                <span css={css`color: #8b8b8b;`}>{token.symbol}</span>
                <span css={css`color: #ffffff;`}>
                  {isLoadingPrices ? '...' : `${token.price.toFixed(4)}`}
                </span>
                {!isLoadingPrices && token.price > 0 && (
                  <span css={css`color: ${token.change24h >= 0 ? '#4ade80' : '#ff4d4d'};`}>
                    {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                  </span>
                )}
              </div>
            ))}

            {watchlistTokens.length === 0 && (
              <div
                css={css`
                  color: #8b8b8b;
                  font-size: 0.75rem;
                `}
              >
                Click ⋮ to add tokens to your watchlist
              </div>
            )}
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

      {/* Watchlist Manager */}
      <WatchlistManager
        isOpen={showWatchlistManager}
        onClose={() => setShowWatchlistManager(false)}
        watchlistTokens={watchlistTokens}
        onUpdateWatchlist={setWatchlistTokens}
      />
    </>
  );
};

export default AppHeader;