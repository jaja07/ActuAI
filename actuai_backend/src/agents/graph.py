"""
agents/graph.py — The execution cycle (the "graph").

WHAT THIS DOES
--------------
This is the conductor described in report section 5.2/5.3. For each trigger it:

   1. INGRESS GUARDRAIL  — scan the raw input for prompt injection. If hit,
                           block and audit. (fail closed)
   2. SUPERVISOR         — classify intent, choose a worker.
   3. WORKER             — transactional / investigative / responder drafts.
   4. EGRESS DLP         — scan the draft summary before it is surfaced.
   5. HITL CHECKPOINT    — write a ValidationTask (PENDING). Execution PAUSES.
                           Nothing is written to SAP here.

We implement the graph as a small, explicit function rather than pulling in the
full LangGraph runtime. The shape is identical (state in -> nodes -> state out)
and it is far easier to read and deploy. Each function below maps 1:1 to a graph
node, so swapping in the real LangGraph library later (for LangSmith tracing) is
mechanical.
"""

from sqlmodel import Session

from agents.investigative.investigative import run_investigative
from agents.responder.responder import run_responder
from agents.security_agent.security import run_security
from agents.state import GlobalState
from agents.supervisor.supervisor import run_supervisor
from agents.transactional.transactional import run_transactional
from database.models import TaskStatus, ValidationTask
from security import audit
from security.guardrails import apply_dlp


def run_cycle(state: GlobalState, session: Session) -> GlobalState:
    """Run one full trigger-to-validation cycle and persist a HITL task."""

    # --- 1. L0 Security Agent: ingress gate (prompt injection, fail closed) -
    state = run_security(state)
    if state.blocked:
        audit.record(
            session, actor=state.user, action="INJECTION_BLOCKED",
            detail={"reason": state.block_reason, "input": state.raw_input[:300]},
        )
        return state

    # --- 2. Supervisor routes the request --------------------------------
    state = run_supervisor(state)

    # --- 3. Dispatch to the chosen specialist worker ---------------------
    if state.route == "investigative":
        state = run_investigative(state, session)
    elif state.route == "responder":
        state = run_responder(state, session)
    else:
        state = run_transactional(state, session)

    # --- 4. Egress DLP on the human-facing summary -----------------------
    dlp = apply_dlp(state.draft_summary, state.clearance)
    state.draft_summary = dlp.sanitized_text
    if dlp.reason:
        state.log(f"DLP applied: {dlp.reason}")

    # --- 5. Human-in-the-loop checkpoint: write a PENDING task -----------
    # This is the "execution pauses" step. The agent's work becomes a draft a
    # human must approve; nothing reaches SAP without that approval.
    task = ValidationTask(
        mission=state.mission or "M1",
        agent=state.agent or "unknown",
        # The Responder marks its payload kind="EMAIL_REPLY"; everything else
        # is a SAP update. This is what the approve route branches on.
        kind=state.draft_payload.get("kind", "SAP_UPDATE"),
        summary=state.draft_summary,
        payload=state.draft_payload,
        status=TaskStatus.PENDING,
    )
    session.add(task)
    session.flush()

    audit.record(
        session, actor=state.user, action="DRAFT_CREATED",
        detail={"task_id": task.id, "mission": task.mission, "agent": task.agent},
    )
    state.log(f"HITL task #{task.id} created and awaiting validation")
    return state
