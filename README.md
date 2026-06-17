# ✈️ ActulA: Aerospace Production Workflow Automation

## 📖 Project Overview
ActulA is a secure, multi-agent artificial intelligence system designed to automate Non-Value Added (NVA) administrative tasks within a highly regulated aerospace Actuation service. Operating under strict EN9100 compliance constraints, the application bridges the gap between unstructured communication (e.g., supplier emails) and rigid enterprise resource planning (ERP) systems (such as SAP).

## 🎯 Automated Service Missions

The Actuation service acts as the operational backbone for thrust reverser manufacturing. ActulA aims to streamline the following five core missions by eliminating manual data entry, double-checking, and scattered information retrieval:

1. **Component Supply Chain Monitoring:** Automating the extraction of delivery statuses, delays, and tracking information from daily supplier emails to continuously update the ERP system without double data entry.
2. **Production Schedule Coordination:** Proactively monitoring discrepancies between predicted ERP delivery dates and actual supplier updates to flag potential assembly line blockages before they impact production.
3. **Quality and Non-Conformance Management:** Automatically pre-filling Non-Conformance Reports (NCR/FNC) and tracking 8D corrective action reports by retrieving existing metadata directly from the ERP, significantly reducing manual drafting time.
4. **Technical Documentation Control:** Streamlining the compilation and version control of mandatory manufacturing records by aggregating data spread across network drives, ERPs, and email archives.
5. **End-to-End Component Traceability:** Creating a unified, instantly searchable context that reconstitutes the complete history of a component from initial order to final integration, fulfilling strict aerospace traceability requirements.

## 🛠️ Core Tech Stack
* **Agent Orchestration:** LangGraph
* **Backend Framework:** FastAPI 
* **Environment Validation:** Pydantic Settings
* **Dependency Management:** uv
* **Data Storage:** PostgreSQL & Vector Database (for semantic search)
* **Deployment:** Docker