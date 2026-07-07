import random
from datetime import timedelta
from faker import Faker
from sqlmodel import Session, create_engine, SQLModel

# Imports relatifs à ton projet
from actuai_mock_data.config import settings
from actuai_mock_data.sap_api.model import (
    PurchaseOrder, 
    GoodsReceipt, 
    ProductionSchedule, 
    QualityNotification
)

# Initialisation de Faker pour générer des données réalistes
fake = Faker('fr_FR')

# Listes de références métier
SUPPLIERS = ["Safran", "Thales", "Liebherr", "Moog", "Parker Aerospace"]
DEFECTS = ["Rayure sur carter", "Absence certificat matière", "Erreur dimensionnelle", "Oxydation connecteur"]

def seed_database():
    print("Initialisation de la base de données SAP factice...")
    engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
    
    # Réinitialisation (Drop & Create)
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        # 1. Création des références de pièces (A350 Thrust Reverser)
        part_references = [f"A350-TR-ACT-{fake.random_int(100, 999)}" for _ in range(15)]

        # 2. Remplissage du Planning de Production (Module PP)
        schedules = []
        for part in part_references:
            # La date d'assemblage (Drop Dead Date) est dans les 30 à 60 prochains jours
            assembly_date = fake.date_between(start_date='+30d', end_date='+60d')
            schedule = ProductionSchedule(
                part_reference=part,
                aircraft_program="A350",
                assembly_line_date=assembly_date
            )
            schedules.append(schedule)
            session.add(schedule)

        # 3. Remplissage des Commandes d'Achat (Module MM)
        purchase_orders = []
        for i in range(30): # On crée 30 commandes
            part = random.choice(part_references)
            # La livraison prévue est généralement AVANT la date d'assemblage
            expected_date = fake.date_between(start_date='-10d', end_date='+40d')
            
            po = PurchaseOrder(
                po_number=f"PO-{fake.unique.random_int(400000, 499999)}",
                part_reference=part,
                supplier_name=random.choice(SUPPLIERS),
                quantity=random.randint(1, 5),
                expected_delivery_date=expected_date,
                status=random.choice(["OPEN", "DELIVERED", "DELAYED"]),
                serial_number_expected=f"SN-{fake.random_int(1000, 9999)}"
            )
            purchase_orders.append(po)
            session.add(po)
        
        session.commit() # On commit pour pouvoir utiliser les po_number ensuite

        # 4. Remplissage des Réceptions (GoodsReceipt) et Non-Conformités (FNC)
        for po in purchase_orders:
            if po.status == "DELIVERED":
                # Si c'est livré, il y a une réception
                receipt = GoodsReceipt(
                    po_number=po.po_number,
                    part_reference=po.part_reference,
                    reception_date=po.expected_delivery_date - timedelta(days=random.randint(-2, 5)),
                    actual_serial_number=po.serial_number_expected # Généralement le même, mais on pourrait simuler une erreur
                )
                session.add(receipt)
                
                # 20% de chances d'avoir un défaut à la réception (Mission 3).
                # Le statut suit le cycle 8D condensé du backend :
                # PENDING -> D3_CONTAINMENT -> D5_CORRECTIVE_ACTION -> D8_CLOSED
                if random.random() < 0.2:
                    fnc = QualityNotification(
                        ncr_number=f"FNC-26-{fake.unique.random_int(100, 999)}",
                        po_number=po.po_number,
                        defect_type=random.choice(DEFECTS),
                        report_8d_status=random.choice(
                            ["PENDING", "D3_CONTAINMENT", "D5_CORRECTIVE_ACTION", "D8_CLOSED"]
                        )
                    )
                    session.add(fnc)

        session.commit()
        print("Base de données simulée avec succès !")
        print(f"   - {len(schedules)} pièces planifiées sur la ligne d'assemblage A350.")
        print(f"   - {len(purchase_orders)} commandes fournisseurs générées.")

if __name__ == "__main__":
    seed_database()