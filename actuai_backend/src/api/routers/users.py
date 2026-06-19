from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel

from api.dependencies import get_session, require_roles, TokenUser, Role
from database.models import User
from security import audit
from security.auth import hash_password

router = APIRouter(prefix="/api/users", tags=["Users"])

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str = Role.ENGINEER.value
    clearance: str = "INTERNAL"

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    clearance: str
    created_at: str

@router.get("", dependencies=[Depends(require_roles(Role.OPERATOR_ADMIN))])
def list_users(session: Annotated[Session, Depends(get_session)]):
    """List all users (Admin only)"""
    users = session.exec(select(User).order_by(User.username)).all()
    return [{"id": u.id, "username": u.username, "role": u.role, "clearance": u.clearance, "created_at": u.created_at.isoformat()} for u in users]


@router.post("", dependencies=[Depends(require_roles(Role.OPERATOR_ADMIN))])
def create_user(
    request: UserCreateRequest,
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[TokenUser, Depends(require_roles(Role.OPERATOR_ADMIN))]
):
    """Create a new user (Admin only)"""
    existing_user = session.exec(select(User).where(User.username == request.username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    new_user = User(
        username=request.username,
        hashed_password=hash_password(request.password),
        role=request.role,
        clearance=request.clearance
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    audit.record(session, actor=current_user.username, action="USER_CREATED", detail={"new_user": request.username})
    return {"status": "success", "user_id": new_user.id}


@router.delete("/{user_id}", dependencies=[Depends(require_roles(Role.OPERATOR_ADMIN))])
def delete_user(
    user_id: int,
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[TokenUser, Depends(require_roles(Role.OPERATOR_ADMIN))]
):
    """Delete a user (Admin only)"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
    session.delete(user)
    session.commit()
    
    audit.record(session, actor=current_user.username, action="USER_DELETED", detail={"deleted_user": user.username})
    return {"status": "deleted", "user_id": user_id}
