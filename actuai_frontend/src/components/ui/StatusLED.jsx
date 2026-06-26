// components/ui/StatusLED.jsx — the console "status light".
//
// The signature element of the ActuAI console: a small instrument LED that
// reads pending / ok / danger / info. It pairs the light with a text label
// (passed as children or `label`) so meaning never depends on color alone.
//
// `pulse` adds a slow glow for live/awaiting states (respects reduced motion).

import styles from "./StatusLED.module.css";

export default function StatusLED({ status = "info", pulse = false, label, children, ...rest }) {
  return (
    <span className={styles.wrap} {...rest}>
      <span
        className={`${styles.led} ${styles[status]} ${pulse ? styles.pulse : ""}`}
        aria-hidden="true"
      />
      {(label || children) && <span className={styles.label}>{label || children}</span>}
    </span>
  );
}
