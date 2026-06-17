import os
from sqlmodel import create_engine, SQLModel
from dotenv import load_dotenv

# Charge les variables du fichier .env global à la racine du projet
load_dotenv()

# Récupération de l'URL PostgreSQL depuis le .env
DATABASE_URL = os.getenv("DATABASE_URL_BACKEND")

if not DATABASE_URL:
    raise ValueError("La variable DATABASE_URL_BACKEND n'est pas définie dans le .env")

# Création du moteur de base de données
engine = create_engine(DATABASE_URL, echo=False)

def init_db():
    """Crée les tables dans PostgreSQL si elles n'existent pas."""
    print("⚙️ Initialisation des tables PostgreSQL...")
    SQLModel.metadata.create_all(engine)