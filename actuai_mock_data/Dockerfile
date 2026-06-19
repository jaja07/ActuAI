# Utilisation de Python 3.13 
FROM python:3.13-slim

# Définition du répertoire de travail
WORKDIR /app

# Optimisations Python et déclaration du chemin source
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/app/actuai_mock_data/"

# 1. Copie du fichier de dépendances (isolé pour optimiser le cache Docker)
COPY actuai_mock_data/requirements.txt ./actuai_mock_data/

# 2. Installation classique avec pip
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r actuai_mock_data/requirements.txt

# 3. Copie du code source
COPY actuai_mock_data/ ./actuai_mock_data/

# Port et variables d'environnement par défaut
EXPOSE 8080
ENV DATABASE_URL="sqlite:///./sap_mock.db"
ENV MOCK_NETWORK_DRIVE_DIR="./output/network_drives"
ENV MOCK_EXCEL_DIR="./output/excel_shares"
ENV WEBHOOK_TARGET_URL="http://actuai-backend:8000/api/v1/webhooks/exchange"

# 4. Démarrage de l'API avec le module Python standard
CMD ["python", "-m", "uvicorn", "sap_api.main:app", "--host", "0.0.0.0", "--port", "8080"]