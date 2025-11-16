/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState } from 'react';

interface CollateralTypeSelectorProps {
  selectedType: 'HBAR' | 'HBARX';
  onTypeChange: (type: 'HBAR' | 'HBARX') => void;
}

export const CollateralTypeSelector = ({ selectedType, onTypeChange }: CollateralTypeSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const collateralTypes = [
    {
      value: 'HBAR' as const,
      label: 'HBAR',
      apy: '13%',
      description: 'Native HBAR - Protocol yield only',
    },
    {
      value: 'HBARX' as const,
      label: 'HBARX',
      apy: '19.5%',
      description: 'Liquid staking token - Protocol + Staking yield',
      badge: 'Higher APY',
    },
  ];

  const selected = collateralTypes.find((t) => t.value === selectedType);

  return (
    <div css={containerStyle}>
      <label css={labelStyle}>Collateral Type</label>
      
      <div css={dropdownStyle}>
        <button
          type="button"
          css={dropdownButtonStyle}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div css={selectedContentStyle}>
            <div css={selectedLabelStyle}>
              <span css={tokenNameStyle}>{selected?.label}</span>
              <span css={apyBadgeStyle}>{selected?.apy} APY</span>
            </div>
            <span css={descriptionStyle}>{selected?.description}</span>
          </div>
          <svg
            css={chevronStyle(isOpen)}
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {isOpen && (
          <div css={dropdownMenuStyle}>
            {collateralTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                css={dropdownItemStyle(type.value === selectedType)}
                onClick={() => {
                  onTypeChange(type.value);
                  setIsOpen(false);
                }}
              >
                <div css={itemContentStyle}>
                  <div css={itemHeaderStyle}>
                    <span css={itemLabelStyle}>{type.label}</span>
                    <span css={itemApyStyle}>{type.apy} APY</span>
                    {type.badge && <span css={badgeStyle}>{type.badge}</span>}
                  </div>
                  <span css={itemDescriptionStyle}>{type.description}</span>
                </div>
                {type.value === selectedType && (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M16.6667 5L7.50004 14.1667L3.33337 10"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedType === 'HBARX' && (
        <div css={infoBoxStyle}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 14A6 6 0 108 2a6 6 0 000 12z"
              stroke="#3b82f6"
              strokeWidth="1.5"
            />
            <path d="M8 8V11M8 5h.01" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div>
            <strong>HBARX Benefits:</strong> Earn 6.5% staking yield + 13% protocol yield = 19.5% total APY
          </div>
        </div>
      )}
    </div>
  );
};

const containerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
`;

const labelStyle = css`
  font-size: 14px;
  font-weight: 600;
  color: #e5e7eb;
`;

const dropdownStyle = css`
  position: relative;
`;

const dropdownButtonStyle = css`
  width: 100%;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

const selectedContentStyle = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  flex: 1;
`;

const selectedLabelStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const tokenNameStyle = css`
  font-size: 16px;
  font-weight: 600;
  color: #fff;
`;

const apyBadgeStyle = css`
  padding: 2px 8px;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #10b981;
`;

const descriptionStyle = css`
  font-size: 13px;
  color: #9ca3af;
  text-align: left;
`;

const chevronStyle = (isOpen: boolean) => css`
  color: #9ca3af;
  transition: transform 0.2s;
  transform: rotate(${isOpen ? '180deg' : '0deg'});
`;

const dropdownMenuStyle = css`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: rgba(17, 24, 39, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px;
  z-index: 100;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
`;

const dropdownItemStyle = (isSelected: boolean) => css`
  width: 100%;
  padding: 12px;
  background: ${isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent'};
  border: 1px solid ${isSelected ? 'rgba(59, 130, 246, 0.3)' : 'transparent'};
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  transition: all 0.2s;
  margin-bottom: 4px;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    background: ${isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
  }
`;

const itemContentStyle = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  flex: 1;
`;

const itemHeaderStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const itemLabelStyle = css`
  font-size: 15px;
  font-weight: 600;
  color: #fff;
`;

const itemApyStyle = css`
  font-size: 13px;
  font-weight: 600;
  color: #10b981;
`;

const badgeStyle = css`
  padding: 2px 6px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #3b82f6;
`;

const itemDescriptionStyle = css`
  font-size: 12px;
  color: #9ca3af;
  text-align: left;
`;

const infoBoxStyle = css`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  font-size: 13px;
  color: #93c5fd;
  margin-top: 8px;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }

  strong {
    color: #60a5fa;
  }
`;
