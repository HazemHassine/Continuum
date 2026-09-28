import uuid

from fastapi.testclient import TestClient


def test_auth_me_unauthorized(client: TestClient):
    """Calling /api/v1/auth/me without an Authorization header must return 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Authorization header missing"


def test_auth_me_invalid_token(client: TestClient, create_auth_token):
    """Calling with a token signed with the wrong secret must return 401."""
    user_id = uuid.uuid4()
    invalid_token = create_auth_token(user_id, secret="wrong-secret-key")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {invalid_token}"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"


def test_auth_me_valid_token_creates_and_returns_profile(
    client: TestClient, create_auth_token
):
    """A valid Supabase JWT creates the profile if needed and returns user data."""
    user_id = uuid.uuid4()
    email = "user1@example.com"
    token = create_auth_token(user_id, email=email)

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user_id)
    assert data["email"] == email
    assert data["onboarding_completed_at"] is None


def test_complete_onboarding(client: TestClient, create_auth_token):
    """Calling /api/v1/auth/complete-onboarding updates onboarding_completed_at."""
    user_id = uuid.uuid4()
    token = create_auth_token(user_id, email="user2@example.com")

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
