"""Workspace management routes."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.rate_limit import limiter
from ...models.user import User, StudentProfile
from ...models.workspace import Workspace, WorkspaceMember, ClassGroup, Enrollment, generate_invite_code
from ...schemas.workspace import (
    WorkspaceCreate, WorkspaceResponse, WorkspaceMemberResponse,
    WorkspaceSummary, JoinWorkspaceRequest,
)
from ..deps import get_current_user, require_workspace_admin, get_current_workspace

WORKSPACE_COLORS = [
    "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B",
    "#EF4444", "#EC4899", "#06B6D4", "#84CC16",
]

router = APIRouter(prefix="/workspace", tags=["Workspace"])


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(
    data: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new workspace."""
    workspace = Workspace(
        name=data.name,
        type=data.type,
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

    return workspace


@router.get("", response_model=WorkspaceResponse)
async def get_active_workspace(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the current user's active workspace details."""
    ws_id = get_current_workspace(user)
    if not ws_id:
        raise HTTPException(status_code=404, detail="No active workspace")

    result = await db.execute(select(Workspace).where(Workspace.id == ws_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.get("/members", response_model=list[WorkspaceMemberResponse])
async def list_workspace_members(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List members of the active workspace."""
    ws_id = get_current_workspace(user)
    if not ws_id:
        raise HTTPException(status_code=404, detail="No active workspace")

    result = await db.execute(
        select(WorkspaceMember, User)
        .join(User, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == ws_id)
    )
    rows = result.all()
    return [
        WorkspaceMemberResponse(
            id=member.id,
            workspace_id=member.workspace_id,
            user_id=member.user_id,
            role=member.role,
            full_name=u.full_name,
            email=u.email,
            joined_at=member.joined_at,
        )
        for member, u in rows
    ]


@router.post("/invite", response_model=WorkspaceResponse)
async def regenerate_invite_code(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_workspace_admin),
):
    """Regenerate the invite code for the active workspace (invalidates old code)."""
    ws_id = get_current_workspace(user)
    if not ws_id:
        raise HTTPException(status_code=404, detail="No active workspace")

    result = await db.execute(select(Workspace).where(Workspace.id == ws_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    workspace.invite_code = generate_invite_code()
    await db.flush()
    return workspace


@router.post("/join", response_model=WorkspaceResponse)
@limiter.limit("10/minute")
async def join_workspace_by_code(
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

    # Idempotent: if already a member, return success
    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        user.active_workspace_id = workspace.id
        await db.flush()
        return workspace

    from ...models.user import UserRole
    role = "student" if user.role == UserRole.STUDENT else "teacher"
    membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role=role,
    )
    db.add(membership)
    user.active_workspace_id = workspace.id
    await db.flush()
    return workspace


@router.get("/mine", response_model=list[WorkspaceSummary])
async def list_my_workspaces(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all workspaces the user belongs to (for workspace switcher).

    Returns enriched data: owner name, class count, primary subject, and
    a deterministic color for each workspace.
    """
    result = await db.execute(
        select(WorkspaceMember, Workspace)
        .join(Workspace, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id)
    )
    rows = result.all()

    if not rows:
        return []

    workspace_ids = [ws.id for _, ws in rows]
    owner_ids = list({ws.owner_id for _, ws in rows})

    # Batch-fetch owner names
    owner_result = await db.execute(
        select(User.id, User.full_name).where(User.id.in_(owner_ids))
    )
    owner_names = {uid: name for uid, name in owner_result.all()}

    # Batch-fetch class counts per workspace for the student
    # For students, count only classes they are enrolled in; for others, count all classes.
    student_profile = None
    if user.role and user.role.value == "student":
        sp_result = await db.execute(
            select(StudentProfile).where(StudentProfile.user_id == user.id)
        )
        student_profile = sp_result.scalar_one_or_none()

    if student_profile:
        class_counts_query = (
            select(
                ClassGroup.workspace_id,
                func.count(ClassGroup.id).label("cnt"),
            )
            .join(Enrollment, Enrollment.class_id == ClassGroup.id)
            .where(
                ClassGroup.workspace_id.in_(workspace_ids),
                Enrollment.student_id == student_profile.id,
                Enrollment.is_active == True,
            )
            .group_by(ClassGroup.workspace_id)
        )
    else:
        class_counts_query = (
            select(
                ClassGroup.workspace_id,
                func.count(ClassGroup.id).label("cnt"),
            )
            .where(ClassGroup.workspace_id.in_(workspace_ids))
            .group_by(ClassGroup.workspace_id)
        )

    cc_result = await db.execute(class_counts_query)
    class_counts = {ws_id: cnt for ws_id, cnt in cc_result.all()}

    # Batch-fetch primary subject (subject of first class in each workspace)
    # SQLite doesn't support DISTINCT ON, so pick the first class per workspace manually
    all_classes_result = await db.execute(
        select(ClassGroup.workspace_id, ClassGroup.subject, ClassGroup.id)
        .where(ClassGroup.workspace_id.in_(workspace_ids))
        .order_by(ClassGroup.id.asc())
    )
    primary_subjects: dict[int, str | None] = {}
    for ws_id, subject, _ in all_classes_result.all():
        if ws_id not in primary_subjects:
            primary_subjects[ws_id] = subject

    return [
        WorkspaceSummary(
            id=ws.id,
            name=ws.name,
            type=ws.type,
            role=member.role,
            owner_name=owner_names.get(ws.owner_id),
            class_count=class_counts.get(ws.id, 0),
            primary_subject=primary_subjects.get(ws.id),
            color=WORKSPACE_COLORS[ws.id % len(WORKSPACE_COLORS)],
        )
        for member, ws in rows
    ]
