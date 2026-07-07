import asyncio
import random
from contextlib import asynccontextmanager
from datetime import date
from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import Session, select, create_engine, SQLModel
from typing import List

from actuai_mock_data.generators.emails import generate_supplier_emails
from actuai_mock_data.config import settings
from actuai_mock_data.sap_api.model import (
    PurchaseOrder,
    GoodsReceipt,
    ProductionSchedule,
    QualityNotification
)

# Cycle de vie 8D condensé d'une FNC (doit rester aligné avec le backend,
# api/routers/quality.py).
EIGHT_D_SEQUENCE = ["PENDING", "D3_CONTAINMENT", "D5_CORRECTIVE_ACTION", "D8_CLOSED"]

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    sender_task = None
    if settings.email_send_enabled:
        sender_task = asyncio.create_task(periodic_email_sender())
    yield
    if sender_task is not None:
        sender_task.cancel()


app = FastAPI(
    title="SAP BAPI Mock API",
    description="API factice pour le projet ActuAI",
    lifespan=lifespan,
)

def get_session():
    with Session(engine) as session:
        yield session

# ==========================================
# ROUTES DE LECTURE (GET) - Pour l'ETL
# ==========================================

@app.get("/api/bapi/purchase-orders/", response_model=List[PurchaseOrder])
def get_all_purchase_orders(session: Session = Depends(get_session)):
    return session.exec(select(PurchaseOrder)).all()

@app.get("/api/bapi/purchase-orders/{po_number}", response_model=PurchaseOrder)
def get_purchase_order(po_number: str, session: Session = Depends(get_session)):
    order = session.exec(select(PurchaseOrder).where(PurchaseOrder.po_number == po_number)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return order

@app.get("/api/bapi/goods-receipts/", response_model=List[GoodsReceipt])
def get_all_goods_receipts(session: Session = Depends(get_session)):
    return session.exec(select(GoodsReceipt)).all()

@app.get("/api/bapi/production-schedules/", response_model=List[ProductionSchedule])
def get_all_production_schedules(session: Session = Depends(get_session)):
    return session.exec(select(ProductionSchedule)).all()

@app.get("/api/bapi/quality-notifications/", response_model=List[QualityNotification])
def get_all_quality_notifications(session: Session = Depends(get_session)):
    return session.exec(select(QualityNotification)).all()

# ==========================================
# ROUTES D'ÉCRITURE (POST / PUT) - Pour les Agents
# ==========================================

@app.put("/api/bapi/purchase-orders/{po_number}/update-date")
def update_delivery_date(po_number: str, new_date: date, session: Session = Depends(get_session)):
    """Permet à l'Agent de repousser une date de livraison (Mission 1 & 2)."""
    order = session.exec(select(PurchaseOrder).where(PurchaseOrder.po_number == po_number)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    order.expected_delivery_date = new_date
    session.add(order)
    session.commit()
    session.refresh(order)
    return {"status": "success", "updated_order": order}

@app.post("/api/bapi/quality-notifications/", response_model=QualityNotification)
def create_quality_notification(notification: QualityNotification, session: Session = Depends(get_session)):
    """Permet à l'Agent de créer une Fiche de Non-Conformité (FNC) dans SAP (Mission 3)."""
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return notification

@app.put("/api/bapi/quality-notifications/{ncr_number}/8d-status")
def update_8d_status(ncr_number: str, new_status: str, session: Session = Depends(get_session)):
    """Fait avancer le rapport 8D d'une FNC (Mission 3). SAP reste la source de
    vérité du statut : le backend écrit ici PUIS met à jour son miroir local."""
    if new_status not in EIGHT_D_SEQUENCE:
        raise HTTPException(
            status_code=422,
            detail=f"Statut 8D invalide. Attendu : {EIGHT_D_SEQUENCE}",
        )
    notification = session.exec(
        select(QualityNotification).where(QualityNotification.ncr_number == ncr_number)
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="FNC introuvable")

    notification.report_8d_status = new_status
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return {"status": "success", "updated_notification": notification}

# ==========================================
# GESTION DE LA SIMULATION EN ARRIÈRE-PLAN
# ==========================================

async def periodic_email_sender():
    """Boucle infinie qui envoie un email aléatoire de temps en temps.

    La cadence est pilotée par EMAIL_SEND_MIN_SECONDS / EMAIL_SEND_MAX_SECONDS
    (par défaut 90-240 s : assez vivant pour la démo sans saturer les quotas
    LLM du backend, qui traite chaque email avec de vrais appels NIM).
    """
    print("Simulateur d'emails en arrière-plan activé "
          f"(toutes les {settings.email_send_min_seconds}-{settings.email_send_max_seconds}s)...")
    while True:
        delay = random.randint(settings.email_send_min_seconds, settings.email_send_max_seconds)
        await asyncio.sleep(delay)

        print(f"\n[Auto-Simulation] Génération d'un email spontané après {delay}s...")
        await asyncio.to_thread(generate_supplier_emails, num_emails=1) # On utilise to_thread pour ne pas bloquer le serveur FastAPI


# ==========================================
# BOUTON MAGIQUE POUR LA DÉMO (Trigger Manuel)
# ==========================================

@app.post("/api/simulate/trigger-email")
async def trigger_manual_email():
    """Route de secours pour la présentation : force l'envoi d'un email IMMÉDIATEMENT."""
    print("\n[Démo] Déclenchement manuel d'un email fournisseur...")
    await asyncio.to_thread(generate_supplier_emails, num_emails=1)
    return {"status": "success", "message": "Email envoyé au backend LangGraph !"}