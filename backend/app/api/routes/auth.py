"""Authentication routes with workspace support."""

import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import (
    get_password_hash, verify_password,
    create_workspace_token,
)
from ...models.user import User, StudentProfile, TeacherProfile, UserRole
from ...models.workspace import Workspace, WorkspaceMember, generate_invite_code
from ...schemas.user import UserRegister, LoginRequest, TokenResponse, UserResponse
from ...schemas.exam import TeacherPreferenceUpdate, TeacherPreferenceResponse
from ...schemas.workspace import JoinWorkspaceRequest, SwitchWorkspaceRequest
from ..deps import get_current_user
from ...core.rate_limit import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def _build_token_response(
    user: User, db: AsyncSession
) -> TokenResponse:
    """Build a TokenResponse with workspace context resolved from DB."""
    workspace_id = user.active_workspace_id
    workspace_role = None
    workspace_name = None
    workspace_type = None

    if workspace_id:
        # Look up membership role and workspace details
        member_result = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user.id,
            )
        )
        member = member_result.scalar_one_or_none()
        if member:
            workspace_role = member.role

        ws_result = await db.execute(
            select(Workspace).where(Workspace.id == workspace_id)
        )
        ws = ws_result.scalar_one_or_none()
        if ws:
            workspace_name = ws.name
            workspace_type = ws.type

    token = create_workspace_token(
        user_id=user.id,
        role=user.role.value,
        workspace_id=workspace_id,
        workspace_role=workspace_role,
    )

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name,
        workspace_id=workspace_id,
        workspace_role=workspace_role,
        workspace_name=workspace_name,
        workspace_type=workspace_type,
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user with profile. Auto-creates workspace for teachers."""
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

    # Workspace handling
    if data.user.role == "teacher":
        # Auto-create personal workspace for teachers
        workspace = Workspace(
            name=f"{data.user.full_name}'s Classroom",
            type="personal",
            owner_id=user.id,
            invite_code=generate_invite_code(),
        )
        db.add(workspace)
        await db.flush()

        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role="owner",
        )
        db.add(membership)
        user.active_workspace_id = workspace.id
        await db.flush()

    elif data.user.role == "student" and data.invite_code:
        # Student with invite code: join existing workspace
        ws_result = await db.execute(
            select(Workspace).where(Workspace.invite_code == data.invite_code)
        )
        workspace = ws_result.scalar_one_or_none()
        if not workspace:
            raise HTTPException(status_code=404, detail="Invalid invite code")

        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role="student",
        )
        db.add(membership)
        user.active_workspace_id = workspace.id
        await db.flush()

    elif data.user.role == "student":
        # Student without invite code: create personal workspace for self-study
        workspace = Workspace(
            name=f"{data.user.full_name}'s Study Space",
            type="personal",
            owner_id=user.id,
            invite_code=generate_invite_code(),
        )
        db.add(workspace)
        await db.flush()

        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role="owner",
        )
        db.add(membership)
        user.active_workspace_id = workspace.id
        await db.flush()

    return await _build_token_response(user, db)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login and get access token with workspace context."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    return await _build_token_response(user, db)


@router.post("/join-workspace", response_model=TokenResponse)
@limiter.limit("10/minute")
async def join_workspace(
    request: Request,
    data: JoinWorkspaceRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Join a workspace by invite code."""
    ws_result = await db.execute(
        select(Workspace).where(Workspace.invite_code == data.invite_code)
    )
    workspace = ws_result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    # Check if already a member (idempotent)
    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        # Already a member -- idempotent success
        user.active_workspace_id = workspace.id
        await db.flush()
        return await _build_token_response(user, db)

    role = "student" if user.role == UserRole.STUDENT else "teacher"
    membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role=role,
    )
    db.add(membership)
    user.active_workspace_id = workspace.id
    await db.flush()

    return await _build_token_response(user, db)


@router.post("/switch-workspace", response_model=TokenResponse)
async def switch_workspace(
    data: SwitchWorkspaceRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Switch to a different workspace. Issues a new JWT."""
    # Verify user is a member of the target workspace
    member_result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == data.workspace_id,
            WorkspaceMember.user_id == user.id,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this workspace")

    user.active_workspace_id = data.workspace_id
    await db.flush()

    return await _build_token_response(user, db)


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
