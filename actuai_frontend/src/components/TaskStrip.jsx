// components/TaskStrip.jsx — one agent draft, as a simple review card.
//
// A calm, plain card: what the agent proposes (mission + kind + summary) and
// two clear actions. Approving is the only path that reaches SAP or sends a
// client reply.

import { Card, Badge, Button, Icon } from "./ui";
import styles from "./TaskStrip.module.css";

const KIND = {
  SAP_UPDATE: { label: "SAP update", icon: "database", approve: "Approve" },
  EMAIL_REPLY: { label: "Client reply", icon: "mail", approve: "Approve & send" },
  SCHEDULE_ALERT: { label: "Production alert", icon: "alert", approve: "Acknowledge" },
  FNC_CREATE: { label: "Non-conformity (FNC)", icon: "alert", approve: "Approve & create FNC" },
  DOC_LOOKUP: { label: "Document lookup", icon: "inbox", approve: "Acknowledge" },
  TRACE_REPORT: { label: "Traceability", icon: "shield", approve: "Acknowledge" },
};

export default function TaskStrip({ task, busy, onApprove, onReject }) {
  const kind = KIND[task.kind] || { label: task.kind, icon: "shield", approve: "Approve" };

  return (
    <Card as="li" className={styles.strip}>
      <div className={styles.head}>
        <span className={styles.meta}>
          {task.mission} · {task.agent}
        </span>
        <Badge tone="info">
          <Icon name={kind.icon} size={12} /> {kind.label}
        </Badge>
      </div>

      <p className={styles.summary}>{task.summary}</p>

      <div className={styles.actions}>
        <Button variant="primary" loading={busy} onClick={onApprove}
          iconLeft={<Icon name="check" size={16} />}>
          {kind.approve}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onReject}>
          Reject
        </Button>
      </div>
    </Card>
  );
}
