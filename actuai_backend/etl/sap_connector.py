import requests
from sqlmodel import Session, select
from actuai_backend.database.connection import engine, init_db
from actuai_backend.database.models import DatalakePurchaseOrder

SAP_MOCK_URL = "http://localhost:8080/api/bapi"

def extract_and_load_purchase_orders():
    print("🔄 Extraction des commandes d'achat depuis SAP (BAPI)...")
    try:
        response = requests.get(f"{SAP_MOCK_URL}/purchase-orders/")
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de connexion au mock SAP : {e}")
        return

    orders = response.json()
    
    with Session(engine) as session:
        for order_data in orders:
            # Upsert logique : on cherche si la commande existe déjà
            statement = select(DatalakePurchaseOrder).where(DatalakePurchaseOrder.po_number == order_data["po_number"])
            existing_order = session.exec(statement).first()
            
            if not existing_order:
                # Création (Nouvelle commande)
                new_po = DatalakePurchaseOrder(**order_data)
                new_po.id = None # Laisse PostgreSQL gérer l'ID incrémental
                session.add(new_po)
            else:
                # Mise à jour (Si la date ou le statut a changé côté SAP)
                existing_order.status = order_data["status"]
                existing_order.expected_delivery_date = order_data["expected_delivery_date"]
                session.add(existing_order)
                
        session.commit()
        print(f"✅ {len(orders)} commandes synchronisées avec succès dans PostgreSQL.")

def run_pipeline():
    print("🚀 Démarrage du pipeline ETL ActuAI...")
    init_db()
    extract_and_load_purchase_orders()
    print("🏁 Pipeline terminé.")

if __name__ == "__main__":
    run_pipeline()