// hooks/useTasks.js — load and poll the validation queue.
//
// Returns an explicit state machine the UI can render directly:
//   { tasks, status, error, refresh, deciding, decide }
//   status: "loading" (first load) | "ready" | "error"
//
// `decide(id, action)` optimistically removes the row and calls the API;
// on failure it restores the row and surfaces the error via the toast channel
// passed by the caller. Polling pauses while a decision is in flight to avoid
// the row flickering back in.

import { useCallback, useEffect, useRef, useState } from "react";
import { listTasks, decideTask } from "../lib/api.js";

export function useTasks({ token, onSessionExpired, toast, pollMs = 10000 }) {
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [deciding, setDeciding] = useState(() => new Set());
  const busyRef = useRef(false);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!token || busyRef.current) return;
      if (!silent) setStatus((s) => (s === "ready" ? s : "loading"));
      try {
        const data = await listTasks(token);
        setTasks(data);
        setError("");
        setStatus("ready");
      } catch (e) {
        if (e.status === 401) return onSessionExpired?.();
        setError(e.message);
        setStatus((s) => (s === "ready" ? s : "error"));
        toast?.error(e.message);
      }
    },
    [token, onSessionExpired, toast]
  );

  // Initial load + polling.
  useEffect(() => {
    if (!token) return;
    refresh();
    const id = setInterval(() => refresh({ silent: true }), pollMs);
    return () => clearInterval(id);
  }, [token, refresh, pollMs]);

  const decide = useCallback(
    async (id, action) => {
      if (deciding.has(id)) return;
      busyRef.current = true;
      setDeciding((s) => new Set(s).add(id));

      const prev = tasks;
      const verbDone = action === "approve" ? "approved" : "rejected";
      try {
        await decideTask(token, id, action);
        setTasks((list) => list.filter((t) => t.id !== id)); // remove on success
        toast?.success(`Task #${id} ${verbDone}.`);
      } catch (e) {
        if (e.status === 401) return onSessionExpired?.();
        setTasks(prev); // restore: the task is still pending
        toast?.error(e.message);
      } finally {
        setDeciding((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
        busyRef.current = false;
      }
    },
    [deciding, tasks, token, toast, onSessionExpired]
  );

  return { tasks, status, error, refresh, deciding, decide };
}
