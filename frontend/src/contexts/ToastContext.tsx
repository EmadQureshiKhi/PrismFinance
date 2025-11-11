import React, { createContext, useContext, useState, useCallback } from "react";
import ToastContainer from "@/shared/components/ToastContainer";
import { ToastProps } from "@/shared/components/Toast";

interface ToastContextType {
  showToast: (toast: Omit<ToastProps, "id" | "onClose" | "isClosing">) => void;
  showSuccess: (title: string, message?: string, txHash?: string) => void;
  showError: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const removeToast = useCallback((id: string) => {
    // Mark as closing
    setToasts((prev) =>
      prev.map((toast) => (toast.id === id ? { ...toast, isClosing: true } : toast))
    );

    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300);
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastProps, "id" | "onClose" | "isClosing">) => {
      const id = Math.random().toString(36).substring(7);
      const newToast: ToastProps = {
        ...toast,
        id,
        onClose: removeToast,
        isClosing: false,
      };

      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        removeToast(id);
      }, 5000);
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (title: string, message?: string, txHash?: string) => {
      showToast({
        type: "success",
        title,
        message,
        txHash,
        network: "testnet",
      });
    },
    [showToast]
  );

  const showError = useCallback(
    (title: string, message?: string) => {
      showToast({
        type: "error",
        title,
        message,
      });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
