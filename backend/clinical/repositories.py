from __future__ import annotations

from threading import Lock
from uuid import uuid4

from .contracts import (
    AIJobCreateRequest,
    AIJobRecord,
    AIJobStatus,
    AuditEvent,
    ReportDraftRequest,
    ReportRecord,
    ReportStatus,
    WorklistRow,
    utc_now,
)


class InMemoryClinicalRepository:
    def __init__(self) -> None:
        now = utc_now().isoformat() + "Z"
        self._lock = Lock()
        self._worklist: dict[str, WorklistRow] = {
            "1.2.840.113619.2.55.3.604688123.1234.1700000001.101": WorklistRow(
                study_instance_uid="1.2.840.113619.2.55.3.604688123.1234.1700000001.101",
                accession_number="ACC-CT-24001",
                patient_ref="Patient/example-ct-01",
                modality="CT",
                description="Chest CT with contrast",
                status=ReportStatus.NEW,
                archive_ref="orthanc://default",
                encounter_ref="Encounter/example-enc-01",
                prior_study_uids=["1.2.840.113619.2.55.3.604688123.1234.1699999000.100"],
                triage_score=0.23,
                last_updated_at=now,
            ),
            "1.2.840.113619.2.55.3.604688123.1234.1700000002.201": WorklistRow(
                study_instance_uid="1.2.840.113619.2.55.3.604688123.1234.1700000002.201",
                accession_number="ACC-MR-24017",
                patient_ref="Patient/example-mr-02",
                modality="MR",
                description="Brain MRI follow-up",
                status=ReportStatus.IN_REVIEW,
                archive_ref="orthanc://default",
                encounter_ref="Encounter/example-enc-02",
                prior_study_uids=["1.2.840.113619.2.55.3.604688123.1234.1699997000.150"],
                triage_score=0.81,
                last_updated_at=now,
            ),
        }
        self._reports: dict[str, ReportRecord] = {}
        self._jobs: dict[str, AIJobRecord] = {}
        self._audit: list[AuditEvent] = []

    def list_worklist(self) -> list[WorklistRow]:
        with self._lock:
            return list(self._worklist.values())

    def get_worklist_row(self, study_uid: str) -> WorklistRow | None:
        with self._lock:
            return self._worklist.get(study_uid)

    def save_report(self, request: ReportDraftRequest) -> ReportRecord:
        with self._lock:
            existing = self._reports.get(request.report_id or "")
            created_at = existing.created_at if existing else utc_now().isoformat() + "Z"
            report_id = request.report_id or f"report-{uuid4()}"
            record = ReportRecord(
                report_id=report_id,
                study_instance_uid=request.study_instance_uid,
                diagnostic_report_id=request.diagnostic_report_id,
                status=request.status,
                author_user_id=request.author_user_id,
                reviewer_user_id=request.reviewer_user_id,
                findings_summary=request.findings_summary,
                impression=request.impression,
                derived_object_refs=request.derived_object_refs,
                ai_contribution_refs=request.ai_contribution_refs,
                created_at=created_at,
                updated_at=utc_now().isoformat() + "Z",
            )
            self._reports[record.report_id] = record

            worklist = self._worklist.get(request.study_instance_uid)
            if worklist:
                self._worklist[request.study_instance_uid] = worklist.model_copy(
                    update={
                        "status": (
                            ReportStatus.PENDING_SIGNOFF
                            if request.status == ReportStatus.PENDING_SIGNOFF
                            else ReportStatus.DRAFTED
                        ),
                        "last_updated_at": record.updated_at,
                    }
                )

            return record

    def create_ai_job(self, request: AIJobCreateRequest) -> AIJobRecord:
        with self._lock:
            record = AIJobRecord(
                job_id=f"job-{uuid4()}",
                kind=request.kind,
                workflow_mode=request.workflow_mode,
                study_instance_uid=request.study_instance_uid,
                series_instance_uid=request.series_instance_uid,
                model_id=request.model_id,
                model_version=request.model_version,
                input_hash=request.input_hash,
                requested_by=request.requested_by,
                status=AIJobStatus.QUEUED,
                output_refs=request.output_refs,
                created_at=utc_now().isoformat() + "Z",
            )
            self._jobs[record.job_id] = record
            return record

    def add_audit_event(self, event: AuditEvent) -> None:
        with self._lock:
            self._audit.append(event)

    def list_audit_events(self, study_uid: str) -> list[AuditEvent]:
        with self._lock:
            return [event for event in self._audit if event.study_instance_uid == study_uid]
