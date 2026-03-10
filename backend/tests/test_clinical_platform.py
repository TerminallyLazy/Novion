import asyncio
import os
import tempfile
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

import pytest
from fastapi.testclient import TestClient

TEST_DB_PATH = Path(tempfile.gettempdir()) / "radsysx-clinical-platform-test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["RADSYSX_CLINICAL_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ.setdefault("RADSYSX_SESSION_COOKIE_SECURE", "false")

try:
    import backend.server as server_module  # type: ignore
    from backend.server import app, clinical_service  # type: ignore
    from backend.clinical.config import ClinicalPlatformSettings  # type: ignore
    from backend.clinical.contracts import AuthMode, StoreResult  # type: ignore
except Exception:
    import server as server_module  # type: ignore
    from server import app, clinical_service  # type: ignore
    from clinical.config import ClinicalPlatformSettings  # type: ignore
    from clinical.contracts import AuthMode, StoreResult  # type: ignore


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


def test_research_mode_keeps_development_signing_secret_default(monkeypatch) -> None:
    monkeypatch.setenv("RADSYSX_APP_MODE", "research")
    monkeypatch.delenv("RADSYSX_CLINICAL_API_SECRET", raising=False)
    monkeypatch.delenv("RADSYSX_SESSION_SECRET", raising=False)
    monkeypatch.setenv("RADSYSX_SESSION_COOKIE_SECURE", "false")

    settings = ClinicalPlatformSettings()

    assert settings.clinical_api_secret == "development-only-secret-change-me"
    assert settings.session_secret == settings.clinical_api_secret
    assert settings.session_cookie_secure is False
    assert settings.session_cookie_samesite == "lax"


def test_clinical_mode_requires_explicit_signing_secret(monkeypatch) -> None:
    monkeypatch.setenv("RADSYSX_APP_MODE", "clinical")
    monkeypatch.setenv("RADSYSX_SESSION_COOKIE_SECURE", "true")
    monkeypatch.delenv("RADSYSX_CLINICAL_API_SECRET", raising=False)
    monkeypatch.delenv("RADSYSX_SESSION_SECRET", raising=False)

    with pytest.raises(RuntimeError, match="RADSYSX_CLINICAL_API_SECRET"):
        ClinicalPlatformSettings()


def test_clinical_mode_uses_explicit_signing_secret_for_sessions(monkeypatch) -> None:
    monkeypatch.setenv("RADSYSX_APP_MODE", "clinical")
    monkeypatch.setenv("RADSYSX_CLINICAL_API_SECRET", "pytest-clinical-signing-secret")
    monkeypatch.setenv("RADSYSX_SESSION_COOKIE_SECURE", "true")
    monkeypatch.delenv("RADSYSX_SESSION_SECRET", raising=False)

    settings = ClinicalPlatformSettings()

    assert settings.clinical_api_secret == "pytest-clinical-signing-secret"
    assert settings.session_secret == "pytest-clinical-signing-secret"
    assert settings.session_cookie_secure is True


def test_cookie_settings_validate_none_requires_secure(monkeypatch) -> None:
    monkeypatch.setenv("RADSYSX_APP_MODE", "clinical")
    monkeypatch.setenv("RADSYSX_CLINICAL_API_SECRET", "pytest-clinical-signing-secret")
    monkeypatch.setenv("RADSYSX_SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("RADSYSX_SESSION_COOKIE_SAMESITE", "none")

    with pytest.raises(RuntimeError, match="RADSYSX_SESSION_COOKIE_SAMESITE"):
        ClinicalPlatformSettings()


def test_local_login_rejects_unknown_persona(monkeypatch) -> None:
    monkeypatch.setattr(server_module.settings, "auth_mode", AuthMode.LOCAL)

    response = client.post("/api/auth/local-login", json={"username": "missing-user"})

    assert response.status_code == 404
    assert "unknown local clinical user" in response.json()["detail"].lower()


def test_local_login_is_disabled_when_auth_mode_is_not_local(monkeypatch) -> None:
    monkeypatch.setattr(server_module.settings, "auth_mode", AuthMode.OIDC)

    response = client.post("/api/auth/local-login", json={"username": "demo-radiologist"})

    assert response.status_code == 404
    assert "disabled" in response.json()["detail"].lower()


def test_session_cookie_policy_is_applied_to_login_response(monkeypatch) -> None:
    monkeypatch.setattr(server_module.settings, "auth_mode", AuthMode.LOCAL)
    monkeypatch.setattr(server_module.settings, "session_cookie_secure", True)
    monkeypatch.setattr(server_module.settings, "session_cookie_samesite", "none")
    monkeypatch.setattr(server_module.settings, "session_cookie_path", "/")
    monkeypatch.setattr(server_module.settings, "session_cookie_domain", None)
    monkeypatch.setattr(server_module.settings, "session_cookie_httponly", True)

    response = client.post("/api/auth/local-login", json={"username": "demo-radiologist"})

    assert response.status_code == 200
    set_cookie = response.headers["set-cookie"].lower()
    assert "secure" in set_cookie
    assert "samesite=none" in set_cookie


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
    assert body["viewerUrl"].startswith("http://localhost:3000/viewer/?launch=")
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
    assert runtime["stowRoot"] == ""
    assert runtime["featureFlags"]["directStow"] is False
    assert runtime["featureFlags"]["localFileImport"] is False


def test_imaging_launch_preserves_existing_viewer_base_url_query(monkeypatch) -> None:
    login()
    monkeypatch.setattr(
        server_module.settings,
        "viewer_base_url",
        "http://localhost:3000/viewer/?theme=clinical&showStudyList=false",
    )

    response = client.post(
        "/api/imaging/launch",
        json={"studyInstanceUID": "1.2.840.113619.2.55.3.604688123.1234.1700000001.101"},
    )
    assert response.status_code == 200

    viewer_url = response.json()["viewerUrl"]
    params = dict(parse_qsl(urlsplit(viewer_url).query, keep_blank_values=True))
    assert params["theme"] == "clinical"
    assert params["showStudyList"] == "false"
    assert params["launch"].startswith("launch-")


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
    captured_stream = None

    async def fake_store_uploaded_instances(request, files):
        nonlocal captured_stream
        assert request.study_instance_uid == study_uid
        assert len(files) == 1
        assert files[0].filename == "seg.dcm"
        captured_stream = files[0].stream
        assert captured_stream.read(4) == b"DICM"
        captured_stream.seek(0)
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
    assert captured_stream is not None
    assert captured_stream.closed is True

    workspace_response = client.get(f"/api/studies/{study_uid}/workspace")
    assert workspace_response.status_code == 200
    workspace = workspace_response.json()
    assert workspace["derivedResults"][0]["storageClass"] == "SEG"
    assert workspace["derivedResults"][0]["metadata"]["source"] == "pytest-stow"
    assert workspace["derivedResults"][0]["metadata"]["stowFileName"] == "seg.dcm"


def test_stow_endpoint_rejects_unsupported_content_type() -> None:
    login()

    response = client.post(
        "/api/derived-results/stow",
        data={
            "studyInstanceUID": "1.2.840.113619.2.55.3.604688123.1234.1700000001.101",
            "objectType": "seg",
            "storageClass": "SEG",
            "contentType": "text/plain",
            "metadata": "{\"source\":\"pytest-stow-invalid\"}",
        },
        files={"files": ("seg.dcm", b"DICMSEG", "application/dicom")},
    )

    assert response.status_code == 400
    assert "unsupported dicom stow contenttype" in response.json()["detail"].lower()


def test_initialize_fhir_server_awaits_async_initializer() -> None:
    class FakeFHIRServer:
        def __init__(self) -> None:
            self.initialized = False

        async def initialize(self) -> bool:
            self.initialized = True
            return True

    fake_server = FakeFHIRServer()
    assert asyncio.run(server_module._initialize_fhir_server(fake_server)) is True
    assert fake_server.initialized is True


def test_fhir_tool_dispatch_matches_server_api(monkeypatch) -> None:
    class FakeFHIRServer:
        available = True

        def __init__(self) -> None:
            self.calls: list[tuple[str, object, object]] = []

        async def list_resources(self, uri_pattern: str, mime_type: str | None) -> list[str]:
            self.calls.append(("list_resources", uri_pattern, mime_type))
            return ["Patient", "Observation"]

        async def call_tool(self, tool_name: str, params: dict[str, object]) -> dict[str, object]:
            self.calls.append(("call_tool", tool_name, params))
            return {"tool": tool_name, "params": params}

    fake_server = FakeFHIRServer()
    monkeypatch.setattr(server_module, "fhir_server", fake_server)

    list_response = client.post("/fhir/tool", json={"tool": "list_fhir_resources", "params": {}})
    assert list_response.status_code == 200
    assert list_response.json() == {"result": ["Patient", "Observation"]}

    demographics_response = client.post(
        "/fhir/tool",
        json={"tool": "get_patient_demographics", "params": {"patient_id": "example"}},
    )
    assert demographics_response.status_code == 200
    assert demographics_response.json() == {
        "result": {
            "tool": "get_patient_demographics",
            "params": {"patient_id": "example"},
        }
    }
    assert fake_server.calls == [
        ("list_resources", "", None),
        ("call_tool", "get_patient_demographics", {"patient_id": "example"}),
    ]


def test_seed_orthanc_logs_without_identifiers(monkeypatch, capsys) -> None:
    pytest.importorskip("pydicom")

    try:
        import backend.clinical.seed_orthanc as seed_orthanc_module  # type: ignore
    except Exception:
        import clinical.seed_orthanc as seed_orthanc_module  # type: ignore

    class _Response:
        def __init__(self, payload):
            self._payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self._payload

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            return None

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return None

        def get(self, path, params=None):
            return _Response([])

        def post(self, path, content=None, headers=None):
            return _Response({})

    monkeypatch.setattr(seed_orthanc_module.httpx, "Client", _FakeClient)

    seed_orthanc_module.main()

    output = capsys.readouterr().out
    assert "Seeded sample study 1 (CT)" in output
    assert "Seeded sample study 2 (MR)" in output
    for study in seed_orthanc_module.SEED_STUDIES:
        assert study.study_uid not in output
        assert study.patient_name not in output
        assert study.accession_number not in output
