"""
api/routers/triggers.py — Ingestion endpoints (the workflow entry points).

POST /api/ingest/email          Receive a supplier/client email and launch one
                                orchestration cycle. Produces a HITL draft.
POST /api/v1/webhooks/exchange  Alias for the MS Exchange connector.

These are the "triggers" of the system: each inbound event runs the agent graph
which ends in a PENDING ValidationTask. Nothing is written to SAP here.
"""

import secrets
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlmodel import Session

from agents.graph import run_cycle
from agents.state import GlobalState
from api.dependencies import get_session
from api.schemas import EmailIn
from config import settings
from database.models import IngestedEmail

router = APIRouter(prefix="/api", tags=["Triggers"])


def verify_ingest_caller(
    request: Request,
    x_webhook_token: Annotated[str | None, Header(alias="X-Webhook-Token")] = None,
) -> None:
    """
    Guard for the machine-to-machine ingestion routes.

    Accepts either the shared webhook secret (X-Webhook-Token, used by the mock
    email generator / Exchange connector) or a valid user JWT (the dashboard's
    "Simulate Email" button). Disabled when WEBHOOK_SHARED_SECRET is empty.
    """
    secret = settings.WEBHOOK_SHARED_SECRET
    if not secret:
        return

    if x_webhook_token and secrets.compare_digest(x_webhook_token, secret):
        return

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            jwt.decode(auth_header[7:], settings.JWT_SECRET, algorithms=["HS256"])
            return
        except jwt.PyJWTError:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid webhook credentials",
    )


@router.post("/ingest/email", dependencies=[Depends(verify_ingest_caller)])
def ingest_email(
    email: EmailIn,
    session: Annotated[Session, Depends(get_session)],
):
    """
    Webhook target for incoming emails. We store the raw email, then run one
    orchestration cycle which ends in a PENDING validation task.

    Protected by a shared webhook secret (X-Webhook-Token) or a valid user JWT;
    the check is disabled when WEBHOOK_SHARED_SECRET is empty (dev/tests).
    """
    # 1. Persist the raw email (traceability).
    record = IngestedEmail(sender=email.sender, subject=email.subject, body=email.body)
    session.add(record)
    session.flush()

    # 2. Run the agent cycle on the email body.
    state = GlobalState(trigger="email", raw_input=email.body, user=email.sender)
    state = run_cycle(state, session)
    record.processed = True

    # 3. Tell the caller what happened (without exposing internals).
    if state.blocked:
        return {"status": "blocked", "reason": state.block_reason}
    return {
        "status": "drafted",
        "summary": state.draft_summary,
        "trace": state.trace,
        # The full draft payload (e.g. RAG answer + sources) so a synchronous
        # caller like the chat UI can render it without a second round-trip.
        "payload": state.draft_payload,
        "agent": state.agent,
        "mission": state.mission,
    }


@router.post("/v1/webhooks/exchange", dependencies=[Depends(verify_ingest_caller)])
def exchange_webhook(
    email: EmailIn,
    session: Annotated[Session, Depends(get_session)],
):
    return ingest_email(email, session)
