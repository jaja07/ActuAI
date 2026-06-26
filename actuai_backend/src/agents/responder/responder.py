"""
agents/responder — The Responder Agent (client reply drafting).

ROLE
----
This agent handles the client-facing case, tracked as mission M6 (a transverse
"client reply" function alongside the five business missions M1-M5): a *client*
writes in asking when their equipment will be delivered (a delivery-time / ETA
enquiry).

It:
  1. extracts the order/equipment reference from the client's email,
  2. looks up the forecast delivery date in the local datalake (SQL tool),
  3. drafts a reply email that is formal, warm/enthusiastic and clear.

Like every other agent, it NEVER sends anything itself. It produces a draft and
the graph drops it into the Human-in-the-Loop queue as a ValidationTask of kind
"EMAIL_REPLY". A human reads it, then approves -> only then is it sent.
"""

import json

from sqlmodel import Session, select

from agents.llm import get_client
from agents.state import GlobalState
from database.models import PurchaseOrder
from security.guardrails import apply_dlp

# --- Prompt 1: pull the order reference out of the client's message ---
_EXTRACT_SYSTEM = """Extract the purchase order or equipment reference a client
is asking about. Return ONLY valid JSON:
  - po_number   (string, e.g. "PO-A350-88123", or null)
  - part_hint   (string, any part name/reference mentioned, or null)
No prose, no markdown fences."""

# --- Prompt 2: write the actual reply email ---
_REPLY_SYSTEM = """You are a customer-relations assistant for an aerospace
actuation supplier. Write a reply email to a client who asked about the delivery
time of their equipment. The email MUST be:
  - formal and professional,
  - warm and genuinely enthusiastic (we value this client and this partnership),
  - clear and concise (no jargon, no filler).
You are given the order reference, the part, and the confirmed forecast delivery
date. State the date plainly and reassure the client. Sign off as
"ActuAI Customer Service".
Return ONLY valid JSON with keys:
  - subject (string)
  - body    (string, the full email text including greeting and sign-off)
No markdown, no prose outside the JSON."""


def _safe_json(text: str) -> dict:
    """Strip stray fences and parse defensively (same pattern as the other agents)."""
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {}


def run_responder(state: GlobalState, session: Session) -> GlobalState:
    state.agent = "responder"
    state.mission = "M6"

    # --- Step 1: figure out which order the client means ------------------
    client = get_client("responder")
    extracted = _safe_json(client.chat(_EXTRACT_SYSTEM, state.raw_input))
    po_number = extracted.get("po_number")
    state.log(f"Responder extracted: {extracted}")

    # --- Step 2: look the order up in the datalake (SQL tool) -------------
    po = None
    if po_number:
        po = session.exec(
            select(PurchaseOrder).where(PurchaseOrder.po_number == po_number)
        ).first()

    if po is None:
        # We can't confirm a date — hand a triage draft to a human instead of
        # inventing one. Honesty beats a confident wrong ETA.
        state.draft_summary = "Client delivery enquiry — order not found, needs human triage."
        state.draft_payload = {
            "kind": "EMAIL_REPLY",
            "to": state.user,
            "needs_human_triage": True,
            "raw": state.raw_input[:500],
        }
        return state

    # --- Step 3: draft the reply email, grounded in the real date ---------
    facts = (
        f"Order reference: {po.po_number}\n"
        f"Part: {po.part_reference}\n"
        f"Supplier: {po.supplier_name}\n"
        f"Confirmed forecast delivery date: {po.expected_delivery_date}"
    )
    drafted = _safe_json(client.chat(_REPLY_SYSTEM, facts))

    subject = drafted.get("subject", f"Delivery update for {po.po_number}")
    body = drafted.get("body", "")

    # --- Step 4: DLP on the OUTBOUND body, strict (recipient is external) --
    # A client is outside the company, so we scan as PUBLIC: any export-control
    # code (ECCN), secret or stray PII is stripped before a human even sees it.
    safe = apply_dlp(body, user_clearance="PUBLIC")
    if safe.reason:
        state.log(f"Responder DLP on outbound email: {safe.reason}")

    state.draft_summary = f"Reply to client re {po.po_number} (ETA {po.expected_delivery_date})"
    state.draft_payload = {
        "kind": "EMAIL_REPLY",
        "to": state.user,                 # the client we reply to (the sender)
        "po_number": po.po_number,
        "subject": subject,
        "body": safe.sanitized_text,
    }
    return state
