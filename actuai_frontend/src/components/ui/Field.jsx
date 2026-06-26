// components/ui/Field.jsx — a labelled form control wrapper.
//
// Wires a <label>, an optional hint, and an error message to the control via
// htmlFor / id / aria-describedby / aria-invalid, so the relationship is
// announced correctly by screen readers. Pass the input as children and give
// it the provided `id` + describedBy via a render prop, or use <Input> which
// reads these from context-free props.

import { useId } from "react";
import styles from "./Field.module.css";

export default function Field({ label, hint, error, required = false, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required && <span className={styles.req} aria-hidden="true"> *</span>}
      </label>
      {hint && <p className={styles.hint} id={hintId}>{hint}</p>}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && (
        <p className={styles.error} id={errId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
