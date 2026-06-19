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
1. Use the LLM to extract structured facts from the message, including WHICH
   kind of request this is: a delay/status report (M1) or a request to create
   a Non-Conformance Report / FNC (M3).
2. Look the referenced PO up in our datalake (an SQL "tool") to confirm it
   exists and to enrich the draft with the supplier and part reference.
3a. DELAY_REPORT -> build a structured SAP_UPDATE draft payload and a summary,
    then cross-check the new date against the Airbus production schedule (M2):
    if it slips past the assembly line's drop-dead date, raise a separate
    AOG_ALERT task right away (use case 2) — it doesn't wait for the
    SAP_UPDATE task above to be approved first.
3b. CREATE_FNC -> pre-fill a Quality Notification draft (use case 3) with the
    part/supplier metadata already on file, so the quality controller only has
    to review and submit it.
4. Return the state — the graph then creates a ValidationTask for HITL.
"""

import json
import uuid
from datetime import date, timedelta

from sqlmodel import Session, select

from agents.llm import get_client
from agents.state import GlobalState
from database.models import ProductionSchedule, PurchaseOrder, TaskStatus, ValidationTask
from security import audit

_SYSTEM = """You extract structured facts from a message for an aerospace ERP.
Return ONLY valid JSON with these keys:
  - request_type (one of: DELAY_REPORT, CREATE_FNC)
  - po_number    (string, the purchase order referenced, or null)
  - new_status   (one of: SHIPPED, DELAYED, RECEIVED, or null — DELAY_REPORT only)
  - delay_days   (integer, 0 if not a delay — DELAY_REPORT only)
  - defect_type  (short string describing the defect, e.g. "Rayure sur carter" —
                  CREATE_FNC only, else null)
  - confidence   (one of: high, medium, low)

Use CREATE_FNC when the message explicitly asks to create/raise a
non-conformity, FNC, or quality notification (it describes a physical defect
found on a part). Use DELAY_REPORT for anything about shipping status, delays
or schedule updates. No prose, no markdown fences. JSON only."""


def _safe_json(text: str) -> dict:
    """Strip stray ```fences``` and parse defensively so a bad model response
    can't crash the pipeline."""
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {}


def _check_aog_risk(session: Session, po: PurchaseOrder, new_expected_date: date) -> None:
    """
    Mission 2 — production schedule coordination.

    JOIN the part's Airbus assembly drop-dead date (ProductionSchedule) against
    the freshly-delayed supplier ETA. If the new date slips past the drop-dead
    date, the part will block the assembly line: raise a dedicated, urgent
    AOG_ALERT task immediately, in parallel with the normal SAP_UPDATE draft —
    a human shouldn't have to wait for the date change to be approved first to
    learn about the production risk it creates.
    """
    schedule = session.exec(
        select(ProductionSchedule).where(ProductionSchedule.part_reference == po.part_reference)
    ).first()
    if schedule is None or new_expected_date <= schedule.assembly_line_date:
        return  # no schedule on file, or the new date still meets the line

    delay_vs_dropdead = (new_expected_date - schedule.assembly_line_date).days
    task = ValidationTask(
        mission="M2",
        agent="transactional",
        kind="AOG_ALERT",
        summary=(
            f"Risque AOG : {po.part_reference} (PO {po.po_number}) attendu le "
            f"{new_expected_date.isoformat()}, mais requis en chaîne le "
            f"{schedule.assembly_line_date.isoformat()} ({delay_vs_dropdead} j de retard)."
        ),
        payload={
            "po_number": po.po_number,
            "part_reference": po.part_reference,
            "supplier_name": po.supplier_name,
            "aircraft_program": schedule.aircraft_program,
            "drop_dead_date": schedule.assembly_line_date.isoformat(),
            "supplier_eta": new_expected_date.isoformat(),
            "delay_vs_dropdead_days": delay_vs_dropdead,
        },
        status=TaskStatus.PENDING,
    )
    session.add(task)
    session.flush()
    audit.record(
        session, actor="transactional", action="AOG_RISK_DETECTED",
        detail={"task_id": task.id, "po_number": po.po_number, "delay_days": delay_vs_dropdead},
    )


def _draft_quality_notification(state: GlobalState, po: PurchaseOrder, extracted: dict) -> GlobalState:
    """
    Mission 3 — pre-fill a Non-Conformance Report (FNC) draft.

    The metadata a quality controller would otherwise retype by hand (part
    reference, supplier, PO number) is already on file in the datalake — only
    the defect description comes from the human's short request. The NCR
    number is generated here so the form is ready to submit on approval
    (hitl.py POSTs it to SAP's quality-notifications endpoint).
    """
    state.mission = "M3"
    defect_type = extracted.get("defect_type") or "Défaut non précisé"
    ncr_number = f"FNC-{date.today().year % 100}-{uuid.uuid4().hex[:6].upper()}"

    state.draft_summary = (
        f"FNC {ncr_number} : {defect_type} sur {po.part_reference} (PO {po.po_number}, "
        f"fournisseur {po.supplier_name})."
    )
    state.draft_payload = {
        "kind": "CREATE_FNC",
        "ncr_number": ncr_number,
        "po_number": po.po_number,
        "part_reference": po.part_reference,
        "supplier_name": po.supplier_name,
        "defect_type": defect_type,
        "confidence": extracted.get("confidence", "medium"),
        "source_request": state.raw_input[:1000],
    }
    return state


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

    # --- Step 3 (CREATE_FNC branch): pre-fill a Quality Notification draft ---
    if extracted.get("request_type") == "CREATE_FNC":
        return _draft_quality_notification(state, po, extracted)

    # --- Step 3 (DELAY_REPORT branch): build the SAP_UPDATE draft -----------
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
        # Kept so the frontend can render a real before/after diff.
        "current_expected_date": po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
        "new_status": status,
        "delay_days": delay,
        "new_expected_date": new_expected_date,   # used by the write-back PUT
        "confidence": extracted.get("confidence", "medium"),
        "source_email": state.raw_input[:1000],   # shown in the UI as the source extract
    }

    # --- Step 4: Mission 2 — does this new date now block the assembly line? ---
    if new_expected_date is not None:
        _check_aog_risk(session, po, date.fromisoformat(new_expected_date))

    return state
