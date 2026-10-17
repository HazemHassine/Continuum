import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.models.entities import Profile


def test_auth_me_unauthorized(client: TestClient):
    """Calling /api/v1/auth/me without an Authorization header must return 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Authorization header missing"


def test_auth_me_invalid_token(client: TestClient, create_auth_token):
    """Calling with a token signed with the wrong secret must return 401."""
    user_id = uuid.uuid4()
    secret = "wrong-secret-key-that-is-at-least-32-chars-long"
    invalid_token = create_auth_token(user_id, secret=secret)
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {invalid_token}"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"


def test_register_and_login_flow(client: TestClient):
    """User can register with email and password, get JWT, and subsequently log in."""
    register_payload = {
        "email": "testuser@example.com",
        "password": "strongpassword123",
    }
    reg_response = client.post("/api/v1/auth/register", json=register_payload)
    assert reg_response.status_code == 201
    reg_data = reg_response.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == "testuser@example.com"
    token = reg_data["access_token"]

    # Verify /me endpoint works with the returned access_token
    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "testuser@example.com"

    # Duplicate registration returns 400
    dup_response = client.post("/api/v1/auth/register", json=register_payload)
    assert dup_response.status_code == 400
    assert "already exists" in dup_response.json()["detail"]

    # Log in with correct credentials
    login_payload = {
        "email": "testuser@example.com",
        "password": "strongpassword123",
    }
    login_response = client.post("/api/v1/auth/login", json=login_payload)
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == "testuser@example.com"

    # Log in with incorrect password returns 401
    bad_login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@example.com", "password": "wrongpassword"},
    )
    assert bad_login_response.status_code == 401


def test_complete_onboarding(client: TestClient):
    """Calling /api/v1/auth/complete-onboarding updates onboarding_completed_at."""
    reg_response = client.post(
        "/api/v1/auth/register",
        json={"email": "onboarding@example.com", "password": "secretpassword123"},
    )
    assert reg_response.status_code == 201
    token = reg_response.json()["access_token"]
    user_id = reg_response.json()["user"]["id"]

    # Call complete onboarding
    response = client.post(
        "/api/v1/auth/complete-onboarding",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user_id)
    assert data["onboarding_completed_at"] is not None

    # Verify subsequent /me call preserves the onboarding timestamp
    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["onboarding_completed_at"] is not None


@pytest.mark.parametrize("endpoint", ["register", "login"])
@pytest.mark.parametrize("password", ["x" * 73, "é" * 37, "📝" * 19])
def test_auth_rejects_passwords_exceeding_bcrypt_bytes(client, endpoint, password):
    response = client.post(
        f"/api/v1/auth/{endpoint}",
        json={"email": "limits@example.com", "password": password},
    )
    assert response.status_code == 422


def test_auth_accepts_72_byte_unicode_password_and_normalizes_email(client):
    password = "é" * 36
    registered = client.post(
        "/api/v1/auth/register",
        json={"email": "  Mixed.Case@Example.com  ", "password": password},
    )
    assert registered.status_code == 201
    assert registered.json()["user"]["email"] == "mixed.case@example.com"
    logged_in = client.post(
        "/api/v1/auth/login",
        json={"email": "MIXED.CASE@example.com", "password": password},
    )
    assert logged_in.status_code == 200


@pytest.mark.parametrize("email", ["not-an-email", "a@@example.com", "a b@example.com"])
def test_register_rejects_malformed_emails(client, email):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "claim,value",
    [
        ("exp", None),
        ("iat", None),
        ("sub", None),
        ("exp", 1),
        ("iat", 4_102_444_800),
        ("sub", "not-a-uuid"),
        ("sub", []),
        ("exp", []),
        ("iat", {}),
        ("role", "email_verification"),
        ("aud", "another-application"),
    ],
)
def test_auth_rejects_missing_expired_or_malformed_claims(client, claim, value):
    now = datetime.now(UTC)
    payload = {
        "sub": str(uuid.uuid4()),
        "email": "claims@example.com",
        "role": "authenticated",
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    if value is None:
        payload.pop(claim)
    else:
        payload[claim] = value
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


def test_zero_lifetime_token_is_not_given_default_week(client):
    token = create_access_token(
        uuid.uuid4(), "expired@example.com", expires_delta=timedelta(0)
    )
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


def test_password_verification_fails_safely_for_invalid_hash_or_oversized_input():
    assert verify_password("password123", "not-a-bcrypt-hash") is False
    assert verify_password("x" * 73, "not-a-bcrypt-hash") is False


def test_completing_onboarding_preserves_original_timestamp(client, db_session):
    registered = client.post(
        "/api/v1/auth/register",
        json={"email": "onboarding-once@example.com", "password": "password123"},
    ).json()
    profile = db_session.get(Profile, uuid.UUID(registered["user"]["id"]))
    completed_at = datetime(2025, 1, 2, 12, 0, 0, tzinfo=UTC)
    profile.onboarding_completed_at = completed_at
    db_session.commit()
    response = client.post(
        "/api/v1/auth/complete-onboarding",
        headers={"Authorization": f"Bearer {registered['access_token']}"},
    )
    assert response.status_code == 200
    actual = datetime.fromisoformat(response.json()["onboarding_completed_at"])
    assert actual.replace(tzinfo=UTC) == completed_at
