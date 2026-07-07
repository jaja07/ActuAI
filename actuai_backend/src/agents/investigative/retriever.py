"""
agents/investigative/retriever.py — RAG retrieval (Qdrant + in-memory fallback).

The Investigative agent only needs ONE method:
    search(query, k, max_clearance) -> list of {source, text, clearance}

In production this targets the Qdrant collection populated by
``etl/document_indexer.py``. When Qdrant (or its heavy embedding dependencies)
is unavailable, we transparently fall back to a tiny in-memory keyword
retriever so the RAG path works out of the box with no extra services — the
agent code never changes.

ABAC NOTE: search() filters out any chunk whose clearance is above the caller's,
so an unauthorised user never even sees a forbidden chunk (report 9.2).
"""

from __future__ import annotations

from config import settings

# Clearance ordering, lowest -> highest. Used to compare access levels.
_CLEARANCE_ORDER = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "EAR", "ITAR"]


def _rank(level: str) -> int:
    try:
        return _CLEARANCE_ORDER.index(level)
    except ValueError:
        return 0


class Retriever:
    def search(self, query: str, k: int, max_clearance: str) -> list[dict]:
        raise NotImplementedError


class InMemoryRetriever(Retriever):
    """
    Keyword-overlap retriever over a small seeded corpus. Good enough to make
    the RAG pipeline runnable and testable without external services.
    """

    def __init__(self) -> None:
        self._docs = [
            {
                "source": "DF-A350-007-v3.pdf",
                "clearance": "CONFIDENTIAL",
                "text": "Manufacturing Record DF for part ELEC-ACT-A350-007, "
                        "revision 3. Supplier SUP-1042. Serial SN-7781. "
                        "Inspection passed on 2026-05-12.",
            },
            {
                "source": "CERT-MAT-SUP1042.pdf",
                "clearance": "INTERNAL",
                "text": "Material certificate for supplier SUP-1042 confirming "
                        "EN9100 compliance for gearmotor housings.",
            },
            {
                "source": "TRACE-SN7781.txt",
                "clearance": "CONFIDENTIAL",
                "text": "Traceability: PO-A350-88123 ordered 2026-03-01, shipped "
                        "2026-05-01, received 2026-05-10, integrated into nacelle "
                        "NAC-22 on 2026-05-20. Serial SN-7781.",
            },
        ]

    def search(self, query: str, k: int, max_clearance: str) -> list[dict]:
        allowed_rank = _rank(max_clearance)
        q_words = set(query.lower().split())

        scored = []
        for doc in self._docs:
            if _rank(doc["clearance"]) > allowed_rank:
                continue
            overlap = len(q_words & set(doc["text"].lower().split()))
            if overlap > 0:
                scored.append((overlap, doc))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored[:k]]


class QdrantRetriever(Retriever):
    """
    Production retriever backed by Qdrant + a local sentence-transformers
    embedding model (same stack as etl/document_indexer.py). Heavy imports are
    done lazily inside __init__ so the backend boots without these deps when the
    in-memory fallback is used.
    """

    def __init__(self) -> None:
        from langchain_huggingface import HuggingFaceEmbeddings
        from langchain_qdrant import QdrantVectorStore
        from qdrant_client import QdrantClient

        self._client = QdrantClient(url=settings.QDRANT_URL)
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self._store = QdrantVectorStore(
            client=self._client,
            collection_name=settings.QDRANT_COLLECTION,
            embedding=embeddings,
        )

    def search(self, query: str, k: int, max_clearance: str) -> list[dict]:
        allowed_rank = _rank(max_clearance)
        hits = self._store.similarity_search(query, k=k)
        out: list[dict] = []
        for h in hits:
            meta = h.metadata or {}
            clearance = meta.get("clearance", "INTERNAL")
            if _rank(clearance) > allowed_rank:
                continue
            out.append({
                "source": meta.get("source", meta.get("file_path", "unknown")),
                "text": h.page_content,
                "clearance": clearance,
                # Mission 4 version control: revision parsed at indexing time.
                "revision": meta.get("revision"),
                "doc_type": meta.get("doc_type"),
            })
        return out


_RETRIEVER: Retriever | None = None


def get_retriever() -> Retriever:
    """
    Singleton accessor. Try Qdrant first; if it (or its dependencies) is not
    available, fall back to the in-memory retriever so the agent always works.
    """
    global _RETRIEVER
    if _RETRIEVER is not None:
        return _RETRIEVER
    try:
        _RETRIEVER = QdrantRetriever()
    except Exception:
        # Qdrant unreachable or embedding deps missing -> deterministic fallback.
        _RETRIEVER = InMemoryRetriever()
    return _RETRIEVER
