// components/ui/EmptyState.jsx — what we show when there's nothing to show.
//
// An empty screen is an invitation to act, not a dead end: it states plainly
// what's empty and offers the next step. Props: icon (name), title, description,
// and an optional action node (e.g. a Button).

import Icon from "./Icon.jsx";
import styles from "./EmptyState.module.css";

export default function EmptyState({ icon = "inbox", title, description, action }) {
  return (
    <div className={styles.empty}>
      <span className={styles.iconWrap}>
        <Icon name={icon} size={26} />
      </span>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.desc}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
