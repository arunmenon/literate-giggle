"""Authentication routes with workspace support."""

import json
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.config import settings
from ...core.security import (
    get_password_hash, verify_password,
    create_workspace_token, verify_google_id_token,
)
from ...models.user import User, StudentProfile, TeacherProfile, UserRole
from ...models.workspace import Workspace, WorkspaceMember, ClassGroup, Enrollment, generate_invite_code
from ...schemas.user import (
    UserRegister, LoginRequest, TokenResponse, UserResponse, GoogleVerifyRequest,
    ConsentGrantRequest, ConsentStatusResponse,
)
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


async def _setup_workspace_and_class(
    user: User,
    role: str,
    full_name: str,
    invite_code: str | None,
    class_join_code: str | None,
    db: AsyncSession,
) -> None:
    """Create/join workspace and optionally enroll in a class. Shared by register and Google verify."""
    if role == "teacher":
        workspace = Workspace(
            name=f"{full_name}'s Classroom",
            type="personal",
            owner_id=user.id,
            invite_code=generate_invite_code(),
        )
        db.add(workspace)
        await db.flush()
        db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"))
        user.active_workspace_id = workspace.id
        await db.flush()

    elif role == "student" and invite_code:
        ws_result = await db.execute(
            select(Workspace).where(Workspace.invite_code == invite_code)
        )
        workspace = ws_result.scalar_one_or_none()
        if not workspace:
            raise HTTPException(status_code=404, detail="Invalid invite code")
        db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="student"))
        user.active_workspace_id = workspace.id
        await db.flush()

    elif role == "student":
        workspace = Workspace(
            name=f"{full_name}'s Study Space",
            type="personal",
            owner_id=user.id,
            invite_code=generate_invite_code(),
        )
        db.add(workspace)
        await db.flush()
        db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"))
        user.active_workspace_id = workspace.id
        await db.flush()

    # Class join code: enroll student + auto-join class workspace
    if class_join_code and role == "student":
        cls_result = await db.execute(
            select(ClassGroup).where(
                ClassGroup.join_code == class_join_code,
                ClassGroup.join_code_active == True,
            )
        )
        class_group = cls_result.scalar_one_or_none()
        if class_group:
            sp_result = await db.execute(
                select(StudentProfile).where(StudentProfile.user_id == user.id)
            )
            student_profile = sp_result.scalar_one_or_none()
            if student_profile:
                db.add(Enrollment(class_id=class_group.id, student_id=student_profile.id))
                ws_check = await db.execute(
                    select(WorkspaceMember).where(
                        WorkspaceMember.workspace_id == class_group.workspace_id,
                        WorkspaceMember.user_id == user.id,
                    )
                )
                if not ws_check.scalar_one_or_none():
                    db.add(WorkspaceMember(
                        workspace_id=class_group.workspace_id,
                        user_id=user.id,
                        role="student",
                    ))
                user.active_workspace_id = class_group.workspace_id
                await db.flush()


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
        guardian_name=data.guardian_name,
        guardian_email=data.guardian_email,
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

    await _setup_workspace_and_class(
        user=user,
        role=data.user.role,
        full_name=data.user.full_name,
        invite_code=data.invite_code,
        class_join_code=data.class_join_code,
        db=db,
    )

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


@router.post("/google/verify")
@limiter.limit("10/minute")
async def google_verify(
    request: Request, data: GoogleVerifyRequest, db: AsyncSession = Depends(get_db)
):
    """Verify a Google ID token and login or register the user."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In is not configured on this server",
        )

    # Verify the Google JWT
    try:
        idinfo = verify_google_id_token(data.credential, settings.GOOGLE_CLIENT_ID)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    if not idinfo.get("email_verified"):
        raise HTTPException(status_code=400, detail="Google email is not verified")

    google_email = idinfo["email"]
    google_name = idinfo.get("name", google_email.split("@")[0])
    google_sub = idinfo["sub"]

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == google_email))
    user = result.scalar_one_or_none()

    if user:
        # Existing user -- link OAuth if not already linked
        if not user.oauth_provider:
            user.oauth_provider = "google"
            user.oauth_id = google_sub
            await db.flush()

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")

        return await _build_token_response(user, db)

    # New user -- role is required
    if not data.role:
        return JSONResponse(
            status_code=422,
            content={
                "detail": "New user. Role selection required.",
                "is_new_user": True,
                "email": google_email,
                "full_name": google_name,
            },
        )

    if data.role not in ("student", "teacher"):
        raise HTTPException(status_code=400, detail="Role must be 'student' or 'teacher'")

    # Create the new user with a random password hash (cannot password-login)
    user = User(
        email=google_email,
        hashed_password=get_password_hash(secrets.token_hex(32)),
        full_name=google_name,
        role=UserRole(data.role),
        oauth_provider="google",
        oauth_id=google_sub,
    )
    db.add(user)
    await db.flush()

    # Create profile
    if data.role == "student" and data.student_profile:
        db.add(StudentProfile(
            user_id=user.id,
            board=data.student_profile.board,
            class_grade=data.student_profile.class_grade,
            school_name=data.student_profile.school_name,
            section=data.student_profile.section,
            roll_number=data.student_profile.roll_number,
            parent_email=data.student_profile.parent_email,
        ))
    elif data.role == "teacher" and data.teacher_profile:
        db.add(TeacherProfile(
            user_id=user.id,
            board=data.teacher_profile.board,
            subjects=json.dumps(data.teacher_profile.subjects),
            classes=json.dumps(data.teacher_profile.classes),
            institution=data.teacher_profile.institution,
            employee_id=data.teacher_profile.employee_id,
        ))
    await db.flush()

    # Setup workspace and class enrollment (reuses register logic)
    await _setup_workspace_and_class(
        user=user,
        role=data.role,
        full_name=google_name,
        invite_code=data.invite_code,
        class_join_code=data.class_join_code,
        db=db,
    )

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


# ── DPDP Consent Endpoints (FR-005) ──────────────────────────────────────────


@router.post("/consent", response_model=ConsentStatusResponse)
async def grant_consent(
    data: ConsentGrantRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Grant parental consent for voice features (DPDP compliance)."""
    user.parental_consent_given = True
    user.consent_given_at = datetime.now(timezone.utc)
    user.guardian_name = data.guardian_name
    user.guardian_email = data.guardian_email
    user.voice_features_enabled = True
    await db.flush()

    return ConsentStatusResponse(
        parental_consent_given=user.parental_consent_given,
        consent_given_at=user.consent_given_at,
        guardian_name=user.guardian_name,
        voice_features_enabled=user.voice_features_enabled,
    )


@router.get("/consent/status", response_model=ConsentStatusResponse)
async def get_consent_status(
    user: User = Depends(get_current_user),
):
    """Check current consent status for voice features."""
    return ConsentStatusResponse(
        parental_consent_given=user.parental_consent_given,
        consent_given_at=user.consent_given_at,
        guardian_name=user.guardian_name,
        voice_features_enabled=user.voice_features_enabled,
    )


@router.post("/consent/revoke", response_model=ConsentStatusResponse)
async def revoke_consent(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Revoke parental consent, disabling voice features."""
    user.parental_consent_given = False
    user.voice_features_enabled = False
    await db.flush()

    return ConsentStatusResponse(
        parental_consent_given=user.parental_consent_given,
        consent_given_at=user.consent_given_at,
        guardian_name=user.guardian_name,
        voice_features_enabled=user.voice_features_enabled,
    )
