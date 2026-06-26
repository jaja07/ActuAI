"""
database/models.py — The shape of the local datalake (PostgreSQL tables).

This merges the team's datalake mirror tables (``DatalakePurchaseOrder``,
``DatalakeProductionSchedule``) with the operational tables ActuAI itself needs
to run the multi-agent workflow:

  - Supplier / Delivery   : extra SAP-mirror context
  - IngestedEmail         : raw supplier emails received via webhook
  - ValidationTask        : the Human-in-the-Loop (HITL) queue of agent drafts
  - AuditLog              : append-only, hash-chained record of every action
  - SentEmail             : outbox of client replies approved by a human

``PurchaseOrder`` is exported as an alias of ``DatalakePurchaseOrder`` so the
agent code can keep its concise references while the canonical table name stays
the team's.
"""

from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import JSON, Column, Field, SQLModel


def utcnow() -> datetime:
    """
    Single source of truth for 'now'. We return a *naive* UTC timestamp on
    purpose: our columns are TIMESTAMP WITHOUT TIME ZONE, and inserting a
    timezone-aware value into a naive column raises. Every timestamp is UTC by
    convention, just without the explicit tzinfo tag.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# 1. SAP metadata mirrored locally (read-only copies pulled by the ETL)
# ---------------------------------------------------------------------------

class DatalakePurchaseOrder(SQLModel, table=True):
    """Table miroir des commandes d'achat dans le Datalake PostgreSQL."""
    __tablename__ = "purchase_orders"  # type: ignore

    id: Optional[int] = Field(default=None, primary_key=True)
    po_number: str = Field(index=True, unique=True, description="Numéro SAP unique")
    part_reference: str = Field(index=True)
    supplier_name: str = ""
    quantity: int = 0
    expected_delivery_date: Optional[date] = None
    status: str = "OPEN"  # OPEN / DELIVERED / DELAYED
    serial_number_expected: Optional[str] = Field(default=None)
    synced_at: datetime = Field(default_factory=utcnow)


class DatalakeProductionSchedule(SQLModel, table=True):
    """Table miroir du planning Airbus dans le Datalake."""
    __tablename__ = "production_schedules"  # type: ignore

    id: Optional[int] = Field(default=None, primary_key=True)
    part_reference: str = Field(index=True)
    aircraft_program: str
    assembly_line_date: date


class Supplier(SQLModel, table=True):
    __tablename__ = "suppliers"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    sap_supplier_id: str = Field(index=True, unique=True)
    name: str
    country: str = "FR"
    synced_at: datetime = Field(default_factory=utcnow)


class Delivery(SQLModel, table=True):
    """Actual delivery status, updated from supplier emails after validation."""
    __tablename__ = "deliveries"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    po_number: str = Field(index=True)
    status: str = "PENDING"  # PENDING / SHIPPED / DELAYED / RECEIVED
    actual_delivery_date: Optional[date] = None
    delay_days: int = 0
    updated_at: datetime = Field(default_factory=utcnow)


# ---------------------------------------------------------------------------
# 2. Operational tables owned by ActuAI
# ---------------------------------------------------------------------------

class IngestedEmail(SQLModel, table=True):
    """A raw supplier email received via the MS Exchange webhook."""
    __tablename__ = "ingested_emails"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    sender: str
    subject: str
    body: str
    received_at: datetime = Field(default_factory=utcnow)
    processed: bool = False


class TaskStatus(str, Enum):
    PENDING = "PENDING"      # drafted by an agent, waiting for a human
    APPROVED = "APPROVED"    # human validated -> will be executed
    REJECTED = "REJECTED"    # human rejected -> discarded
    EXECUTED = "EXECUTED"    # change was pushed back to SAP


class ValidationTask(SQLModel, table=True):
    """
    The Human-in-the-Loop queue. An agent never writes to SAP directly; it
    drops a *draft* here. A human reviews it on the dashboard and approves or
    rejects. Only on approval does the backend push the change to SAP.
    """
    __tablename__ = "validation_tasks"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    mission: str                      # "M1".."M5" — which mission produced it
    agent: str                        # which agent drafted it
    # What approving this task DOES: "SAP_UPDATE" pushes to SAP, "EMAIL_REPLY"
    # sends an email to the client. Lets one queue hold both kinds of draft.
    kind: str = "SAP_UPDATE"
    summary: str                      # human-readable one-liner for the UI
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = Field(default_factory=utcnow)
    decided_at: Optional[datetime] = None
    decided_by: Optional[str] = None  # username of the validating expert


class AuditLog(SQLModel, table=True):
    """
    Append-only, hash-chained audit trail. Each row stores the hash of the
    previous row, so tampering with any entry breaks the chain and becomes
    detectable.
    """
    __tablename__ = "audit_log"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=utcnow, index=True)
    actor: str                        # who/what caused the event
    action: str                       # e.g. "LOGIN", "TASK_APPROVED"
    detail: dict = Field(default_factory=dict, sa_column=Column(JSON))
    prev_hash: str = ""               # hash of the previous entry
    entry_hash: str = ""              # hash of this entry (computed on insert)


class SentEmail(SQLModel, table=True):
    __tablename__ = "sent_emails"  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    to_address: str
    subject: str = ""
    body: str = ""
    sent_at: datetime = Field(default_factory=utcnow)
    sent_by: str = ""                 # the human who approved the send


# Concise alias used throughout the agent code. Binding a second name to the
# same SQLModel class is safe (no duplicate table is registered).
PurchaseOrder = DatalakePurchaseOrder
ProductionSchedule = DatalakeProductionSchedule
