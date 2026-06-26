"""
agents/security_agent.py — The L0 Security Agent (the ingress front door).

ROLE (report section 9 — "the L0 Security Agent at ingress")
------------------------------------------------------------
This is the first node every trigger hits, before the Supervisor ever sees it.
Per the report, "nothing reaches the rest of the system without a verified
identity attached", and the system "fails closed rather than open".

Identity (authentication / RBAC) is enforced at the API boundary by
``security.auth`` (JWT + ``require_roles``). What this *agent node* owns is the
content-level ingress defence: scanning the untrusted raw input (a supplier or
client email, a PDF excerpt) for prompt-injection before any LLM agent reads it.
If the input is hostile, the agent marks the state blocked and the graph stops —
fail closed.

Keeping this as its own agent module (rather than an inline check in the graph)
mirrors the report's architecture, where Security is a first-class agent, and
makes the ingress policy easy to evolve in one place.
"""

from agents.state import GlobalState
from security.guardrails import check_injection


def run_security(state: GlobalState) -> GlobalState:
    """
    Ingress gate. Returns the state annotated with the security decision:
      - ``state.blocked`` True + ``state.block_reason`` if the input is hostile,
      - otherwise the state is left clean to continue to the Supervisor.
    """
    guard = check_injection(state.raw_input)
    if not guard.allowed:
        state.blocked = True
        state.block_reason = guard.reason
        state.log(f"L0 Security Agent BLOCKED ingress: {guard.reason}")
    else:
        state.log("L0 Security Agent: ingress clean")
    return state
