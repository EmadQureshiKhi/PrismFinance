import { css } from "@emotion/react";
import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

interface Token {
  symbol: string;
  name: string;
  logo: string;
  apy: string;
}

interface TokenSelectorProps {
  selectedToken: Token;
  onSelectToken: (token: Token) => void;
  currencies: Token[];
  assets?: Token[];
}

export default function TokenSelector({ selectedToken, onSelectToken, currencies, assets = [] }: TokenSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div css={css`
      position: relative;
      z-index: ${showDropdown ? 9999 : 1};
    `}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        css={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          background: rgba(220, 253, 143, 0.1);
          border: 1px solid rgba(220, 253, 143, 0.3);
          border-radius: 12px;
          color: #dcfd8f;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;

          &:hover {
            background: rgba(220, 253, 143, 0.15);
          }
        `}
      >
        <img 
          src={selectedToken.logo} 
          alt={selectedToken.symbol} 
          css={css`width: 20px; height: 20px; border-radius: 50%; object-fit: cover;`} 
        />
        <span>{selectedToken.symbol}</span>
        <CaretDown size={16} />
      </button>
      
      {/* Token Dropdown */}
      {showDropdown && (
        <div
          css={css`
            position: absolute;
            top: calc(100% + 0.5rem);
            right: 0;
            background: rgba(12, 13, 16, 0.98);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 0.5rem;
            min-width: 250px;
            max-height: 400px;
            overflow-y: auto;
            z-index: 10000;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            
            /* Custom scrollbar */
            &::-webkit-scrollbar {
              width: 6px;
            }
            &::-webkit-scrollbar-track {
              background: rgba(255, 255, 255, 0.05);
              border-radius: 3px;
            }
            &::-webkit-scrollbar-thumb {
              background: rgba(220, 253, 143, 0.3);
              border-radius: 3px;
            }
          `}
        >
          {currencies.length > 0 && (
            <>
              <div css={css`padding: 0.5rem; font-size: 0.75rem; color: #a0a0a0; font-weight: 600;`}>
                CURRENCIES
              </div>
              {currencies.map((token) => (
            <button
              key={token.symbol}
              onClick={() => {
                onSelectToken(token);
                setShowDropdown(false);
              }}
              css={css`
                width: 100%;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem;
                background: ${selectedToken.symbol === token.symbol ? 'rgba(220, 253, 143, 0.1)' : 'transparent'};
                border: none;
                border-radius: 8px;
                color: #fff;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(220, 253, 143, 0.1);
                }
              `}
            >
              <img 
                src={token.logo} 
                alt={token.symbol} 
                css={css`width: 28px; height: 28px; border-radius: 50%; object-fit: cover;`} 
              />
              <div css={css`flex: 1; text-align: left;`}>
                <div css={css`font-weight: 600; font-size: 0.875rem;`}>{token.symbol}</div>
                <div css={css`font-size: 0.75rem; color: #a0a0a0;`}>{token.name}</div>
              </div>
              <div css={css`font-size: 0.75rem; color: #dcfd8f; font-weight: 600;`}>{token.apy}</div>
            </button>
          ))}
            </>
          )}
          
          {assets.length > 0 && (
            <>
              <div css={css`padding: 0.5rem; font-size: 0.75rem; color: #a0a0a0; font-weight: 600; margin-top: 0.5rem;`}>
                ASSETS
              </div>
              {assets.map((token) => (
            <button
              key={token.symbol}
              onClick={() => {
                onSelectToken(token);
                setShowDropdown(false);
              }}
              css={css`
                width: 100%;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem;
                background: ${selectedToken.symbol === token.symbol ? 'rgba(220, 253, 143, 0.1)' : 'transparent'};
                border: none;
                border-radius: 8px;
                color: #fff;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(220, 253, 143, 0.1);
                }
              `}
            >
              <img 
                src={token.logo} 
                alt={token.symbol} 
                css={css`width: 28px; height: 28px; border-radius: 50%; object-fit: cover;`} 
              />
              <div css={css`flex: 1; text-align: left;`}>
                <div css={css`font-weight: 600; font-size: 0.875rem;`}>{token.symbol}</div>
                <div css={css`font-size: 0.75rem; color: #a0a0a0;`}>{token.name}</div>
              </div>
              <div css={css`font-size: 0.75rem; color: #dcfd8f; font-weight: 600;`}>{token.apy}</div>
            </button>
          ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
