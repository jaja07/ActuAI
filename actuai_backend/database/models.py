from sqlmodel import Field, SQLModel
from datetime import date
from typing import Optional

class DatalakePurchaseOrder(SQLModel, table=True):
    """Table miroir des commandes dans le Datalake PostgreSQL"""
    __tablename__ = "purchase_orders" # type: ignore
    
    id: Optional[int] = Field(default=None, primary_key=True)
    po_number: str = Field(index=True, unique=True, description="Numéro SAP unique")
    part_reference: str = Field(index=True)
    supplier_name: str
    quantity: int
    expected_delivery_date: date
    status: str
    serial_number_expected: Optional[str] = Field(default=None)

class DatalakeProductionSchedule(SQLModel, table=True):
    """Table miroir du planning Airbus dans le Datalake"""
    __tablename__ = "production_schedules" # type: ignore
    
    id: Optional[int] = Field(default=None, primary_key=True)
    part_reference: str = Field(index=True)
    aircraft_program: str
    assembly_line_date: date