// components/AppShell.jsx — the authenticated application frame.
//
// A fixed control-console header (brand + signed-in identity + sign out) over a
// centered content column. Responsive: on narrow screens the identity collapses
// to the role badge only. A skip link lets keyboard users jump past the header.

import { Badge, Button, Icon } from "./ui";
import styles from "./AppShell.module.css";

const ROLE_LABEL = {
  engineer: "Engineer",
  buyer: "Buyer",
  operator_admin: "Admin",
  compliance_officer: "Compliance",
  auditor: "Auditor",
};

export default function AppShell({ user, onSignOut, children }) {
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>Skip to content</a>

      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden="true"><Icon name="plane" size={20} /></span>
            <span className={styles.brandText}>
              <span className={styles.name}>ActuAI</span>
              <span className={styles.tag}>Validation console</span>
            </span>
          </div>

          <div className={styles.identity}>
            {user && (
              <span className={styles.user}>
                <Badge tone="neutral">{ROLE_LABEL[user.role] || user.role}</Badge>
                <span className={styles.username}>{user.username}</span>
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={onSignOut} iconLeft={<Icon name="logout" size={16} />}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
