import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

security = HTTPBearer(auto_error=False)


class AuthenticatedUser:
    def __init__(
        self,
        user_id: uuid.UUID,
        email: str | None = None,
        role: str | None = None,
    ):
        self.id = user_id
        self.email = email
        self.role = role

    @property
    def id_str(self) -> str:
        return str(self.id)


def get_current_user(
    auth_header: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthenticatedUser:
    """
    Validates Supabase JWT and returns the authenticated user.
    Enforces the security rule: client never supplies user_id directly.
    """
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.credentials
    try:
        # Supabase signs JWTs with HS256 using the project JWT secret
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id_raw: str | None = payload.get("sub")
        if not user_id_raw:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject claim",
            )
        try:
            user_uuid = uuid.UUID(user_id_raw)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: subject is not a valid UUID",
            ) from None

        return AuthenticatedUser(
            user_id=user_uuid,
            email=payload.get("email"),
            role=payload.get("role"),
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
