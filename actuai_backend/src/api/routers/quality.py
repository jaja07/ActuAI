"""
api/routers/quality.py — Mission 3: Non-Conformance (FNC) & 8D lifecycle.

GET  /api/quality/fncs                     List the mirrored FNCs (any user).
POST /api/quality/fncs/{ncr}/advance       Advance the 8D report to the next
                                           step (quality-authorized roles).

The condensed 8D state machine is forward-only:

    PENDING -> D3_CONTAINMENT -> D5_CORRECTIVE_ACTION -> D8_CLOSED

The status write goes to SAP FIRST (SAPConnector.push_8d_status), then the
local mirror is updated. SAP stays the source of truth, so the periodic ETL
sync — which re-mirrors report_8d_status on every tick — can never silently
roll a transition back.
"""

from typing import Annotated

import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from api.dependencies import Role, TokenUser, get_current_user, get_session, require_roles
from database.models import DatalakeQualityNotification, utcnow
from etl.sap_connector import SAPConnector
from security import audit

router = APIRouter(prefix="/api/quality", tags=["Quality / 8D"])

# Condensed 8D lifecycle. Must stay aligned with the mock SAP
# (actuai_mock_data/sap_api/main.py::EIGHT_D_SEQUENCE).
EIGHT_D_SEQUENCE = ["PENDING", "D3_CONTAINMENT", "D5_CORRECTIVE_ACTION", "D8_CLOSED"]


@router.get("/fncs")
def list_fncs(
    user: Annotated[TokenUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
    status: str | None = None,
):
    """List the FNCs mirrored from SAP, newest first. Optional ?status= filter."""
    query = select(DatalakeQualityNotification).order_by(
        DatalakeQualityNotification.synced_at.desc()  # type: ignore[attr-defined]
    )
    if status:
        query = query.where(DatalakeQualityNotification.report_8d_status == status)
    return session.exec(query).all()


@router.post("/fncs/{ncr_number}/advance")
def advance_8d(
    ncr_number: str,
    session: Annotated[Session, Depends(get_session)],
    user: Annotated[
        TokenUser,
        Depends(require_roles(Role.ENGINEER, Role.COMPLIANCE_OFFICER, Role.OPERATOR_ADMIN)),
    ],
):
    """
    Advance an FNC's 8D report to the next lifecycle step (forward-only, no
    reopen — consistent with the append-only audit philosophy).
    """
    ncr = session.exec(
        select(DatalakeQualityNotification).where(
            DatalakeQualityNotification.ncr_number == ncr_number
        )
    ).first()
    if ncr is None:
        raise HTTPException(status_code=404, detail=f"FNC {ncr_number} not found")

    current = ncr.report_8d_status
    if current == "CLOSED":  # legacy SAP value, treated as terminal
        raise HTTPException(status_code=409, detail="8D report already closed")
    try:
        index = EIGHT_D_SEQUENCE.index(current)
    except ValueError:
        raise HTTPException(status_code=409, detail=f"Unknown 8D status '{current}'")
    if index >= len(EIGHT_D_SEQUENCE) - 1:
        raise HTTPException(status_code=409, detail="8D report already closed (D8)")
    new_status = EIGHT_D_SEQUENCE[index + 1]

    # SAP first, mirror second — see module docstring.
    try:
        SAPConnector().push_8d_status(ncr_number, new_status)
    except (requests.exceptions.RequestException, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=f"SAP write failed: {exc}")

    ncr.report_8d_status = new_status
    ncr.synced_at = utcnow()
    audit.record(
        session, actor=user.username, action="FNC_8D_ADVANCED",
        detail={"ncr_number": ncr_number, "from": current, "to": new_status},
    )
    return {"ncr_number": ncr_number, "previous_status": current, "new_status": new_status}
