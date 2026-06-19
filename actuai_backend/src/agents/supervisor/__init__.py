"""
agents/supervisor — The Supervisor Agent (semantic router).

ROLE (from the report, section 5.2)
-----------------------------------
"Acting as the single-entry point, this agent utilizes a fast LLM inference
call to perform intent classification. It does NOT execute business logic or
interact with databases. Its sole purpose is to semantically analyze the
Global State and route execution to the appropriate specialist worker."

So this agent is deliberately tiny: input -> classify intent -> set
``state.route`` to "responder", "transactional" or "investigative".

It runs LOCALLY on Ollama (Llama 3.1 8B) because it is called on every cycle and
must be fast and free of cloud quota.
"""

from agents.llm import get_client
from agents.state import GlobalState

# The system prompt is intentionally strict: we want a one-word answer so it is
# trivial and safe to parse. This is also a small injection-hardening measure.
_SYSTEM = """You are the Supervisor router for an aerospace supply-chain AI.
Classify the user's request into EXACTLY ONE of these three categories:

- "responder": a CLIENT is ASKING a question about WHEN their equipment will be
  delivered — a delivery-time / ETA / lead-time enquiry that expects a reply.
  Handled by the Responder agent (mission M1, drafts a reply email).

- "transactional": a supplier or system is REPORTING structured ERP facts —
  a delivery delay, shipping status, SAP update, schedule discrepancy, or a
  non-conformity (FNC/8D). Handled by the Transactional agent (M1, M2, M3).

- "investigative": anything about finding or reconstructing documents and
  history — locating the right document version, component traceability,
  serial-number checks. Handled by the Investigative agent (missions M4, M5).

Rule of thumb: a QUESTION expecting an answer to the client -> responder;
a STATEMENT updating data -> transactional; a SEARCH over documents ->
investigative.

Reply with ONLY one lowercase word: responder OR transactional OR investigative.
Do not explain. Do not add punctuation."""


def run_supervisor(state: GlobalState) -> GlobalState:
    """Classify the request and write the chosen route into the state."""
    client = get_client("supervisor")
    raw = client.chat(_SYSTEM, state.raw_input)

    answer = raw.strip().lower()
    if "responder" in answer:
        state.route = "responder"
    elif "investigative" in answer:
        state.route = "investigative"
    else:
        # Default to transactional — it is the safer, more constrained path.
        state.route = "transactional"

    state.log(f"Supervisor routed to: {state.route}")
    return state
