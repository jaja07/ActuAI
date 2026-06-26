// components/ui/Card.jsx — a surface container with optional status rail.
//
// Props:
//   rail : "pending" | "ok" | "danger" | "info" | undefined
//          draws the colored left "instrument rail" (the console signature).
//   as   : element/component to render as (default "div"). Use "li" in lists.
//   interactive : subtle hover lift (for clickable cards).

import styles from "./Card.module.css";

export default function Card({ rail, interactive = false, as: Tag = "div", className = "", children, ...rest }) {
  const cls = [
    styles.card,
    rail ? styles.railed : "",
    rail ? styles[`rail_${rail}`] : "",
    interactive ? styles.interactive : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}
