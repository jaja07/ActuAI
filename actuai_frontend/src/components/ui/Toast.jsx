// components/ui/Toast.jsx — transient, accessible notifications.
//
// <ToastProvider> wraps the app and renders a single aria-live region (the
// "Toaster"). Any component calls useToast() to push a message:
//
//     const toast = useToast();
//     toast.success("Task approved");
//     toast.error("SAP write failed");
//
// Polite messages (success/info) don't interrupt; errors use assertive so they
// are announced immediately. Toasts auto-dismiss but can be closed manually.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import styles from "./Toast.module.css";

const ToastContext = createContext(null);

let seq = 0;

export function ToastProvider({ children, duration = 4500 }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback(
    (tone, message) => {
      const id = ++seq;
      setToasts((list) => [...list, { id, tone, message }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss, duration]
  );

  const api = useMemo(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("danger", m),
      info: (m) => push("info", m),
      dismiss,
    }),
    [push, dismiss]
  );

  const polite = toasts.filter((t) => t.tone !== "danger");
  const assertive = toasts.filter((t) => t.tone === "danger");

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region}>
        <div aria-live="polite" aria-atomic="false">
          {polite.map((t) => (
            <ToastItem key={t.id} {...t} onClose={() => dismiss(t.id)} />
          ))}
        </div>
        <div aria-live="assertive" role="alert" aria-atomic="false">
          {assertive.map((t) => (
            <ToastItem key={t.id} {...t} onClose={() => dismiss(t.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ tone, message, onClose }) {
  const icon = tone === "success" ? "check" : tone === "danger" ? "alert" : "shield";
  return (
    <div className={`${styles.toast} ${styles[tone]}`}>
      <span className={styles.icon}><Icon name={icon} size={18} /></span>
      <span className={styles.msg}>{message}</span>
      <button className={styles.close} onClick={onClose} aria-label="Dismiss notification">
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
