"""
etl/document_indexer.py — Indexes technical PDFs into Qdrant for RAG.

Loads every PDF under ``settings.MOCK_DOCS_DIR``, splits them into overlapping
chunks, embeds them locally (no external API call), and (re)creates the Qdrant
collection the Investigative agent's retriever (agents/investigative/retriever.py)
reads from.
"""

from pathlib import Path

from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import settings

MOCK_DOCS_DIR = Path(settings.MOCK_DOCS_DIR)


def index_technical_documents():
    print("Étape 1: Chargement des PDF depuis le disque réseau...")

    if not MOCK_DOCS_DIR.exists():
        print(f"Erreur : Le dossier {MOCK_DOCS_DIR} n'existe pas.")
        print("Astuce : Lance ton générateur de mock d'abord avec :")
        print("   uv run python -m actuai_mock_data.generators.main")
        return

    # PyPDFDirectoryLoader va lire tous les .pdf présents dans le dossier
    loader = PyPDFDirectoryLoader(str(MOCK_DOCS_DIR))
    raw_documents = loader.load()
    print(f"{len(raw_documents)} pages chargées depuis les documents techniques.")

    print("Étape 2: Découpage du texte (Chunking)...")
    # On découpe le texte pour ne pas saturer la mémoire (contexte) des LLM
    # chunk_overlap permet de garder le contexte entre deux morceaux coupés
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    chunks = text_splitter.split_documents(raw_documents)
    print(f"{len(chunks)} morceaux (chunks) générés.")

    print("Étape 3: Chargement du modèle d'Embedding Local...")
    # Modèle ultra-léger et rapide exécuté localement (pas d'API externe = Sécurité)
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    print("Étape 4: Vectorisation et insertion dans Qdrant...")
    # On crée ou écrase la collection pour y insérer les vecteurs
    QdrantVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        url=settings.QDRANT_URL,
        collection_name=settings.QDRANT_COLLECTION,
        force_recreate=True
    )

    print("Base de données vectorielle Qdrant mise à jour avec succès !")

if __name__ == "__main__":
    index_technical_documents()
