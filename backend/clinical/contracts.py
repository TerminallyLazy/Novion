from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ClinicalModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        use_enum_values=True,
    )


class AppMode(str, Enum):
    RESEARCH = "research"
    PILOT = "pilot"
    CLINICAL = "clinical"


class ImagingLaunchMode(str, Enum):
    DIAGNOSTIC = "diagnostic"
    REVIEW = "review"
    QA = "qa"


class WorkflowMode(str, Enum):
    SHADOW = "shadow"
    ASSISTIVE = "assistive"
    ACTIVE = "active"


class AIJobKind(str, Enum):
    TRIAGE = "triage"
    SEGMENTATION = "segmentation"
    DRAFT_REPORT = "draft_report"
    EVIDENCE_RETRIEVAL = "evidence_retrieval"


class AIJobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    WITHDRAWN = "withdrawn"


class ReportStatus(str, Enum):
    NEW = "new"
    IN_REVIEW = "in_review"
    DRAFTED = "drafted"
    DRAFT = "draft"
    PENDING_SIGNOFF = "pending_signoff"
    FINAL = "final"
    AMENDED = "amended"


class ReviewerDecision(str, Enum):
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"


class AuditAction(str, Enum):
    SEARCH_STUDY = "SEARCH_STUDY"
    OPEN_STUDY = "OPEN_STUDY"
    VIEW_SERIES = "VIEW_SERIES"
    CREATE_MEASUREMENT = "CREATE_MEASUREMENT"
    STORE_SEG = "STORE_SEG"
    SAVE_REPORT = "SAVE_REPORT"
    FINALIZE_REPORT = "FINALIZE_REPORT"
    RUN_AI = "RUN_AI"
    ACCEPT_AI = "ACCEPT_AI"
    REJECT_AI = "REJECT_AI"


class ResourceType(str, Enum):
    STUDY = "study"
    SERIES = "series"
    REPORT = "report"
    AI_JOB = "ai_job"
    DERIVED_OBJECT = "derived_object"


class StudyQuery(ClinicalModel):
    patient_ref: str | None = None
    accession_number: str | None = None
    modality: str | None = None
    study_instance_uid: str | None = Field(default=None, alias="studyInstanceUID")
    limit: int = Field(default=25, ge=1, le=100)


class StudyMetadata(ClinicalModel):
    study_instance_uid: str = Field(alias="studyInstanceUID")
    patient_ref: str
    accession_number: str | None = None
    modality: str
    description: str
    study_date: str
    series_instance_uids: list[str] = Field(default_factory=list, alias="seriesInstanceUIDs")
    archive_ref: str


class SeriesMetadata(ClinicalModel):
    study_instance_uid: str = Field(alias="studyInstanceUID")
    series_instance_uid: str = Field(alias="seriesInstanceUID")
    modality: str
    description: str
    sop_instance_uids: list[str] = Field(default_factory=list, alias="sopInstanceUIDs")


class StudySearchPage(ClinicalModel):
    items: list[StudyMetadata]
    total: int


class DerivedDicomObject(ClinicalModel):
    object_type: str
    study_instance_uid: str = Field(alias="studyInstanceUID")
    series_instance_uid: str | None = Field(default=None, alias="seriesInstanceUID")
    sop_instance_uid: str | None = Field(default=None, alias="sopInstanceUID")
    storage_class: str
    content_type: str = "application/dicom"
    payload_ref: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class StoreResult(ClinicalModel):
    stored: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ImagingLaunchRequest(ClinicalModel):
    study_instance_uid: str = Field(alias="studyInstanceUID")
    series_instance_uids: list[str] = Field(default_factory=list, alias="seriesInstanceUIDs")
    patient_ref: str
    encounter_ref: str | None = None
    accession_number: str | None = None
    prior_study_uids: list[str] = Field(default_factory=list, alias="priorStudyUIDs")
    mode: ImagingLaunchMode = ImagingLaunchMode.DIAGNOSTIC
    requested_scopes: list[str] = Field(default_factory=list)
    actor_user_id: str = "system"
    actor_role: str = "radiologist"
    trace_id: str | None = None


class ImagingLaunchContext(ClinicalModel):
    study_instance_uid: str = Field(alias="studyInstanceUID")
    series_instance_uids: list[str] = Field(default_factory=list, alias="seriesInstanceUIDs")
    patient_ref: str
    encounter_ref: str | None = None
    accession_number: str | None = None
    prior_study_uids: list[str] = Field(default_factory=list, alias="priorStudyUIDs")
    mode: ImagingLaunchMode
    signed_at: str
    expires_at: str
    scopes: list[str] = Field(default_factory=list)


class ImagingLaunchResponse(ClinicalModel):
    context: ImagingLaunchContext
    signature: str
    launch_token: str = Field(alias="launchToken")
    viewer_url: str


class ImagingLaunchResolveResponse(ClinicalModel):
    launch_token: str = Field(alias="launchToken")
    context: ImagingLaunchContext
    signature: str
    study_wado_rs_uri: str = Field(alias="studyWadoRsUri")


class WorklistRow(ClinicalModel):
    study_instance_uid: str = Field(alias="studyInstanceUID")
    accession_number: str
    patient_ref: str
    modality: str
    description: str
    status: ReportStatus
    archive_ref: str
    encounter_ref: str | None = None
    prior_study_uids: list[str] = Field(default_factory=list, alias="priorStudyUIDs")
    triage_score: float | None = None
    last_updated_at: str


class WorklistResponse(ClinicalModel):
    role: str
    user_id: str
    rows: list[WorklistRow]


class ReportDraftRequest(ClinicalModel):
    report_id: str | None = None
    study_instance_uid: str = Field(alias="studyInstanceUID")
    diagnostic_report_id: str | None = None
    status: ReportStatus = ReportStatus.DRAFT
    author_user_id: str
    reviewer_user_id: str | None = None
    findings_summary: str
    impression: str
    derived_object_refs: list[str] = Field(default_factory=list)
    ai_contribution_refs: list[str] = Field(default_factory=list)
    trace_id: str | None = None


class ReportRecord(ClinicalModel):
    report_id: str
    study_instance_uid: str = Field(alias="studyInstanceUID")
    diagnostic_report_id: str | None = None
    status: ReportStatus
    author_user_id: str
    reviewer_user_id: str | None = None
    findings_summary: str
    impression: str
    derived_object_refs: list[str] = Field(default_factory=list)
    ai_contribution_refs: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str


class AIJobCreateRequest(ClinicalModel):
    kind: AIJobKind
    workflow_mode: WorkflowMode
    study_instance_uid: str = Field(alias="studyInstanceUID")
    series_instance_uid: str | None = Field(default=None, alias="seriesInstanceUID")
    model_id: str
    model_version: str
    input_hash: str
    requested_by: str
    output_refs: list[str] = Field(default_factory=list)
    trace_id: str | None = None


class AIJobRecord(ClinicalModel):
    job_id: str
    kind: AIJobKind
    workflow_mode: WorkflowMode
    study_instance_uid: str = Field(alias="studyInstanceUID")
    series_instance_uid: str | None = Field(default=None, alias="seriesInstanceUID")
    model_id: str
    model_version: str
    input_hash: str
    requested_by: str
    status: AIJobStatus
    output_refs: list[str] = Field(default_factory=list)
    reviewer_decision: ReviewerDecision | None = None
    created_at: str


class DerivedResultRecord(ClinicalModel):
    id: str
    study_instance_uid: str = Field(alias="studyInstanceUID")
    series_instance_uid: str | None = Field(default=None, alias="seriesInstanceUID")
    sop_instance_uid: str | None = Field(default=None, alias="sopInstanceUID")
    object_type: str
    storage_class: str
    content_type: str
    payload_ref: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class DerivedResultRequest(ClinicalModel):
    actor_user_id: str
    actor_role: str
    objects: list[DerivedDicomObject]
    trace_id: str | None = None


class DerivedResultResponse(ClinicalModel):
    result: StoreResult
    trace_id: str


class AuditEvent(ClinicalModel):
    event_id: str
    occurred_at: str
    actor_user_id: str
    actor_role: str
    action: AuditAction
    patient_ref: str | None = None
    study_instance_uid: str | None = Field(default=None, alias="studyInstanceUID")
    resource_type: ResourceType
    resource_id: str
    trace_id: str
    source_ip: str
    outcome: str


class AuditStudyResponse(ClinicalModel):
    study_instance_uid: str = Field(alias="studyInstanceUID")
    events: list[AuditEvent]


class StudyWorkspace(ClinicalModel):
    worklist_row: WorklistRow | None = Field(default=None, alias="worklistRow")
    reports: list[ReportRecord] = Field(default_factory=list)
    ai_jobs: list[AIJobRecord] = Field(default_factory=list, alias="aiJobs")
    derived_results: list[DerivedResultRecord] = Field(
        default_factory=list,
        alias="derivedResults",
    )
    audit: list[AuditEvent] = Field(default_factory=list)


class LaunchSessionRecord(ClinicalModel):
    launch_token: str = Field(alias="launchToken")
    context: ImagingLaunchContext
    signature: str
    actor_user_id: str
    actor_role: str
    expires_at: str
    created_at: str
    resolved_at: str | None = None


def utc_now() -> datetime:
    return datetime.utcnow()


def to_iso_z(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def parse_iso_z(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed
