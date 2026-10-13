import uuid

import pytest


def headers(create_auth_token):
    return {"Authorization": f"Bearer {create_auth_token(uuid.uuid4())}"}


def test_note_save_reorder_archive_and_isolation(client, create_auth_token):
    owner = headers(create_auth_token)
    stranger = headers(create_auth_token)
    blocks = [
        {"id": "one", "type": "paragraph", "content": "A thought"},
        {
            "id": "two",
            "type": "checkListItem",
            "props": {"checked": False},
            "content": [{"type": "text", "text": "Make something", "styles": {}}],
        },
    ]
    created = client.post(
        "/api/v1/notes", headers=owner, json={"title": "Notebook", "content": blocks}
    )
    assert created.status_code == 201
    note = created.json()
    path = f"/api/v1/notes/{note['id']}"
    assert client.get(path, headers=stranger).status_code == 404
    assert (
        client.put(
            path, headers=stranger, json={"title": "Other", "content": []}
        ).status_code
        == 404
    )
    assert client.post(path + "/archive", headers=stranger).status_code == 404
    assert client.get("/api/v1/notes", headers=stranger).json() == []
    saved = client.put(
        path, headers=owner, json={"title": "Reordered", "content": blocks[::-1]}
    )
    assert saved.status_code == 200
    assert saved.json()["content"][0]["id"] == "two"
    assert client.get(path, headers=owner).json()["content"] == blocks[::-1]
    assert client.post(path + "/archive", headers=owner).json()["archived_at"]
    assert client.get("/api/v1/notes", headers=owner).json() == []
    assert len(client.get("/api/v1/notes?archived=true", headers=owner).json()) == 1
    assert (
        client.put(
            path, headers=owner, json={"title": "Restore", "content": []}
        ).status_code
        == 400
    )


@pytest.mark.parametrize(
    "block",
    [
        {"type": "image", "props": {"url": "https://example.com/image.png"}},
        {"type": "paragraph", "content": [{"type": "image", "url": "image.png"}]},
        {
            "type": "paragraph",
            "content": [{"type": "link", "href": "javascript:alert(1)", "content": []}],
        },
    ],
)
def test_note_rejects_deferred_media_and_unsafe_links(client, create_auth_token, block):
    response = client.post(
        "/api/v1/notes",
        headers=headers(create_auth_token),
        json={"title": "Narrow editor", "content": [block]},
    )
    assert response.status_code == 422


def test_sticky_promotion_preserves_text_and_connections(client, create_auth_token):
    owner = headers(create_auth_token)
    goal = client.post("/api/v1/goals", headers=owner, json={"title": "Grow"}).json()
    sticky = client.post(
        "/api/v1/sticky-notes",
        headers=owner,
        json={"content": "Keep this thought.\nAnd this one.", "color_token": "blush"},
    ).json()
    path = f"/api/v1/sticky-notes/{sticky['id']}"
    client.post(
        "/api/v1/links",
        headers=owner,
        json={
            "source_type": "sticky_note",
            "source_id": sticky["id"],
            "target_type": "goal",
            "target_id": goal["id"],
        },
    )
    updated = client.put(
        path, headers=owner, json={"content": sticky["content"], "color_token": "sage"}
    )
    assert updated.status_code == 200
    assert updated.json()["color_token"] == "sage"
    promoted = client.post(path + "/promote", headers=owner)
    assert promoted.status_code == 201
    note = promoted.json()
    assert note["content"][0]["content"] == sticky["content"]
    assert client.get("/api/v1/sticky-notes", headers=owner).json() == []
    assert (
        len(client.get("/api/v1/sticky-notes?archived=true", headers=owner).json()) == 1
    )
    links = client.get(
        "/api/v1/links",
        headers=owner,
        params={"entity_type": "note", "entity_id": note["id"]},
    ).json()
    assert len(links) == 1
    assert goal["id"] in [links[0]["source_id"], links[0]["target_id"]]
    assert client.post(path + "/promote", headers=owner).status_code == 400


def test_library_types_are_reusable_and_owned(client, create_auth_token):
    owner = headers(create_auth_token)
    stranger = headers(create_auth_token)
    defaults = client.get("/api/v1/library-types", headers=owner).json()
    assert {kind["slug"] for kind in defaults} == {
        "book",
        "movie",
        "series",
        "article",
        "course",
        "video",
    }
    assert len(client.get("/api/v1/library-types", headers=owner).json()) == 6
    custom = client.post(
        "/api/v1/library-types", headers=owner, json={"name": "Podcast"}
    ).json()
    assert (
        client.post(
            "/api/v1/library-types", headers=owner, json={"name": " podcast "}
        ).status_code
        == 409
    )
    for title in ["One", "Two"]:
        assert (
            client.post(
                "/api/v1/library",
                headers=owner,
                json={"title": title, "type_id": custom["id"]},
            ).status_code
            == 201
        )
    assert len(client.get("/api/v1/library", headers=owner).json()) == 2
    assert client.get("/api/v1/library", headers=stranger).json() == []
    assert all(
        kind["id"] != custom["id"]
        for kind in client.get("/api/v1/library-types", headers=stranger).json()
    )
    assert (
        client.post(
            "/api/v1/library",
            headers=stranger,
            json={"title": "Steal type", "type_id": custom["id"]},
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/library",
            headers=owner,
            json={
                "title": "Unsafe",
                "type_id": custom["id"],
                "url": "javascript:alert(1)",
            },
        ).status_code
        == 422
    )


def test_generic_links_canonicalize_and_validate_both_owners(client, create_auth_token):
    owner = headers(create_auth_token)
    stranger = headers(create_auth_token)
    goal = client.post("/api/v1/goals", headers=owner, json={"title": "Goal"}).json()
    project = client.post(
        "/api/v1/projects", headers=owner, json={"title": "Project"}
    ).json()
    foreign = client.post(
        "/api/v1/notes", headers=stranger, json={"title": "Private"}
    ).json()
    body = {
        "source_type": "goal",
        "source_id": goal["id"],
        "target_type": "project",
        "target_id": project["id"],
    }
    created = client.post("/api/v1/links", headers=owner, json=body)
    assert created.status_code == 201
    reverse = client.post(
        "/api/v1/links",
        headers=owner,
        json={
            "source_type": "project",
            "source_id": project["id"],
            "target_type": "goal",
            "target_id": goal["id"],
        },
    )
    assert reverse.json()["id"] == created.json()["id"]
    assert len(client.get("/api/v1/links", headers=owner).json()) == 1
    assert (
        client.post(
            "/api/v1/links",
            headers=owner,
            json={**body, "target_type": "note", "target_id": foreign["id"]},
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/links",
            headers=owner,
            json={**body, "target_type": "goal", "target_id": goal["id"]},
        ).status_code
        == 422
    )
    assert (
        client.get(
            "/api/v1/links",
            headers=stranger,
            params={"entity_type": "goal", "entity_id": goal["id"]},
        ).status_code
        == 404
    )
    link_path = f"/api/v1/links/{created.json()['id']}"
    assert client.delete(link_path, headers=stranger).status_code == 404
    assert client.delete(link_path, headers=owner).status_code == 204
    assert client.get(f"/api/v1/goals/{goal['id']}", headers=owner).status_code == 200
    assert (
        client.get(f"/api/v1/projects/{project['id']}", headers=owner).status_code
        == 200
    )


def test_timeline_is_single_date_and_manually_curated(client, create_auth_token):
    owner = headers(create_auth_token)
    stranger = headers(create_auth_token)
    goal = client.post("/api/v1/goals", headers=owner, json={"title": "Done"}).json()
    client.patch(
        f"/api/v1/goals/{goal['id']}", headers=owner, json={"status": "completed"}
    )
    assert client.get("/api/v1/timeline", headers=owner).json() == []
    body = {
        "title": "First page",
        "event_date": "2026-10-14",
        "description": "A beginning",
    }
    created = client.post("/api/v1/timeline", headers=owner, json=body)
    assert created.status_code == 201
    path = f"/api/v1/timeline/{created.json()['id']}"
    assert client.put(path, headers=stranger, json=body).status_code == 404
    changed = client.put(path, headers=owner, json={**body, "title": "A new beginning"})
    assert changed.status_code == 200
    assert changed.json()["event_date"] == body["event_date"]
    assert (
        client.post(
            "/api/v1/timeline",
            headers=owner,
            json={"title": "Invalid", "event_date": "2026-02-30"},
        ).status_code
        == 422
    )
    assert client.get("/api/v1/timeline", headers=stranger).json() == []


@pytest.mark.parametrize(
    "path",
    ["/notes", "/sticky-notes", "/library", "/library-types", "/timeline", "/links"],
)
def test_workspace_requires_authentication(client, path):
    assert client.get("/api/v1" + path).status_code == 401
