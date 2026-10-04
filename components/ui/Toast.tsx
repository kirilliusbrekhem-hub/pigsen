"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

interface ToastItem {
  id: number;
  message: string;
  kind: "ok" | "err";
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (message: string, opts?: { kind?: "ok" | "err"; action?: ToastItem["action"] }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const show = useCallback<ToastApi["show"]>((message, opts = {}) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { id, message, kind: opts.kind ?? "ok", action: opts.action }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === "err" ? "err" : ""}`} role={t.kind === "err" ? "alert" : "status"}>
            <Icon name={t.kind === "err" ? "alert" : "check"} />
            <span>{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.onClick();
                  setItems((xs) => xs.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
