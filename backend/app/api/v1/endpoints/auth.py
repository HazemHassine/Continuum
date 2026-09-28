from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.security import AuthenticatedUser, get_current_user
from app.db.session import get_db
from app.models.entities import Profile
from app.schemas.auth import UserProfileResponse

router = APIRouter()


@router.get("/me", response_model=UserProfileResponse, status_code=status.HTTP_200_OK)
def get_current_user_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves the authenticated user's profile.
    Automatically initializes the profile record on first access if not already present.
    """
    profile = db.query(Profile).filter(Profile.id == current_user.id).first()
    if not profile:
        profile = Profile(id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return UserProfileResponse(
        id=profile.id,
        email=current_user.email,
        role=current_user.role,
        onboarding_completed_at=profile.onboarding_completed_at,
        created_at=profile.created_at,
    )


@router.post(
    "/complete-onboarding",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
)
def complete_onboarding(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks onboarding as completed for the authenticated user.
    """
    profile = db.query(Profile).filter(Profile.id == current_user.id).first()
    if not profile:
        profile = Profile(id=current_user.id, onboarding_completed_at=func.now())
        db.add(profile)
    else:
        profile.onboarding_completed_at = func.now()

    db.commit()
    db.refresh(profile)

    return UserProfileResponse(
        id=profile.id,
        email=current_user.email,
        role=current_user.role,
        onboarding_completed_at=profile.onboarding_completed_at,
        created_at=profile.created_at,
    )
