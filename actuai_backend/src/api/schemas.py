"""
api/schemas.py — Pydantic request/response models for the REST surface.

Keeping the wire format in one place makes the API contract explicit and easy to
evolve without touching the router logic.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class EmailIn(BaseModel):
    """Inbound supplier/client email (MS Exchange webhook payload)."""
    sender: str
    subject: str
    body: str


class IngestResult(BaseModel):
    """Outcome of one ingestion cycle, returned to the webhook caller."""
    status: str                       # "drafted" | "blocked"
    summary: Optional[str] = None
    reason: Optional[str] = None
    trace: list[str] = []


class TaskOut(BaseModel):
    """A validation task as shown on the HITL dashboard."""
    id: int
    mission: str
    agent: str
    kind: str
    summary: str
    payload: dict
    status: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
