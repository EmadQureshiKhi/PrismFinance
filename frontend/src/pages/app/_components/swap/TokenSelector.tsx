import { css } from "@emotion/react";
import { HederaToken } from "@/services/dex/types";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useState } from "react";
import HederaLogo from "@/assets/svgs/Hedera/hedera-hashgraph-hbar-seeklogo.svg";

interface TokenSelectorProps {
  tokens: HederaToken[];
  selectedToken: HederaToken | null;
  onSelectToken: (token: HederaToken) => void;
  isOpen: boolean;
  onClose: () => void;
}

const TokenSelector = ({
  tokens,
  selectedToken,
  onSelectToken,
  isOpen,
  onClose,
}: TokenSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  // Filter tokens based on search
  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show only top 30 if no search query, otherwise show all filtered results
  const tokensToDisplay = searchQuery 
    ? filteredTokens 
    : filteredTokens.slice(0, 30);

  return (
    <>
      {/* Backdrop */}
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

      {/* Modal */}
      <div
        css={css`
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 420px;
          background: #0c0d10;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 1.5rem;
          z-index: 1000;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
        `}
      >
        {/* Header */}
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          `}
        >
          <h3
            css={css`
              font-size: 1.25rem;
              font-weight: 700;
              color: #ffffff;
            `}
          >
            Select Token
          </h3>
          <button
            onClick={onClose}
            css={css`
              background: transparent;
              border: none;
              color: #a0a0a0;
              cursor: pointer;
              display: flex;
              align-items: center;
              &:hover {
                color: #ffffff;
              }
            `}
          >
            <X size={24} weight="bold" />
          </button>
        </div>

        {/* Search */}
        <div
          css={css`
            position: relative;
            margin-bottom: 1rem;
          `}
        >
          <MagnifyingGlass
            size={16}
            css={css`
              position: absolute;
              left: 1rem;
              top: 50%;
              transform: translateY(-50%);
              color: #6b6b6b;
              pointer-events: none;
            `}
          />
          <input
            type="text"
            placeholder="Search by name or symbol"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            css={css`
              width: 100%;
              background: rgba(0, 0, 0, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.08);
              color: #ffffff;
              padding: 0.875rem 1rem 0.875rem 2.75rem;
              border-radius: 12px;
              font-size: 0.9375rem;
              outline: none;

              &::placeholder {
                color: #6b6b6b;
              }

              &:focus {
                border-color: rgba(220, 253, 143, 0.3);
              }
            `}
          />
        </div>

        {/* Token Count Info */}
        {!searchQuery && tokens.length > 30 && (
          <div
            css={css`
              font-size: 0.75rem;
              color: #a0a0a0;
              margin-bottom: 0.5rem;
              text-align: center;
            `}
          >
            Showing top 30 of {tokens.length} tokens. Search to find more.
          </div>
        )}

        {/* Token List */}
        <div
          css={css`
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          `}
        >
          {tokensToDisplay.map((token) => (
            <button
              key={token.tokenId}
              onClick={() => {
                onSelectToken(token);
                onClose();
                setSearchQuery("");
              }}
              css={css`
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.875rem;
                background: ${selectedToken?.tokenId === token.tokenId
                  ? 'rgba(220, 253, 143, 0.1)'
                  : 'transparent'};
                border: 1px solid ${selectedToken?.tokenId === token.tokenId
                  ? '#dcfd8f'
                  : 'transparent'};
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(255, 255, 255, 0.05);
                }
              `}
            >
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.75rem;
                `}
              >
                {/* Token Logo */}
                <div
                  css={css`
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(220, 253, 143, 0.1);
                    border-radius: 50%;
                    font-size: 1.25rem;
                    overflow: hidden;
                  `}
                >
                  {token.symbol === 'HBAR' ? (
                    <img 
                      src={HederaLogo} 
                      alt="HBAR" 
                      css={css`width: 36px; height: 36px;`} 
                    />
                  ) : token.logo ? (
                    <img 
                      src={token.logo.startsWith('http') ? token.logo : `https://dwk1opv266jxs.cloudfront.net${token.logo}`}
                      alt={token.symbol}
                      css={css`
                        width: 36px; 
                        height: 36px;
                        object-fit: cover;
                      `}
                      onError={(e) => {
                        // Fallback to first letter if image fails to load
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextSibling) {
                          (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div
                    css={css`
                      display: ${token.logo ? 'none' : 'flex'};
                      align-items: center;
                      justify-content: center;
                      width: 100%;
                      height: 100%;
                      color: #dcfd8f;
                      font-weight: 600;
                    `}
                  >
                    {token.symbol.slice(0, 1)}
                  </div>
                </div>

                {/* Token Info */}
                <div
                  css={css`
                    text-align: left;
                  `}
                >
                  <div
                    css={css`
                      font-size: 0.9375rem;
                      font-weight: 600;
                      color: #ffffff;
                    `}
                  >
                    {token.symbol}
                  </div>
                  <div
                    css={css`
                      font-size: 0.75rem;
                      color: #a0a0a0;
                    `}
                  >
                    {token.name}
                  </div>
                </div>
              </div>

              {/* Balance (if available) */}
              <div
                css={css`
                  text-align: right;
                `}
              >
                <div
                  css={css`
                    font-size: 0.875rem;
                    color: #ffffff;
                  `}
                >
                  0.00
                </div>
              </div>
            </button>
          ))}

          {tokensToDisplay.length === 0 && (
            <div
              css={css`
                text-align: center;
                padding: 2rem;
                color: #a0a0a0;
              `}
            >
              {searchQuery ? 'No tokens found' : 'No tokens available'}
            </div>
          )}
          
          {searchQuery && filteredTokens.length > 0 && (
            <div
              css={css`
                text-align: center;
                padding: 0.5rem;
                font-size: 0.75rem;
                color: #6b6b6b;
              `}
            >
              Found {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TokenSelector;
