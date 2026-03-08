from fastapi.testclient import TestClient

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


def test_imaging_launch_returns_signature_and_viewer_url() -> None:
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
    assert body["viewerUrl"].startswith("http://localhost:3000/viewer")
    assert body["context"]["studyInstanceUID"] == payload["studyInstanceUID"]


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


def test_derived_results_are_stored_through_contract() -> None:
    payload = {
        "actorUserId": "demo-radiologist",
        "actorRole": "radiologist",
        "objects": [
            {
                "objectType": "seg",
                "studyInstanceUID": "1.2.840.113619.2.55.3.604688123.1234.1700000001.101",
                "storageClass": "SEG",
                "payloadRef": "derived/seg/example-01",
            }
        ],
    }

    response = client.post("/api/derived-results", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert body["result"]["stored"] == ["derived/seg/example-01"]
    assert body["traceId"].startswith("trace-")
