"""
tests/test_features.py — Tests for the mission-gap features:

  1. Mission 3: the 8D lifecycle advances step by step (SAP-first) and refuses
     to move past D8_CLOSED or to touch an unknown FNC.
  2. Mission 2: the proactive schedule-discrepancy scan raises exactly one
     deduped AOG alert per (PO, ETA) pair.
  3. Mission 1: approving a SAP_UPDATE task upserts the ActuAI-owned Delivery
     record and refreshes the mirrored PO.
  4. Ingestion security: the webhook shared secret gates /api/ingest/email.

Same harness as test_actuai.py: SQLite + mock LLMs, no external services.
"""

import os

# Configure the app for tests BEFORE importing it.
os.environ.setdefault("USE_MOCK_LLM", "true")
os.environ.setdefault("DATABASE_URL_BACKEND", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-prod")

from datetime import date

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, select

from api.routers import triggers
from api.routers.hitl import approve_task
from api.routers.quality import EIGHT_D_SEQUENCE, advance_8d
from config import settings
from database.connection import engine, init_db
from database.models import (
    Delivery,
    ProductionSchedule,
    PurchaseOrder,
    QualityNotification,
    TaskStatus,
    ValidationTask,
)
from etl.aog_scanner import scan_schedule_discrepancies
from etl.sap_connector import SAPConnector
from security.auth import Role, TokenUser, seed_demo_users


@pytest.fixture(autouse=True)
def _setup():
    """Fresh, isolated schema + demo users before each test."""
    SQLModel.metadata.drop_all(engine)
    init_db()
    with Session(engine) as session:
        seed_demo_users(session)
        session.commit()
    yield


ENGINEER = TokenUser(username="expert", role=Role.ENGINEER, clearance="CONFIDENTIAL")


# ---------------------------------------------------------------------------
# 1. Mission 3 — 8D lifecycle
# ---------------------------------------------------------------------------

def test_8d_lifecycle_advances_and_closes(monkeypatch):
    pushed: list[tuple[str, str]] = []
    monkeypatch.setattr(
        SAPConnector, "push_8d_status",
        lambda self, ncr, status: pushed.append((ncr, status)) or {"status": "success"},
    )

    with Session(engine) as session:
        session.add(QualityNotification(
            ncr_number="FNC-26-TEST01", po_number="PO-400001",
            defect_type="Rayure sur carter", report_8d_status="PENDING",
        ))
        session.commit()

        # Walk the full sequence PENDING -> D3 -> D5 -> D8.
        for expected in EIGHT_D_SEQUENCE[1:]:
            result = advance_8d("FNC-26-TEST01", session, ENGINEER)
            assert result["new_status"] == expected
        session.commit()

        ncr = session.exec(
            select(QualityNotification).where(QualityNotification.ncr_number == "FNC-26-TEST01")
        ).first()
        assert ncr.report_8d_status == "D8_CLOSED"
        # Every transition went through SAP first.
        assert [s for _, s in pushed] == EIGHT_D_SEQUENCE[1:]

        # A closed report cannot advance further.
        with pytest.raises(HTTPException) as exc:
            advance_8d("FNC-26-TEST01", session, ENGINEER)
        assert exc.value.status_code == 409


def test_8d_advance_unknown_ncr_is_404():
    with Session(engine) as session:
        with pytest.raises(HTTPException) as exc:
            advance_8d("FNC-00-NOPE", session, ENGINEER)
        assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# 2. Mission 2 — proactive schedule-discrepancy scan
# ---------------------------------------------------------------------------

def test_proactive_scan_creates_deduped_aog_alert():
    with Session(engine) as session:
        # This PO's ETA misses the drop-dead date -> must alert.
        session.add(PurchaseOrder(
            po_number="PO-SCAN-1", part_reference="A350-TR-ACT-901",
            supplier_name="Safran", quantity=1, status="OPEN",
            expected_delivery_date=date(2026, 8, 20),
        ))
        session.add(ProductionSchedule(
            part_reference="A350-TR-ACT-901", aircraft_program="A350",
            assembly_line_date=date(2026, 8, 10),
        ))
        # This PO still meets the line -> no alert.
        session.add(PurchaseOrder(
            po_number="PO-SCAN-2", part_reference="A350-TR-ACT-902",
            supplier_name="Thales", quantity=1, status="OPEN",
            expected_delivery_date=date(2026, 8, 1),
        ))
        session.add(ProductionSchedule(
            part_reference="A350-TR-ACT-902", aircraft_program="A350",
            assembly_line_date=date(2026, 8, 10),
        ))
        session.commit()

        assert scan_schedule_discrepancies(session) == 1
        session.commit()

        tasks = session.exec(
            select(ValidationTask).where(ValidationTask.kind == "AOG_ALERT")
        ).all()
        assert len(tasks) == 1
        assert tasks[0].payload["po_number"] == "PO-SCAN-1"
        assert tasks[0].payload["detected_by"] == "proactive_scan"

        # Second sweep with unchanged data -> deduped, nothing new.
        assert scan_schedule_discrepancies(session) == 0


# ---------------------------------------------------------------------------
# 3. Mission 1 — Delivery write-back on approval
# ---------------------------------------------------------------------------

def test_approving_sap_update_writes_delivery_record(monkeypatch):
    monkeypatch.setattr(
        SAPConnector, "push_delivery_date",
        lambda self, po, new_date: {"status": "success"},
    )

    with Session(engine) as session:
        session.add(PurchaseOrder(
            po_number="PO-DLV-1", part_reference="A350-TR-ACT-777",
            supplier_name="Liebherr", quantity=3, status="OPEN",
            expected_delivery_date=date(2026, 7, 10),
        ))
        task = ValidationTask(
            mission="M1", agent="transactional", kind="SAP_UPDATE",
            summary="Delay of 8 days on PO-DLV-1",
            payload={
                "sap_action": "UPDATE_DELIVERY_DATE",
                "po_number": "PO-DLV-1",
                "new_status": "DELAYED",
                "delay_days": 8,
                "new_expected_date": "2026-07-18",
            },
            status=TaskStatus.PENDING,
        )
        session.add(task)
        session.commit()
        task_id = task.id

        approve_task(task_id, session, ENGINEER)
        session.commit()

        delivery = session.exec(
            select(Delivery).where(Delivery.po_number == "PO-DLV-1")
        ).first()
        assert delivery is not None
        assert delivery.status == "DELAYED"
        assert delivery.delay_days == 8

        po = session.exec(
            select(PurchaseOrder).where(PurchaseOrder.po_number == "PO-DLV-1")
        ).first()
        assert po.expected_delivery_date == date(2026, 7, 18)
        assert po.status == "DELAYED"

        refreshed = session.get(ValidationTask, task_id)
        assert refreshed.status == TaskStatus.EXECUTED


# ---------------------------------------------------------------------------
# 4. Webhook shared-secret authentication
# ---------------------------------------------------------------------------

def _ingest_client() -> TestClient:
    app = FastAPI()
    app.include_router(triggers.router)
    return TestClient(app)


EMAIL = {"sender": "logistique@safran.com", "subject": "Retard", "body": "Retard de 8 jours sur PO-A350-88123"}


def test_webhook_secret_disabled_allows_anonymous(monkeypatch):
    monkeypatch.setattr(settings, "WEBHOOK_SHARED_SECRET", "")
    response = _ingest_client().post("/api/ingest/email", json=EMAIL)
    assert response.status_code == 200


def test_webhook_secret_enforced(monkeypatch):
    monkeypatch.setattr(settings, "WEBHOOK_SHARED_SECRET", "sekrit")
    client = _ingest_client()

    # No credentials -> refused.
    assert client.post("/api/ingest/email", json=EMAIL).status_code == 401
    # Wrong token -> refused.
    assert client.post(
        "/api/ingest/email", json=EMAIL, headers={"X-Webhook-Token": "wrong"}
    ).status_code == 401
    # Correct machine token -> accepted.
    assert client.post(
        "/api/ingest/email", json=EMAIL, headers={"X-Webhook-Token": "sekrit"}
    ).status_code == 200
