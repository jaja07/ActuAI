"""
generators/emails.py — Simulated supplier email flow.

Each call to generate_supplier_emails():
  1. Picks a random PurchaseOrder that actually exists in the SAP mock DB.
  2. Picks a random scenario (delay, shipment, quality issue).
  3. Calls Gemini (gemini-2.5-flash, free tier) to write a realistic French
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
        "subject_tpl": "Alerte retard livraison — {po}",
        "type": "DELAY",
        "instruction": (
            "Informe le client d'un retard de {delay} jours sur la commande {po}. "
            "Donne la nouvelle date estimée ({new_date}). Sois direct et factuel."
        ),
    },
    {
        "subject_tpl": "Confirmation d'expédition — {po}",
        "type": "SHIPPED",
        "instruction": (
            "Confirme l'expédition de la commande {po} aujourd'hui. "
            "Indique que la livraison est prévue à la date contractuelle."
        ),
    },
    {
        "subject_tpl": "Problème qualité détecté en usine — {po}",
        "type": "FNC",
        "instruction": (
            "Signale un défaut qualité ({defect}) sur la pièce {part} de la commande {po}. "
            "Demande l'ouverture d'une fiche de non-conformité (FNC)."
        ),
    },
]

_DEFECTS = [
    "rayure sur carter",
    "absence de certificat matière",
    "erreur dimensionnelle hors tolérance",
    "oxydation sur connecteur",
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
        else "date inconnue"
    )
    instruction = scenario["instruction"].format(
        po=po.po_number,
        part=po.part_reference,
        delay=delay,
        new_date=new_date,
        defect=random.choice(_DEFECTS),
    )
    return (
        f"Tu es un fournisseur aérospatial ({po.supplier_name}) qui écrit un email "
        f"professionnel et concis en français à son client.\n\n"
        f"Contexte : {instruction}\n\n"
        f"Règles :\n"
        f"- Mentionne explicitement le numéro de commande {po.po_number}\n"
        f"- 3 à 5 phrases maximum\n"
        f"- Pas de signature, pas d'objet — uniquement le corps du message\n"
        f"- Ton professionnel mais direct"
    )


def _call_gemini(prompt: str, po_number: str) -> str:
    """Call Gemini and return the generated body; fall back to a template on error."""
    try:
        response = _gemini.models.generate_content(
            model="gemini-2.5-flash", contents=prompt
        )
        return response.text.strip()
    except Exception as exc:
        print(f"  [Gemini] Erreur : {exc} — utilisation du fallback.")
        return (
            f"Madame, Monsieur,\n\n"
            f"Nous vous informons d'une mise à jour concernant la commande {po_number}. "
            f"Merci de bien vouloir prendre en compte cette information dans votre planning.\n\n"
            f"Cordialement,\nService Logistique"
        )


def generate_supplier_emails(num_emails: int = 1) -> None:
    print("Simulation du flux d'emails fournisseurs MS Exchange...")

    for _ in range(num_emails):
        po = _fetch_random_po()
        if po is None:
            print("  [X] Aucune commande en base — le seeder a-t-il été lancé ?")
            continue

        scenario = random.choice(_SCENARIOS)
        delay = random.randint(3, 15) if scenario["type"] == "DELAY" else 0

        prompt = _build_prompt(po, scenario, delay)
        body = _call_gemini(prompt, po.po_number)

        subject = scenario["subject_tpl"].format(po=po.po_number)
        email_payload = {
            "message_id": fake.uuid4(),
            "sender": f"logistique@{po.supplier_name.lower().replace(' ', '')}.com",
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
                print(f"  [OK] Email envoyé : {subject} (HTTP {response.status_code})")
            else:
                print(f"  [X] Backend a refusé l'email (HTTP {response.status_code}) : "
                      f"{response.text[:200]}")
        except requests.exceptions.RequestException as exc:
            print(f"  [X] Backend injoignable ({exc.__class__.__name__}) — "
                  f"email généré localement : {subject}")
            print(f"      Body : {body[:120]}...")


if __name__ == "__main__":
    generate_supplier_emails()
