"""
agents/state.py — The shared "Global State" that flows through the graph.

The report describes a LangGraph "Global State ... a shared memory dictionary,
holding the raw input data and maintaining the context of the execution as it
moves through the graph."

We make that explicit and typed. Every node (agent) receives this object,
reads what it needs, writes its result back, and passes it on.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class GlobalState(BaseModel):
    """One object that travels supervisor -> worker -> validation."""

    # ---- input -------------------------------------------------------------
    trigger: str = "email"                 # "email" | "erp_discrepancy" | "audit"
    raw_input: str = ""                    # the email body, query, etc.
    user: str = "system"                   # who/what initiated this run
    clearance: str = "INTERNAL"            # caller clearance, drives DLP

    # ---- routing -----------------------------------------------------------
    route: Optional[str] = None            # set by the supervisor

    # ---- worker output -----------------------------------------------------
    mission: Optional[str] = None          # "M1".."M5"
    agent: Optional[str] = None            # which agent handled it
    draft_summary: str = ""                # human-readable summary for the UI
    draft_payload: dict[str, Any] = Field(default_factory=dict)

    # ---- bookkeeping -------------------------------------------------------
    blocked: bool = False                  # set if a guardrail refused the input
    block_reason: str = ""
    trace: list[str] = Field(default_factory=list)  # step-by-step for debugging

    def log(self, message: str) -> None:
        """Append a human-readable line to the execution trace."""
        self.trace.append(message)
