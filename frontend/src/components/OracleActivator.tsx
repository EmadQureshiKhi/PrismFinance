import { useState, useEffect } from 'react';
import { css } from '@emotion/react';

const ORACLE_API_URL = import.meta.env.VITE_ORACLE_API_URL || 'http://localhost:3001';

interface OracleStatus {
  active: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  remainingMs: number;
}

export function OracleActivator() {
  const [status, setStatus] = useState<OracleStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true); // Start expanded on first visit

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${ORACLE_API_URL}/status`);
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch oracle status');
      console.error(err);
    }
  };

  const activateOracle = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${ORACLE_API_URL}/activate`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Failed to activate oracle');
      }
    } catch (err) {
      setError('Failed to activate oracle');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deactivateOracle = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${ORACLE_API_URL}/deactivate`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Failed to deactivate oracle');
      }
    } catch (err) {
      setError('Failed to deactivate oracle');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div css={containerStyle}>
      {/* Compact Button */}
      {!isExpanded && (
        <button
          css={compactButtonStyle(status?.active || false)}
          onClick={() => setIsExpanded(true)}
        >
          <div css={compactContentStyle}>
            <span css={iconStyle}>{status?.active ? '🟢' : '⚫'}</span>
            <span css={labelStyle}>Oracle</span>
          </div>
        </button>
      )}

      {/* Expanded Card */}
      {isExpanded && (
        <div css={cardStyle}>
          <div css={headerStyle}>
            <h3>Price Oracle (Demo Mode)</h3>
            <button css={minimizeButtonStyle} onClick={() => setIsExpanded(false)} title="Minimize">
              −
            </button>
          </div>

          <p css={descriptionStyle}>
            Activate the price oracle to fetch live prices from Chainlink and Pyth Network.
            Oracle runs for 2 hours then auto-sleeps to save costs.
          </p>

          <div css={statusRowStyle}>
            <span>Status:</span>
            <div css={statusBadgeStyle(status?.active || false)}>
              {status?.active ? '🟢 Active' : '⚫ Sleeping'}
            </div>
          </div>

          {status?.active && status.remainingMs > 0 && (
            <div css={timerStyle}>
              ⏱️ Time remaining: {formatTimeRemaining(status.remainingMs)}
            </div>
          )}

          {error && (
            <div css={errorStyle}>
              ⚠️ {error}
            </div>
          )}

          <div css={buttonContainerStyle}>
            {!status?.active ? (
              <button
                css={activateButtonStyle}
                onClick={activateOracle}
                disabled={loading}
              >
                {loading ? '⏳ Activating...' : '🚀 Activate Oracle (2 hours)'}
              </button>
            ) : (
              <button
                css={deactivateButtonStyle}
                onClick={deactivateOracle}
                disabled={loading}
              >
                {loading ? '⏳ Stopping...' : '🛑 Stop Oracle'}
              </button>
            )}
          </div>

          <div css={infoStyle}>
            <small>
              💡 This is a demo feature for testnet. In production, oracles run continuously.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const containerStyle = css`
  position: relative;
`;

const compactButtonStyle = (active: boolean) => css`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid ${active ? 'rgba(220, 253, 143, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);

  &:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    border-color: ${active ? 'rgba(220, 253, 143, 0.8)' : 'rgba(255, 255, 255, 0.2)'};
  }
`;

const compactContentStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const iconStyle = css`
  font-size: 16px;
  line-height: 1;
`;

const labelStyle = css`
  color: white;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
`;

const cardStyle = css`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  min-width: 320px;
  max-width: 400px;
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const headerStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: white;
  }
`;

const minimizeButtonStyle = css`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-color: rgba(220, 253, 143, 0.3);
  }
`;

const statusRowStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
`;

const descriptionStyle = css`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
`;

const statusBadgeStyle = (active: boolean) => css`
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${active ? 'rgba(220, 253, 143, 0.1)' : 'rgba(100, 100, 100, 0.1)'};
  color: ${active ? '#dcfd8f' : '#9ca3af'};
  border: 1px solid ${active ? 'rgba(220, 253, 143, 0.3)' : 'rgba(100, 100, 100, 0.2)'};
`;

const errorStyle = css`
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
`;

const timerStyle = css`
  background: rgba(220, 253, 143, 0.1);
  border: 1px solid rgba(220, 253, 143, 0.3);
  color: #dcfd8f;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  text-align: center;
  font-weight: 600;
`;

const buttonContainerStyle = css`
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
`;

const infoStyle = css`
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  line-height: 1.5;
`;

const activateButtonStyle = css`
  flex: 1;
  padding: 12px 20px;
  background: rgba(220, 253, 143, 0.1);
  border: 1px solid rgba(220, 253, 143, 0.3);
  border-radius: 12px;
  color: #dcfd8f;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(220, 253, 143, 0.15);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(220, 253, 143, 0.2);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const deactivateButtonStyle = css`
  flex: 1;
  padding: 10px 16px;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.3);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
