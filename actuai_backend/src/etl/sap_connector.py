"""
etl/sap_connector.py — The SAP / BAPI ETL connector (synchronous).

WHAT THIS DOES
--------------
It queries the simulated SAP API (``actuai_mock_data`` -> sap_api/main.py) and
mirrors all 4 BAPI entities into our PostgreSQL datalake: purchase orders,
production schedules, goods receipts and quality notifications (NCRs). This is
a READ path. Writing back to SAP (pushing a new delivery date) happens only
after human validation — see ``SAPConnector.push_delivery_date`` called from
the HITL router.

It keeps the team's simple functional entrypoints (``extract_and_load_purchase_orders``
and ``run_pipeline`` for ``python -m etl.sap_connector``) and adds a robust,
reusable ``SAPConnector`` class (retries, supplier derivation, write-back) used
by the API and the background scheduler.
"""

import time
from datetime import date

import requests
from sqlmodel import Session, select

from config import settings
from database.connection import engine, init_db
from database.models import (
    DatalakeGoodsReceipt,
    DatalakeProductionSchedule,
    DatalakePurchaseOrder,
    DatalakeQualityNotification,
    Supplier,
)
from security import audit


class SAPConnector:
    """A light, resilient HTTP client for the mock SAP BAPI."""

    def __init__(self, base_url: str | None = None):
        """Use ``base_url`` if given, otherwise fall back to ``settings.BAPI_BASE_URL``."""
        self.base_url = (base_url or settings.BAPI_BASE_URL).rstrip("/")

    # ---- low-level GET with retry/backoff --------------------------------
    def _get(self, path: str, retries: int = 3) -> list[dict]:
        """GET ``path`` off the BAPI, retrying with exponential backoff (1s, 2s, 4s...)."""
        url = f"{self.base_url}{path}"
        last_error: Exception | None = None
        for attempt in range(retries):
            try:
                resp = requests.get(url, timeout=10)
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.RequestException as exc:
                last_error = exc
                time.sleep(2 ** attempt)  # 1s, 2s, 4s
        raise RuntimeError(f"BAPI GET {url} a échoué après {retries} essais : {last_error}")

    @staticmethod
    def _as_date(value):
        """Parse an ISO date string into a ``date``; pass through anything else unchanged."""
        return date.fromisoformat(value) if isinstance(value, str) else value

    # ---- upsert one purchase order into the datalake ---------------------
    def _upsert_po(self, session: Session, r: dict) -> None:
        """Insert or update the datalake's purchase order matching ``r["po_number"]``."""
        existing = session.exec(
            select(DatalakePurchaseOrder).where(
                DatalakePurchaseOrder.po_number == r["po_number"]
            )
        ).first()

        fields = dict(
            po_number=r["po_number"],
            part_reference=r["part_reference"],
            supplier_name=r.get("supplier_name", ""),
            quantity=int(r.get("quantity") or 0),
            expected_delivery_date=self._as_date(r.get("expected_delivery_date")),
            status=r.get("status", "OPEN"),
            serial_number_expected=r.get("serial_number_expected"),
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            session.add(existing)
        else:
            session.add(DatalakePurchaseOrder(**fields)) #type: ignore

    def sync_purchase_orders(self, session: Session) -> int:
        """Pull every PO from SAP and upsert it into the datalake (idempotent)."""
        rows = self._get("/api/bapi/purchase-orders/")
        for r in rows:
            self._upsert_po(session, r)
        return len(rows)

    def derive_suppliers(self, session: Session) -> int:
        """Create any supplier name seen on a purchase order that isn't in the datalake yet."""
        rows = self._get("/api/bapi/purchase-orders/")
        names = {r["supplier_name"] for r in rows if r.get("supplier_name")}
        for name in names:
            existing = session.exec(
                select(Supplier).where(Supplier.sap_supplier_id == name)
            ).first()
            if not existing:
                session.add(Supplier(sap_supplier_id=name, name=name))
        return len(names)

    # ---- upsert one production schedule entry -----------------------------
    def _upsert_schedule(self, session: Session, r: dict) -> None:
        """Insert or update the datalake's schedule entry matching ``r["part_reference"]``."""
        existing = session.exec(
            select(DatalakeProductionSchedule).where(
                DatalakeProductionSchedule.part_reference == r["part_reference"]
            )
        ).first()

        fields = dict(
            part_reference=r["part_reference"],
            aircraft_program=r["aircraft_program"],
            assembly_line_date=self._as_date(r["assembly_line_date"]),
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            session.add(existing)
        else:
            session.add(DatalakeProductionSchedule(**fields)) # type: ignore

    def sync_production_schedules(self, session: Session) -> int:
        """Pull the Airbus assembly line schedule and upsert it (idempotent)."""
        rows = self._get("/api/bapi/production-schedules/")
        for r in rows:
            self._upsert_schedule(session, r)
        return len(rows)

    # ---- upsert one goods receipt ------------------------------------------
    def _upsert_receipt(self, session: Session, r: dict) -> None:
        """Insert or update the datalake's goods receipt matching ``r["po_number"]``."""
        existing = session.exec(
            select(DatalakeGoodsReceipt).where(
                DatalakeGoodsReceipt.po_number == r["po_number"]
            )
        ).first()

        fields = dict(
            po_number=r["po_number"],
            part_reference=r["part_reference"],
            reception_date=self._as_date(r["reception_date"]),
            actual_serial_number=r.get("actual_serial_number"),
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            session.add(existing)
        else:
            session.add(DatalakeGoodsReceipt(**fields)) # type: ignore

    def sync_goods_receipts(self, session: Session) -> int:
        """Pull every physical goods receipt and upsert it (idempotent)."""
        rows = self._get("/api/bapi/goods-receipts/")
        for r in rows:
            self._upsert_receipt(session, r)
        return len(rows)

    # ---- upsert one quality notification (NCR) -----------------------------
    def _upsert_ncr(self, session: Session, r: dict) -> None:
        """Insert or update the datalake's NCR matching ``r["ncr_number"]``."""
        existing = session.exec(
            select(DatalakeQualityNotification).where(
                DatalakeQualityNotification.ncr_number == r["ncr_number"]
            )
        ).first()

        fields = dict(
            ncr_number=r["ncr_number"],
            po_number=r["po_number"],
            defect_type=r["defect_type"],
            report_8d_status=r.get("report_8d_status", "PENDING"),
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            session.add(existing)
        else:
            session.add(DatalakeQualityNotification(**fields))

    def sync_quality_notifications(self, session: Session) -> int:
        """Pull every non-conformance report (NCR) and upsert it (idempotent)."""
        rows = self._get("/api/bapi/quality-notifications/")
        for r in rows:
            self._upsert_ncr(session, r)
        return len(rows)

    def full_sync(self, session: Session) -> dict:
        """Full sync: all 4 BAPI entities + derived suppliers. Used by ETL and boot."""
        result = {
            "purchase_orders": self.sync_purchase_orders(session),
            "production_schedules": self.sync_production_schedules(session),
            "goods_receipts": self.sync_goods_receipts(session),
            "quality_notifications": self.sync_quality_notifications(session),
            "suppliers": self.derive_suppliers(session),
        }
        audit.record(session, actor="sap_connector", action="SAP_SYNC", detail=result)
        return result

    # ---- write-back: push a new delivery date to SAP (after HITL) --------
    def push_delivery_date(self, po_number: str, new_date: str) -> dict:
        """Push a human-approved delivery date change back to SAP for ``po_number``."""
        url = f"{self.base_url}/api/bapi/purchase-orders/{po_number}/update-date"
        resp = requests.put(url, params={"new_date": new_date}, timeout=10)
        resp.raise_for_status()
        return resp.json()

    # ---- write-back: advance the 8D report status in SAP (Mission 3) -----
    def push_8d_status(self, ncr_number: str, new_status: str) -> dict:
        """Push a human-approved 8D status transition back to SAP. SAP stays the
        source of truth: the ETL mirror re-reads this value on every sync."""
        url = f"{self.base_url}/api/bapi/quality-notifications/{ncr_number}/8d-status"
        resp = requests.put(url, params={"new_status": new_status}, timeout=10)
        resp.raise_for_status()
        return resp.json()

    # ---- write-back: create a Non-Conformance Report in SAP (Mission 3) --
    def create_quality_notification(self, ncr_number: str, po_number: str, defect_type: str) -> dict:
        """Push a human-approved FNC (Quality Notification) into SAP for ``po_number``."""
        url = f"{self.base_url}/api/bapi/quality-notifications/"
        resp = requests.post(url, json={
            "ncr_number": ncr_number,
            "po_number": po_number,
            "defect_type": defect_type,
            "report_8d_status": "PENDING",
        }, timeout=10)
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Functional entrypoints (kept for the team's `uv run python -m etl.sap_connector`)
# ---------------------------------------------------------------------------

def extract_and_load_purchase_orders() -> None:
    """Run a full SAP sync via a fresh ``SAPConnector`` and print a one-line summary."""
    print("Extraction des commandes d'achat depuis SAP (BAPI)...")
    connector = SAPConnector()
    try:
        with Session(engine) as session:
            result = connector.full_sync(session)
            session.commit()
        print(
            f"{result['purchase_orders']} commandes, {result['production_schedules']} plannings, "
            f"{result['goods_receipts']} réceptions, {result['quality_notifications']} FNC et "
            f"{result['suppliers']} fournisseurs synchronisés avec succès dans PostgreSQL."
        )
    except (requests.exceptions.RequestException, RuntimeError) as e:
        print(f"Erreur de connexion au mock SAP : {e}")


def run_pipeline() -> None:
    """Entrypoint for ``python -m etl.sap_connector``: init the datalake, then sync."""
    print("Démarrage du pipeline ETL ActuAI...")
    init_db()
    extract_and_load_purchase_orders()
    print("Pipeline terminé.")


if __name__ == "__main__":
    run_pipeline()
