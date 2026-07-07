"""
api/routers/documents.py — Mission 4: technical documentation inventory.

GET /api/documents  List the unique documents currently indexed in Qdrant,
                    with their version-control metadata (revision, type,
                    indexed_at). Returns {"indexed": false, ...} gracefully
                    when Qdrant is unreachable or the collection is empty.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from api.dependencies import TokenUser, get_current_user
from config import settings

router = APIRouter(prefix="/api", tags=["Documents"])


@router.get("/documents")
def list_documents(user: Annotated[TokenUser, Depends(get_current_user)]):
    """Aggregate the indexed chunks into one entry per source document."""
    try:
        from qdrant_client import QdrantClient

        client = QdrantClient(url=settings.QDRANT_URL, timeout=5)
        docs: dict[str, dict] = {}
        offset = None
        while True:
            points, offset = client.scroll(
                collection_name=settings.QDRANT_COLLECTION,
                with_payload=True,
                with_vectors=False,
                limit=256,
                offset=offset,
            )
            for point in points:
                payload = point.payload or {}
                # langchain stores custom metadata under "metadata"
                meta = payload.get("metadata", payload)
                source = meta.get("source")
                if not source:
                    continue
                docs.setdefault(source, {
                    "source": source,
                    "revision": meta.get("revision", "A"),
                    "doc_type": meta.get("doc_type", "unknown"),
                    "indexed_at": meta.get("indexed_at"),
                })
            if offset is None:
                break
        return {"indexed": True, "documents": sorted(docs.values(), key=lambda d: d["source"])}
    except Exception:  # noqa: BLE001 — Qdrant down/empty must not 500 the UI
        return {"indexed": False, "documents": []}
