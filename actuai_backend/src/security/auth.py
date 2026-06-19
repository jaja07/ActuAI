"""
security/auth.py — Authentication & authorization (v1 of the L0 layer).

The report describes OIDC/SAML federation against a company IdP. That needs an
actual identity provider, which we don't have in a student/edge setup. So v1
implements the SAME SHAPE locally:
  - users with a hashed password (never store plain passwords),
  - login returns a short-lived signed JWT carrying role + clearance claims,
  - every protected route checks the token and the user's role.

Swapping to real OIDC later means replacing ``authenticate_user`` +
``create_access_token`` with calls to the IdP — the rest of the app (which only
reads claims) stays the same.
"""

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlmodel import Session, select

from config import settings
from database.models import User


# --- Password hashing (bcrypt, used directly) ------------------------------
# bcrypt only looks at the first 72 BYTES of a password, so we encode to bytes
# and cap at 72 to stay well-defined.

def hash_password(password: str) -> str:
    """Hash a plaintext password into a salted bcrypt hash (stored as text)."""
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Return True if the plaintext password matches the stored bcrypt hash."""
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))


# Tells FastAPI/Swagger where clients obtain a token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# The five base roles from the report (section 9.2).
class Role(str, Enum):
    ENGINEER = "engineer"
    BUYER = "buyer"
    COMPLIANCE_OFFICER = "compliance_officer"
    OPERATOR_ADMIN = "operator_admin"
    AUDITOR = "auditor"


class TokenUser(BaseModel):
    """The identity we reconstruct from a valid token on each request."""
    username: str
    role: Role
    clearance: str = "INTERNAL"  # PUBLIC / INTERNAL / CONFIDENTIAL / EAR / ITAR


def seed_demo_users(session: Session) -> None:
    """Create a few demo accounts in the database so you can log in immediately after deploy."""
    existing_user = session.exec(select(User).limit(1)).first()
    if existing_user:
        return
        
    demo = [
        ("expert", "expert123", Role.ENGINEER, "CONFIDENTIAL"),
        ("buyer", "buyer123", Role.BUYER, "INTERNAL"),
        ("admin", "admin123", Role.OPERATOR_ADMIN, "ITAR"),
        ("auditor", "auditor123", Role.AUDITOR, "CONFIDENTIAL"),
    ]
    for username, password, role, clearance in demo:
        new_user = User(
            username=username,
            hashed_password=hash_password(password),
            role=role.value,
            clearance=clearance,
        )
        session.add(new_user)
    session.commit()


def authenticate_user(session: Session, username: str, password: str) -> TokenUser | None:
    """Return the user if the password matches, otherwise None."""
    db_user = session.exec(select(User).where(User.username == username)).first()
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return TokenUser(username=db_user.username, role=Role(db_user.role), clearance=db_user.clearance)


def create_access_token(user: TokenUser) -> str:
    """Build a signed JWT carrying the user's claims and an expiry."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    payload = {
        "sub": user.username,
        "role": user.role.value,
        "clearance": user.clearance,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> TokenUser:
    """
    FastAPI dependency that protects a route. It decodes + verifies the token
    signature and expiry, rebuilds the TokenUser from the claims, and raises 401
    if anything is wrong.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise credentials_error
    username = payload.get("sub")
    role = payload.get("role")
    if username is None or role is None:
        raise credentials_error
    return TokenUser(username=username, role=Role(role), clearance=payload.get("clearance", "INTERNAL"))


def require_roles(*allowed: Role):
    """
    Dependency factory for Role-Based Access Control (RBAC).

    Usage:
        @router.post(..., dependencies=[Depends(require_roles(Role.ENGINEER))])

    The caller must hold one of the allowed roles or they get a 403.
    """
    def checker(user: Annotated[TokenUser, Depends(get_current_user)]) -> TokenUser:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role.value}' is not permitted to perform this action",
            )
        return user
    return checker
