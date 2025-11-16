import { css } from "@emotion/react";
import { useState } from "react";
import { X } from "@phosphor-icons/react";

interface DepositWithdrawModalProps {
    type: "deposit" | "withdraw";
    maxAmount?: number;
    onConfirm: (amount: string) => void;
    onClose: () => void;
    isLoading?: boolean;
}

const DepositWithdrawModal = ({ type, maxAmount, onConfirm, onClose, isLoading }: DepositWithdrawModalProps) => {
    const [amount, setAmount] = useState("");

    const handleSubmit = () => {
        if (!amount || parseFloat(amount) <= 0) return;
        if (type === "withdraw" && maxAmount && parseFloat(amount) > maxAmount) return;
        onConfirm(amount);
    };

    return (
        <div
            css={css`
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(8px);
                z-index: 2000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.2s ease-out;

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}
            onClick={onClose}
        >
            <div
                css={css`
                    background: rgba(12, 13, 16, 0.98);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 2rem;
                    width: 400px;
                    max-width: 90vw;
                    animation: slideUp 0.3s ease-out;

                    @keyframes slideUp {
                        from {
                            opacity: 0;
                            transform: translateY(20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    css={css`
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 1.5rem;
                    `}
                >
                    <h3
                        css={css`
                            font-size: 1.5rem;
                            font-weight: 700;
                            color: #ffffff;
                            margin: 0;
                        `}
                    >
                        {type === "deposit" ? "Deposit HBAR" : "Withdraw HBAR"}
                    </h3>
                    <button
                        onClick={onClose}
                        css={css`
                            background: rgba(255, 255, 255, 0.05);
                            border: none;
                            border-radius: 8px;
                            width: 32px;
                            height: 32px;
                            color: #a0a0a0;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: all 0.2s;

                            &:hover {
                                background: rgba(255, 255, 255, 0.1);
                                color: #ffffff;
                            }
                        `}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Amount Input */}
                <div
                    css={css`
                        margin-bottom: 1.5rem;
                    `}
                >
                    <label
                        css={css`
                            display: block;
                            font-size: 0.875rem;
                            color: #a0a0a0;
                            margin-bottom: 0.5rem;
                        `}
                    >
                        Amount (HBAR)
                    </label>
                    <div
                        css={css`
                            position: relative;
                        `}
                    >
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSubmit();
                                if (e.key === "Escape") onClose();
                            }}
                            css={css`
                                width: 100%;
                                background: rgba(0, 0, 0, 0.3);
                                border: 1px solid rgba(255, 255, 255, 0.1);
                                border-radius: 12px;
                                padding: 1rem;
                                color: #ffffff;
                                font-size: 1.25rem;
                                font-weight: 600;
                                outline: none;
                                transition: all 0.2s;

                                &:focus {
                                    border-color: ${type === "deposit" ? "rgba(74, 222, 128, 0.5)" : "rgba(255, 77, 77, 0.5)"};
                                    background: rgba(0, 0, 0, 0.5);
                                }

                                &::placeholder {
                                    color: rgba(255, 255, 255, 0.3);
                                }
                            `}
                        />
                        {type === "withdraw" && maxAmount && (
                            <button
                                onClick={() => setAmount(maxAmount.toString())}
                                css={css`
                                    position: absolute;
                                    right: 12px;
                                    top: 50%;
                                    transform: translateY(-50%);
                                    background: rgba(220, 253, 143, 0.1);
                                    border: 1px solid rgba(220, 253, 143, 0.3);
                                    border-radius: 6px;
                                    padding: 0.25rem 0.75rem;
                                    color: #dcfd8f;
                                    font-size: 0.75rem;
                                    font-weight: 600;
                                    cursor: pointer;
                                    transition: all 0.2s;

                                    &:hover {
                                        background: rgba(220, 253, 143, 0.2);
                                    }
                                `}
                            >
                                MAX
                            </button>
                        )}
                    </div>
                    {type === "withdraw" && maxAmount && (
                        <div
                            css={css`
                                margin-top: 0.5rem;
                                font-size: 0.75rem;
                                color: #a0a0a0;
                            `}
                        >
                            Available: {maxAmount.toFixed(2)} HBAR
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div
                    css={css`
                        display: flex;
                        gap: 0.75rem;
                    `}
                >
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        css={css`
                            flex: 1;
                            padding: 1rem;
                            background: rgba(255, 255, 255, 0.05);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            border-radius: 12px;
                            color: #ffffff;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s;

                            &:hover:not(:disabled) {
                                background: rgba(255, 255, 255, 0.1);
                            }

                            &:disabled {
                                opacity: 0.5;
                                cursor: not-allowed;
                            }
                        `}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!amount || parseFloat(amount) <= 0 || isLoading || (type === "withdraw" && maxAmount && parseFloat(amount) > maxAmount)}
                        css={css`
                            flex: 1;
                            padding: 1rem;
                            background: ${type === "deposit" 
                                ? "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)"
                                : "linear-gradient(135deg, #ff4d4d 0%, #dc2626 100%)"};
                            border: none;
                            border-radius: 12px;
                            color: #ffffff;
                            font-weight: 700;
                            cursor: pointer;
                            transition: all 0.2s;

                            &:hover:not(:disabled) {
                                transform: translateY(-2px);
                                box-shadow: 0 8px 16px ${type === "deposit" 
                                    ? "rgba(74, 222, 128, 0.3)"
                                    : "rgba(255, 77, 77, 0.3)"};
                            }

                            &:disabled {
                                opacity: 0.5;
                                cursor: not-allowed;
                                transform: none;
                            }
                        `}
                    >
                        {isLoading ? "Processing..." : type === "deposit" ? "Deposit" : "Withdraw"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DepositWithdrawModal;
