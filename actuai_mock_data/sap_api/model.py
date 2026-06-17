from sqlmodel import Field, SQLModel
from datetime import date
from typing import Optional

"""
Modèle de données pour l'API factice SAP BAPI.
"""

# --- MODULE MM : Achats ---
class PurchaseOrder(SQLModel, table=True):
    """
    Représente une commande d'achat dans le système SAP.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    po_number: str = Field(index=True)
    part_reference: str = Field(index=True)
    supplier_name: str
    quantity: int
    expected_delivery_date: date
    status: str = Field(default="OPEN")
    serial_number_expected: Optional[str] = Field(default=None)

# --- MODULE MM : Réceptions Physiques ---
class GoodsReceipt(SQLModel, table=True):
    """
    Représente une réception physique dans le système SAP.  
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    po_number: str = Field(foreign_key="purchaseorder.po_number", index=True)
    part_reference: str
    reception_date: date
    actual_serial_number: Optional[str] = Field(default=None, description="Numéro gravé sur la pièce")

# --- MODULE PP : Planning Production Airbus ---
class ProductionSchedule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    part_reference: str = Field(index=True)
    aircraft_program: str = Field(description="Ex: A350, A320")
    assembly_line_date: date = Field(description="Date limite \"Drop Dead\" pour éviter l'AOG")

# --- MODULE QM : Qualité ---
class QualityNotification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ncr_number: str = Field(unique=True, index=True, description="Numéro FNC")
    po_number: str = Field(foreign_key="purchaseorder.po_number")
    defect_type: str
    report_8d_status: str = Field(default="PENDING", description="Statut de l'action corrective")