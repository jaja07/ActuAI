"""
security/audit.py — Append-only, hash-chained audit log.

Every entry stores the hash of the entry before it, like links in a chain; if
anyone edits or deletes a past entry, the hashes stop matching and the tampering
is detectable.

WHAT WE LOG: logins, authorization refusals, every agent draft, every human
approval/rejection and every SAP write. This is the evidence an auditor asks for.
"""

import hashlib
import json

from sqlmodel import Session, select

from database.models import AuditLog


def _compute_hash(prev_hash: str, payload: dict) -> str:
    """SHA-256 over (previous hash + this entry's content)."""
    # sort_keys makes the serialization deterministic, so the hash is stable.
    blob = prev_hash + json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def record(
    session: Session,
    actor: str,
    action: str,
    detail: dict | None = None,
) -> AuditLog:
    """
    Append one entry to the chain. Call this from any place that does something
    security-relevant. It looks up the latest entry's hash, links to it, then
    writes the new tamper-evident row.
    """
    detail = detail or {}

    last = session.exec(select(AuditLog).order_by(AuditLog.id.desc()).limit(1)).first()
    prev_hash = last.entry_hash if last else "GENESIS"

    content = {"actor": actor, "action": action, "detail": detail}
    entry_hash = _compute_hash(prev_hash, content)

    entry = AuditLog(
        actor=actor,
        action=action,
        detail=detail,
        prev_hash=prev_hash,
        entry_hash=entry_hash,
    )
    session.add(entry)
    # Flush (not commit) so the row gets an id within the caller's transaction.
    session.flush()
    return entry


def verify_chain(session: Session) -> bool:
    """
    Walk the whole chain and recompute each hash. Returns True if intact.
    This is the KPI the report calls "audit-log integrity check".
    """
    prev_hash = "GENESIS"
    for entry in session.exec(select(AuditLog).order_by(AuditLog.id.asc())):
        expected = _compute_hash(
            prev_hash,
            {"actor": entry.actor, "action": entry.action, "detail": entry.detail},
        )
        if expected != entry.entry_hash or entry.prev_hash != prev_hash:
            return False
        prev_hash = entry.entry_hash
    return True
