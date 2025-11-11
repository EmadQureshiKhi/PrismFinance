import { css } from "@emotion/react";
import Toast, { ToastProps } from "./Toast";

interface ToastContainerProps {
  toasts: ToastProps[];
  onClose: (id: string) => void;
}

export default function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div
      css={css`
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        pointer-events: none;

        > * {
          pointer-events: auto;
        }

        @media (max-width: 768px) {
          left: 1rem;
          right: 1rem;
          bottom: 1rem;
          align-items: stretch;
        }
      `}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}
