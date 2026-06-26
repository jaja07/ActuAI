// components/ui/Spinner.jsx — an accessible loading indicator.
// role="status" + a visually-hidden label so screen readers announce loading.

import VisuallyHidden from "./VisuallyHidden.jsx";
import styles from "./Spinner.module.css";

export default function Spinner({ size = 18, label = "Loading", inline = false }) {
  return (
    <span className={inline ? styles.inline : styles.block} role="status">
      <svg className={styles.spinner} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle className={styles.track} cx="12" cy="12" r="9" fill="none" strokeWidth="3" />
        <circle className={styles.head} cx="12" cy="12" r="9" fill="none" strokeWidth="3" />
      </svg>
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}
