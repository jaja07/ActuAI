"""
etl/sap_connector.py — The SAP / BAPI ETL connector (synchronous).

WHAT THIS DOES
--------------
It queries the simulated SAP API (``actuai_mock_data`` -> sap_api/main.py) and
copies the purchase orders into our PostgreSQL datalake. This is a READ path.
Writing back to SAP (pushing a new delivery date) happens only after human
validation — see ``SAPConnector.push_delivery_date`` called from the HITL router.

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
from database.models import DatalakeProductionSchedule, DatalakePurchaseOrder, Supplier
from security import audit


class SAPConnector:
    """A light, resilient HTTP client for the mock SAP BAPI."""

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.BAPI_BASE_URL).rstrip("/")

    # ---- low-level GET with retry/backoff --------------------------------
    def _get(self, path: str, retries: int = 3) -> list[dict]:
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

    # ---- upsert one purchase order into the datalake ---------------------
    def _upsert_po(self, session: Session, r: dict) -> None:
        existing = session.exec(
            select(DatalakePurchaseOrder).where(
                DatalakePurchaseOrder.po_number == r["po_number"]
            )
        ).first()

        edate = r.get("expected_delivery_date")
        expected = date.fromisoformat(edate) if isinstance(edate, str) else edate

        fields = dict(
            po_number=r["po_number"],
            part_reference=r["part_reference"],
            supplier_name=r.get("supplier_name", ""),
            quantity=int(r.get("quantity") or 0),
            expected_delivery_date=expected,
            status=r.get("status", "OPEN"),
            serial_number_expected=r.get("serial_number_expected"),
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            session.add(existing)
        else:
            session.add(DatalakePurchaseOrder(**fields))

    def sync_purchase_orders(self, session: Session) -> int:
        """Pull every PO from SAP and upsert it into the datalake (idempotent)."""
        rows = self._get("/api/bapi/purchase-orders/")
        for r in rows:
            self._upsert_po(session, r)
        return len(rows)

    def derive_suppliers(self, session: Session) -> int:
        rows = self._get("/api/bapi/purchase-orders/")
        names = {r["supplier_name"] for r in rows if r.get("supplier_name")}
        for name in names:
            existing = session.exec(
                select(Supplier).where(Supplier.sap_supplier_id == name)
            ).first()
            if not existing:
                session.add(Supplier(sap_supplier_id=name, name=name))
        return len(names)

    def sync_production_schedules(self, session: Session) -> int:
        """Pull the Airbus production schedule into the datalake.

        Needed by Mission 2 (Production Scheduling): the Transactional agent
        cross-references a delayed delivery against the assembly-line date.
        """
        rows = self._get("/api/bapi/production-schedules/")
        for r in rows:
            adate = r.get("assembly_line_date")
            assembly = date.fromisoformat(adate) if isinstance(adate, str) else adate
            existing = session.exec(
                select(DatalakeProductionSchedule).where(
                    DatalakeProductionSchedule.part_reference == r["part_reference"]
                )
            ).first()
            fields = dict(
                part_reference=r["part_reference"],
                aircraft_program=r.get("aircraft_program", ""),
                assembly_line_date=assembly,
            )
            if existing:
                for k, v in fields.items():
                    setattr(existing, k, v)
                session.add(existing)
            else:
                session.add(DatalakeProductionSchedule(**fields))
        return len(rows)

    def full_sync(self, session: Session) -> dict:
        """Full sync: POs + suppliers + production schedules. Used by ETL and boot."""
        pos = self.sync_purchase_orders(session)
        suppliers = self.derive_suppliers(session)
        schedules = self.sync_production_schedules(session)
        result = {"purchase_orders": pos, "suppliers": suppliers, "schedules": schedules}
        audit.record(session, actor="sap_connector", action="SAP_SYNC", detail=result)
        return result

    # ---- write-back: push a new delivery date to SAP (after HITL) --------
    def push_delivery_date(self, po_number: str, new_date: str) -> dict:
        url = f"{self.base_url}/api/bapi/purchase-orders/{po_number}/update-date"
        resp = requests.put(url, params={"new_date": new_date}, timeout=10)
        resp.raise_for_status()
        return resp.json()

    # ---- write-back: create a Non-Conformance Report in SAP (Mission 3) --
    def create_quality_notification(self, payload: dict) -> dict:
        """POST a Quality Notification (FNC) to SAP after human approval."""
        url = f"{self.base_url}/api/bapi/quality-notifications/"
        body = {
            "ncr_number": payload["ncr_number"],
            "po_number": payload["po_number"],
            "defect_type": payload.get("defect_type", "UNSPECIFIED"),
            "report_8d_status": payload.get("report_8d_status", "PENDING"),
        }
        resp = requests.post(url, json=body, timeout=10)
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Functional entrypoints (kept for the team's `uv run python -m etl.sap_connector`)
# ---------------------------------------------------------------------------

def extract_and_load_purchase_orders() -> None:
    print("🔄 Extraction des commandes d'achat depuis SAP (BAPI)...")
    connector = SAPConnector()
    try:
        with Session(engine) as session:
            count = connector.sync_purchase_orders(session)
            connector.derive_suppliers(session)
            schedules = connector.sync_production_schedules(session)
            session.commit()
        print(f"✅ {count} commandes synchronisées avec succès dans PostgreSQL.")
        print(f"✅ {schedules} lignes de planning de production synchronisées (Mission 2).")
    except (requests.exceptions.RequestException, RuntimeError) as e:
        print(f"❌ Erreur de connexion au mock SAP : {e}")


def run_pipeline() -> None:
    print("🚀 Démarrage du pipeline ETL ActuAI...")
    init_db()
    extract_and_load_purchase_orders()
    print("🏁 Pipeline terminé.")


if __name__ == "__main__":
    run_pipeline()
