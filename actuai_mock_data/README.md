# ActuAI - Mock Data Engine

This module is part of the global **ActuAI** project, a multi-agent architecture (LangGraph) designed to automate Non-Value-Added (NVA) tasks within an aerospace Actuation department (elecTRAS A350 context).

Since it is impossible to connect to real industrial production systems (data sovereignty, EN9100 standards), this sub-project acts as a **fake data generator and infrastructure simulator**. It provides the main project's ETL (Extract, Transform, Load) pipeline with a realistic environment to extract structured and unstructured data.

## 🎯 Features

The engine simulates the four main data sources of the Actuation department:

1. **SAP ERP (Fake BAPI API):** a RESTful API built with FastAPI and SQLModel (SQLite). It simulates the key industrial modules:
   - **MM (Material Management):** purchase orders (`PurchaseOrder`) and physical goods receipts (`GoodsReceipt`).
   - **PP (Production Planning):** the Airbus assembly line schedule (`ProductionSchedule`).
   - **QM (Quality Management):** non-conformance reports (`QualityNotification`).
2. **MS Exchange (Emails):** a generator simulating the daily flow of supplier emails (delays, shipments, 8D reports) sent over an HTTP webhook — either on demand or automatically in the background (see [Background simulation](#background-simulation--demo-trigger) below).
3. **Network Drives (Technical Documents):** generation of fake PDF files (material certificates, 8D reports, inspection records) to feed the vector database (RAG).
4. **Excel Files (Dashboards):** creation of `.xlsx` files simulating the weekly progress trackers shared by the teams.

All fake data is generated with [Faker](https://faker.readthedocs.io/) (`fr_FR` locale) and stays consistent across sources (the same part references and purchase order numbers are reused across the ERP, the PDFs, and the emails).

## 📂 Sub-Project Architecture

```text
actuai_mock_data/
├── pyproject.toml          # Sub-project dependencies (uv workspace)
├── requirements.txt        # Pinned dependencies for the Docker image (pip)
├── Dockerfile               # Fake SAP API image
├── README.md
├── __init__.py
├── config.py                # Pydantic validation of environment variables
├── sap_api/                 # SAP ERP simulation
│   ├── main.py               # FastAPI endpoints (CRUD + demo/background simulation)
│   ├── model.py               # Database schemas (SQLModel)
│   └── seeder.py               # Initial data seeding script
├── generators/               # Unstructured data generation scripts
│   ├── main.py                 # Orchestrator (excel + documents + emails)
│   ├── excel.py
│   ├── documents.py
│   └── emails.py
└── output/                   # Target folders, generated automatically
    ├── network_drives/
    └── excel_shares/
```

## ⚙️ Prerequisites and Installation

This project uses **[uv](https://github.com/astral-sh/uv)** as package and virtual environment manager, configured in *Workspace* mode from the global repository root (`actuai_mock_data` and `actuai_backend` are declared as members in the root `pyproject.toml`).

1. **Environment configuration**

   Create (or complete) the `.env` file at the global repository root with the following variables:

   ```env
   MOCK_NETWORK_DRIVE_DIR=./actuai_mock_data/output/network_drives
   MOCK_EXCEL_DIR=./actuai_mock_data/output/excel_shares
   DATABASE_URL=sqlite:///./sap_mock.db
   WEBHOOK_TARGET_URL=http://localhost:8000/api/v1/webhooks/exchange
   ```

   | Variable | Description |
   |---|---|
   | `MOCK_NETWORK_DRIVE_DIR` | Folder simulating the shared network drive where technical PDFs are dropped. |
   | `MOCK_EXCEL_DIR` | Folder simulating the network share where Excel dashboards are dropped. |
   | `DATABASE_URL` | SQLAlchemy URL of the SQLite database used by the fake SAP API. |
   | `WEBHOOK_TARGET_URL` | HTTP endpoint of the ETL/backend that simulated supplier emails are sent to. |

2. **Install dependencies**

   From the repository root (where `uv.lock` lives), sync **all workspace members** — a plain `uv sync` only installs the root project's own dependencies (which are empty) and skips `actuai_mock_data`/`actuai_backend`:

   ```bash
   uv sync --all-packages
   ```

## 🚀 Usage

The following commands must be run from the **global project root**, so that the `actuai_mock_data` package is resolvable.

### 1. Initialize and seed the SAP ERP (Seeding)

Before starting the API, the SQLite database must be created and filled with consistent business data (orders, NCRs, production schedule across 15 A350 part references).

```bash
uv run python -m actuai_mock_data.sap_api.seeder
```

⚠️ This script **resets** the database (`drop_all` then `create_all`) on every run.

### 2. Start the Fake SAP API (FastAPI)

Starts the local server exposing the endpoints for the ETL extractor.

```bash
uv run uvicorn actuai_mock_data.sap_api.main:app --reload --port 8080
```

* 📖 **Interactive docs (Swagger):** [http://localhost:8080/docs](http://localhost:8080/docs)

#### Available endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/bapi/purchase-orders/` | List all purchase orders. |
| `GET` | `/api/bapi/purchase-orders/{po_number}` | Detail of a single purchase order. |
| `GET` | `/api/bapi/goods-receipts/` | List all physical goods receipts. |
| `GET` | `/api/bapi/production-schedules/` | List the production schedule. |
| `GET` | `/api/bapi/quality-notifications/` | List the non-conformance reports (NCR). |
| `PUT` | `/api/bapi/purchase-orders/{po_number}/update-date` | Lets an agent push back a delivery date. |
| `POST` | `/api/bapi/quality-notifications/` | Lets an agent create an NCR in SAP. |
| `POST` | `/api/simulate/trigger-email` | Demo helper: immediately fires one simulated supplier email. |

#### Background simulation & demo trigger

On startup, `sap_api/main.py` schedules an `asyncio` background task (`periodic_email_sender`) that fires one random supplier email (via `generate_supplier_emails`) every 15 to 40 seconds, for as long as the API process is running — useful to demo a continuously "live" system without manually re-running the generators. The `POST /api/simulate/trigger-email` route does the same thing on demand, instantly, for presentations.

### 3. Generate the unstructured data flow

Runs the orchestration script that generates the Excel files, the technical PDFs, and simulates sending the email webhooks.

```bash
uv run python -m actuai_mock_data.generators.main
```

This script sequentially calls:
- `generate_weekly_dashboard()` → 1 `Suivi_Hebdo_Actuation.xlsx` file (15 rows by default) in `MOCK_EXCEL_DIR`.
- `generate_technical_documents()` → 10 PDFs (Material Certificate / 8D Report / Inspection Record) in `MOCK_NETWORK_DRIVE_DIR/Fournisseurs_Archives`.
- `generate_supplier_emails()` → 3 supplier emails sent as `POST` JSON to `WEBHOOK_TARGET_URL` (a message is printed to the console if the target backend isn't reachable).

*Generated files are available under the `output/` folder.*

## 🐳 Running with Docker

A dedicated image for the fake SAP API is provided (`Dockerfile`), based on `python:3.13-slim` and installed via `pip` from `requirements.txt` (independently of `uv`, to keep the container lightweight).

### Recommended: via the root `docker-compose.yml`

The `actuai-mock-data` service is wired into the global `docker-compose.yml` at the repository root, alongside the PostgreSQL/Qdrant datalake:

```bash
docker compose up -d actuai-mock-data
```

* The API is exposed on `http://localhost:8080`.
* The SQLite database is persisted in the named volume `mock_sqlite_data` (mounted at `/app/data`, with `DATABASE_URL` overridden in the compose file to point there) — data survives container restarts/recreations.
* Generated PDFs/Excel files are persisted in the named volume `mock_output_data` (mounted at `/app/output`), so they are not lost when the container is recreated and can later be shared with `actuai_backend`.
* The image bakes in default values for `DATABASE_URL`, `MOCK_NETWORK_DRIVE_DIR`, `MOCK_EXCEL_DIR`, and `WEBHOOK_TARGET_URL` (the latter defaults to `http://actuai-backend:8000/api/v1/webhooks/exchange`, anticipating the backend's future service name in the compose network) — all overridable via `environment:`.
* The seeder and generators are not run automatically; run them inside the running container on demand, e.g.:

  ```bash
  docker exec actuai-mock-data python -m sap_api.seeder
  docker exec actuai-mock-data python -m generators.main
  ```

### Standalone (without compose)

```bash
docker build -t actuai-mock-sap -f actuai_mock_data/Dockerfile .
docker run -p 8080:8080 actuai-mock-sap
```

With this approach, the SQLite database and generated files live only inside the container's writable layer and are lost when the container is removed — prefer the compose service above for anything beyond a quick manual test.

## 🔗 Integration with the main project (ActuAI Backend)

Once this mock is running, the main project (the ETL and the LangGraph agents) can:

* Query the `GET http://localhost:8080/api/bapi/...` routes to extract data and populate the PostgreSQL datalake.
* Read the PDF files generated under `output/network_drives/Fournisseurs_Archives/` to vectorize them via the embedding model (Qdrant).
* Read the Excel files generated under `output/excel_shares/` for manual operator tracking.
* Receive `POST` requests from the fake supplier emails on its own ingestion router (`WEBHOOK_TARGET_URL`).
* Use the `PUT`/`POST` routes of the fake API to simulate agents' corrective actions (pushing back a date, creating an NCR).

## 🧰 Tech Stack

| Domain | Library |
|---|---|
| REST API | `fastapi`, `uvicorn` |
| ORM / Database | `sqlmodel` (SQLite) |
| Data generation | `faker` |
| Excel files | `pandas`, `openpyxl` |
| PDF files | `fpdf2` |
| HTTP client (webhooks) | `requests` |
| Configuration | `pydantic-settings` |

Python ≥ 3.13 required (see `pyproject.toml`).
