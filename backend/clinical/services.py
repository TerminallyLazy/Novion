from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import timedelta
from uuid import uuid4

from fastapi import HTTPException

from .config import ClinicalPlatformSettings
from .contracts import (
    AIJobCreateRequest,
    AuditAction,
    AuditEvent,
    AuditStudyResponse,
    DerivedResultRequest,
    DerivedResultResponse,
    ImagingLaunchContext,
    ImagingLaunchRequest,
    ImagingLaunchResponse,
    ReportDraftRequest,
    ReportRecord,
    ReportStatus,
    ResourceType,
    WorklistResponse,
    WorkflowMode,
    utc_now,
)
from .dicomweb import DICOMwebAdapter
from .repositories import InMemoryClinicalRepository


class ClinicalPlatformService:
    def __init__(
        self,
        settings: ClinicalPlatformSettings,
        repository: InMemoryClinicalRepository,
        dicomweb_adapter: DICOMwebAdapter,
    ) -> None:
        self._settings = settings
        self._repository = repository
        self._dicomweb = dicomweb_adapter

    async def launch_imaging(
        self,
        request: ImagingLaunchRequest,
        source_ip: str,
    ) -> ImagingLaunchResponse:
        worklist_row = self._repository.get_worklist_row(request.study_instance_uid)
        prior_study_uids = request.prior_study_uids or (
            worklist_row.prior_study_uids if worklist_row else []
        )
        signed_at = utc_now()
        expires_at = signed_at + timedelta(seconds=self._settings.launch_ttl_seconds)

        context = ImagingLaunchContext(
            study_instance_uid=request.study_instance_uid,
            series_instance_uids=request.series_instance_uids,
            patient_ref=request.patient_ref,
            encounter_ref=request.encounter_ref or (worklist_row.encounter_ref if worklist_row else None),
            accession_number=request.accession_number or (worklist_row.accession_number if worklist_row else None),
            prior_study_uids=prior_study_uids,
            mode=request.mode,
            signed_at=signed_at.isoformat() + "Z",
            expires_at=expires_at.isoformat() + "Z",
            scopes=request.requested_scopes or self._default_scopes_for_role(request.actor_role),
        )
        signature = self._sign_context(context)
        viewer_url = (
            f"{self._settings.viewer_base_url}"
            f"?study={context.study_instance_uid}"
            f"&mode={context.mode}"
            f"&signature={signature}"
        )

        self._repository.add_audit_event(
            self._build_audit_event(
                actor_user_id=request.actor_user_id,
                actor_role=request.actor_role,
                action=AuditAction.OPEN_STUDY,
                patient_ref=request.patient_ref,
                study_instance_uid=request.study_instance_uid,
                resource_type=ResourceType.STUDY,
                resource_id=request.study_instance_uid,
                trace_id=request.trace_id,
                source_ip=source_ip,
            )
        )

        return ImagingLaunchResponse(
            context=context,
            signature=signature,
            viewer_url=viewer_url,
        )

    def get_worklist(
        self,
        user_id: str,
        role: str,
        source_ip: str,
        trace_id: str | None = None,
    ) -> WorklistResponse:
        rows = sorted(
            self._repository.list_worklist(),
            key=lambda row: (
                row.triage_score is None,
                -(row.triage_score or 0.0),
                row.last_updated_at,
            ),
        )
        self._repository.add_audit_event(
            self._build_audit_event(
                actor_user_id=user_id,
                actor_role=role,
                action=AuditAction.SEARCH_STUDY,
                resource_type=ResourceType.STUDY,
                resource_id="worklist",
                trace_id=trace_id,
                source_ip=source_ip,
            )
        )
        return WorklistResponse(role=role, user_id=user_id, rows=rows)

    def save_report(
        self,
        request: ReportDraftRequest,
        source_ip: str,
    ) -> ReportRecord:
        record = self._repository.save_report(request)
        audit_action = (
            AuditAction.FINALIZE_REPORT
            if request.status in {ReportStatus.FINAL, ReportStatus.AMENDED}
            else AuditAction.SAVE_REPORT
        )
        self._repository.add_audit_event(
            self._build_audit_event(
                actor_user_id=request.author_user_id,
                actor_role="radiologist",
                action=audit_action,
                study_instance_uid=request.study_instance_uid,
                resource_type=ResourceType.REPORT,
                resource_id=record.report_id,
                trace_id=request.trace_id,
                source_ip=source_ip,
            )
        )
        return record

    def submit_ai_job(
        self,
        request: AIJobCreateRequest,
        source_ip: str,
    ):
        if request.workflow_mode == WorkflowMode.ACTIVE and not self._settings.ai_allow_active:
            raise HTTPException(
                status_code=409,
                detail="Active triage mode is disabled until governance approval is recorded.",
            )

        record = self._repository.create_ai_job(request)
        self._repository.add_audit_event(
            self._build_audit_event(
                actor_user_id=request.requested_by,
                actor_role="ai_operator",
                action=AuditAction.RUN_AI,
                study_instance_uid=request.study_instance_uid,
                resource_type=ResourceType.AI_JOB,
                resource_id=record.job_id,
                trace_id=request.trace_id,
                source_ip=source_ip,
            )
        )
        return record

    async def store_derived_results(
        self,
        request: DerivedResultRequest,
        source_ip: str,
    ) -> DerivedResultResponse:
        result = await self._dicomweb.store_derived_objects(request.objects)
        trace_id = request.trace_id or f"trace-{uuid4()}"

        for stored_ref, object_ in zip(result.stored, request.objects):
            self._repository.add_audit_event(
                self._build_audit_event(
                    actor_user_id=request.actor_user_id,
                    actor_role=request.actor_role,
                    action=AuditAction.STORE_SEG,
                    study_instance_uid=object_.study_instance_uid,
                    resource_type=ResourceType.DERIVED_OBJECT,
                    resource_id=stored_ref,
                    trace_id=trace_id,
                    source_ip=source_ip,
                )
            )

        return DerivedResultResponse(result=result, trace_id=trace_id)

    def list_audit_events(self, study_uid: str) -> AuditStudyResponse:
        events = self._repository.list_audit_events(study_uid)
        return AuditStudyResponse(study_instance_uid=study_uid, events=events)

    def _default_scopes_for_role(self, actor_role: str) -> list[str]:
        scopes = ["study.read", "report.read"]
        if actor_role in {"radiologist", "attending", "admin"}:
            scopes.extend(["report.write", "derived.write"])
        return scopes

    def _sign_context(self, context: ImagingLaunchContext) -> str:
        payload = json.dumps(context.model_dump(by_alias=True), sort_keys=True).encode("utf-8")
        digest = hmac.new(
            self._settings.clinical_api_secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).digest()
        return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")

    def _build_audit_event(
        self,
        *,
        actor_user_id: str,
        actor_role: str,
        action: AuditAction,
        resource_type: ResourceType,
        resource_id: str,
        source_ip: str,
        trace_id: str | None = None,
        patient_ref: str | None = None,
        study_instance_uid: str | None = None,
    ) -> AuditEvent:
        return AuditEvent(
            event_id=f"audit-{uuid4()}",
            occurred_at=utc_now().isoformat() + "Z",
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action=action,
            patient_ref=patient_ref,
            study_instance_uid=study_instance_uid,
            resource_type=resource_type,
            resource_id=resource_id,
            trace_id=trace_id or f"trace-{uuid4()}",
            source_ip=source_ip,
            outcome="success",
        )
