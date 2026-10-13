import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class EntityUpdate(BaseModel):
    @field_validator("title", "status", check_fields=False)
    @classmethod
    def reject_null_required_fields(cls, value):
        if value is None:
            raise ValueError("Field cannot be null")
        return value


GoalStatus = Literal["active", "completed"]
ProjectStatus = Literal["active", "paused", "completed", "abandoned"]


# --- Goals ---
class GoalBase(BaseModel):
    title: Title
    progress_percent: int | None = Field(default=None, ge=0, le=100)


class GoalCreate(GoalBase):
    pass


class GoalUpdate(EntityUpdate):
    title: Title | None = None
    progress_percent: int | None = Field(default=None, ge=0, le=100)
    status: GoalStatus | None = None


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    status: GoalStatus
    progress_percent: int | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    archived_at: datetime | None = None
    # Computed helper for frontend grace period display
    is_archived: bool = False
    in_grace_period: bool = False


# --- Projects ---
class ProjectBase(BaseModel):
    title: Title
    description: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(EntityUpdate):
    title: Title | None = None
    description: str | None = None
    status: ProjectStatus | None = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None = None
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    archived_at: datetime | None = None
    # Computed helper for frontend grace period display
    is_archived: bool = False
    in_grace_period: bool = False
