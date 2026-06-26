# ✈️ ActuAI: Aerospace Production Workflow Automation

## 📖 Project Overview
ActuAI is a secure, multi-agent AI system that automates the Non-Value Added (NVA) administrative work of an aerospace **Actuation service** (customer relations / supply chain). Operating under strict **EN9100 / AS9100** compliance, it bridges unstructured communication (supplier and customer emails) and rigid ERP systems (SAP).

Every action the AI proposes is validated by a human before execution — the **Human-in-the-Loop (HITL)** principle: *the AI proposes, the human decides*. The system is designed to run **on-premise** for data sovereignty.

## 🎯 Automated Missions
The Actuation service is the operational backbone for thrust-reverser manufacturing. ActuAI covers **five core business missions**, plus a customer-reply function, each handled by a dedicated agent:

| # | Mission | Agent | Action drafted |
|---|---------|-------|----------------|
| **M1** | Supply-Chain Monitoring | Transactional | Update delivery date/status in SAP |
| **M2** | Production Scheduling | Transactional | Cross-check delay vs assembly-line date → flag AOG risk |
| **M3** | Quality / Non-Conformance | Transactional | Pre-fill a Non-Conformance Report (FNC/NCR) in SAP |
| **M4** | Technical Documentation Control | Investigative | Retrieve the latest correct document version (RAG) |
| **M5** | Component Traceability | Investigative | Reconstruct history + verify serial number vs SAP |
| **M6** | Customer Reply | Responder | Draft a reply to a client delivery enquiry |

Before any of this, an **L0 Security Agent** filters every incoming email and blocks prompt-injection / malicious content (fail-closed).

## 🧠 How it works
```
Email ─▶ L0 Security ─▶ Supervisor (semantic router) ─▶ Specialist agent
      └▶ blocked                                        (Transactional / Investigative / Responder)
                                                                │
                                                     draft ─▶ HITL queue ─▶ human approves ─▶ executed in SAP
```
Nothing reaches SAP without human approval. Every decision is recorded in a hash-chained audit log; access is role-based (RBAC/JWT).

## 🛠️ Tech Stack
* **Multi-agent orchestration:** graph-based supervisor routing (`agents/graph.py`, `run_cycle`)
* **Backend & API:** FastAPI, SQLModel, Pydantic
* **Frontend:** React + Vite (Human-in-the-Loop dashboard)
* **Data:** PostgreSQL (structured) & Qdrant (vector DB for RAG)
* **LLM:** local (Ollama) or cloud, with a mock mode for offline demos
* **Dependency management:** `uv` (monorepo workspace)
* **Deployment:** Docker & Docker Compose + nginx reverse proxy

## 📂 Repository Structure
```text
ActuAI/
├── docker-compose.yml          # Full stack: databases + services + nginx proxy
├── pyproject.toml / uv.lock     # uv workspace
├── nginx/                       # Reverse proxy (single entry point on port 80)
├── monitoring/                  # Prometheus + Grafana config (observability)
├── scripts/                     # Demo & integration tooling (see below)
├── docs/                        # Architecture diagrams & implementation notes
│
├── actuai_mock_data/            # 🏭 Simulated SAP ERP (BAPI) + fake emails/docs
├── actuai_backend/              # 🧠 ETL, DB connectors, agents, security, API
│   └── src/agents/              #    security_agent · supervisor · transactional
│                                #    · investigative (+retriever) · responder
└── actuai_frontend/             # 💻 React HITL dashboard (AppShell, TaskStrip, ui/)
```

---

## 🚀 Quick Start (Docker — recommended)
The whole system starts with one command and is reachable on a single URL.

```bash
git clone https://github.com/jaja07/ActuAI.git
cd ActuAI
cp .env.example .env          # default values are fine for a demo
docker compose up -d
```
Wait ~25 s, then check the 6 services are healthy:
```bash
docker compose ps
curl http://localhost/healthz   # -> {"status":"ok"}
```

**Open the app:** http://localhost  → log in with **`expert / expert123`**.

Services started: `actuai-postgres`, `actuai-qdrant`, `actuai-mock-data` (:8080), `actuai-backend` (:8000), `actuai-frontend`, `actuai-proxy` (:80). The mock SAP is seeded and the datalake (purchase orders + production schedules) is synced automatically on startup.

---

## ✅ End-to-End Test / Demo
Run the narrated simulator — it plays the security block + all five missions and verifies the real SAP side effects:

```bash
uv run --with requests python scripts/demo_e2e.py
```
Expected: `M1 → M5` all `executed`, the SAP delivery date updated, and an FNC created.

**Other demo tooling (in `scripts/`):**
* `auto_arrivals.ps1` — continuously injects emails so the HITL queue fills itself (great for a live demo).
* `mail_connector.py` (+ `MAIL_CONNECTOR_SETUP_FR.md`) — a **real email connector** via Microsoft Graph (OAuth 2.0) that reads an Outlook mailbox and forwards new mail to the app.

To exercise all six functions manually (security + M1–M6), POST emails to `/api/ingest/email`; see `scripts/demo_e2e.py` for ready-made payloads.

---

## ⚙️ Local Development (without Docker)
Uses **[uv](https://github.com/astral-sh/uv)** for fast dependency management.

**Prerequisites:** Python ≥ 3.13, `uv`, and Docker (for PostgreSQL/Qdrant).

```bash
uv sync                        # creates .venv at the root, installs all sub-projects
docker compose up -d actuai-postgres actuai-qdrant   # just the databases
```

**A. SAP Mock API** (run from the repo root so paths resolve):
```bash
uv run python -m actuai_mock_data.sap_api.seeder
uv run uvicorn actuai_mock_data.sap_api.main:app --port 8080 --reload
```

**B. Backend** (agent orchestration + ETL):
```bash
cd actuai_backend/src
uv run uvicorn main:app --port 8000 --reload
# one-time datalake sync (purchase orders + production schedules):
uv run python -m etl.sap_connector
```

**C. Frontend:**
```bash
cd actuai_frontend
npm install
npm run dev      # Vite dev server; the proxy forwards /api to the backend
```

* Qdrant dashboard: `http://localhost:6333/dashboard`

---

## 🔐 Security & Compliance
* **L0 ingress guardrail** against prompt injection (fail-closed).
* **HITL validation** on every action — nothing is sent or written without approval.
* **Hash-chained audit log** of all decisions; **RBAC + JWT** access control; basic **DLP** on outputs.
* Aligned with **EN9100 / AS9100** traceability requirements.

## 📝 Notes
* `sap_mock.db` is a generated database; the mock recreates it on every startup (drop → create → seed).
* Tip for live demos: do **not** run `docker compose down -v` between injecting emails and approving them, otherwise the mock regenerates new POs and older tasks point to missing orders.
