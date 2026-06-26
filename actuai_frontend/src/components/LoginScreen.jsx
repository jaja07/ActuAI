// components/LoginScreen.jsx — the sign-in gate.
//
// A real <form> (Enter submits; password managers work), labelled fields wired
// for screen readers, an inline error Alert, and a submit button that shows its
// loading state. Demo credentials are surfaced so the app is usable out of the
// box. The form is centered in a console-style card.

import { useState } from "react";
import { Card, Field, Input, Button, Alert, Icon } from "./ui";
import styles from "./LoginScreen.module.css";

export default function LoginScreen({ onSubmit }) {
  const [username, setUsername] = useState("expert");
  const [password, setPassword] = useState("expert123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit(username, password);
    } catch (err) {
      setError(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.screen}>
      <Card className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true"><Icon name="plane" size={22} /></span>
          <div>
            <p className="eyebrow">ActuAI</p>
            <h1 className={styles.title}>Validation console</h1>
          </div>
        </div>

        <p className={styles.lede}>
          Sign in to review the actions ActuAI&#39;s agents have drafted. Nothing reaches
          SAP or a client until you approve it.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && <Alert tone="danger" title="Couldn&#39;t sign in">{error}</Alert>}

          <Field label="Username" required>
            {({ id, describedBy }) => (
              <Input
                id={id}
                describedBy={describedBy}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            )}
          </Field>

          <Field label="Password" required>
            {({ id, describedBy }) => (
              <Input
                id={id}
                describedBy={describedBy}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            )}
          </Field>

          <Button type="submit" loading={loading} fullWidth size="lg">
            Sign in
          </Button>
        </form>

        <p className={styles.demo}>
          Demo accounts — <code>expert / expert123</code>, <code>admin / admin123</code>,{" "}
          <code>auditor / auditor123</code>
        </p>
      </Card>
    </div>
  );
}
