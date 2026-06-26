// components/ui/CodeBlock.jsx — a monospace "instrument readout" for payloads.
//
// Renders a JSON/object (or string) as a scrollable, copyable block. The copy
// button announces success via the toast region passed in, or falls back to a
// transient inline label. `label` gives the region an accessible name.

import { useState } from "react";
import Icon from "./Icon.jsx";
import styles from "./CodeBlock.module.css";

export default function CodeBlock({ value, label = "Payload", maxHeight = 220 }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked (e.g. insecure context) — no-op */
    }
  }

  return (
    <figure className={styles.block} aria-label={label}>
      <figcaption className={styles.bar}>
        <span className={styles.cap}>{label}</span>
        <button className={styles.copy} onClick={copy} aria-label={`Copy ${label}`}>
          <Icon name={copied ? "check" : "copy"} size={14} />
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre className={styles.pre} style={{ maxHeight }} tabIndex={0}>
        <code>{text}</code>
      </pre>
    </figure>
  );
}
