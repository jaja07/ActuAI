// components/ui/Alert.jsx — an inline message banner.
//
// tone: "info" | "success" | "warning" | "danger"
// role is "alert" for danger/warning (assertive) and "status" otherwise.
// Optional onDismiss renders a close button with an accessible label.

import Icon from "./Icon.jsx";
import styles from "./Alert.module.css";

const ICON = { info: "shield", success: "check", warning: "alert", danger: "alert" };

export default function Alert({ tone = "info", title, children, onDismiss }) {
  const assertive = tone === "danger" || tone === "warning";
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={assertive ? "alert" : "status"}>
      <span className={styles.icon}><Icon name={ICON[tone]} size={18} /></span>
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
      {onDismiss && (
        <button className={styles.close} onClick={onDismiss} aria-label="Dismiss message">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
