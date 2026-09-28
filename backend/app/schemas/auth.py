import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str | None = None
    role: str | None = None
    onboarding_completed_at: datetime | None = None
    created_at: datetime
