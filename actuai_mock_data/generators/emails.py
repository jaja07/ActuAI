import requests
import random
from faker import Faker
from actuai_mock_data.config import settings

fake = Faker('fr_FR')

def generate_supplier_emails(num_emails: int = 5):
    print("📧 Simulation du flux d'emails fournisseurs MS Exchange...")
    
    subjects = [
        "Confirmation d'expédition",
        "Alerte de retard de livraison",
        "Transmission du rapport 8D",
        "Problème qualité détecté en usine"
    ]
    
    for _ in range(num_emails):
        po_number = f"PO-{fake.random_int(400000, 499999)}"
        supplier = random.choice(["Safran", "Thales", "Liebherr", "Moog"])
        
        email_payload = {
            "message_id": fake.uuid4(),
            "sender": f"logistique@{supplier.lower()}.com",
            "subject": f"{random.choice(subjects)} - {po_number}",
            "date": fake.iso8601(),
            "body": fake.paragraph(nb_sentences=4) + f" Concerne la commande {po_number}.",
        }
        
        # Simulation de l'envoi vers l'ETL (qui n'existe pas encore)
        try:
            response = requests.post(str(settings.webhook_target_url), json=email_payload)
            print(f"  [➔] Email envoyé : {email_payload['subject']} (Statut: {response.status_code})")
        except requests.exceptions.ConnectionError:
            # Normal tant que ton backend principal n'est pas lancé
            print(f"  [X] Backend ETL injoignable. Payload généré en local : {email_payload['subject']}")

if __name__ == "__main__":
    generate_supplier_emails()