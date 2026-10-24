from datetime import datetime, timedelta, timezone


def test_register_and_login(client):
    """Verifies registration and login flows with password validation."""
    # 1. Register User
    reg_res = client.post("/api/auth/register", json={
        "email": "alice@example.com",
        "password": "strongpassword123"
    })
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "alice@example.com"
    # Check that httpOnly cookie was set in response
    assert "access_token" in reg_res.cookies

    # 2. Login with wrong password
    bad_login = client.post("/api/auth/login", json={
        "email": "alice@example.com",
        "password": "wrongpassword"
    })
    assert bad_login.status_code == 401

    # 3. Login with correct password
    good_login = client.post("/api/auth/login", json={
        "email": "alice@example.com",
        "password": "strongpassword123"
    })
    assert good_login.status_code == 200
    assert "access_token" in good_login.json()


def test_user_data_isolation(client):
    """
    CRITICAL SECURITY TEST:
    Proves that every user can only view, modify, and delete their own data.
    User B must never be able to access or tamper with User A's tasks or journal entries.
    """
    # 1. Register User A (Alice)
    res_a = client.post("/api/auth/register", json={
        "email": "alice@example.com",
        "password": "password123"
    })
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Register User B (Bob)
    res_b = client.post("/api/auth/register", json={
        "email": "bob@example.com",
        "password": "password123"
    })
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. Alice creates a private task
    now = datetime.now(timezone.utc)
    task_res = client.post("/api/tasks/", json={
        "title": "Alice's Secret Project",
        "planned_start_time": now.isoformat(),
        "planned_end_time": (now + timedelta(hours=1)).isoformat()
    }, headers=headers_a)
    assert task_res.status_code == 201
    alice_task_id = task_res.json()["id"]

    # 4. Bob creates his own task
    client.post("/api/tasks/", json={
        "title": "Bob's Public Task",
        "planned_start_time": now.isoformat(),
        "planned_end_time": (now + timedelta(hours=2)).isoformat()
    }, headers=headers_b)

    # 5. VERIFY ISOLATION: Bob views his tasks
    bob_tasks_res = client.get("/api/tasks/", headers=headers_b)
    bob_tasks = bob_tasks_res.json()
    assert len(bob_tasks) == 1
    assert bob_tasks[0]["title"] == "Bob's Public Task"
    # Alice's task must NOT be in Bob's task list!
    assert not any(t["id"] == alice_task_id for t in bob_tasks)

    # 6. VERIFY ISOLATION: Bob tries to delete Alice's task -> 404 Not Found
    tamper_res = client.delete(f"/api/tasks/{alice_task_id}", headers=headers_b)
    assert tamper_res.status_code == 404

    # 7. Alice writes a journal reflection
    today_str = now.date().isoformat()
    client.post("/api/journal/", json={
        "entry_date": today_str,
        "content": "Alice's deepest private thoughts.",
        "mood": "calm"
    }, headers=headers_a)

    # 8. VERIFY ISOLATION: Bob requests journal for today
    bob_journal_res = client.get(f"/api/journal/?entry_date={today_str}", headers=headers_b)
    assert bob_journal_res.status_code == 200
    bob_journal = bob_journal_res.json()
    # Bob should get an empty journal, NOT Alice's text
    assert bob_journal["content"] == ""
    assert bob_journal["content"] != "Alice's deepest private thoughts."
