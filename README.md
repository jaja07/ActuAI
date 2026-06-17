# ✈️ ActuAI: Aerospace Production Workflow Automation

## 📖 Project Overview
ActuAI is a secure, multi-agent artificial intelligence system designed to automate Non-Value Added (NVA) administrative tasks within a highly regulated aerospace Actuation service. Operating under strict EN9100 compliance constraints, the application bridges the gap between unstructured communication (e.g., supplier emails) and rigid enterprise resource planning (ERP) systems (such as SAP).

To guarantee data sovereignty and confidentiality, the core of the system is designed to run On-Premise (Edge Infrastructure) with "Human-in-the-Loop" (HITL) validation checkpoints.

## 🎯 Automated Service Missions
The Actuation service acts as the operational backbone for thrust reverser manufacturing. ActuAI aims to streamline the following five core missions by eliminating manual data entry, double-checking, and scattered information retrieval:

1. **Component Supply Chain Monitoring:** Automating the extraction of delivery statuses, delays, and tracking information from daily supplier emails to continuously update the ERP system without double data entry.
2. **Production Schedule Coordination:** Proactively monitoring discrepancies between predicted ERP delivery dates and actual supplier updates to flag potential assembly line blockages before they impact production.
3. **Quality and Non-Conformance Management:** Automatically pre-filling Non-Conformance Reports (NCR/FNC) and tracking 8D corrective action reports by retrieving existing metadata directly from the ERP, significantly reducing manual drafting time.
4. **Technical Documentation Control:** Streamlining the compilation and version control of mandatory manufacturing records by aggregating data spread across network drives, ERPs, and email archives.
5. **End-to-End Component Traceability:** Creating a unified, instantly searchable context that reconstitutes the complete history of a component from initial order to final integration, fulfilling strict aerospace traceability requirements.

## 🛠️ Core Tech Stack
* **Agent Orchestration:** LangGraph & LangChain
* **Backend & API:** FastAPI, SQLModel, Pydantic
* **Frontend UI:** React (Human-in-the-loop Dashboard)
* **Dependency Management:** uv (Monorepo Workspace)
* **Data Storage:** PostgreSQL (Structured Data) & Qdrant (Vector Database for RAG)
* **Deployment:** Docker & Docker Compose

---

## 📂 Repository Structure (Monorepo)

The project is structured as a Monorepo managed by `uv` workspaces, containing three decoupled microservices:

```text
ActuAI/
├── pyproject.toml              # Global workspace configuration
├── uv.lock                     # Global dependency lockfile
├── .env                        # Global environment variables
├── docker-compose.yml          # Infrastructure orchestration (Databases)
│
├── actuai_mock_data/           # 🏭 MODULE 1: Industrial Simulation
│   # Simulates the air-gapped SAP ERP (BAPI) and generates unstructured 
│   # supplier emails, Excel dashboards, and PDF technical documents.
│
├── actuai_backend/             # 🧠 MODULE 2: Core Logic & AI Orchestration
│   # Contains the ETL pipelines, the PostgreSQL/Qdrant connectors, 
│   # and the LangGraph Multi-Agent system (Supervisor, Transactional, Investigative).
│
└── actuai_frontend/            # 💻 MODULE 3: User Interface (WIP)
    # A comprehensive React-based frontend providing the Human-in-the-Loop 
    # validation dashboard for aerospace experts to review AI-drafted actions.

```

---

## ⚙️ Installation & Local Development

We use **[uv](https://github.com/astral-sh/uv)** for ultra-fast dependency management and virtual environment resolution across the entire workspace.

### 1. Prerequisites

* Python >= 3.13
* Docker & Docker Compose
* `uv` package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### 2. Initial Setup

Clone the repository and set up your environment variables:

```bash
git clone <repository_url>
cd ActuAI
cp .env.example .env  # Ensure you configure your local paths and API keys

```

Synchronize the entire workspace. This single command will create the `.venv` at the root and install dependencies for all sub-projects:

```bash
uv sync

```

### 3. Launching the Local Infrastructure (Datalake)

Before running the applications, start the backend databases (PostgreSQL and Qdrant vector store):

```bash
docker compose up -d

```

* *Qdrant Dashboard available at: `http://localhost:6333/dashboard*`

### 4. Running the Microservices for Development

**A. Start the SAP Mock API:**

```bash
uv run uvicorn actuai_mock_data.sap_api.main:app --port 8080 --reload

```

* *Generate initial fake documents/emails:* `uv run python actuai_mock_data/generators/main.py`

**B. Start the Backend (LangGraph & ETL):**

```bash
# In a new terminal tab
uv run uvicorn actuai_backend.src.main:app --port 8000 --reload

```

**C. Start the Frontend (Coming Soon):**

```bash
# In a new terminal tab
cd actuai_frontend
npm run dev

```

---

## 🐳 Full Docker Deployment

For staging or production-like environments, the entire system (Databases + Microservices) can be spun up using Docker.

*(Note: Dockerfiles for the backend and frontend are actively being integrated into the global compose network).*

```bash
docker compose -f docker-compose.prod.yml up --build -d

```