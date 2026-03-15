"""Authentication routes."""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_password_hash, verify_password, create_access_token
from ...models.user import User, StudentProfile, TeacherProfile, UserRole
from ...schemas.user import UserRegister, LoginRequest, TokenResponse, UserResponse
from ...schemas.exam import TeacherPreferenceUpdate, TeacherPreferenceResponse
from ..deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user with profile."""
    result = await db.execute(select(User).where(User.email == data.user.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.user.email,
        hashed_password=get_password_hash(data.user.password),
        full_name=data.user.full_name,
        role=UserRole(data.user.role),
    )
    db.add(user)
    await db.flush()

    if data.user.role == "student" and data.student_profile:
        profile = StudentProfile(
            user_id=user.id,
            board=data.student_profile.board,
            class_grade=data.student_profile.class_grade,
            school_name=data.student_profile.school_name,
            section=data.student_profile.section,
            roll_number=data.student_profile.roll_number,
            parent_email=data.student_profile.parent_email,
        )
        db.add(profile)
    elif data.user.role == "teacher" and data.teacher_profile:
        profile = TeacherProfile(
            user_id=user.id,
            board=data.teacher_profile.board,
            subjects=json.dumps(data.teacher_profile.subjects),
            classes=json.dumps(data.teacher_profile.classes),
            institution=data.teacher_profile.institution,
            employee_id=data.teacher_profile.employee_id,
        )
        db.add(profile)

    await db.flush()

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name,
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login and get access token."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current user info."""
    return user


@router.get("/me/preferences", response_model=TeacherPreferenceResponse)
async def get_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get teacher preferences including AI assistance level."""
    if user.role != UserRole.TEACHER and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Teacher access required")

    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    return TeacherPreferenceResponse(
        ai_assistance_level=profile.ai_assistance_level or "guided",
        board=profile.board,
        subjects=json.loads(profile.subjects) if profile.subjects else None,
        classes=json.loads(profile.classes) if profile.classes else None,
    )


@router.patch("/me/preferences", response_model=TeacherPreferenceResponse)
async def update_preferences(
    data: TeacherPreferenceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update teacher preferences (AI assistance level)."""
    if user.role != UserRole.TEACHER and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Teacher access required")

    if data.ai_assistance_level not in ("auto", "guided", "expert"):
        raise HTTPException(
            status_code=400,
            detail="ai_assistance_level must be 'auto', 'guided', or 'expert'",
        )

    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    profile.ai_assistance_level = data.ai_assistance_level
    await db.flush()

    return TeacherPreferenceResponse(
        ai_assistance_level=profile.ai_assistance_level,
        board=profile.board,
        subjects=json.loads(profile.subjects) if profile.subjects else None,
        classes=json.loads(profile.classes) if profile.classes else None,
    )
