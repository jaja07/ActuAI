# ActuAI — Backend (Orchestrator & Datalake)

This module is the core orchestration service of the **ActuAI** project. It
implements the full pipeline described in the project report: ETL ingestion from
the simulated SAP ERP, the multi-agent orchestration (Supervisor → Transactional
/ Investigative / Responder), the vector/RAG retrieval path, the Human-in-the-Loop
(HITL) validation API, and the security layer (auth, RBAC, DLP, prompt-injection
guardrails, hash-chained audit log).

## 🎯 Purpose

`actuai_backend` is the "brain" of ActuAI: a multi-agent system designed to
automate Non-Value-Added (NVA) administrative tasks in an aerospace Actuation
department (elecTRAS A350 context). It is responsible for:

1. **ETL ingestion** — pulling structured data from the simulated SAP ERP
   (`actuai_mock_data`) and unstructured data (emails, PDFs) into a local datalake.
2. **Agent orchestration** — routing each ingestion event (supplier email, client
   enquiry, ERP discrepancy, audit request) to a specialized agent
   (Supervisor → Transactional / Investigative / Responder).
3. **Human-in-the-Loop validation** — pausing every agent-drafted action (an SAP
   update, a client reply) and exposing it to a human expert via REST API before
   any write-back to the ERP.

For the full business case and target architecture, see the project report (`docs/`).

## 📂 Project Structure

```text
actuai_backend/
├── pyproject.toml          # Dependencies (uv workspace member)
├── Dockerfile              # Container image (uv + uvicorn, src/ layout)
├── pytest.ini / ruff.toml  # Test + lint config
├── README.md
├── tests/
│   └── test_actuai.py      # Sync test suite (SQLite + mock LLMs, no external deps)
└── src/
    ├── main.py                       # FastAPI application entrypoint
    ├── config.py                     # Central settings (pydantic-settings)
    ├── database/
    │   ├── connection.py               # SQLModel engine + init_db() + get_session()
    │   └── models.py                   # Datalake mirror + operational tables
    ├── etl/
    │   ├── sap_connector.py            # SAP BAPI -> PostgreSQL (class + functional API)
    │   ├── scheduler.py                # Threaded background ETL poller
    │   └── document_indexer.py         # PDF -> Qdrant RAG indexer
    ├── agents/                         # Orchestration + the five agents (subpackages)
    │   ├── graph.py                     # run_cycle: security -> route -> worker -> DLP -> HITL
    │   ├── state.py                     # Shared GlobalState schema
    │   ├── llm.py                       # One LLM interface (Ollama / Cloud / Mock)
    │   ├── security_agent/              # 1. L0 Security Agent (ingress front door)
    │   ├── supervisor/                  # 2. Supervisor (semantic router)
    │   ├── transactional/               # 3. Transactional agent (SQL tools, Missions 1-3)
    │   ├── investigative/               # 4. Investigative agent (RAG tools, Missions 4-5)
    │   │   └── retriever.py             #    Qdrant retriever (+ in-memory fallback)
    │   └── responder/                   # 5. Responder agent (client reply, Mission 1)
    ├── security/
    │   ├── auth.py                      # JWT + bcrypt + RBAC
    │   ├── guardrails.py                # Prompt-injection (ingress) + DLP (egress)
    │   └── audit.py                     # Append-only hash-chained audit log
    └── api/                             # REST surface for the frontend
        ├── dependencies.py
        ├── schemas.py
        └── routers/
            ├── triggers.py                 # Ingestion endpoints (email webhook)
            ├── hitl.py                     # Human-in-the-Loop validation endpoints
            ├── auth.py                     # Login
            └── health.py                   # /healthz, /readyz, /api/audit/verify
```

## ⚙️ Prerequisites and Installation

This project is a member of the **[uv](https://github.com/astral-sh/uv) workspace**
defined at the repository root (alongside `actuai_mock_data`).

1. **Environment variables** — copy the example file at the repository root and
   adjust as needed:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |---|---|
   | `DATABASE_URL_BACKEND` | Sync PostgreSQL DSN of the relational datalake (psycopg2). |
   | `QDRANT_URL` | URL of the Qdrant vector database (RAG / Investigative agent). |
   | `BAPI_BASE_URL` | Base URL of the mock SAP BAPI (default `http://localhost:8080`). |
   | `JWT_SECRET` | Secret used to sign access tokens (override in prod!). |
   | `USE_MOCK_LLM` | `true` runs deterministic stub models — no Ollama / cloud key needed. |
   | `ETL_AUTO_START` | `true` runs an initial SAP sync + background poller on boot. |

2. **Start the infrastructure** (PostgreSQL + Qdrant + mock SAP + backend):

   ```bash
   docker compose up -d --build
   ```

3. **Install dependencies** (from the repository root, where `uv.lock` lives):

   ```bash
   uv sync
   ```

## 🚀 Usage

> **Import convention.** Every module under `src/` uses imports rooted at `src`
> (e.g. `from database.connection import init_db`, `from agents.graph import run_cycle`).
> Run commands therefore use `src/` as the working directory / `PYTHONPATH`.
> This resolves the earlier inconsistency between `main.py` and `sap_connector.py`.

### 1. Run the FastAPI application

```bash
cd actuai_backend/src
uv run uvicorn main:app --reload --port 8000
```

* Health check: <http://localhost:8000/health> (or `/healthz`, `/readyz`)
* Interactive API docs: <http://localhost:8000/docs>
* Prometheus metrics: <http://localhost:8000/metrics>

Demo accounts seeded at startup: `expert/expert123` (engineer),
`buyer/buyer123`, `admin/admin123`, `auditor/auditor123`.

### 2. Run the ETL pipeline manually (SAP → PostgreSQL datalake)

Requires the mock SAP API running on `http://localhost:8080`.

```bash
cd actuai_backend/src
uv run python -m etl.sap_connector
```

This creates the datalake tables if needed and upserts purchase orders from
`GET /api/bapi/purchase-orders/` into the local `purchase_orders` table.

### 3. Index technical documents into Qdrant (RAG)

```bash
cd actuai_backend/src
uv run python -m etl.document_indexer
```

### 4. Run the tests

```bash
cd actuai_backend
USE_MOCK_LLM=true pytest -q
```

The suite uses SQLite + mock LLMs, so it needs no PostgreSQL, no Ollama and no
cloud key.

## 📊 Implementation status

| Layer (per project report) | Component | Status |
|---|---|---|
| Application Services | FastAPI app, `/health`+`/healthz`+`/readyz`, metrics, hardening middleware | ✅ Implemented |
| Data Layer | PostgreSQL datalake connection & models (orders, schedules, suppliers, deliveries, tasks, audit, emails) | ✅ Implemented |
| Integration Layer | SAP BAPI ETL connector (read sync + write-back) | ✅ Implemented |
| Integration Layer | Background ETL poller (`etl/scheduler.py`) | ✅ Implemented |
| Integration Layer | Email webhook ingestion router (`api/routers/triggers.py`) | ✅ Implemented |
| AI Agent Layer | Global State (`agents/state.py`) | ✅ Implemented |
| AI Agent Layer | Orchestration cycle (`agents/graph.py`) | ✅ Implemented |
| AI Agent Layer | Supervisor agent (semantic router) | ✅ Implemented |
| AI Agent Layer | Transactional agent (SQL tools, Missions 1-3) | ✅ Implemented |
| AI Agent Layer | Investigative agent (RAG tools, Missions 4-5) | ✅ Implemented |
| AI Agent Layer | Responder agent (client reply drafting) | ✅ Implemented |
| Data Layer | Vector store ingestion/indexing (Qdrant) | ✅ Implemented |
| Integration Layer | Human-in-the-Loop validation API (`api/routers/hitl.py`) | ✅ Implemented |
| Foundation Model Layer | Local Ollama / Cloud LLM wiring + deterministic mock | ✅ Implemented |
| Security & Governance Layer | Auth (JWT+RBAC), DLP, prompt-injection guardrails, hash-chained audit log | ✅ Implemented |

> The RAG path degrades gracefully: if Qdrant or its embedding dependencies are
> unavailable, the Investigative agent falls back to an in-memory retriever, so
> the system runs end-to-end with no extra services. Likewise, `USE_MOCK_LLM=true`
> swaps in deterministic stub models so no GPU / API key is required.

## 🔗 Integration with the rest of ActuAI

* **`actuai_mock_data`**: the simulated SAP BAPI (`GET/PUT/POST http://localhost:8080/api/bapi/...`)
  consumed by `etl/sap_connector.py`, plus the supplier emails/PDFs feeding the
  ingestion router and RAG pipeline.
* **PostgreSQL / Qdrant** (`docker-compose.yml` at the repo root): the local
  datalake this backend exclusively owns.
* **`actuai_frontend`**: the React Human-in-the-Loop dashboard, which consumes
  `/api/auth/login`, `/api/tasks` and `/api/tasks/{id}/approve|reject`. Its Vite
  dev server proxies `/api` to this backend on port 8000.

## 🧰 Tech stack

| Domain | Library |
|---|---|
| API | `fastapi`, `uvicorn`, `python-multipart` |
| Observability | `prometheus-client` |
| Agent orchestration | explicit graph (`agents/graph.py`); `langchain`/`langchain-community` for RAG |
| ORM / Relational database | `sqlmodel`, `psycopg2-binary` (PostgreSQL) |
| Vector database | `qdrant-client` |
| Embeddings | `sentence-transformers` |
| PDF parsing | `pypdf` |
| Security | `pyjwt`, `bcrypt` |
| Configuration | `pydantic-settings`, `python-dotenv` |
| HTTP client | `requests` |

Python ≥ 3.13 required (see `pyproject.toml`).
