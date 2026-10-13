import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.lifecycle import archive_timestamp, is_archived_item, is_in_grace_period
from app.core.security import AuthenticatedUser, get_current_user
from app.db.session import get_db
from app.models.entities import Goal
from app.schemas.entities import GoalCreate, GoalRead, GoalUpdate

router = APIRouter()


def to_goal_read(goal: Goal) -> GoalRead:
    now = datetime.now(UTC)
    is_archived = is_archived_item(goal.completed_at, goal.archived_at, now)
    in_grace = is_in_grace_period(goal.completed_at, goal.archived_at, now)
    return GoalRead(
        id=goal.id,
        user_id=goal.user_id,
        title=goal.title,
        status=goal.status,
        progress_percent=goal.progress_percent,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
        completed_at=goal.completed_at,
        archived_at=goal.archived_at,
        is_archived=is_archived,
        in_grace_period=in_grace,
    )


@router.get("", response_model=list[GoalRead])
def list_goals(
    filter_status: Literal["active_workspace", "archived", "all"] = Query(
        default="active_workspace",
        description="Filter by active workspace items, archived items, or all",
    ),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List goals belonging to the authenticated user.
    active_workspace: unarchived and either active or within the 2-day grace period.
    archived: archived or past the 2-day grace period.
    """
    query = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.desc())
    )
    goals = query.all()

    for goal in goals:
        goal.archived_at = archive_timestamp(goal.completed_at, goal.archived_at)
    db.commit()

    items = [to_goal_read(g) for g in goals]
    if filter_status == "active_workspace":
        return [g for g in items if not g.is_archived]
    elif filter_status == "archived":
        return [g for g in items if g.is_archived]
    return items


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(
    goal_in: GoalCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = Goal(
        user_id=current_user.id,
        title=goal_in.title.strip(),
        progress_percent=goal_in.progress_percent,
        status="active",
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return to_goal_read(goal)


@router.get("/{goal_id}", response_model=GoalRead)
def get_goal(
    goal_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )
    goal.archived_at = archive_timestamp(goal.completed_at, goal.archived_at)
    db.commit()
    return to_goal_read(goal)


@router.patch("/{goal_id}", response_model=GoalRead)
def update_goal(
    goal_id: uuid.UUID,
    goal_in: GoalUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    if goal_in.title is not None:
        goal.title = goal_in.title.strip()
    if "progress_percent" in goal_in.model_fields_set:
        goal.progress_percent = goal_in.progress_percent

    if goal_in.status is not None and goal_in.status != goal.status:
        if goal_in.status == "completed":
            goal.status = "completed"
            goal.completed_at = datetime.now(UTC)
            if goal.progress_percent is None or goal.progress_percent < 100:
                goal.progress_percent = 100
        elif goal_in.status == "active":
            # Reopening
            if is_archived_item(goal.completed_at, goal.archived_at):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot reopen goal once grace period has expired",
                )
            goal.status = "active"
            goal.completed_at = None
            goal.archived_at = None

    db.commit()
    db.refresh(goal)
    return to_goal_read(goal)


@router.post("/{goal_id}/reopen", response_model=GoalRead)
def reopen_goal(
    goal_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reopen a completed goal during its 2-day grace period.
    Cancels the archive countdown and sets status back to active.
    """
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    if goal.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only completed goals can be reopened",
        )

    if is_archived_item(goal.completed_at, goal.archived_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reopen goal after 2-day grace period has expired",
        )

    goal.status = "active"
    goal.completed_at = None
    goal.archived_at = None
    db.commit()
    db.refresh(goal)
    return to_goal_read(goal)
