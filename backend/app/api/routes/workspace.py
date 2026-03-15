"""Workspace management routes."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.rate_limit import limiter
from ...models.user import User
from ...models.workspace import Workspace, WorkspaceMember, generate_invite_code
from ...schemas.workspace import (
    WorkspaceCreate, WorkspaceResponse, WorkspaceMemberResponse,
    WorkspaceSummary, JoinWorkspaceRequest,
)
from ..deps import get_current_user, require_workspace_admin, get_current_workspace

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
    """List all workspaces the user belongs to (for workspace switcher)."""
    result = await db.execute(
        select(WorkspaceMember, Workspace)
        .join(Workspace, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id)
    )
    rows = result.all()
    return [
        WorkspaceSummary(
            id=ws.id,
            name=ws.name,
            type=ws.type,
            role=member.role,
        )
        for member, ws in rows
    ]
