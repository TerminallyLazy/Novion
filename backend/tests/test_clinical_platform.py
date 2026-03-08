import os
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

TEST_DB_PATH = Path(tempfile.gettempdir()) / "novion-clinical-platform-test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["NOVION_CLINICAL_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"

try:
    from backend.server import app, clinical_service  # type: ignore
    from backend.clinical.contracts import StoreResult  # type: ignore
except Exception:
    from server import app, clinical_service  # type: ignore
    from clinical.contracts import StoreResult  # type: ignore


client = TestClient(app)


def login(username: str = "demo-radiologist") -> None:
    response = client.post("/api/auth/local-login", json={"username": username})
    assert response.status_code == 200
    body = response.json()
    assert body["session"]["username"] == username
    assert "expiresAt" in body["session"]


def test_auth_session_lifecycle() -> None:
    unauthenticated = client.get("/api/auth/session")
    assert unauthenticated.status_code == 200
    assert unauthenticated.json() == {"authenticated": False, "session": None}

    login()

    authenticated = client.get("/api/auth/session")
    assert authenticated.status_code == 200
    payload = authenticated.json()
    assert payload["authenticated"] is True
    assert payload["session"]["username"] == "demo-radiologist"
    assert payload["session"]["roles"] == ["radiologist"]

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200
    assert logout.json() == {"authenticated": False, "session": None}

    after_logout = client.get("/api/auth/session")
    assert after_logout.status_code == 200
    assert after_logout.json() == {"authenticated": False, "session": None}


def test_clinical_endpoints_require_session() -> None:
    response = client.get("/api/worklist")
    assert response.status_code == 401
    assert "session required" in response.json()["detail"].lower()


def test_platform_config_exposes_auth_and_viewer_shape() -> None:
    response = client.get("/api/platform/config")
    assert response.status_code == 200

    payload = response.json()
    assert payload["mode"] in {"research", "pilot", "clinical"}
    assert payload["viewerKind"] == "ohif"
    assert payload["viewerBasePath"] == "/viewer"
    assert payload["authMode"] == "local"
    assert payload["aiDefaultWorkflowMode"] == "shadow"
    assert payload["aiAllowActive"] is False


def test_worklist_returns_seeded_rows_for_authenticated_actor() -> None:
    login()

    response = client.get("/api/worklist")
    assert response.status_code == 200

    payload = response.json()
    assert payload["role"] == "radiologist"
    assert payload["userId"] == "demo-radiologist"
    assert len(payload["rows"]) >= 1
    assert "studyInstanceUID" in payload["rows"][0]


def test_imaging_launch_returns_opaque_token_and_viewer_url_without_phi_in_url() -> None:
    login()

    payload = {
        "studyInstanceUID": "1.2.840.113619.2.55.3.604688123.1234.1700000001.101",
    }

    response = client.post("/api/imaging/launch", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert body["signature"]
    assert body["launchToken"].startswith("launch-")
    assert body["viewerUrl"].startswith("http://localhost:3000/viewer?launch=")
    assert "study=" not in body["viewerUrl"]
    assert body["context"]["studyInstanceUID"] == payload["studyInstanceUID"]
    assert body["context"]["patientRef"] == "Patient/example-ct-01"


def test_launch_resolution_returns_viewer_runtime_and_same_origin_dicomweb_roots() -> None:
    login()

    launch_response = client.post(
        "/api/imaging/launch",
        json={
            "studyInstanceUID": "1.2.840.113619.2.55.3.604688123.1234.1700000002.201",
        },
    )
    assert launch_response.status_code == 200

    launch_token = launch_response.json()["launchToken"]
    resolve_response = client.get(f"/api/imaging/launch/resolve?launch={launch_token}")
    assert resolve_response.status_code == 200

    payload = resolve_response.json()
    assert payload["launchToken"] == launch_token
    assert payload["context"]["studyInstanceUID"] == "1.2.840.113619.2.55.3.604688123.1234.1700000002.201"
    assert payload["studyWadoRsUri"].endswith(payload["context"]["studyInstanceUID"])
    runtime = payload["viewerRuntime"]
    assert runtime["viewerKind"] == "ohif"
    assert runtime["viewerBasePath"] == "/viewer"
    assert runtime["authMode"] == "local"
    assert runtime["qidoRoot"] == "/dicom-web"
    assert runtime["wadoRoot"] == "/dicom-web"
    assert runtime["stowRoot"] == "/dicom-web"
    assert runtime["featureFlags"]["localFileImport"] is False


def test_active_ai_mode_is_rejected_by_default() -> None:
    login()

    payload = {
        "kind": "triage",
        "workflowMode": "active",
        "studyInstanceUID": "1.2.840.113619.2.55.3.604688123.1234.1700000001.101",
        "modelId": "triage-model",
        "modelVersion": "1.0.0",
        "inputHash": "abc123",
    }

    response = client.post("/api/ai/jobs", json=payload)
    assert response.status_code == 409
    assert "disabled" in response.json()["detail"].lower()


def test_workspace_round_trip_persists_report_ai_job_and_internal_derived_result() -> None:
    login()
    study_uid = "9.9.9.9.20260308.1"

    report_response = client.post(
        "/api/reports/draft",
        json={
            "studyInstanceUID": study_uid,
            "findingsSummary": "Stable postoperative changes. No acute hemorrhage.",
            "impression": "No acute intracranial abnormality.",
            "status": "draft",
        },
    )
    assert report_response.status_code == 200
    report_id = report_response.json()["reportId"]
    assert report_response.json()["authorUserId"] == "demo-radiologist"

    ai_response = client.post(
        "/api/ai/jobs",
        json={
            "kind": "triage",
            "workflowMode": "shadow",
            "studyInstanceUID": study_uid,
            "modelId": "triage-model",
            "modelVersion": "1.0.0",
            "inputHash": "workspace-round-trip",
        },
    )
    assert ai_response.status_code == 200
    job_id = ai_response.json()["jobId"]
    assert ai_response.json()["requestedBy"] == "demo-radiologist"

    derived_response = client.post(
        "/api/derived-results",
        json={
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


def test_stow_endpoint_persists_backend_registered_refs(monkeypatch) -> None:
    login()
    study_uid = "1.2.840.113619.2.55.3.604688123.1234.1700000001.101"

    async def fake_store_uploaded_instances(request, files):
        assert request.study_instance_uid == study_uid
        assert len(files) == 1
        return StoreResult(
            stored=[f"/dicom-web/studies/{study_uid}/instances/1.2.3.4"],
            warnings=[],
        )

    monkeypatch.setattr(
        clinical_service._dicomweb,
        "store_uploaded_instances",
        fake_store_uploaded_instances,
    )

    response = client.post(
        "/api/derived-results/stow",
        data={
            "studyInstanceUID": study_uid,
            "objectType": "seg",
            "storageClass": "SEG",
            "metadata": "{\"source\":\"pytest-stow\"}",
        },
        files={"files": ("seg.dcm", b"DICMSEG", "application/dicom")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["result"]["stored"] == [f"/dicom-web/studies/{study_uid}/instances/1.2.3.4"]

    workspace_response = client.get(f"/api/studies/{study_uid}/workspace")
    assert workspace_response.status_code == 200
    workspace = workspace_response.json()
    assert workspace["derivedResults"][0]["storageClass"] == "SEG"
    assert workspace["derivedResults"][0]["metadata"]["source"] == "pytest-stow"
    assert workspace["derivedResults"][0]["metadata"]["stowFileName"] == "seg.dcm"
