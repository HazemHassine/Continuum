import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.lifecycle import is_archived_item, is_in_grace_period
from app.models.entities import Goal, Project


@pytest.mark.parametrize("resource", ["goals", "projects"])
def test_edit_validation_and_isolation(client, create_auth_token, resource):
    owner = {"Authorization": f"Bearer {create_auth_token(uuid.uuid4())}"}
    stranger = {"Authorization": f"Bearer {create_auth_token(uuid.uuid4())}"}
    optional = "progress_percent" if resource == "goals" else "description"
    value = 25 if resource == "goals" else "Original description"
    path = f"/api/v1/{resource}"
    created = client.post(
        path, headers=owner, json={"title": " Original ", optional: value}
    )
    assert created.status_code == 201
    assert created.json()["title"] == "Original"
    item_path = f"{path}/{created.json()['id']}"
    for method, suffix, body in [
        ("get", "", None),
        ("patch", "", {"title": "Stolen"}),
        ("post", "/reopen", None),
    ]:
        args = {"headers": stranger}
        if body is not None:
            args["json"] = body
        assert getattr(client, method)(item_path + suffix, **args).status_code == 404
    for query_filter in ["all", "archived", "active_workspace"]:
        assert (
            client.get(
                path, headers=stranger, params={"filter_status": query_filter}
            ).json()
            == []
        )
    cleared = client.patch(
        item_path, headers=owner, json={"title": " Renamed ", optional: None}
    )
    assert cleared.status_code == 200
    assert cleared.json()[optional] is None
    assert cleared.json()["title"] == "Renamed"
    for body in [
        {"title": "   "},
        {"title": None},
        {"status": None},
        {"status": "invalid"},
    ]:
        assert client.patch(item_path, headers=owner, json=body).status_code == 422
    assert client.post(path, headers=owner, json={"title": "   "}).status_code == 422
    assert client.get(path).status_code == 401
    assert client.post(path, json={"title": "Unauthorized"}).status_code == 401
    assert client.patch(item_path, json={"title": "Unauthorized"}).status_code == 401
    assert client.post(item_path + "/reopen").status_code == 401


@pytest.mark.parametrize("terminal", ["completed", "abandoned"])
def test_project_expiration_cannot_reset_archive(
    client, create_auth_token, db_session, terminal
):
    user_id = uuid.uuid4()
    headers = {"Authorization": f"Bearer {create_auth_token(user_id)}"}
    project = Project(
        user_id=user_id,
        title="Expired",
        status=terminal,
        completed_at=datetime.now(UTC) - timedelta(days=3),
    )
    db_session.add(project)
    db_session.commit()
    path = f"/api/v1/projects/{project.id}"
    assert client.get("/api/v1/projects", headers=headers).json() == []
    archived = client.get(
        "/api/v1/projects?filter_status=archived", headers=headers
    ).json()
    assert len(archived) == 1
    assert archived[0]["is_archived"] is True
    assert archived[0]["archived_at"] is not None
    db_session.refresh(project)
    assert project.archived_at is not None
    for new_status in {"active", "paused", "completed", "abandoned"} - {terminal}:
        assert (
            client.patch(path, headers=headers, json={"status": new_status}).status_code
            == 400
        )
    assert client.post(path + "/reopen", headers=headers).status_code == 400


def test_project_terminal_switch_preserves_deadline(client, create_auth_token):
    headers = {"Authorization": f"Bearer {create_auth_token(uuid.uuid4())}"}
    item = client.post(
        "/api/v1/projects", headers=headers, json={"title": "Lifecycle"}
    ).json()
    path = f"/api/v1/projects/{item['id']}"
    completed = client.patch(path, headers=headers, json={"status": "completed"}).json()
    abandoned = client.patch(path, headers=headers, json={"status": "abandoned"}).json()
    assert abandoned["completed_at"] == completed["completed_at"]
    repeated = client.patch(path, headers=headers, json={"status": "abandoned"}).json()
    assert repeated["completed_at"] == completed["completed_at"]
    reopened = client.patch(path, headers=headers, json={"status": "paused"}).json()
    assert reopened["status"] == "paused"
    assert reopened["completed_at"] is None
    assert reopened["is_archived"] is False


def test_exact_grace_boundary():
    now = datetime(2026, 10, 13, tzinfo=UTC)
    deadline_completion = now - timedelta(days=2)
    for completion in [deadline_completion, deadline_completion.replace(tzinfo=None)]:
        assert is_archived_item(completion, None, now)
        assert not is_in_grace_period(completion, None, now)
        just_before = now - timedelta(microseconds=1)
        assert not is_archived_item(completion, None, just_before)
        assert is_in_grace_period(completion, None, just_before)


def test_goal_repeated_completion_and_reopen(client, create_auth_token):
    headers = {"Authorization": f"Bearer {create_auth_token(uuid.uuid4())}"}
    created = client.post(
        "/api/v1/goals", headers=headers, json={"title": "Goal"}
    ).json()
    path = f"/api/v1/goals/{created['id']}"
    completed = client.patch(path, headers=headers, json={"status": "completed"}).json()
    repeated = client.patch(path, headers=headers, json={"status": "completed"}).json()
    assert repeated["completed_at"] == completed["completed_at"]
    reopened = client.patch(path, headers=headers, json={"status": "active"}).json()
    assert reopened["completed_at"] is None
    assert reopened["archived_at"] is None
    assert reopened["status"] == "active"


@pytest.mark.parametrize("progress", [-1, 101, 1.5])
def test_invalid_progress(client, create_auth_token, progress):
    headers = {"Authorization": f"Bearer {create_auth_token(uuid.uuid4())}"}
    response = client.post(
        "/api/v1/goals",
        headers=headers,
        json={"title": "Progress", "progress_percent": progress},
    )
    assert response.status_code == 422


def test_goal_crud_and_user_isolation(
    client: TestClient, create_auth_token, db_session
):
    user1_id = uuid.uuid4()
    user2_id = uuid.uuid4()
    token1 = create_auth_token(user_id=user1_id, email="user1@example.com")
    token2 = create_auth_token(user_id=user2_id, email="user2@example.com")

    # User 1 creates goal
    create_res = client.post(
        "/api/v1/goals",
        json={"title": "Run a 5k", "progress_percent": 30},
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert create_res.status_code == 201
    goal_data = create_res.json()
    assert goal_data["title"] == "Run a 5k"
    assert goal_data["progress_percent"] == 30
    assert goal_data["status"] == "active"
    assert goal_data["is_archived"] is False
    assert goal_data["in_grace_period"] is False
    goal_id = goal_data["id"]

    # User 2 cannot see User 1's goal
    list_res_u2 = client.get(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert list_res_u2.status_code == 200
    assert len(list_res_u2.json()) == 0

    get_res_u2 = client.get(
        f"/api/v1/goals/{goal_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert get_res_u2.status_code == 404

    # User 1 completes goal
    update_res = client.patch(
        f"/api/v1/goals/{goal_id}",
        json={"status": "completed"},
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert update_res.status_code == 200
    completed_data = update_res.json()
    assert completed_data["status"] == "completed"
    assert completed_data["progress_percent"] == 100
    assert completed_data["in_grace_period"] is True
    assert completed_data["is_archived"] is False

    # Goal is still visible in active_workspace during grace period
    list_active = client.get(
        "/api/v1/goals?filter_status=active_workspace",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert len(list_active.json()) == 1

    # User 1 reopens goal during grace period
    reopen_res = client.post(
        f"/api/v1/goals/{goal_id}/reopen",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert reopen_res.status_code == 200
    reopened_data = reopen_res.json()
    assert reopened_data["status"] == "active"
    assert reopened_data["in_grace_period"] is False
    assert reopened_data["completed_at"] is None


def test_goal_grace_period_expiration(
    client: TestClient, create_auth_token, db_session
):
    user_id = uuid.uuid4()
    token = create_auth_token(user_id=user_id, email="grace@example.com")

    # Create goal with completed_at 3 days ago (grace period expired)
    three_days_ago = datetime.now(UTC) - timedelta(days=3)
    goal = Goal(
        user_id=user_id,
        title="Expired Goal",
        status="completed",
        progress_percent=100,
        completed_at=three_days_ago,
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)

    # In active workspace, it should not appear
    list_active = client.get(
        "/api/v1/goals?filter_status=active_workspace",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(list_active.json()) == 0

    # In archived view, it should appear
    list_archived = client.get(
        "/api/v1/goals?filter_status=archived",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(list_archived.json()) == 1
    assert list_archived.json()[0]["is_archived"] is True

    # Reopening after grace period expires should fail
    reopen_res = client.post(
        f"/api/v1/goals/{goal.id}/reopen",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert reopen_res.status_code == 400


def test_project_crud_and_lifecycle(client: TestClient, create_auth_token, db_session):
    user_id = uuid.uuid4()
    token = create_auth_token(user_id=user_id, email="project@example.com")

    # Create project
    create_res = client.post(
        "/api/v1/projects",
        json={"title": "Continuum App", "description": "Handcrafted tracking app"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    proj_data = create_res.json()
    assert proj_data["status"] == "active"
    proj_id = proj_data["id"]

    # Pause project
    pause_res = client.patch(
        f"/api/v1/projects/{proj_id}",
        json={"status": "paused"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert pause_res.status_code == 200
    assert pause_res.json()["status"] == "paused"

    # Abandon project (terminal state -> enters grace period)
    abandon_res = client.patch(
        f"/api/v1/projects/{proj_id}",
        json={"status": "abandoned"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert abandon_res.status_code == 200
    ab_data = abandon_res.json()
    assert ab_data["status"] == "abandoned"
    assert ab_data["in_grace_period"] is True
    assert ab_data["completed_at"] is not None

    # Reopen during grace period
    reopen_res = client.post(
        f"/api/v1/projects/{proj_id}/reopen",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert reopen_res.status_code == 200
    reopened = reopen_res.json()
    assert reopened["status"] == "active"
    assert reopened["in_grace_period"] is False
    assert reopened["completed_at"] is None
