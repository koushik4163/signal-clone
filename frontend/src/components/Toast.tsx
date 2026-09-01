"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl border animate-slide-in ${
              t.type === "success"
                ? "bg-emerald-700/90 border-emerald-600/40 text-white"
                : t.type === "error"
                ? "bg-red-700/90 border-red-600/40 text-white"
                : "bg-[#181d30]/98 border-[#252c44] text-[#00c8d0]"
            }`}
            style={{ minWidth: 220, maxWidth: 380 }}
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-2 shrink-0 text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
