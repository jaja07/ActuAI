"""
api/dependencies.py — Shared FastAPI dependencies for the routers.

Centralises the dependencies the routers inject so a router only imports from
here, not from the database/security internals. Re-exports:

  - get_session      : a transactional SQLModel Session (commit/rollback/close)
  - get_current_user : decode + verify the JWT, return the TokenUser
  - require_roles    : RBAC dependency factory
  - Role / TokenUser : the identity types
"""

from database.connection import get_session
from security.auth import Role, TokenUser, get_current_user, require_roles

__all__ = [
    "get_session",
    "get_current_user",
    "require_roles",
    "Role",
    "TokenUser",
]
