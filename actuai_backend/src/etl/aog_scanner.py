"""
etl/aog_scanner.py — Mission 2: production schedule coordination.

Two paths create AOG (Aircraft On Ground) risk alerts:

  - REACTIVE: a supplier delay email announces a new ETA that slips past the
    assembly line's drop-dead date (called from the Transactional agent while
    it drafts the SAP update).
  - PROACTIVE: every ETL tick, after the SAP mirror sync, scan ALL open
    purchase orders against the Airbus production schedule — a discrepancy is
    flagged even if no email ever arrives (the "flag blockages before they
    impact production" requirement).

Both paths converge on ``create_aog_task`` which dedupes: the same
(po_number, supplier_eta) pair never produces two alerts, so the proactive
scan can run every tick and a repeated delay email stays idempotent.
"""

import logging
from datetime import date

from sqlmodel import Session, select

from database.models import ProductionSchedule, PurchaseOrder, TaskStatus, ValidationTask
from security import audit

log = logging.getLogger("actuai.aog")


def _already_alerted(session: Session, po_number: str, supplier_eta: str) -> bool:
    """True if a live AOG alert already exists for this PO at this ETA."""
    existing = session.exec(
        select(ValidationTask).where(
            ValidationTask.kind == "AOG_ALERT",
            ValidationTask.status.in_([TaskStatus.PENDING, TaskStatus.EXECUTED]),  # type: ignore[attr-defined]
        )
    ).all()
    # The payload is a JSON column; filter in Python (the table is tiny) to
    # stay portable between PostgreSQL and the SQLite test harness.
    return any(
        t.payload.get("po_number") == po_number and t.payload.get("supplier_eta") == supplier_eta
        for t in existing
    )


def create_aog_task(
    session: Session,
    po: PurchaseOrder,
    schedule: ProductionSchedule,
    new_expected_date: date,
    detected_by: str,
) -> ValidationTask | None:
    """
    Raise an AOG_ALERT ValidationTask for a PO whose ETA slips past the
    assembly drop-dead date. Returns None when deduped or when the date still
    meets the line. ``detected_by`` is "delay_email" or "proactive_scan".
    """
    if new_expected_date <= schedule.assembly_line_date:
        return None
    if _already_alerted(session, po.po_number, new_expected_date.isoformat()):
        return None

    delay_vs_dropdead = (new_expected_date - schedule.assembly_line_date).days
    task = ValidationTask(
        mission="M2",
        agent="transactional" if detected_by == "delay_email" else "etl_scanner",
        kind="AOG_ALERT",
        summary=(
            f"Risque AOG : {po.part_reference} (PO {po.po_number}) attendu le "
            f"{new_expected_date.isoformat()}, mais requis en chaîne le "
            f"{schedule.assembly_line_date.isoformat()} ({delay_vs_dropdead} j de retard)."
        ),
        payload={
            "po_number": po.po_number,
            "part_reference": po.part_reference,
            "supplier_name": po.supplier_name,
            "aircraft_program": schedule.aircraft_program,
            "drop_dead_date": schedule.assembly_line_date.isoformat(),
            "supplier_eta": new_expected_date.isoformat(),
            "delay_vs_dropdead_days": delay_vs_dropdead,
            "detected_by": detected_by,
        },
        status=TaskStatus.PENDING,
    )
    session.add(task)
    session.flush()
    audit.record(
        session, actor=task.agent, action="AOG_RISK_DETECTED",
        detail={
            "task_id": task.id,
            "po_number": po.po_number,
            "delay_days": delay_vs_dropdead,
            "detected_by": detected_by,
        },
    )
    return task


def scan_schedule_discrepancies(session: Session) -> int:
    """
    Proactive Mission-2 sweep: every OPEN purchase order with a known ETA is
    joined against the production schedule; any ETA past the drop-dead date
    raises an (deduped) AOG alert. Returns the number of new alerts created.
    """
    open_pos = session.exec(
        select(PurchaseOrder).where(
            PurchaseOrder.status == "OPEN",
            PurchaseOrder.expected_delivery_date.is_not(None),  # type: ignore[union-attr]
        )
    ).all()

    created = 0
    for po in open_pos:
        schedule = session.exec(
            select(ProductionSchedule).where(
                ProductionSchedule.part_reference == po.part_reference
            )
        ).first()
        if schedule is None:
            continue
        task = create_aog_task(
            session, po, schedule, po.expected_delivery_date, detected_by="proactive_scan"
        )
        if task is not None:
            created += 1

    if created:
        log.info("Proactive AOG scan raised %d new alert(s)", created)
    return created
