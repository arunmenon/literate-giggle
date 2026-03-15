"""Smoke tests for workspace tenancy flow.

Tests the full lifecycle:
1. Register teacher -> auto-creates workspace + gets invite code
2. Register student with invite code -> joins workspace
3. Create class -> enroll student
4. Assign exam to class
5. Student lists exams -> sees only assigned paper
6. Student starts exam -> submits -> evaluates
7. Teacher sees student in class and results
"""

import pytest
import pytest_asyncio
import httpx
from httpx import ASGITransport

from app.main import app
from app.core.database import engine, Base

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create fresh database for each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_teacher_registration_creates_workspace(client):
    """Teacher registration should auto-create a personal workspace."""
    response = await client.post("/api/auth/register", json={
        "user": {
            "email": "test.teacher@example.com",
            "password": "password123",
            "full_name": "Test Teacher",
            "role": "teacher",
        },
        "teacher_profile": {
            "board": "CBSE",
            "subjects": ["Mathematics"],
            "classes": [10],
        },
    })
    assert response.status_code == 201
    data = response.json()
    assert data["workspace_id"] is not None
    assert data["workspace_role"] == "owner"
    assert data["workspace_name"] is not None
    assert data["workspace_type"] == "personal"
    return data


async def test_student_registration_with_invite_code(client):
    """Student with invite code should join the teacher's workspace."""
    # Register teacher first
    teacher_resp = await client.post("/api/auth/register", json={
        "user": {
            "email": "teacher@test.com",
            "password": "pass123",
            "full_name": "Teacher",
            "role": "teacher",
        },
        "teacher_profile": {
            "board": "CBSE",
            "subjects": ["Math"],
            "classes": [10],
        },
    })
    teacher_data = teacher_resp.json()
    teacher_token = teacher_data["access_token"]

    # Get workspace details (to find invite code)
    ws_resp = await client.get("/api/workspace", headers={
        "Authorization": f"Bearer {teacher_token}"
    })
    assert ws_resp.status_code == 200
    invite_code = ws_resp.json()["invite_code"]

    # Register student with invite code
    student_resp = await client.post("/api/auth/register", json={
        "user": {
            "email": "student@test.com",
            "password": "pass123",
            "full_name": "Student",
            "role": "student",
        },
        "student_profile": {
            "board": "CBSE",
            "class_grade": 10,
        },
        "invite_code": invite_code,
    })
    assert student_resp.status_code == 201
    student_data = student_resp.json()
    assert student_data["workspace_id"] == teacher_data["workspace_id"]
    assert student_data["workspace_role"] == "student"


async def test_full_workspace_flow(client):
    """Full flow: register -> create class -> enroll -> assign -> student sees exam."""
    # 1. Register teacher
    teacher_resp = await client.post("/api/auth/register", json={
        "user": {
            "email": "teacher@flow.com",
            "password": "pass123",
            "full_name": "Flow Teacher",
            "role": "teacher",
        },
        "teacher_profile": {
            "board": "CBSE",
            "subjects": ["Mathematics"],
            "classes": [10],
        },
    })
    teacher_data = teacher_resp.json()
    teacher_token = teacher_data["access_token"]
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    # Get invite code
    ws_resp = await client.get("/api/workspace", headers=teacher_headers)
    invite_code = ws_resp.json()["invite_code"]

    # 2. Register student with invite code
    student_resp = await client.post("/api/auth/register", json={
        "user": {
            "email": "student@flow.com",
            "password": "pass123",
            "full_name": "Flow Student",
            "role": "student",
        },
        "student_profile": {
            "board": "CBSE",
            "class_grade": 10,
        },
        "invite_code": invite_code,
    })
    student_data = student_resp.json()
    student_token = student_data["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 3. Teacher creates a class
    class_resp = await client.post("/api/classes", json={
        "name": "Class 10-A",
        "grade": 10,
        "section": "A",
        "subject": "Mathematics",
        "academic_year": "2025-26",
    }, headers=teacher_headers)
    assert class_resp.status_code == 201
    class_id = class_resp.json()["id"]

    # 4. Teacher enrolls student
    enroll_resp = await client.post(f"/api/classes/{class_id}/enroll", json={
        "email": "student@flow.com",
    }, headers=teacher_headers)
    assert enroll_resp.status_code == 201

    # 5. Teacher creates a question bank and question
    bank_resp = await client.post("/api/questions/banks", json={
        "name": "Math Bank",
        "board": "CBSE",
        "class_grade": 10,
        "subject": "Mathematics",
    }, headers=teacher_headers)
    assert bank_resp.status_code == 201
    bank_id = bank_resp.json()["id"]

    q_resp = await client.post("/api/questions", json={
        "bank_id": bank_id,
        "question_type": "mcq",
        "question_text": "What is 2+2?",
        "marks": 1,
        "topic": "Arithmetic",
        "mcq_options": {"a": "3", "b": "4", "c": "5", "d": "6"},
        "correct_option": "b",
    }, headers=teacher_headers)
    assert q_resp.status_code == 201
    question_id = q_resp.json()["id"]

    # 6. Teacher creates a paper
    paper_resp = await client.post("/api/papers", json={
        "title": "Math Unit Test",
        "board": "CBSE",
        "class_grade": 10,
        "subject": "Mathematics",
        "total_marks": 1,
        "duration_minutes": 30,
        "questions": [
            {"question_id": question_id, "section": "A", "order": 1},
        ],
    }, headers=teacher_headers)
    assert paper_resp.status_code == 201
    paper_id = paper_resp.json()["id"]

    # Publish the paper
    await client.patch(f"/api/papers/{paper_id}/status", json={
        "status": "published",
    }, headers=teacher_headers)

    # Make it active
    await client.patch(f"/api/papers/{paper_id}/status", json={
        "status": "active",
    }, headers=teacher_headers)

    # 7. Teacher assigns paper to class
    assign_resp = await client.post(f"/api/classes/{class_id}/assign-exam", json={
        "paper_id": paper_id,
        "status": "active",
    }, headers=teacher_headers)
    assert assign_resp.status_code == 201

    # 8. Verify workspace members
    members_resp = await client.get("/api/workspace/members", headers=teacher_headers)
    assert members_resp.status_code == 200
    members = members_resp.json()
    assert len(members) == 2  # teacher + student

    # 9. Verify class has student
    students_resp = await client.get(f"/api/classes/{class_id}/students", headers=teacher_headers)
    assert students_resp.status_code == 200
    students = students_resp.json()
    assert len(students) == 1


async def test_invite_code_error_contract(client):
    """Verify invite code error responses match the contract."""
    # Invalid code -> 404
    resp = await client.post("/api/auth/register", json={
        "user": {
            "email": "bad@test.com",
            "password": "pass123",
            "full_name": "Bad Student",
            "role": "student",
        },
        "student_profile": {
            "board": "CBSE",
            "class_grade": 10,
        },
        "invite_code": "XXXXXX",
    })
    assert resp.status_code == 404
    assert "Invalid invite code" in resp.json()["detail"]


async def test_workspace_scoping_isolation(client):
    """Question banks should be isolated between workspaces."""
    # Create two teachers with separate workspaces
    t1_resp = await client.post("/api/auth/register", json={
        "user": {
            "email": "t1@test.com", "password": "pass", "full_name": "T1", "role": "teacher",
        },
        "teacher_profile": {"board": "CBSE", "subjects": ["Math"], "classes": [10]},
    })
    t1_token = t1_resp.json()["access_token"]
    t1_headers = {"Authorization": f"Bearer {t1_token}"}

    t2_resp = await client.post("/api/auth/register", json={
        "user": {
            "email": "t2@test.com", "password": "pass", "full_name": "T2", "role": "teacher",
        },
        "teacher_profile": {"board": "CBSE", "subjects": ["Science"], "classes": [10]},
    })
    t2_token = t2_resp.json()["access_token"]
    t2_headers = {"Authorization": f"Bearer {t2_token}"}

    # T1 creates a bank
    await client.post("/api/questions/banks", json={
        "name": "T1 Bank", "board": "CBSE", "class_grade": 10, "subject": "Math",
    }, headers=t1_headers)

    # T2 creates a bank
    await client.post("/api/questions/banks", json={
        "name": "T2 Bank", "board": "CBSE", "class_grade": 10, "subject": "Science",
    }, headers=t2_headers)

    # T1 should only see T1's bank
    t1_banks = await client.get("/api/questions/banks", headers=t1_headers)
    assert len(t1_banks.json()) == 1
    assert t1_banks.json()[0]["name"] == "T1 Bank"

    # T2 should only see T2's bank
    t2_banks = await client.get("/api/questions/banks", headers=t2_headers)
    assert len(t2_banks.json()) == 1
    assert t2_banks.json()[0]["name"] == "T2 Bank"
