// App.jsx — The Human-in-the-Loop validation dashboard.
//
// This is the screen described in the report's User Experience Layer. Its whole
// job: show the drafts the agents produced, and let a human approve or reject.
// Approving is the ONLY way a change reaches SAP.
//
// Flow:
//   1. log in -> get a JWT, keep it in memory (not localStorage — see note),
//   2. fetch the list of PENDING tasks,
//   3. show each draft with Approve / Reject buttons.
//
// Note on storage: we keep the token in React state only. Persisting JWTs in
// localStorage is a common XSS risk; for a real deploy use httpOnly cookies.

import { useState, useEffect } from "react";

const API = ""; // same origin, behind nginx

export default function App() {
  const [token, setToken] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(""); // success feedback after an action

  // --- login ---------------------------------------------------------------
  async function login(username, password) {
    setError("");
    try {
      const form = new URLSearchParams({ username, password });
      const res = await fetch(`${API}/api/auth/login`, { method: "POST", body: form });
      if (!res.ok) {
        // Surface the REAL reason instead of a generic message.
        const detail = await res.json().catch(() => ({}));
        setError(detail.detail || `Login failed (HTTP ${res.status})`);
        return;
      }
      const data = await res.json();
      setToken(data.access_token);
    } catch {
      // Network/proxy failure (e.g. backend not running on :8000).
      setError("Cannot reach the API — is the backend up on :8000?");
    }
  }

  // --- load pending tasks --------------------------------------------------
  async function loadTasks() {
    try {
      const res = await fetch(`${API}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        // Token expired/invalid: drop it and send the user back to login.
        setToken(null);
        setError("Session expired — please log in again.");
        return;
      }
      if (res.ok) setTasks(await res.json());
    } catch {
      setError("Cannot reach the API to load tasks.");
    }
  }

  // Reload tasks whenever we have a token (and every 10s after).
  useEffect(() => {
    if (!token) return;
    loadTasks();
    const id = setInterval(loadTasks, 10000);
    return () => clearInterval(id);
  }, [token]);

  // --- approve / reject ----------------------------------------------------
  async function decide(taskId, action) {
    setError("");
    setNotice("");
    try {
      const res = await fetch(`${API}/api/tasks/${taskId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setToken(null);
        setError("Session expired — please log in again.");
        return;
      }
      if (!res.ok) {
        // CRITICAL: never fail silently. A 403 (wrong role), 409 (needs triage)
        // or 502 (SAP write failed) must be shown; keep the task on screen.
        const detail = await res.json().catch(() => ({}));
        setError(detail.detail || `Action "${action}" failed (HTTP ${res.status})`);
        return;
      }
      setNotice(`Task ${taskId} ${action === "approve" ? "approved" : "rejected"}.`);
      loadTasks(); // refresh the queue
    } catch {
      setError(`Cannot reach the API to ${action} this task.`);
    }
  }

  if (!token) return <Login onLogin={login} error={error} />;

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>ActuAI — Validation dashboard</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {notice && <p style={{ color: "green" }}>{notice}</p>}
      <p>{tasks.length} draft(s) awaiting your review.</p>
      {tasks.map((t) => (
        <div key={t.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <strong>{t.mission} · {t.agent}</strong>
          <p>{t.summary}</p>
          <pre style={{ background: "#f5f5f5", padding: 8, fontSize: 12, overflowX: "auto" }}>
            {JSON.stringify(t.payload, null, 2)}
          </pre>
          <button onClick={() => decide(t.id, "approve")}>
            {t.kind === "EMAIL_REPLY" ? "Approve → send client reply" : "Approve → write to SAP"}
          </button>{" "}
          <button onClick={() => decide(t.id, "reject")}>Reject</button>
        </div>
      ))}
    </div>
  );
}

function Login({ onLogin, error }) {
  const [u, setU] = useState("expert");
  const [p, setP] = useState("expert123");
  return (
    <div style={{ maxWidth: 320, margin: "5rem auto", fontFamily: "system-ui" }}>
      <h2>ActuAI sign in</h2>
      <input value={u} onChange={(e) => setU(e.target.value)} placeholder="username" />
      <input value={p} onChange={(e) => setP(e.target.value)} type="password" placeholder="password" />
      <button onClick={() => onLogin(u, p)}>Log in</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
