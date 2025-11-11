import { css, keyframes } from "@emotion/react";
import { X, CheckCircle, XCircle, ArrowSquareOut } from "@phosphor-icons/react";

const slideIn = keyframes`
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(400px);
    opacity: 0;
  }
`;

export interface ToastProps {
  id: string;
  type: "success" | "error";
  title: string;
  message?: string;
  txHash?: string;
  network?: string;
  onClose: (id: string) => void;
  isClosing?: boolean;
}

export default function Toast({ id, type, title, message, txHash, network = "testnet", onClose, isClosing }: ToastProps) {
  const handleHashScanClick = () => {
    if (txHash) {
      window.open(`https://hashscan.io/${network}/transaction/${txHash}`, "_blank");
    }
  };

  return (
    <div
      css={css`
        position: relative;
        min-width: 350px;
        max-width: 400px;
        background: rgba(12, 13, 16, 0.98);
        border: 1px solid ${type === "success" ? "rgba(220, 253, 143, 0.3)" : "rgba(255, 100, 100, 0.3)"};
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 0.75rem;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        animation: ${isClosing ? slideOut : slideIn} 0.3s ease-out forwards;
        backdrop-filter: blur(20px);
      `}
    >
      {/* Close Button */}
      <button
        onClick={() => onClose(id)}
        css={css`
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: #a0a0a0;
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;

          &:hover {
            color: #fff;
          }
        `}
      >
        <X size={16} />
      </button>

      {/* Content */}
      <div
        css={css`
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
        `}
      >
        {/* Icon */}
        <div
          css={css`
            flex-shrink: 0;
            margin-top: 0.125rem;
          `}
        >
          {type === "success" ? (
            <CheckCircle size={24} color="#dcfd8f" weight="fill" />
          ) : (
            <XCircle size={24} color="#ff6464" weight="fill" />
          )}
        </div>

        {/* Text Content */}
        <div
          css={css`
            flex: 1;
            padding-right: 1.5rem;
          `}
        >
          <div
            css={css`
              font-weight: 700;
              font-size: 0.9375rem;
              color: ${type === "success" ? "#dcfd8f" : "#ff6464"};
              margin-bottom: 0.25rem;
            `}
          >
            {title}
          </div>
          {message && (
            <div
              css={css`
                font-size: 0.875rem;
                color: #a0a0a0;
                line-height: 1.4;
              `}
            >
              {message}
            </div>
          )}

          {/* HashScan Link */}
          {txHash && (
            <button
              onClick={handleHashScanClick}
              css={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-top: 0.75rem;
                padding: 0.5rem 0.75rem;
                background: rgba(220, 253, 143, 0.1);
                border: 1px solid rgba(220, 253, 143, 0.3);
                border-radius: 8px;
                color: #dcfd8f;
                font-size: 0.8125rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(220, 253, 143, 0.15);
                  transform: translateY(-1px);
                }
              `}
            >
              <span>View on HashScan</span>
              <ArrowSquareOut size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
