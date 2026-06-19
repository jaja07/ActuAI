"""
api/routers/auth.py — Login endpoint.

POST /api/auth/login  (form: username, password)  -> { access_token, token_type }

Every login attempt — success or failure — is written to the immutable audit log
(report 9.1).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, status
from sqlmodel import Session

from api.dependencies import get_session
from security import audit
from security.auth import authenticate_user, create_access_token

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login")
def login(
    username: Annotated[str, Form()],
    password: Annotated[str, Form()],
    session: Annotated[Session, Depends(get_session)],
):
    user = authenticate_user(username, password)
    if user is None:
        # Log the failure (without the password!) then refuse.
        audit.record(session, actor=username, action="LOGIN_FAILED", detail={})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token(user)
    audit.record(session, actor=username, action="LOGIN_OK", detail={"role": user.role.value})
    return {"access_token": token, "token_type": "bearer"}
