"""
agents/investigative — The Investigative Agent (unstructured data / RAG tools).

ROLE (report §5.2 C)
--------------------
"Equipped with Retrieval-Augmented Generation (RAG) tools, this agent interacts
with the Vector Database to perform semantic searches across massive volumes of
unstructured text and digitized documents."

It owns the two RAG-driven missions, implemented explicitly below and tagged
M4/M5 on the resulting HITL task:

  • Mission 4 — Technical Documentation Control
      Retrieve the correct / most recent document version (DF, certificates,
      inspection protocols) from poorly-structured archives. -> kind DOC_LOOKUP
  • Mission 5 — Component Traceability
      Reconstruct a component's end-to-end history across SAP + archives AND
      verify the physical serial number against the SAP record. -> kind TRACE_REPORT

Retrieval is delegated to ``agents.investigative.retriever`` (Qdrant in prod,
in-memory fallback otherwise). For M5 it also reads the datalake to compare the
expected serial number with what the documents say.
"""

import json
import re

from sqlmodel import Session, select

from agents.investigative.retriever import get_retriever
from agents.llm import get_client
from agents.state import GlobalState
from database.models import PurchaseOrder

_SYSTEM = """You are a documentation assistant for aerospace traceability.
Answer the user's question using ONLY the provided context passages. If the
answer is not in the context, say you could not find it. Return ONLY valid JSON:
  - answer   (string)
  - sources  (list of source filenames you used)
No prose outside the JSON, no markdown fences."""

# Keywords that mark a traceability request (Mission 5) vs a doc lookup (M4).
_M5_WORDS = ("trace", "traçab", "tracab", "serial", "série", "serie", "numéro de série",
             "history", "historique", "end-to-end", "bout en bout", "nacelle", "sn-", "sn ")

_SERIAL_RE = re.compile(r"\bSN[-\s]?\w+\b", re.IGNORECASE)
_PO_RE = re.compile(r"\bPO-[\w-]+\b", re.IGNORECASE)  # require the hyphen (avoids matching words like "POUR")


def _safe_json(text: str) -> dict:
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"answer": cleaned[:1000], "sources": []}


def _classify_mission(raw_input: str) -> str:
    text = raw_input.lower()
    return "M5" if any(w in text for w in _M5_WORDS) else "M4"


def _rag_answer(state: GlobalState):
    """Shared retrieval + grounded generation. Returns (result, chunks)."""
    retriever = get_retriever()
    # ABAC in RAG: only return chunks the caller is cleared to see (report §9.2).
    chunks = retriever.search(query=state.raw_input, k=4, max_clearance=state.clearance)
    state.log(f"Investigative retrieved {len(chunks)} chunk(s)")
    if not chunks:
        return {"answer": "Aucun document correspondant trouvé.", "sources": []}, []
    context = "\n\n".join(f"[{c['source']}]\n{c['text']}" for c in chunks)
    client = get_client("investigative")
    result = _safe_json(client.chat(
        _SYSTEM, f"CONTEXT PASSAGES:\n{context}\n\nQUESTION:\n{state.raw_input}"
    ))
    result.setdefault("sources", [c["source"] for c in chunks])
    return result, chunks


# --------------------------------------------------------------------------
# Mission 4 — Technical Documentation Control
# --------------------------------------------------------------------------
def _mission4_documentation(state: GlobalState) -> GlobalState:
    state.mission = "M4"
    result, _ = _rag_answer(state)
    state.draft_summary = "[M4] " + (result.get("answer", "")[:200])
    state.draft_payload = {
        "kind": "DOC_LOOKUP",
        "answer": result.get("answer", ""),
        "sources": result.get("sources", []),
    }
    return state


# --------------------------------------------------------------------------
# Mission 5 — Component Traceability (+ serial number consistency check)
# --------------------------------------------------------------------------
def _mission5_traceability(state: GlobalState, session: Session) -> GlobalState:
    state.mission = "M5"
    result, chunks = _rag_answer(state)

    # Verify the physical serial vs the SAP record (report §5.2 M5).
    doc_blob = " ".join(c["text"] for c in chunks) + " " + state.raw_input
    serials = {s.upper().replace(" ", "-") for s in _SERIAL_RE.findall(doc_blob)}
    po_match = _PO_RE.search(state.raw_input) or _PO_RE.search(doc_blob)

    consistency = "unknown"
    sap_serial = None
    po_number = None
    if po_match:
        po_number = po_match.group(0).upper().replace(" ", "-")
        po = session.exec(
            select(PurchaseOrder).where(PurchaseOrder.po_number == po_number)
        ).first()
        if po and po.serial_number_expected:
            sap_serial = po.serial_number_expected.upper()
            doc_serials = {s.replace("SN", "SN-").replace("SN--", "SN-") for s in serials}
            consistency = "match" if any(sap_serial in s or s in sap_serial
                                          for s in doc_serials) else "mismatch"

    verdict = {"match": "cohérent", "mismatch": "INCOHÉRENT", "unknown": "non vérifié"}[consistency]
    state.draft_summary = (
        f"[M5] Traçabilité reconstituée"
        + (f" (PO {po_number})" if po_number else "")
        + f" — contrôle n° de série : {verdict}"
    )
    state.draft_payload = {
        "kind": "TRACE_REPORT",
        "answer": result.get("answer", ""),
        "sources": result.get("sources", []),
        "po_number": po_number,
        "sap_serial_expected": sap_serial,
        "serials_in_documents": sorted(serials),
        "serial_consistency": consistency,
    }
    return state


# --------------------------------------------------------------------------
# Entry point: classify M4/M5 -> dispatch
# --------------------------------------------------------------------------
def run_investigative(state: GlobalState, session: Session) -> GlobalState:
    state.agent = "investigative"
    mission = _classify_mission(state.raw_input)
    state.log(f"Investigative mission: {mission}")
    if mission == "M5":
        return _mission5_traceability(state, session)
    return _mission4_documentation(state)
