import os
from pathlib import Path
from dotenv import load_dotenv

from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Qdrant

# 1. Chargement de la configuration
load_dotenv()
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")

# Chemin vers les documents générés par ton mock (relatif à la racine du workspace)
MOCK_DOCS_DIR = Path("./actuai_mock_data/output/network_drives/Fournisseurs_Archives")

def index_technical_documents():
    print("📂 Étape 1: Chargement des PDF depuis le disque réseau...")
    
    if not MOCK_DOCS_DIR.exists():
        print(f"❌ Erreur : Le dossier {MOCK_DOCS_DIR} n'existe pas.")
        print("💡 Astuce : Lance ton générateur de mock d'abord avec :")
        print("   uv run python actuai_mock_data/generators/main.py")
        return

    # PyPDFDirectoryLoader va lire tous les .pdf présents dans le dossier
    loader = PyPDFDirectoryLoader(str(MOCK_DOCS_DIR))
    raw_documents = loader.load()
    print(f"📄 {len(raw_documents)} pages chargées depuis les documents techniques.")

    print("✂️ Étape 2: Découpage du texte (Chunking)...")
    # On découpe le texte pour ne pas saturer la mémoire (contexte) des LLM
    # chunk_overlap permet de garder le contexte entre deux morceaux coupés
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    chunks = text_splitter.split_documents(raw_documents)
    print(f"🧩 {len(chunks)} morceaux (chunks) générés.")

    print("🧠 Étape 3: Chargement du modèle d'Embedding Local...")
    # Modèle ultra-léger et rapide exécuté localement (pas d'API externe = Sécurité)
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    print("🚀 Étape 4: Vectorisation et insertion dans Qdrant...")
    # On crée ou écrase la collection pour y insérer les vecteurs
    Qdrant.from_documents(
        documents=chunks,
        embedding=embeddings,
        url=QDRANT_URL,
        collection_name="technical_documentation",
        force_recreate=True 
    )
    
    print("✅ Base de données vectorielle Qdrant mise à jour avec succès !")

if __name__ == "__main__":
    index_technical_documents()