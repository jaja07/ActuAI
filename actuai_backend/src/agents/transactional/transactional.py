"""
agents/transactional — The Transactional Agent (structured data / SQL tools).

ROLE (report §5.2 B)
--------------------
"Equipped with Python-based SQL tools, this agent interacts directly with the
local PostgreSQL datalake to query and format structured ERP metadata. It is
responsible for tasks requiring high logical precision."

It owns THREE of the five missions. This module implements each one explicitly
and tags the resulting HITL task with the right mission code (M1/M2/M3):

  • Mission 1 — Supply Chain Monitoring
      Parse a supplier email about a delivery (delay/shipment), extract the new
      status/date and draft a SAP delivery-date update.  -> kind SAP_UPDATE
  • Mission 2 — Production Scheduling
      Cross-reference the (possibly delayed) delivery against the Airbus
      assembly-line date and flag an AOG risk 48 h in advance. -> kind SCHEDULE_ALERT
  • Mission 3 — Non-Conformity & Quality Management
      Pre-fill a Non-Conformance Report (FNC) from SAP data for a reported
      defect, and track the supplier 8D follow-up.            -> kind FNC_CREATE

The agent never writes to SAP itself: it produces a DRAFT; the human approves it
in the HITL queue, and only then does hitl.py execute the side effect.
"""

import json
from datetime import date, timedelta

from sqlmodel import Session, select

from agents.llm import get_client
from agents.state import GlobalState
from database.models import ProductionSchedule, PurchaseOrder

# The extraction prompt now also classifies WHICH of the agent's missions the
# message belongs to, so we can branch to the right handler.
_SYSTEM = """You extract structured facts from an internal aerospace ERP message.
Return ONLY valid JSON (no prose, no markdown fences) with these keys:
  - intent       (one of: "delivery_update", "scheduling", "non_conformity")
  - po_number    (string, the purchase order referenced, or null)
  - new_status   (one of: SHIPPED, DELAYED, RECEIVED, or null)
  - delay_days   (integer, 0 if not a delay)
  - defect_type  (short string describing the defect, or null)
  - confidence   (one of: high, medium, low)

Guidance for "intent":
  - "delivery_update": a supplier reports a shipment, delay or new delivery date.
  - "scheduling": the message is about the production/assembly schedule, planning
    impact, AOG risk, or asks whether a delay threatens the line.
  - "non_conformity": a defect, quality issue, non-conformance (FNC), or 8D report.
"""

# Keywords used as a deterministic fallback if the LLM intent is missing/unsure.
_M3_WORDS = ("non-conform", "nonconform", "non conform", "défaut", "defaut",
             "defect", "fnc", "8d", "quality", "qualité", "qualite", "ncr")
_M2_WORDS = ("planning", "schedule", "assembly", "assemblage", "ligne", "aog",
             "production", "cadence", "retard sur le planning")


def _safe_json(text: str) -> dict:
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {}


def _classify_mission(extracted: dict, raw_input: str) -> str:
    """Decide M1/M2/M3 from the LLM intent, with a keyword fallback."""
    intent = (extracted.get("intent") or "").lower()
    if intent == "non_conformity":
        return "M3"
    if intent == "scheduling":
        return "M2"
    if intent == "delivery_update":
        return "M1"
    text = raw_input.lower()
    if any(w in text for w in _M3_WORDS):
        return "M3"
    if any(w in text for w in _M2_WORDS):
        return "M2"
    return "M1"


def _find_po(session: Session, po_number: str | None):
    if not po_number:
        return None
    return session.exec(
        select(PurchaseOrder).where(PurchaseOrder.po_number == po_number)
    ).first()


def _triage(state: GlobalState, mission: str, summary: str, payload: dict) -> GlobalState:
    state.mission = mission
    state.draft_summary = summary
    state.draft_payload = {**payload, "needs_human_triage": True}
    return state


# --------------------------------------------------------------------------
# Mission 1 — Supply Chain Monitoring
# --------------------------------------------------------------------------
def _mission1_supply_chain(state, session, extracted) -> GlobalState:
    state.mission = "M1"
    po = _find_po(session, extracted.get("po_number"))
    if po is None:
        return _triage(
            state, "M1",
            f"PO {extracted.get('po_number')} introuvable dans le datalake.",
            {"po_number": extracted.get("po_number"), "unknown_po": True},
        )

    status = extracted.get("new_status") or "DELAYED"
    delay = int(extracted.get("delay_days") or 0)
    new_expected_date = None
    if po.expected_delivery_date is not None:
        new_expected_date = (po.expected_delivery_date + timedelta(days=delay)).isoformat()

    state.draft_summary = (
        f"[M1] Mise à jour fournisseur sur {po.part_reference} (PO {po.po_number}) : "
        f"statut -> {status}"
        + (f", +{delay} j de retard" if delay else "")
        + (f", nouvelle date prévue {new_expected_date}" if new_expected_date else "")
    )
    state.draft_payload = {
        "kind": "SAP_UPDATE",
        "sap_action": "UPDATE_DELIVERY_DATE",
        "po_number": po.po_number,
        "supplier_name": po.supplier_name,
        "part_reference": po.part_reference,
        "new_status": status,
        "delay_days": delay,
        "new_expected_date": new_expected_date,
        "confidence": extracted.get("confidence", "medium"),
    }
    return state


# --------------------------------------------------------------------------
# Mission 2 — Production Scheduling (cross-reference with the assembly line)
# --------------------------------------------------------------------------
def _mission2_production_scheduling(state, session, extracted) -> GlobalState:
    state.mission = "M2"
    po = _find_po(session, extracted.get("po_number"))
    if po is None:
        return _triage(
            state, "M2",
            f"PO {extracted.get('po_number')} introuvable pour l'analyse planning.",
            {"po_number": extracted.get("po_number"), "unknown_po": True},
        )

    delay = int(extracted.get("delay_days") or 0)
    new_date = po.expected_delivery_date
    if new_date is not None and delay:
        new_date = new_date + timedelta(days=delay)

    # SQL tool: look up the assembly-line date for this part.
    sched = session.exec(
        select(ProductionSchedule).where(
            ProductionSchedule.part_reference == po.part_reference
        )
    ).first()

    if sched is None:
        state.draft_summary = (
            f"[M2] Aucune planification trouvée pour {po.part_reference} "
            f"(PO {po.po_number}) — impact production non évaluable."
        )
        state.draft_payload = {
            "kind": "SCHEDULE_ALERT", "po_number": po.po_number,
            "part_reference": po.part_reference, "no_schedule": True,
        }
        return state

    margin = (sched.assembly_line_date - new_date).days if new_date else None
    at_risk = margin is not None and margin < 2  # < 48 h of margin = risk
    verdict = "RISQUE AOG" if at_risk else "OK"

    state.draft_summary = (
        f"[M2] {po.part_reference} (PO {po.po_number}) — programme {sched.aircraft_program} : "
        f"livraison prévue {new_date}, date ligne d'assemblage {sched.assembly_line_date}, "
        f"marge {margin} j -> {verdict}"
    )
    state.draft_payload = {
        "kind": "SCHEDULE_ALERT",
        "po_number": po.po_number,
        "part_reference": po.part_reference,
        "aircraft_program": sched.aircraft_program,
        "new_expected_date": new_date.isoformat() if new_date else None,
        "assembly_line_date": sched.assembly_line_date.isoformat(),
        "margin_days": margin,
        "at_risk": at_risk,
    }
    return state


# --------------------------------------------------------------------------
# Mission 3 — Non-Conformity & Quality Management (pre-fill an FNC)
# --------------------------------------------------------------------------
def _mission3_nonconformity(state, session, extracted) -> GlobalState:
    state.mission = "M3"
    po = _find_po(session, extracted.get("po_number"))
    if po is None:
        return _triage(
            state, "M3",
            f"PO {extracted.get('po_number')} introuvable pour la création de FNC.",
            {"po_number": extracted.get("po_number"), "unknown_po": True},
        )

    defect = extracted.get("defect_type") or "Non-conformité signalée"
    # Deterministic FNC number from the PO (demo-friendly, unique enough).
    ncr_number = f"FNC-{po.po_number.replace('PO-', '')}-{date.today():%Y%m%d}"

    state.draft_summary = (
        f"[M3] Projet de FNC {ncr_number} pour {po.part_reference} (PO {po.po_number}, "
        f"fournisseur {po.supplier_name}) — défaut : {defect}"
    )
    state.draft_payload = {
        "kind": "FNC_CREATE",
        "ncr_number": ncr_number,
        "po_number": po.po_number,
        "part_reference": po.part_reference,
        "supplier_name": po.supplier_name,
        "defect_type": defect,
        "report_8d_status": "PENDING",
        "confidence": extracted.get("confidence", "medium"),
    }
    return state


# --------------------------------------------------------------------------
# Entry point: extract -> classify mission -> dispatch
# --------------------------------------------------------------------------
def run_transactional(state: GlobalState, session: Session) -> GlobalState:
    state.agent = "transactional"

    client = get_client("transactional")
    extracted = _safe_json(client.chat(_SYSTEM, state.raw_input))
    state.log(f"Transactional extracted: {extracted}")

    if not extracted.get("po_number"):
        return _triage(
            state, "M1",
            "Aucun numéro de commande (PO) identifié dans le message.",
            {"raw": state.raw_input[:500]},
        )

    mission = _classify_mission(extracted, state.raw_input)
    state.log(f"Transactional mission: {mission}")

    if mission == "M3":
        return _mission3_nonconformity(state, session, extracted)
    if mission == "M2":
        return _mission2_production_scheduling(state, session, extracted)
    return _mission1_supply_chain(state, session, extracted)
