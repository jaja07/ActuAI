// components/TaskList.jsx — the validation queue.
//
// Renders the four states a real data view must handle, each deliberately:
//   • loading  -> skeleton strips (layout-stable, announced via role=status)
//   • error    -> Alert with a retry action
//   • empty    -> EmptyState ("queue clear") with a refresh
//   • ready    -> the list of TaskStrips
//
// The queue is a <ul> of <li> strips for correct list semantics.

import { Card, Alert, Skeleton, EmptyState, Button, Icon, Spinner } from "./ui";
import TaskStrip from "./TaskStrip.jsx";
import styles from "./TaskList.module.css";

function StripSkeleton() {
  return (
    <Card as="li" className={styles.skelStrip}>
      <Skeleton width="38%" height={14} />
      <Skeleton width="90%" height={12} />
      <Skeleton width="70%" height={12} />
      <div className={styles.skelActions}>
        <Skeleton width={150} height={36} radius="var(--radius-md)" />
        <Skeleton width={96} height={36} radius="var(--radius-md)" />
      </div>
    </Card>
  );
}

export default function TaskList({ status, tasks, error, deciding, onDecide, onRefresh, refreshing }) {
  return (
    <section aria-label="Validation queue">
      <header className={styles.bar}>
        <div>
          <p className="eyebrow">Validation queue</p>
          <h2 className={styles.count}>
            {status === "ready"
              ? `${tasks.length} draft${tasks.length === 1 ? "" : "s"} awaiting review`
              : status === "loading"
              ? "Loading queue…"
              : "Queue"}
          </h2>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          iconLeft={refreshing ? <Spinner size={14} inline /> : <Icon name="refresh" size={15} />}
        >
          Refresh
        </Button>
      </header>

      {status === "loading" && (
        <ul className={styles.list} role="status" aria-label="Loading tasks">
          <StripSkeleton />
          <StripSkeleton />
          <StripSkeleton />
        </ul>
      )}

      {status === "error" && (
        <Alert tone="danger" title="Couldn't load the queue">
          {error}{" "}
          <button className={styles.retry} onClick={onRefresh}>Try again</button>
        </Alert>
      )}

      {status === "ready" && tasks.length === 0 && (
        <Card>
          <EmptyState
            icon="check"
            title="Queue clear"
            description="Every agent draft has been reviewed. New supplier emails and ERP discrepancies will appear here automatically."
            action={
              <Button variant="secondary" size="sm" onClick={onRefresh} iconLeft={<Icon name="refresh" size={15} />}>
                Check again
              </Button>
            }
          />
        </Card>
      )}

      {status === "ready" && tasks.length > 0 && (
        <ul className={styles.list}>
          {tasks.map((t) => (
            <TaskStrip
              key={t.id}
              task={t}
              busy={deciding.has(t.id)}
              onApprove={() => onDecide(t.id, "approve")}
              onReject={() => onDecide(t.id, "reject")}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
