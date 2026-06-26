// components/ui/Skeleton.jsx — a content placeholder shown while data loads.
//
// Decorative by design: aria-hidden so screen readers ignore it (the loading
// status is announced elsewhere via role="status"). Shimmer is disabled under
// prefers-reduced-motion (handled in CSS).

import styles from "./Skeleton.module.css";

export default function Skeleton({ width = "100%", height = 14, radius = "var(--radius-sm)", className = "" }) {
  return (
    <span
      className={`${styles.skeleton} ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
