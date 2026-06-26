// components/ui/Input.jsx — a styled text input.
// `describedBy` and `invalid` come from <Field>'s render prop, wiring ARIA.

import styles from "./Field.module.css";

export default function Input({ id, describedBy, invalid = false, className = "", ...rest }) {
  return (
    <input
      id={id}
      className={`${styles.input} ${invalid ? styles.inputInvalid : ""} ${className}`}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}
