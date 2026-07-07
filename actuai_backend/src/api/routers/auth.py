"""
api/routers/auth.py — Login endpoint.

POST /api/auth/login  (form: username, password)  -> { access_token, token_type }

Every login attempt — success or failure — is written to the immutable audit log
(report 9.1).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel

from api.dependencies import get_session
from database.models import User
from security import audit
from security.auth import authenticate_user, create_access_token, hash_password, Role

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = Role.ENGINEER.value

@router.post("/register")
def register(
    request: RegisterRequest,
    session: Annotated[Session, Depends(get_session)],
):
    existing_user = session.exec(select(User).where(User.username == request.username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    new_user = User(
        username=request.username,
        hashed_password=hash_password(request.password),
        role=request.role,
        clearance="INTERNAL"
    )
    session.add(new_user)
    session.commit()
    
    audit.record(session, actor=request.username, action="USER_REGISTERED", detail={"role": request.role})
    
    # Auto-login after registration
    token = create_access_token(authenticate_user(session, request.username, request.password))
    return {"access_token": token, "token_type": "bearer"}

@router.post("/login")
def login(
    username: Annotated[str, Form()],
    password: Annotated[str, Form()],
    session: Annotated[Session, Depends(get_session)],
):
    user = authenticate_user(session, username, password)
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
