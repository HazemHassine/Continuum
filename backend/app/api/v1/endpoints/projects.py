import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.lifecycle import archive_timestamp, is_archived_item, is_in_grace_period
from app.core.security import AuthenticatedUser, get_current_user
from app.db.session import get_db
from app.models.entities import Project
from app.schemas.entities import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter()

TERMINAL_STATUSES = {"completed", "abandoned"}


def to_project_read(project: Project) -> ProjectRead:
    now = datetime.now(UTC)
    is_archived = is_archived_item(project.completed_at, project.archived_at, now)
    in_grace = is_in_grace_period(project.completed_at, project.archived_at, now)
    return ProjectRead(
        id=project.id,
        user_id=project.user_id,
        title=project.title,
        description=project.description,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        completed_at=project.completed_at,
        archived_at=project.archived_at,
        is_archived=is_archived,
        in_grace_period=in_grace,
    )


@router.get("", response_model=list[ProjectRead])
def list_projects(
    filter_status: Literal["active_workspace", "archived", "all"] = Query(
        default="active_workspace",
        description="Filter by active workspace items, archived items, or all",
    ),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List projects belonging to the authenticated user.
    active_workspace: non-terminal items and items within the grace period.
    archived: archived or terminal states past the 2-day grace period.
    """
    query = (
        db.query(Project)
        .filter(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    projects = query.all()

    for project in projects:
        project.archived_at = archive_timestamp(
            project.completed_at, project.archived_at
        )
    db.commit()

    items = [to_project_read(p) for p in projects]
    if filter_status == "active_workspace":
        return [p for p in items if not p.is_archived]
    elif filter_status == "archived":
        return [p for p in items if p.is_archived]
    return items


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(
        user_id=current_user.id,
        title=project_in.title.strip(),
        description=project_in.description.strip() if project_in.description else None,
        status="active",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return to_project_read(project)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    project.archived_at = archive_timestamp(project.completed_at, project.archived_at)
    db.commit()
    return to_project_read(project)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: uuid.UUID,
    project_in: ProjectUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    if project_in.title is not None:
        project.title = project_in.title.strip()
    if "description" in project_in.model_fields_set:
        project.description = (
            project_in.description.strip() if project_in.description else None
        )

    if project_in.status is not None and project_in.status != project.status:
        if is_archived_item(project.completed_at, project.archived_at):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change status of an archived project",
            )
        new_status = project_in.status
        old_status = project.status

        # Transitioning to terminal status
        if new_status in TERMINAL_STATUSES:
            project.status = new_status
            if old_status not in TERMINAL_STATUSES:
                project.completed_at = datetime.now(UTC)
        # Transitioning from terminal status back to active or paused
        elif old_status in TERMINAL_STATUSES and new_status in {"active", "paused"}:
            if is_archived_item(project.completed_at, project.archived_at):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot reopen project once grace period has expired",
                )
            project.status = new_status
            project.completed_at = None
            project.archived_at = None
        else:
            # e.g., active <-> paused
            project.status = new_status

    db.commit()
    db.refresh(project)
    return to_project_read(project)


@router.post("/{project_id}/reopen", response_model=ProjectRead)
def reopen_project(
    project_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reopen a completed or abandoned project during its 2-day grace period.
    Cancels the archive countdown and sets status back to active.
    """
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    if project.status not in TERMINAL_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only completed or abandoned projects can be reopened",
        )

    if is_archived_item(project.completed_at, project.archived_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reopen project after 2-day grace period has expired",
        )

    project.status = "active"
    project.completed_at = None
    project.archived_at = None
    db.commit()
    db.refresh(project)
    return to_project_read(project)
