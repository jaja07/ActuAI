// components/ui/Button.jsx — the primary action primitive.
//
// Props:
//   variant : "primary" | "secondary" | "ghost" | "danger" | "success"  (default "primary")
//   size    : "sm" | "md" | "lg"                                         (default "md")
//   loading : boolean — shows a spinner, sets aria-busy, blocks clicks
//   disabled: boolean
//   fullWidth: boolean
//   iconLeft / iconRight : ReactNode
//   ...rest : forwarded to <button> (onClick, type, aria-*, etc.)
//
// Accessibility: a real <button> (keyboard + screen-reader native). While
// loading it is aria-busy and non-interactive but keeps its width so the
// layout doesn't jump.

import Spinner from "./Spinner.jsx";
import styles from "./Button.module.css";

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  iconLeft,
  iconRight,
  className = "",
  children,
  ...rest
}) {
  const cls = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : "",
    loading ? styles.loading : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && (
        <span className={styles.spinnerWrap}>
          <Spinner size={16} label="Working" inline />
        </span>
      )}
      <span className={styles.content}>
        {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
        {children}
        {iconRight && <span className={styles.icon}>{iconRight}</span>}
      </span>
    </button>
  );
}
