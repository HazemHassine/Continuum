from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.security import (
    AuthenticatedUser,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.entities import Profile, User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserProfileResponse,
)

router = APIRouter()


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    email_clean = request.email
    existing_user = db.query(User).filter(User.email == email_clean).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    user = User(
        email=email_clean,
        hashed_password=hash_password(request.password),
    )
    db.add(user)
    db.flush()

    profile = Profile(id=user.id)
    db.add(profile)
    db.commit()
    db.refresh(user)
    db.refresh(profile)

    token = create_access_token(user_id=user.id, email=user.email)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=profile.id,
            email=user.email,
            role="authenticated",
            onboarding_completed_at=profile.onboarding_completed_at,
            created_at=profile.created_at,
        ),
    )


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    email_clean = request.email
    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    profile = db.query(Profile).filter(Profile.id == user.id).first()
    if not profile:
        profile = Profile(id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    token = create_access_token(user_id=user.id, email=user.email)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=profile.id,
            email=user.email,
            role="authenticated",
            onboarding_completed_at=profile.onboarding_completed_at,
            created_at=profile.created_at,
        ),
    )


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
    elif profile.onboarding_completed_at is None:
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
