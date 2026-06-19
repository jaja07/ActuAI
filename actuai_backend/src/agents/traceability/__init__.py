"""
agents/traceability — Hybrid traceability audit (use case 5, Mission 5).

ROLE (report 5.2, use case 5)
------------------------------
End-to-end component traceability is a hybrid mission: the Supervisor doesn't
route to a single specialist, it coordinates BOTH workers for one query:

  - the Transactional agent's SQL tools reconstruct the structured trail
    (the purchase order, the physical receipt, any quality notification) from
    the datalake;
  - the Investigative agent's RAG tools pull every document/email mentioning
    the component's serial number.

The two results are merged into a single "Traceability Dossier" draft — one
HITL task, not two — because they describe the SAME component and a human
reviews them together before archiving.
"""

import json
import re

from sqlmodel import Session, select

from agents.investigative.retriever import get_retriever
from agents.llm import get_client
from agents.state import GlobalState
from database.models import GoodsReceipt, PurchaseOrder, QualityNotification

_SERIAL_RE = re.compile(r"\bSN-[A-Za-z0-9-]+\b", re.IGNORECASE)

_SYSTEM = """You are an aerospace traceability auditor. Given the structured
facts and the retrieved document excerpts below, write a short, factual
chronological narrative of the component's history (order -> receipt ->
integration, any defects). Return ONLY valid JSON:
  - narrative (string)
No prose outside the JSON, no markdown fences."""


def _safe_json(text: str) -> dict:
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"narrative": cleaned[:1000]}


def run_traceability(state: GlobalState, session: Session) -> GlobalState:
    """Mission 5: compile a unified traceability dossier for one serial number."""
    state.agent = "traceability"
    state.mission = "M5"

    m = _SERIAL_RE.search(state.raw_input)
    serial_number = m.group(0).upper() if m else None

    if not serial_number:
        state.draft_summary = "Could not identify a serial number to audit."
        state.draft_payload = {"kind": "TRACEABILITY_DOSSIER", "needs_human_triage": True}
        return state

    # --- Transactional side: reconstruct the structured trail --------------
    receipt = session.exec(
        select(GoodsReceipt).where(GoodsReceipt.actual_serial_number == serial_number)
    ).first()

    po = None
    notifications: list[QualityNotification] = []
    if receipt is not None:
        po = session.exec(
            select(PurchaseOrder).where(PurchaseOrder.po_number == receipt.po_number)
        ).first()
        notifications = list(session.exec(
            select(QualityNotification).where(QualityNotification.po_number == receipt.po_number)
        ).all())

    # --- Investigative side: pull every document mentioning this serial ----
    retriever = get_retriever()
    chunks = retriever.search(query=serial_number, k=5, max_clearance=state.clearance)
    state.log(f"Traceability: SQL trail {'found' if po else 'not found'}, {len(chunks)} document(s)")

    # --- Synthesis: ask the heavy model for a human-readable narrative -----
    facts = (
        f"Serial number: {serial_number}\n"
        + (f"Purchase order: {po.po_number} (supplier {po.supplier_name}, part {po.part_reference})\n" if po else "Purchase order: not found in datalake\n")
        + (f"Goods receipt date: {receipt.reception_date}\n" if receipt else "")
        + (f"Quality notifications: {[n.defect_type for n in notifications]}\n" if notifications else "Quality notifications: none\n")
        + "\nDocument excerpts:\n"
        + "\n".join(f"[{c['source']}] {c['text']}" for c in chunks)
    )
    client = get_client("investigative")
    result = _safe_json(client.chat(_SYSTEM, facts))
    narrative = result.get("narrative", "")

    state.draft_summary = f"Dossier de traçabilité {serial_number} compilé ({len(chunks)} document(s), {len(notifications)} FNC)."
    state.draft_payload = {
        "kind": "TRACEABILITY_DOSSIER",
        "serial_number": serial_number,
        "po_number": po.po_number if po else None,
        "part_reference": po.part_reference if po else None,
        "supplier_name": po.supplier_name if po else None,
        "reception_date": receipt.reception_date.isoformat() if receipt else None,
        "defects": [n.defect_type for n in notifications],
        "narrative": narrative,
        "sources": [c["source"] for c in chunks],
    }
    return state
