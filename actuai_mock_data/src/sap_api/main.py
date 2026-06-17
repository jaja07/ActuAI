from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import Session, select, create_engine, SQLModel
from typing import List

from actuai_mock_data.config import settings
from src.sap_api.model import (
    PurchaseOrder, 
    GoodsReceipt, 
    ProductionSchedule, 
    QualityNotification
)

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

app = FastAPI(title="SAP BAPI Mock API", description="API factice pour le projet ActuAI")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

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
def update_delivery_date(po_number: str, new_date: str, session: Session = Depends(get_session)):
    """Permet à l'Agent de repousser une date de livraison (Mission 1 & 2)."""
    order = session.exec(select(PurchaseOrder).where(PurchaseOrder.po_number == po_number)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    
    order.expected_delivery_date = new_date  # type: ignore
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