// components/ui/Badge.jsx — a compact status/label pill.
// tone: "neutral" | "info" | "pending" | "ok" | "danger"
// Tones carry a text label, never color alone (accessibility).

import styles from "./Badge.module.css";

export default function Badge({ tone = "neutral", children, className = "", ...rest }) {
  return (
    <span className={`${styles.badge} ${styles[tone]} ${className}`} {...rest}>
      {children}
    </span>
  );
}
