# ActuAI - Mock Data Engine

Ce module fait partie du projet global **ActuAI**, une architecture multi-agents (LangGraph) conçue pour automatiser les tâches à Non-Valeur Ajoutée (NVA) au sein d'un service d'Actuation aéronautique (contexte : elecTRAS A350).

Étant donné l'impossibilité de se connecter aux systèmes de production industriels réels (souveraineté des données, normes EN9100), ce sous-projet agit comme un **générateur de données factices et un simulateur d'infrastructures**. Il fournit à l'ETL (Extract, Transform, Load) du projet principal un environnement réaliste pour extraire des données structurées et non structurées.

## 🎯 Fonctionnalités

Le moteur simule les quatre sources de données principales du service Actuation :

1. **SAP ERP (API BAPI Factice) :** Une API RESTful développée avec FastAPI et SQLModel (SQLite). Elle simule les modules industriels clés :
   - **MM (Material Management) :** Commandes d'achat (`PurchaseOrder`) et Réceptions (`GoodsReceipt`).
   - **PP (Production Planning) :** Planning de la ligne d'assemblage Airbus (`ProductionSchedule`).
   - **QM (Quality Management) :** Fiches de non-conformité (`QualityNotification`).
2. **MS Exchange (Emails) :** Un générateur simulant le flux quotidien d'emails fournisseurs (retards, expéditions) via des webhooks.
3. **Disques Réseau (Documents Techniques) :** Génération de fichiers PDF factices (Rapports 8D, Certificats matière) pour alimenter la base vectorielle (RAG).
4. **Fichiers Excel (Tableaux de bord) :** Création de fichiers `.xlsx` simulant les suivis d'avancement partagés.

## 📂 Architecture du Sous-Projet

```text
actuai-mock-data/
├── pyproject.toml          # Dépendances gérées via uv (workspace)
├── README.md
└── src/
    └── actuai_mock_data/
        ├── config.py       # Validation Pydantic des variables d'environnement
        ├── sap_api/        # Simulation de l'ERP SAP
        │   ├── main.py     # Endpoints FastAPI (CRUD)
        │   ├── model.py    # Schémas de la base de données (SQLModel)
        │   └── seeder.py   # Script d'injection de données initiales
        ├── generators/     # Scripts de génération de données non-structurées
        │   ├── emails.py
        │   ├── excel.py
        │   ├── documents.py
        │   └── main_generator.py
        └── output/         # Dossiers cibles (générés automatiquement)
            ├── network_drives/
            └── excel_shares/

```

## ⚙️ Prérequis et Installation

Ce projet utilise **[uv](https://github.com/astral-sh/uv)** comme gestionnaire de paquets et d'environnements virtuels, configuré en mode *Workspace* depuis la racine du dépôt global.

1. **Configuration de l'environnement :**
Créez un fichier `.env` à la racine globale du projet avec les variables suivantes :
```env
MOCK_NETWORK_DRIVE_DIR=./actuai-mock-data/src/actuai_mock_data/output/network_drives
MOCK_EXCEL_DIR=./actuai-mock-data/src/actuai_mock_data/output/excel_shares
DATABASE_URL=sqlite:///./sap_mock.db
WEBHOOK_TARGET_URL=http://localhost:8000/api/v1/webhooks/exchange

```


2. **Installation des dépendances :**
Depuis la racine du projet (où se trouve `uv.lock`) :
```bash
uv sync

```



## 🚀 Utilisation

Les commandes suivantes doivent être exécutées depuis la **racine du projet global**.

### 1. Initialiser et peupler l'ERP SAP (Seeding)

Avant de lancer l'API, il faut créer la base de données SQLite et la remplir avec des données métier cohérentes (Commandes, FNC, Planning).

```bash
uv run python actuai-mock-data/src/actuai_mock_data/sap_api/seeder.py

```

### 2. Lancer l'API SAP Factice (FastAPI)

Démarre le serveur local qui expose les points de terminaison pour l'Extracteur ETL.

```bash
uv run uvicorn actuai_mock_data.sap_api.main:app --reload --port 8080

```

* 📖 **Documentation interactive (Swagger) :** [http://localhost:8080/docs](https://www.google.com/search?q=http://localhost:8080/docs)

### 3. Générer le flux de données non-structurées

Lance le script d'orchestration pour générer les fichiers Excel, les PDF techniques et simuler l'envoi des webhooks emails.

```bash
uv run python actuai-mock-data/src/actuai_mock_data/generators/main_generator.py

```

*Les fichiers générés seront disponibles dans le dossier `output/`.*

## 🔗 Intégration avec le projet principal (ActuAI Backend)

Une fois ce mock démarré, le projet principal (l'ETL et les agents LangGraph) peut :

* Interroger les routes `GET http://localhost:8080/api/bapi/...` pour extraire les données et remplir le datalake PostgreSQL.
* Lire les fichiers PDF générés dans `output/network_drives/` pour les vectoriser via le modèle d'embedding (Qdrant/Milvus).
* Recevoir les requêtes `POST` des faux emails fournisseurs sur son propre routeur d'ingestion.