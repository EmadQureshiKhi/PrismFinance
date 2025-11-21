/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { ActivityItem } from '@/hooks/useActivity';
import { 
  ArrowSquareOut, 
  ArrowDown, 
  ArrowUp, 
  Plus, 
  Minus, 
  ArrowsLeftRight 
} from '@phosphor-icons/react';
import { hederaTxService } from '@/services/hederaTransactions';

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading: boolean;
  error: string | null;
}

export function ActivityFeed({ activities, isLoading, error }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div css={css`display: flex; flex-direction: column; gap: 0.75rem;`}>
        {[1, 2, 3].map(i => (
          <div key={i} css={css`
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}>
            <div css={css`
              display: flex;
              align-items: center;
              gap: 0.75rem;
              padding: 0.75rem;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 0.5rem;
            `}>
              <div css={css`
                width: 2.5rem;
                height: 2.5rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
              `} />
              <div css={css`flex: 1; display: flex; flex-direction: column; gap: 0.5rem;`}>
                <div css={css`
                  height: 1rem;
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 0.25rem;
                  width: 75%;
                `} />
                <div css={css`
                  height: 0.75rem;
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 0.25rem;
                  width: 50%;
                `} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div css={css`
        text-align: center;
        padding: 2rem 0;
        color: #f87171;
      `}>
        {error}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div css={css`
        text-align: center;
        padding: 3rem 0;
        color: rgba(255, 255, 255, 0.4);
      `}>
        <p css={css`font-size: 0.875rem;`}>No transactions yet</p>
        <p css={css`font-size: 0.75rem; margin-top: 0.25rem;`}>Your activity will appear here</p>
      </div>
    );
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 400px;
      overflow-y: auto;
      padding-right: 0.25rem;

      /* Custom scrollbar to match theme */
      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.02);
        border-radius: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }

      &::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    `}>
      {activities.slice(0, 50).map(activity => (
        <ActivityRow key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const { icon, bgColor, description } = getActivityDisplay(activity);
  const timeAgo = formatTimeAgo(activity.timestamp);

  return (
    <div css={css`
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.625rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 0.5rem;
      transition: background 0.2s;
      position: relative;

      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      &:hover a {
        opacity: 1;
      }
    `}>
      {/* Icon */}
      <div css={css`
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        background: ${bgColor};
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      `}>
        {icon}
      </div>

      {/* Content */}
      <div css={css`flex: 1; min-width: 0;`}>
        <p 
          css={css`
            font-size: 0.8125rem;
            color: #ffffff;
            font-weight: 400;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `}
          dangerouslySetInnerHTML={{ __html: description }}
        />
        <div css={css`
          display: flex;
          align-items: center;
          gap: 0.375rem;
          margin-top: 0.25rem;
        `}>
          <span css={css`font-size: 0.6875rem; color: rgba(255, 255, 255, 0.4);`}>
            {timeAgo}
          </span>
          <span css={css`font-size: 0.6875rem; color: rgba(255, 255, 255, 0.2);`}>
            •
          </span>
          <span css={css`
            font-size: 0.6875rem;
            color: ${activity.status === 'SUCCESS' ? '#4ade80' : '#f87171'};
          `}>
            {activity.status === 'SUCCESS' ? 'Success' : 'Failed'}
          </span>
        </div>
      </div>

      {/* HashScan Link */}
      <a
        href={hederaTxService.getHashScanLink(activity.txHash)}
        target="_blank"
        rel="noopener noreferrer"
        css={css`
          opacity: 0;
          transition: opacity 0.2s;
          color: rgba(255, 255, 255, 0.4);

          &:hover {
            color: rgba(255, 255, 255, 0.6);
          }
        `}
      >
        <ArrowSquareOut size={16} weight="bold" />
      </a>
    </div>
  );
}

function getActivityDisplay(activity: ActivityItem) {
  const amount = parseFloat(activity.amount).toFixed(4);
  const secondaryAmount = activity.secondaryAmount 
    ? parseFloat(activity.secondaryAmount).toFixed(2)
    : null;

  // Highlight token symbols in lime color
  const highlightToken = (text: string, symbol: string) => {
    return text.replace(symbol, `<span style="color: #dcfd8f; font-weight: 600;">${symbol}</span>`);
  };

  switch (activity.type) {
    case 'vault_deposit':
      const depositDesc = secondaryAmount
        ? `Deposited ${secondaryAmount} HBAR → Minted ${amount} ${activity.symbol}`
        : `Deposited ${amount} ${activity.symbol}`;
      return {
        icon: <ArrowDown size={18} weight="bold" color="#dcfd8f" />,
        bgColor: 'transparent',
        description: highlightToken(depositDesc, activity.symbol),
      };
    
    case 'vault_withdraw':
      const withdrawDesc = secondaryAmount
        ? `Burned ${amount} ${activity.symbol} → Withdrew ${secondaryAmount} HBAR`
        : `Withdrew ${amount} ${activity.symbol}`;
      return {
        icon: <ArrowUp size={18} weight="bold" color="#6b9eff" />,
        bgColor: 'transparent',
        description: highlightToken(withdrawDesc, activity.symbol),
      };
    
    case 'asset_buy':
      const buyDesc = secondaryAmount
        ? `Bought ${amount} ${activity.symbol} for ${secondaryAmount} HBAR`
        : `Bought ${amount} ${activity.symbol}`;
      return {
        icon: <Plus size={18} weight="bold" color="#dcfd8f" />,
        bgColor: 'transparent',
        description: highlightToken(buyDesc, activity.symbol),
      };
    
    case 'asset_sell':
      const sellDesc = secondaryAmount
        ? `Sold ${amount} ${activity.symbol} for ${secondaryAmount} HBAR`
        : `Sold ${amount} ${activity.symbol}`;
      return {
        icon: <Minus size={18} weight="bold" color="#ff6b6b" />,
        bgColor: 'transparent',
        description: highlightToken(sellDesc, activity.symbol),
      };
    
    default:
      return {
        icon: <ArrowsLeftRight size={18} weight="bold" color="#ffffff" />,
        bgColor: 'transparent',
        description: `Transaction: <span style="color: #dcfd8f; font-weight: 600;">${activity.symbol}</span>`,
      };
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}
