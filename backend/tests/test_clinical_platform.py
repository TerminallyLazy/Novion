import os
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

TEST_DB_PATH = Path(tempfile.gettempdir()) / "novion-clinical-platform-test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["NOVION_CLINICAL_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"

try:
    from backend.server import app  # type: ignore
except Exception:
    from server import app  # type: ignore


client = TestClient(app)


def test_platform_config_exposes_safe_defaults() -> None:
    response = client.get("/api/platform/config")
    assert response.status_code == 200

    payload = response.json()
    assert payload["mode"] in {"research", "pilot", "clinical"}
    assert payload["aiDefaultWorkflowMode"] == "shadow"
    assert payload["aiAllowActive"] is False


def test_worklist_returns_seeded_rows() -> None:
    response = client.get("/api/worklist")
    assert response.status_code == 200

    payload = response.json()
    assert payload["role"] == "radiologist"
    assert len(payload["rows"]) >= 1
    assert "studyInstanceUID" in payload["rows"][0]


def test_imaging_launch_returns_opaque_token_and_viewer_url() -> None:
    payload = {
        "studyInstanceUID": "1.2.840.113619.2.55.3.604688123.1234.1700000001.101",
        "patientRef": "Patient/example-ct-01",
        "actorUserId": "demo-radiologist",
        "actorRole": "radiologist",
    }

    response = client.post("/api/imaging/launch", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert body["signature"]
    assert body["launchToken"].startswith("launch-")
    assert body["viewerUrl"].startswith("http://localhost:3000/viewer?launch=")
    assert "study=" not in body["viewerUrl"]
    assert body["context"]["studyInstanceUID"] == payload["studyInstanceUID"]


def test_launch_resolution_returns_verified_context_and_wado_uri() -> None:
    launch_response = client.post(
        "/api/imaging/launch",
        json={
            "studyInstanceUID": "1.2.840.113619.2.55.3.604688123.1234.1700000002.201",
            "patientRef": "Patient/example-mr-02",
            "actorUserId": "demo-radiologist",
            "actorRole": "radiologist",
        },
    )
    assert launch_response.status_code == 200

    launch_token = launch_response.json()["launchToken"]
    resolve_response = client.get(
        f"/api/imaging/launch/resolve?launch={launch_token}"
    )
    assert resolve_response.status_code == 200

    payload = resolve_response.json()
    assert payload["launchToken"] == launch_token
    assert payload["context"]["studyInstanceUID"] == "1.2.840.113619.2.55.3.604688123.1234.1700000002.201"
    assert payload["studyWadoRsUri"].endswith(payload["context"]["studyInstanceUID"])


def test_active_ai_mode_is_rejected_by_default() -> None:
    payload = {
        "kind": "triage",
        "workflowMode": "active",
        "studyInstanceUID": "1.2.840.113619.2.55.3.604688123.1234.1700000001.101",
        "modelId": "triage-model",
        "modelVersion": "1.0.0",
        "inputHash": "abc123",
        "requestedBy": "qa-user",
    }

    response = client.post("/api/ai/jobs", json=payload)
    assert response.status_code == 409
    assert "disabled" in response.json()["detail"].lower()


def test_workspace_round_trip_persists_report_ai_job_and_derived_result() -> None:
    study_uid = "9.9.9.9.20260308.1"

    report_response = client.post(
        "/api/reports/draft",
        json={
            "studyInstanceUID": study_uid,
            "authorUserId": "demo-radiologist",
            "findingsSummary": "Stable postoperative changes. No acute hemorrhage.",
            "impression": "No acute intracranial abnormality.",
            "status": "draft",
        },
    )
    assert report_response.status_code == 200
    report_id = report_response.json()["reportId"]

    ai_response = client.post(
        "/api/ai/jobs",
        json={
            "kind": "triage",
            "workflowMode": "shadow",
            "studyInstanceUID": study_uid,
            "modelId": "triage-model",
            "modelVersion": "1.0.0",
            "inputHash": "workspace-round-trip",
            "requestedBy": "demo-radiologist",
        },
    )
    assert ai_response.status_code == 200
    job_id = ai_response.json()["jobId"]

    derived_response = client.post(
        "/api/derived-results",
        json={
            "actorUserId": "demo-radiologist",
            "actorRole": "radiologist",
            "objects": [
                {
                    "objectType": "sr",
                    "studyInstanceUID": study_uid,
                    "storageClass": "SR",
                    "payloadRef": "derived/sr/test-workspace-round-trip",
                    "metadata": {"source": "pytest"},
                }
            ],
        },
    )
    assert derived_response.status_code == 200
    assert derived_response.json()["result"]["stored"] == [
        "derived/sr/test-workspace-round-trip"
    ]

    workspace_response = client.get(f"/api/studies/{study_uid}/workspace")
    assert workspace_response.status_code == 200

    workspace = workspace_response.json()
    assert workspace["worklistRow"]["studyInstanceUID"] == study_uid
    assert workspace["reports"][0]["reportId"] == report_id
    assert workspace["aiJobs"][0]["jobId"] == job_id
    assert workspace["derivedResults"][0]["payloadRef"] == "derived/sr/test-workspace-round-trip"
    audit_actions = {event["action"] for event in workspace["audit"]}
    assert {"SAVE_REPORT", "RUN_AI", "STORE_SEG"}.issubset(audit_actions)
