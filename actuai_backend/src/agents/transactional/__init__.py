"""
agents/transactional — The Transactional Agent (structured data / SQL).

ROLE (report 5.2)
-----------------
Handles the missions that need high logical precision against structured ERP
data: M1 supply-chain monitoring, M2 production scheduling, M3 non-conformity.
It reads the local PostgreSQL datalake (our SAP mirror), uses the cloud model
(Mistral-Nemo 12B) to extract structured facts from text, and produces a DRAFT
SAP update — it never writes to SAP itself.

THE FLOW
--------
1. Use the LLM to extract {po_number, new_status, delay_days} from the email.
2. Look that PO up in our datalake (an SQL "tool") to confirm it exists and to
   enrich the draft with the supplier and part reference.
3. Build a structured draft payload and a human summary.
4. Return the state — the graph then creates a ValidationTask for HITL.
"""

import json
from datetime import timedelta

from sqlmodel import Session, select

from agents.llm import get_client
from agents.state import GlobalState
from database.models import PurchaseOrder

_SYSTEM = """You extract structured facts from a supplier email for an aerospace
ERP. Return ONLY valid JSON with these keys:
  - po_number   (string, the purchase order referenced, or null)
  - new_status  (one of: SHIPPED, DELAYED, RECEIVED, or null)
  - delay_days  (integer, 0 if not a delay)
  - confidence  (one of: high, medium, low)
No prose, no markdown fences. JSON only."""


def _safe_json(text: str) -> dict:
    """Strip stray ```fences``` and parse defensively so a bad model response
    can't crash the pipeline."""
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {}


def run_transactional(state: GlobalState, session: Session) -> GlobalState:
    state.agent = "transactional"

    # --- Step 1: LLM extraction ------------------------------------------
    client = get_client("transactional")
    extracted = _safe_json(client.chat(_SYSTEM, state.raw_input))
    state.log(f"Transactional extracted: {extracted}")

    po_number = extracted.get("po_number")
    if not po_number:
        state.mission = "M1"
        state.draft_summary = "Could not identify a purchase order in the message."
        state.draft_payload = {"needs_human_triage": True, "raw": state.raw_input[:500]}
        return state

    # --- Step 2: SQL tool — confirm the PO exists in our datalake ---------
    po = session.exec(
        select(PurchaseOrder).where(PurchaseOrder.po_number == po_number)
    ).first()

    if po is None:
        state.mission = "M1"
        state.draft_summary = f"PO {po_number} referenced but not found in datalake."
        state.draft_payload = {"po_number": po_number, "unknown_po": True}
        return state

    # --- Step 3: build the structured draft for SAP write-back ------------
    state.mission = "M1"
    status = extracted.get("new_status") or "DELAYED"
    delay = int(extracted.get("delay_days") or 0)

    # New expected date = current expected date + delay.
    new_expected_date = None
    if po.expected_delivery_date is not None:
        new_expected_date = (po.expected_delivery_date + timedelta(days=delay)).isoformat()

    state.draft_summary = (
        f"Mise à jour fournisseur sur {po.part_reference} (PO {po.po_number}) : "
        f"statut -> {status}"
        + (f", +{delay} jour(s) de retard" if delay else "")
        + (f", nouvelle date prévue {new_expected_date}" if new_expected_date else "")
    )
    # This payload is exactly what will be sent to the SAP API on approval
    # (hitl.py does the PUT .../update-date with new_expected_date).
    state.draft_payload = {
        "sap_action": "UPDATE_DELIVERY_DATE",
        "po_number": po.po_number,
        "supplier_name": po.supplier_name,
        "part_reference": po.part_reference,
        "new_status": status,
        "delay_days": delay,
        "new_expected_date": new_expected_date,   # used by the write-back PUT
        "confidence": extracted.get("confidence", "medium"),
    }
    return state
