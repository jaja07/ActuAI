"""
api/routers/health.py — Health, readiness and audit-integrity endpoints.

GET /healthz              liveness  — is the process up? (cheap, no dependencies)
GET /readyz               readiness — can we actually reach the database?
GET /api/audit/verify     recompute the audit hash chain (integrity KPI)
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlmodel import Session

from api.dependencies import Role, TokenUser, get_session, require_roles
from security import audit

router = APIRouter(tags=["Health"])


@router.get("/healthz")
def liveness():
    """Liveness: the app is running. Used by Docker's HEALTHCHECK."""
    return {"status": "ok"}


@router.get("/readyz")
def readiness(session: Annotated[Session, Depends(get_session)]):
    """Readiness: we can serve traffic because the DB answers a trivial query."""
    session.exec(text("SELECT 1"))
    return {"status": "ready"}


@router.get("/api/audit/verify")
def verify_audit(
    session: Annotated[Session, Depends(get_session)],
    # Only auditors and admins can run the integrity check.
    user: Annotated[TokenUser, Depends(require_roles(Role.AUDITOR, Role.OPERATOR_ADMIN))],
):
    intact = audit.verify_chain(session)
    return {"audit_chain_intact": intact}
