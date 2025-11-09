import { css } from "@emotion/react";
import { X } from "@phosphor-icons/react";
import metamaskLogo from "@/assets/MetaMask/MetaMask-icon-fox.svg";
import hashpackLogo from "@/assets/MetaMask/hashpack logo.svg";
import { useWallet } from "@/contexts/WalletContext";

interface WalletSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletSidebar = ({ isOpen, onClose }: WalletSidebarProps) => {
  const { connect, isConnecting, error, installedWallets, clearError } = useWallet();

  const handleConnect = async (walletId: 'metamask' | 'hashpack') => {
    try {
      await connect(walletId);
      onClose(); // Close sidebar on successful connection
    } catch (err) {
      // Error is handled in context
      console.error('Connection failed:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with blur */}
      <div
        onClick={onClose}
        css={css`
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 999;
        `}
      />

      {/* Sidebar */}
      <div
        css={css`
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-width: 400px;
          background: #0c0d10;
          border-left: 1px solid rgba(255, 255, 255, 0.05);
          z-index: 1000;
          overflow-y: auto;
          animation: slideIn 0.3s ease-out;

          @keyframes slideIn {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
        `}
      >
        {/* Header */}
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          `}
        >
          <h2
            css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: #ffffff;
              margin: 0;
            `}
          >
            Connect
          </h2>
          <button
            onClick={onClose}
            css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              color: rgba(144, 161, 185, 1);
              cursor: pointer;
              transition: all 0.2s;

              &:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
              }
            `}
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div
          css={css`
            padding: 1.5rem;
          `}
        >
          {/* Wallet Options */}
          <div
            css={css`
              margin-bottom: 2rem;
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
            `}
          >
            {/* Error Message */}
            {error && (
              <div
                css={css`
                  padding: 1rem;
                  background: rgba(255, 77, 77, 0.1);
                  border: 1px solid rgba(255, 77, 77, 0.3);
                  border-radius: 12px;
                  color: #ff4d4d;
                  font-size: 0.875rem;
                  margin-bottom: 1rem;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                `}
              >
                <span>{error}</span>
                <button
                  onClick={clearError}
                  css={css`
                    background: transparent;
                    border: none;
                    color: #ff4d4d;
                    cursor: pointer;
                    padding: 0.25rem;
                    &:hover {
                      opacity: 0.7;
                    }
                  `}
                >
                  ✕
                </button>
              </div>
            )}

            {/* MetaMask - Recommended */}
            <button
              onClick={() => handleConnect('metamask')}
              disabled={isConnecting}
              css={css`
                width: 100%;
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(220, 253, 143, 0.2);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
                overflow: hidden;
                opacity: ${isConnecting ? 0.5 : 1};

                &:disabled {
                  cursor: not-allowed;
                }

                &::before {
                  content: "";
                  position: absolute;
                  top: -50%;
                  left: -50%;
                  width: 200%;
                  height: 200%;
                  background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(220, 253, 143, 0.15),
                    transparent
                  );
                  animation: shimmer 3s infinite;
                }

                @keyframes shimmer {
                  0% {
                    transform: translateX(-100%) translateY(-100%) rotate(45deg);
                  }
                  100% {
                    transform: translateX(100%) translateY(100%) rotate(45deg);
                  }
                }

                &:hover {
                  background: rgba(255, 255, 255, 0.05);
                  border-color: rgba(220, 253, 143, 0.4);
                  box-shadow: 0 0 20px rgba(220, 253, 143, 0.2);
                }
              `}
            >
              <div
                css={css`
                  width: 40px;
                  height: 40px;
                  background: #ffffff;
                  border-radius: 8px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 0.375rem;
                  position: relative;
                  z-index: 1;
                `}
              >
                <img
                  src={metamaskLogo}
                  alt="MetaMask"
                  css={css`
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                  `}
                />
              </div>
              <div
                css={css`
                  flex: 1;
                  text-align: left;
                  position: relative;
                  z-index: 1;
                `}
              >
                <div
                  css={css`
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: #ffffff;
                    margin-bottom: 0.25rem;
                  `}
                >
                  MetaMask
                </div>
                <div
                  css={css`
                    font-size: 0.75rem;
                    color: rgba(144, 161, 185, 1);
                  `}
                >
                  Connect with MetaMask wallet
                </div>
              </div>
              <span
                css={css`
                  position: absolute;
                  top: 0.75rem;
                  right: 0.75rem;
                  background: rgba(220, 253, 143, 0.1);
                  color: #dcfd8f;
                  font-size: 0.625rem;
                  font-weight: 700;
                  padding: 0.25rem 0.5rem;
                  border-radius: 4px;
                  z-index: 1;
                `}
              >
                Recommended
              </span>
            </button>

            {/* HashPack */}
            <button
              onClick={() => handleConnect('hashpack')}
              disabled={isConnecting}
              css={css`
                width: 100%;
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                opacity: ${isConnecting ? 0.5 : 1};

                &:hover {
                  background: rgba(255, 255, 255, 0.05);
                  border-color: rgba(220, 253, 143, 0.3);
                }

                &:disabled {
                  cursor: not-allowed;
                }
              `}
            >
              <div
                css={css`
                  width: 40px;
                  height: 40px;
                  background: #ffffff;
                  border-radius: 8px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 0.375rem;
                `}
              >
                <img
                  src={hashpackLogo}
                  alt="HashPack"
                  css={css`
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                  `}
                />
              </div>
              <div
                css={css`
                  flex: 1;
                  text-align: left;
                `}
              >
                <div
                  css={css`
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: #ffffff;
                    margin-bottom: 0.25rem;
                  `}
                >
                  HashPack
                </div>
                <div
                  css={css`
                    font-size: 0.75rem;
                    color: rgba(144, 161, 185, 1);
                  `}
                >
                  Connect with HashPack wallet
                </div>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div
            css={css`
              height: 1px;
              background: rgba(255, 255, 255, 0.05);
              margin: 1.5rem 0;
            `}
          />

          {/* Installed Wallets */}
          <div>
            <h3
              css={css`
                font-size: 0.875rem;
                font-weight: 600;
                color: rgba(144, 161, 185, 1);
                margin: 0 0 1rem 0;
              `}
            >
              Installed
            </h3>

            <div
              css={css`
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
              `}
            >
              {/* Show only installed wallets */}
              {installedWallets.length > 0 ? (
                installedWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => handleConnect(wallet.id)}
                    disabled={isConnecting}
                    css={css`
                      aspect-ratio: 1;
                      background: rgba(255, 255, 255, 0.03);
                      border: 1px solid rgba(255, 255, 255, 0.08);
                      border-radius: 12px;
                      cursor: pointer;
                      transition: all 0.2s;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      padding: 0.5rem;
                      opacity: ${isConnecting ? 0.5 : 1};

                      &:hover {
                        background: rgba(255, 255, 255, 0.05);
                        border-color: rgba(220, 253, 143, 0.3);
                      }

                      &:disabled {
                        cursor: not-allowed;
                      }
                    `}
                  >
                    <img
                      src={wallet.id === 'metamask' ? metamaskLogo : hashpackLogo}
                      alt={wallet.name}
                      css={css`
                        width: 100%;
                        height: 100%;
                        object-fit: contain;
                      `}
                    />
                  </button>
                ))
              ) : (
                <div
                  css={css`
                    grid-column: 1 / -1;
                    text-align: center;
                    color: rgba(144, 161, 185, 1);
                    font-size: 0.875rem;
                    padding: 1rem;
                  `}
                >
                  No wallets detected. Please install MetaMask or HashPack.
                </div>
              )}
            </div>

            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-top: 1rem;
              `}
            >
              <div
                css={css`
                  flex: 1;
                  height: 1px;
                  background: rgba(255, 255, 255, 0.05);
                `}
              />
              <button
                css={css`
                  padding: 0.75rem;
                  background: transparent;
                  border: none;
                  color: rgba(144, 161, 185, 1);
                  font-size: 0.875rem;
                  font-weight: 500;
                  cursor: pointer;
                  transition: color 0.2s;
                  white-space: nowrap;

                  &:hover {
                    color: #dcfd8f;
                  }
                `}
              >
                View More Wallets ↓
              </button>
              <div
                css={css`
                  flex: 1;
                  height: 1px;
                  background: rgba(255, 255, 255, 0.05);
                `}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WalletSidebar;
