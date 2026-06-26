"""
api/routers/hitl.py — Human-in-the-Loop validation endpoints.

GET  /api/tasks               List PENDING validation tasks for the dashboard.
POST /api/tasks/{id}/approve  Human approves -> send the email OR push to SAP.
POST /api/tasks/{id}/reject   Human rejects  -> discard the draft.
GET  /api/mail/outbox         List the client replies that were approved & sent.

This implements the HITL contract: agents draft, humans decide, only approval
triggers a real-world effect. The URL shapes (/api/tasks/...) are kept exactly
as the frontend dashboard expects them.
"""

from datetime import date, timedelta
from typing import Annotated

import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from api.dependencies import Role, TokenUser, get_current_user, get_session, require_roles
from database.models import SentEmail, TaskStatus, ValidationTask, utcnow
from etl.sap_connector import SAPConnector
from security import audit

router = APIRouter(prefix="/api", tags=["Human in the Loop"])


@router.get("/tasks")
def list_tasks(
    user: Annotated[TokenUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    """Return PENDING tasks for the validation dashboard. Any logged-in user."""
    return session.exec(
        select(ValidationTask)
        .where(ValidationTask.status == TaskStatus.PENDING)
        .order_by(ValidationTask.created_at.desc())
    ).all()


@router.post("/tasks/{task_id}/approve")
def approve_task(
    task_id: int,
    session: Annotated[Session, Depends(get_session)],
    # Only engineers/buyers/admins may approve a write to SAP (RBAC).
    user: Annotated[
        TokenUser, Depends(require_roles(Role.ENGINEER, Role.BUYER, Role.OPERATOR_ADMIN))
    ],
):
    """
    Approve a draft. THIS is the only place an agent's work takes a real-world
    effect, and only after an explicit human action. Depending on the task kind
    we either send the drafted email to the client or push the update to SAP,
    then mark the task EXECUTED.
    """
    task = session.get(ValidationTask, task_id)
    if task is None or task.status != TaskStatus.PENDING:
        raise HTTPException(status_code=404, detail="No pending task with that id")

    if task.kind == "EMAIL_REPLY":
        # Record the client reply in OUR outbox (keeps the mock SAP untouched).
        # In production this is where a real Exchange/SMTP send goes.
        if task.payload.get("needs_human_triage"):
            raise HTTPException(status_code=409, detail="Draft needs manual completion before sending")
        session.add(SentEmail(
            to_address=task.payload.get("to", ""),
            subject=task.payload.get("subject", ""),
            body=task.payload.get("body", ""),
            sent_by=user.username,
        ))
    elif task.kind == "SAP_UPDATE":
        # Mission 1 write-back: PUT /api/bapi/purchase-orders/{po}/update-date
        if task.payload.get("needs_human_triage"):
            raise HTTPException(status_code=409, detail="Draft needs manual completion")
        po_number = task.payload.get("po_number")
        if not po_number:
            raise HTTPException(status_code=409, detail="Draft has no PO number to update")
        new_date = task.payload.get("new_expected_date")
        if not new_date:
            delay_days = int(task.payload.get("delay_days") or 0)
            new_date = (date.today() + timedelta(days=delay_days)).isoformat()
        try:
            SAPConnector().push_delivery_date(po_number, new_date)
        except (requests.exceptions.RequestException, RuntimeError) as exc:
            raise HTTPException(status_code=502, detail=f"SAP write failed: {exc}")
    elif task.kind == "FNC_CREATE":
        # Mission 3 write-back: create the Non-Conformance Report in SAP.
        if task.payload.get("needs_human_triage"):
            raise HTTPException(status_code=409, detail="Draft needs manual completion")
        try:
            SAPConnector().create_quality_notification(task.payload)
        except (requests.exceptions.RequestException, RuntimeError) as exc:
            raise HTTPException(status_code=502, detail=f"FNC creation failed: {exc}")
    else:
        # Mission 2 (SCHEDULE_ALERT) and Mission 4/5 (DOC_LOOKUP / TRACE_REPORT)
        # are informational: approving them acknowledges the finding. No external
        # system write — the audit trail below records the human decision.
        if task.payload.get("needs_human_triage"):
            raise HTTPException(status_code=409, detail="Draft needs manual completion")

    task.status = TaskStatus.EXECUTED
    task.decided_at = utcnow()
    task.decided_by = user.username
    audit.record(
        session, actor=user.username, action="TASK_APPROVED",
        detail={"task_id": task_id, "kind": task.kind},
    )
    return {"status": "executed", "kind": task.kind, "task_id": task_id}


@router.post("/tasks/{task_id}/reject")
def reject_task(
    task_id: int,
    session: Annotated[Session, Depends(get_session)],
    user: Annotated[TokenUser, Depends(get_current_user)],
):
    """Reject a draft. Nothing is written to SAP; the draft is discarded."""
    task = session.get(ValidationTask, task_id)
    if task is None or task.status != TaskStatus.PENDING:
        raise HTTPException(status_code=404, detail="No pending task with that id")
    task.status = TaskStatus.REJECTED
    task.decided_at = utcnow()
    task.decided_by = user.username
    audit.record(
        session, actor=user.username, action="TASK_REJECTED", detail={"task_id": task_id}
    )
    return {"status": "rejected", "task_id": task_id}


@router.get("/mail/outbox")
def list_outbox(
    user: Annotated[TokenUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    """List client reply emails that were approved and 'sent' (backend outbox)."""
    return session.exec(select(SentEmail).order_by(SentEmail.sent_at.desc())).all()
