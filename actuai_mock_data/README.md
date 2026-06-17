# ActuAI - Mock Data Engine

Ce module fait partie du projet global **ActuAI**, une architecture multi-agents (LangGraph) conçue pour automatiser les tâches à Non-Valeur Ajoutée (NVA) au sein d'un service d'Actuation aéronautique (contexte : elecTRAS A350).

Étant donné l'impossibilité de se connecter aux systèmes de production industriels réels (souveraineté des données, normes EN9100), ce sous-projet agit comme un **générateur de données factices et un simulateur d'infrastructures**. Il fournit à l'ETL (Extract, Transform, Load) du projet principal un environnement réaliste pour extraire des données structurées et non structurées.

## 🎯 Fonctionnalités

Le moteur simule les quatre sources de données principales du service Actuation :

1. **SAP ERP (API BAPI Factice) :** une API RESTful développée avec FastAPI et SQLModel (SQLite). Elle simule les modules industriels clés :
   - **MM (Material Management) :** commandes d'achat (`PurchaseOrder`) et réceptions physiques (`GoodsReceipt`).
   - **PP (Production Planning) :** planning de la ligne d'assemblage Airbus (`ProductionSchedule`).
   - **QM (Quality Management) :** fiches de non-conformité (`QualityNotification`).
2. **MS Exchange (Emails) :** un générateur simulant le flux quotidien d'emails fournisseurs (retards, expéditions, rapports 8D) envoyés par webhook HTTP.
3. **Disques Réseau (Documents Techniques) :** génération de fichiers PDF factices (Certificats matière, Rapports 8D, PV de contrôle) pour alimenter la base vectorielle (RAG).
4. **Fichiers Excel (Tableaux de bord) :** création de fichiers `.xlsx` simulant les suivis d'avancement hebdomadaires partagés par les équipes.

Toutes les données factices sont générées avec [Faker](https://faker.readthedocs.io/) (locale `fr_FR`) et restent cohérentes entre elles (mêmes références pièces, mêmes numéros de commande à travers l'ERP, les PDF et les emails).

## 📂 Architecture du Sous-Projet

```text
actuai_mock_data/
├── pyproject.toml          # Dépendances du sous-projet (workspace uv)
├── requirements.txt        # Dépendances figées pour l'image Docker (pip)
├── Dockerfile               # Image de l'API SAP factice
├── README.md
├── __init__.py
├── config.py                # Validation Pydantic des variables d'environnement
├── sap_api/                 # Simulation de l'ERP SAP
│   ├── main.py               # Endpoints FastAPI (CRUD)
│   ├── model.py               # Schémas de la base de données (SQLModel)
│   └── seeder.py               # Script d'injection des données initiales
├── generators/               # Scripts de génération de données non-structurées
│   ├── main.py                 # Orchestrateur (excel + documents + emails)
│   ├── excel.py
│   ├── documents.py
│   └── emails.py
└── output/                   # Dossiers cibles générés automatiquement
    ├── network_drives/
    └── excel_shares/
```

## ⚙️ Prérequis et Installation

Ce projet utilise **[uv](https://github.com/astral-sh/uv)** comme gestionnaire de paquets et d'environnements virtuels, configuré en mode *Workspace* depuis la racine du dépôt global (`actuai_mock_data` et `actuai_backend` sont déclarés comme membres dans le `pyproject.toml` racine).

1. **Configuration de l'environnement**

   Créez (ou complétez) le fichier `.env` à la racine globale du projet avec les variables suivantes :

   ```env
   MOCK_NETWORK_DRIVE_DIR=./actuai_mock_data/output/network_drives
   MOCK_EXCEL_DIR=./actuai_mock_data/output/excel_shares
   DATABASE_URL=sqlite:///./sap_mock.db
   WEBHOOK_TARGET_URL=http://localhost:8000/api/v1/webhooks/exchange
   ```

   | Variable | Description |
   |---|---|
   | `MOCK_NETWORK_DRIVE_DIR` | Dossier simulant le disque réseau partagé où sont déposés les PDF techniques. |
   | `MOCK_EXCEL_DIR` | Dossier simulant le partage réseau où sont déposés les tableaux de bord Excel. |
   | `DATABASE_URL` | URL SQLAlchemy de la base SQLite utilisée par l'API SAP factice. |
   | `WEBHOOK_TARGET_URL` | Endpoint HTTP de l'ETL/backend vers lequel les emails fournisseurs simulés sont envoyés. |

2. **Installation des dépendances**

   Depuis la racine du projet (où se trouve `uv.lock`) :

   ```bash
   uv sync
   ```

## 🚀 Utilisation

Les commandes suivantes doivent être exécutées depuis la **racine du projet global**, afin que le package `actuai_mock_data` soit résolvable.

### 1. Initialiser et peupler l'ERP SAP (Seeding)

Avant de lancer l'API, il faut créer la base de données SQLite et la remplir avec des données métier cohérentes (commandes, FNC, planning de production sur 15 références pièces A350).

```bash
uv run python -m actuai_mock_data.sap_api.seeder
```

⚠️ Ce script **réinitialise** la base de données (`drop_all` puis `create_all`) à chaque exécution.

### 2. Lancer l'API SAP Factice (FastAPI)

Démarre le serveur local qui expose les points de terminaison pour l'Extracteur ETL.

```bash
uv run uvicorn actuai_mock_data.sap_api.main:app --reload --port 8080
```

* 📖 **Documentation interactive (Swagger) :** [http://localhost:8080/docs](http://localhost:8080/docs)

#### Endpoints disponibles

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/bapi/purchase-orders/` | Liste toutes les commandes d'achat. |
| `GET` | `/api/bapi/purchase-orders/{po_number}` | Détail d'une commande d'achat. |
| `GET` | `/api/bapi/goods-receipts/` | Liste toutes les réceptions physiques. |
| `GET` | `/api/bapi/production-schedules/` | Liste le planning de production. |
| `GET` | `/api/bapi/quality-notifications/` | Liste les fiches de non-conformité (FNC). |
| `PUT` | `/api/bapi/purchase-orders/{po_number}/update-date` | Permet à un agent de repousser une date de livraison. |
| `POST` | `/api/bapi/quality-notifications/` | Permet à un agent de créer une FNC dans SAP. |

### 3. Générer le flux de données non-structurées

Lance le script d'orchestration qui génère les fichiers Excel, les PDF techniques et simule l'envoi des webhooks emails.

```bash
uv run python -m actuai_mock_data.generators.main
```

Ce script appelle séquentiellement :
- `generate_weekly_dashboard()` → 1 fichier `Suivi_Hebdo_Actuation.xlsx` (15 lignes par défaut) dans `MOCK_EXCEL_DIR`.
- `generate_technical_documents()` → 10 PDF (Certificat Matière / Rapport 8D / PV Contrôle) dans `MOCK_NETWORK_DRIVE_DIR/Fournisseurs_Archives`.
- `generate_supplier_emails()` → 3 emails fournisseurs envoyés en `POST` JSON vers `WEBHOOK_TARGET_URL` (un message est affiché en console si le backend cible n'est pas joignable).

*Les fichiers générés sont disponibles dans le dossier `output/`.*

## 🐳 Exécution avec Docker

Une image dédiée à l'API SAP factice est fournie (`Dockerfile`), basée sur `python:3.13-slim` et installée via `pip` à partir de `requirements.txt` (indépendamment de `uv`, pour rester légère en conteneur).

```bash
docker build -t actuai-mock-sap -f actuai_mock_data/Dockerfile .
docker run -p 8080:8080 actuai-mock-sap
```

L'image expose le port `8080` et embarque des valeurs par défaut pour `DATABASE_URL`, `MOCK_NETWORK_DRIVE_DIR` et `MOCK_EXCEL_DIR` (surchargeables via `-e`).

Les bases de données du projet principal (PostgreSQL pour le datalake relationnel, Qdrant pour le datalake vectoriel) sont quant à elles définies dans le `docker-compose.yml` à la racine du dépôt.

## 🔗 Intégration avec le projet principal (ActuAI Backend)

Une fois ce mock démarré, le projet principal (l'ETL et les agents LangGraph) peut :

* Interroger les routes `GET http://localhost:8080/api/bapi/...` pour extraire les données et remplir le datalake PostgreSQL.
* Lire les fichiers PDF générés dans `output/network_drives/Fournisseurs_Archives/` pour les vectoriser via le modèle d'embedding (Qdrant).
* Lire les fichiers Excel générés dans `output/excel_shares/` pour le suivi manuel des opérateurs.
* Recevoir les requêtes `POST` des faux emails fournisseurs sur son propre routeur d'ingestion (`WEBHOOK_TARGET_URL`).
* Utiliser les routes `PUT`/`POST` de l'API factice pour simuler les actions correctives des agents (report de date, création de FNC).

## 🧰 Stack technique

| Domaine | Bibliothèque |
|---|---|
| API REST | `fastapi`, `uvicorn` |
| ORM / Base de données | `sqlmodel` (SQLite) |
| Génération de données | `faker` |
| Fichiers Excel | `pandas`, `openpyxl` |
| Fichiers PDF | `fpdf2` |
| Configuration | `pydantic-settings` |

Python ≥ 3.13 requis (voir `pyproject.toml`).
