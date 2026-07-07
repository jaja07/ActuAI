"""
generators/emails.py — Simulated supplier email flow.

Each call to generate_supplier_emails():
  1. Picks a random PurchaseOrder that actually exists in the SAP mock DB.
  2. Picks a random scenario (delay, shipment, quality issue).
  3. Calls Gemini (gemini-2.5-flash, free tier) to write a realistic English
     email body that explicitly references the real PO number.
  4. POSTs the email as a JSON webhook to the ActuAI backend ingestion route.

Using real PO numbers guarantees the Transactional agent can do a successful
SQL lookup and produce a meaningful HITL draft — without this the agent always
returns "PO not found in datalake".
"""

import random

import requests
from faker import Faker
from google import genai
from sqlmodel import Session, create_engine, select

from actuai_mock_data.config import settings
from actuai_mock_data.sap_api.model import PurchaseOrder

fake = Faker("fr_FR")

# One shared Gemini client (configured once at import time).
_gemini = genai.Client(api_key=settings.google_api_key)

# Three scenarios the Transactional agent knows how to handle.
_SCENARIOS = [
    {
        "subject_tpl": "Delivery delay alert — {po}",
        "type": "DELAY",
        "instruction": (
            "Inform the client of a {delay}-day delay on purchase order {po}. "
            "Give the new estimated date ({new_date}). Be direct and factual."
        ),
    },
    {
        "subject_tpl": "Shipping confirmation — {po}",
        "type": "SHIPPED",
        "instruction": (
            "Confirm that purchase order {po} shipped today. "
            "State that delivery is expected on the contractual date."
        ),
    },
    {
        "subject_tpl": "Quality issue detected in the factory — {po}",
        "type": "FNC",
        "instruction": (
            "Report a quality defect ({defect}) on part {part} of purchase order {po}. "
            "Request the creation of a non-conformance report (FNC)."
        ),
    },
]

_DEFECTS = [
    "scratch on the housing",
    "missing material certificate",
    "dimensional error out of tolerance",
    "oxidation on the connector",
]


def _fetch_random_po() -> PurchaseOrder | None:
    """Query the SAP mock DB and return a random PurchaseOrder."""
    engine = create_engine(
        settings.database_url, connect_args={"check_same_thread": False}
    )
    with Session(engine) as session:
        pos = session.exec(select(PurchaseOrder)).all()
    return random.choice(pos) if pos else None


def _build_prompt(po: PurchaseOrder, scenario: dict, delay: int) -> str:
    from datetime import timedelta

    new_date = (
        (po.expected_delivery_date + timedelta(days=delay)).isoformat()
        if po.expected_delivery_date
        else "unknown date"
    )
    instruction = scenario["instruction"].format(
        po=po.po_number,
        part=po.part_reference,
        delay=delay,
        new_date=new_date,
        defect=random.choice(_DEFECTS),
    )
    return (
        f"You are an aerospace supplier ({po.supplier_name}) writing a concise, "
        f"professional email in English to your client.\n\n"
        f"Context: {instruction}\n\n"
        f"Rules:\n"
        f"- Explicitly mention purchase order number {po.po_number}\n"
        f"- 3 to 5 sentences maximum\n"
        f"- No signature, no subject line — only the message body\n"
        f"- Professional but direct tone"
    )


def _call_gemini(prompt: str, po_number: str) -> str:
    """Call Gemini and return the generated body; fall back to a template on error."""
    try:
        response = _gemini.models.generate_content(
            model="gemini-2.5-flash", contents=prompt
        )
        return response.text.strip()
    except Exception as exc:
        print(f"  [Gemini] Error: {exc} — using the fallback template.")
        return (
            f"Dear Sir or Madam,\n\n"
            f"Please be informed of an update concerning purchase order {po_number}. "
            f"Kindly take this information into account in your planning.\n\n"
            f"Best regards,\nLogistics Department"
        )


def generate_supplier_emails(num_emails: int = 1) -> None:
    print("Simulating the MS Exchange supplier email flow...")

    for _ in range(num_emails):
        po = _fetch_random_po()
        if po is None:
            print("  [X] No purchase orders in the database — has the seeder been run?")
            continue

        scenario = random.choice(_SCENARIOS)
        delay = random.randint(3, 15) if scenario["type"] == "DELAY" else 0

        prompt = _build_prompt(po, scenario, delay)
        body = _call_gemini(prompt, po.po_number)

        subject = scenario["subject_tpl"].format(po=po.po_number)
        email_payload = {
            "message_id": fake.uuid4(),
            "sender": f"logistics@{po.supplier_name.lower().replace(' ', '')}.com",
            "subject": subject,
            "date": fake.iso8601(),
            "body": body,
        }

        headers = {}
        if settings.webhook_shared_secret:
            headers["X-Webhook-Token"] = settings.webhook_shared_secret

        try:
            response = requests.post(
                str(settings.webhook_target_url),
                json=email_payload,
                headers=headers,
                timeout=30,
            )
            if response.ok:
                print(f"  [OK] Email sent: {subject} (HTTP {response.status_code})")
            else:
                print(f"  [X] Backend rejected the email (HTTP {response.status_code}) : "
                      f"{response.text[:200]}")
        except requests.exceptions.RequestException as exc:
            print(f"  [X] Backend unreachable ({exc.__class__.__name__}) — "
                  f"email generated locally: {subject}")
            print(f"      Body : {body[:120]}...")


if __name__ == "__main__":
    generate_supplier_emails()
