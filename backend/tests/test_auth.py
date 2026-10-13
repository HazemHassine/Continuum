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
