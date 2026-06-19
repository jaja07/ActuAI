"""
api/routers/triggers.py — Ingestion endpoints (the workflow entry points).

POST /api/ingest/email          Receive a supplier/client email and launch one
                                orchestration cycle. Produces a HITL draft.
POST /api/v1/webhooks/exchange  Alias for the MS Exchange connector.

These are the "triggers" of the system: each inbound event runs the agent graph
which ends in a PENDING ValidationTask. Nothing is written to SAP here.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from agents.graph import run_cycle
from agents.state import GlobalState
from api.dependencies import get_session
from api.schemas import EmailIn
from database.models import IngestedEmail

router = APIRouter(prefix="/api", tags=["Triggers"])


@router.post("/ingest/email")
def ingest_email(
    email: EmailIn,
    session: Annotated[Session, Depends(get_session)],
):
    """
    Webhook target for incoming emails. We store the raw email, then run one
    orchestration cycle which ends in a PENDING validation task.

    Note: in production this endpoint is protected by a shared webhook secret or
    mTLS from the Exchange connector; left open here for clarity.
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


@router.post("/v1/webhooks/exchange")
def exchange_webhook(
    email: EmailIn,
    session: Annotated[Session, Depends(get_session)],
):
    return ingest_email(email, session)
