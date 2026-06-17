# ActuAI - Backend (Orchestrator & Datalake)

This module is the core orchestration service of the **ActuAI** project. Only the data-ingestion foundations (PostgreSQL datalake + SAP ETL connector + a minimal FastAPI shell) are implemented so far. The multi-agent orchestration (LangGraph), the vector/RAG pipeline, the Human-in-the-Loop (HITL) API, and the security layer described in the project report are **not implemented yet** — see [Implementation status](#-implementation-status) below.

## 🎯 Purpose

`actuai_backend` is the "brain" of ActuAI: a multi-agent system (LangGraph) designed to automate Non-Value-Added (NVA) administrative tasks in an aerospace Actuation department (elecTRAS A350 context). It is responsible for:

1. **ETL ingestion** — pulling structured data from the simulated SAP ERP (`actuai_mock_data`) and unstructured data (emails, PDFs, Excel) into a local datalake.
2. **Agent orchestration** — routing each ingestion event (supplier email, ERP discrepancy, audit request) to a specialized LangGraph agent (Supervisor → Transactional or Investigative).
3. **Human-in-the-Loop validation** — pausing every agent-drafted action (an SAP update, a drafted FNC/8D report) and exposing it to a human expert via REST API before any write-back to the ERP.

For the full business case and target architecture, see the project report (`docs/`).

## 📂 Project Structure

```text
actuai_backend/
├── pyproject.toml          # Dependencies (uv workspace member)
├── README.md
└── src/
    ├── main.py                       # FastAPI application entrypoint
    ├── database/
    │   ├── connection.py               # SQLModel engine + init_db() (PostgreSQL datalake)
    │   └── models.py                    # Datalake mirror tables (PurchaseOrder, ProductionSchedule)
    ├── etl/
    │   └── sap_connector.py            # Extracts data from the mock SAP BAPI and upserts it into PostgreSQL
    ├── agents/                         # LangGraph orchestration (not implemented — empty scaffolding)
    │   ├── graph.py                      # Supervisor / Transactional / Investigative graph definition
    │   ├── state.py                       # Shared Global State schema
    │   ├── supervisor/                     # Semantic router agent
    │   ├── transactional/                  # SQL-tools agent (Missions 1-3)
    │   └── investigative/                  # RAG-tools agent (Missions 4-5)
    └── api/                             # REST surface for the frontend (not implemented — empty scaffolding)
        ├── dependencies.py
        ├── schemas.py
        └── routers/
            ├── triggers.py                 # Ingestion endpoints (emails, ERP discrepancies)
            └── hitl.py                      # Human-in-the-Loop validation endpoints
```

## ⚙️ Prerequisites and Installation

This project is a member of the **[uv](https://github.com/astral-sh/uv) workspace** defined at the repository root (alongside `actuai_mock_data`).

1. **Environment variables**

   Set the following in the global `.env` file at the repository root:

   ```env
   DATABASE_URL_BACKEND=postgresql://actuai_user:actuai_password@localhost:5432/actuai_db
   QDRANT_URL=http://localhost:6333
   ```

   | Variable | Description |
   |---|---|
   | `DATABASE_URL_BACKEND` | PostgreSQL connection string for the relational datalake (mirrors SAP metadata). |
   | `QDRANT_URL` | URL of the Qdrant vector database, used for the future RAG/Investigative agent. |

2. **Start the datalake infrastructure**

   PostgreSQL and Qdrant are defined in the root `docker-compose.yml`:

   ```bash
   docker compose up -d
   ```

3. **Install dependencies**

   From the repository root (where `uv.lock` lives):

   ```bash
   uv sync
   ```

## 🚀 Usage

### 1. Run the ETL pipeline (SAP → PostgreSQL datalake)

Requires the mock SAP API (`actuai_mock_data`) to be running on `http://localhost:8080` (see that module's README).

```bash
uv run python -m actuai_backend.src.etl.sap_connector
```

This creates the datalake tables if needed and upserts purchase orders from `GET /api/bapi/purchase-orders/` into the local `purchase_orders` table.

### 2. Run the FastAPI application

```bash
cd actuai_backend/src
uv run uvicorn main:app --reload --port 8000
```

* Health check: [http://localhost:8000/health](http://localhost:8000/health)

⚠️ `src/main.py` currently uses unqualified imports (`from api.routers import triggers`, `from database.connection import init_db`), so it must be run with `src/` as the working directory / on `PYTHONPATH`, unlike `etl/sap_connector.py` which uses fully qualified `actuai_backend.src...` imports. This inconsistency will be resolved once the package layout is finalized.

## 📊 Implementation status

| Layer (per project report) | Component | Status |
|---|---|---|
| Application Services | FastAPI app shell, `/health` endpoint | ✅ Implemented |
| Data Layer | PostgreSQL datalake connection & mirror models (`PurchaseOrder`, `ProductionSchedule`) | ✅ Implemented |
| Integration Layer | SAP BAPI ETL connector (`extract_and_load_purchase_orders`) | ✅ Implemented |
| Integration Layer | Goods receipts / Quality notifications ETL | ❌ Not implemented |
| Integration Layer | Email webhook ingestion router (`api/routers/triggers.py`) | ❌ Empty scaffolding |
| AI Agent Layer | Global State (`agents/state.py`) | ❌ Empty scaffolding |
| AI Agent Layer | LangGraph graph wiring (`agents/graph.py`) | ❌ Empty scaffolding |
| AI Agent Layer | Supervisor agent (semantic router) | ❌ Empty scaffolding |
| AI Agent Layer | Transactional agent (SQL tools, Missions 1-3) | ❌ Empty scaffolding |
| AI Agent Layer | Investigative agent (RAG tools, Missions 4-5) | ❌ Empty scaffolding |
| Data Layer | Vector store ingestion/indexing (Qdrant) | ❌ Not implemented |
| Integration Layer | Human-in-the-Loop validation API (`api/routers/hitl.py`) | ❌ Empty scaffolding |
| Foundation Model Layer | Local Ollama (Llama 3.1 8B) / Cloud LLM (Mistral, Llama 70B) wiring | ❌ Not implemented |
| Security & Governance Layer | Authentication, authorization, DLP, audit log | ❌ Not implemented |

## 🔗 Integration with the rest of ActuAI

* **`actuai_mock_data`**: provides the simulated SAP BAPI (`GET/PUT/POST http://localhost:8080/api/bapi/...`) consumed by `etl/sap_connector.py`, plus the supplier emails, PDFs, and Excel dashboards intended to feed the (future) ingestion router and RAG pipeline.
* **PostgreSQL / Qdrant** (`docker-compose.yml` at the repo root): the local datalake this backend exclusively owns — no other service should access these databases directly.
* **`actuai_frontend`** (separate, not in this repository yet): the planned React Human-in-the-Loop dashboard, which will consume the `api/routers/hitl.py` endpoints once implemented.

## 🧰 Tech stack

| Domain | Library |
|---|---|
| API | `fastapi` |
| Agent orchestration (planned) | `langchain`, `langchain-community` (LangGraph to be added) |
| ORM / Relational database | `sqlmodel`, `psycopg2-binary` (PostgreSQL) |
| Vector database (planned) | `qdrant-client` |
| Embeddings (planned) | `sentence-transformers` |
| PDF parsing (planned) | `pypdf` |
| Configuration | `pydantic-settings`, `python-dotenv` |
| HTTP client | `requests` |

Python ≥ 3.13 required (see `pyproject.toml`).
