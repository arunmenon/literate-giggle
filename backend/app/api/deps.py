"""API dependencies - authentication, current user, workspace context."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.database import get_db
from ..core.security import decode_access_token
from ..models.user import User, StudentProfile, UserRole

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Attach workspace context from JWT (single decode, no extra DB lookup)
    user._workspace_id = payload.get("workspace_id")
    user._workspace_role = payload.get("workspace_role")
    return user


async def get_current_student(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudentProfile:
    if user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Student access required")
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile


async def require_teacher_or_admin(
    user: User = Depends(get_current_user),
) -> User:
    if user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Teacher or admin access required")
    return user


def get_current_workspace(user: User) -> int | None:
    """Return the active workspace_id from the User object (set by get_current_user)."""
    return getattr(user, "_workspace_id", None)


def require_workspace_admin(user: User = Depends(get_current_user)) -> User:
    """Require the user to be a workspace owner or admin."""
    ws_role = getattr(user, "_workspace_role", None)
    if ws_role not in ("owner", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Workspace owner or admin access required",
        )
    return user


def require_voice_consent(user: User = Depends(get_current_user)) -> User:
    """Require parental consent and voice features enabled (DPDP compliance)."""
    if not user.parental_consent_given or not user.voice_features_enabled:
        raise HTTPException(
            status_code=403,
            detail="Parental consent required for voice features",
        )
    return user
