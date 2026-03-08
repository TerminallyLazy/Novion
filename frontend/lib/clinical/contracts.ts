import type { AppMode } from "@/lib/env";

export type ImagingLaunchMode = "diagnostic" | "review" | "qa";
export type WorkflowMode = "shadow" | "assistive" | "active";
export type AIJobKind =
  | "triage"
  | "segmentation"
  | "draft_report"
  | "evidence_retrieval";
export type AIJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "withdrawn";
export type ReportStatus =
  | "new"
  | "in_review"
  | "drafted"
  | "draft"
  | "pending_signoff"
  | "final"
  | "amended";

export type ImagingLaunchContext = {
  studyInstanceUID: string;
  seriesInstanceUIDs?: string[];
  patientRef: string;
  encounterRef?: string;
  accessionNumber?: string;
  priorStudyUIDs: string[];
  mode: ImagingLaunchMode;
  signedAt: string;
  expiresAt: string;
  scopes: string[];
};

export type ImagingLaunchRequest = {
  studyInstanceUID: string;
  seriesInstanceUIDs?: string[];
  patientRef: string;
  encounterRef?: string;
  accessionNumber?: string;
  priorStudyUIDs?: string[];
  mode?: ImagingLaunchMode;
  requestedScopes?: string[];
  actorUserId?: string;
  actorRole?: string;
  traceId?: string;
};

export type ImagingLaunchResponse = {
  context: ImagingLaunchContext;
  signature: string;
  launchToken: string;
  viewerUrl: string;
};

export type ImagingLaunchResolveResponse = {
  launchToken: string;
  context: ImagingLaunchContext;
  signature: string;
  studyWadoRsUri: string;
};

export type WorklistRow = {
  studyInstanceUID: string;
  accessionNumber: string;
  patientRef: string;
  modality: string;
  description: string;
  status: ReportStatus;
  archiveRef: string;
  encounterRef?: string;
  priorStudyUIDs: string[];
  triageScore?: number | null;
  lastUpdatedAt: string;
};

export type WorklistResponse = {
  role: string;
  userId: string;
  rows: WorklistRow[];
};

export type ReportRecord = {
  reportId: string;
  studyInstanceUID: string;
  diagnosticReportId?: string;
  status: ReportStatus;
  authorUserId: string;
  reviewerUserId?: string;
  findingsSummary: string;
  impression: string;
  derivedObjectRefs: string[];
  aiContributionRefs: string[];
  createdAt: string;
  updatedAt: string;
};

export type ReportDraftRequest = {
  reportId?: string;
  studyInstanceUID: string;
  diagnosticReportId?: string;
  status?: ReportStatus;
  authorUserId: string;
  reviewerUserId?: string;
  findingsSummary: string;
  impression: string;
  derivedObjectRefs?: string[];
  aiContributionRefs?: string[];
  traceId?: string;
};

export type AIJobRecord = {
  jobId: string;
  kind: AIJobKind;
  workflowMode: WorkflowMode;
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  modelId: string;
  modelVersion: string;
  inputHash: string;
  requestedBy: string;
  status: AIJobStatus;
  outputRefs: string[];
  reviewerDecision?: "accepted" | "rejected" | "superseded";
  createdAt: string;
};

export type DerivedResultRecord = {
  id: string;
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  objectType: string;
  storageClass: string;
  contentType: string;
  payloadRef?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AIJobRequest = {
  kind: AIJobKind;
  workflowMode: WorkflowMode;
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  modelId: string;
  modelVersion: string;
  inputHash: string;
  requestedBy: string;
  outputRefs?: string[];
  traceId?: string;
};

export type DerivedDicomObject = {
  objectType: string;
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  storageClass: string;
  contentType?: string;
  payloadRef?: string;
  metadata?: Record<string, unknown>;
};

export type DerivedResultRequest = {
  actorUserId: string;
  actorRole: string;
  objects: DerivedDicomObject[];
  traceId?: string;
};

export type AuditEvent = {
  eventId: string;
  occurredAt: string;
  actorUserId: string;
  actorRole: string;
  action:
    | "SEARCH_STUDY"
    | "OPEN_STUDY"
    | "VIEW_SERIES"
    | "CREATE_MEASUREMENT"
    | "STORE_SEG"
    | "SAVE_REPORT"
    | "FINALIZE_REPORT"
    | "RUN_AI"
    | "ACCEPT_AI"
    | "REJECT_AI";
  patientRef?: string;
  studyInstanceUID?: string;
  resourceType: "study" | "series" | "report" | "ai_job" | "derived_object";
  resourceId: string;
  traceId: string;
  sourceIp: string;
  outcome: "success" | "failure";
};

export type AuditStudyResponse = {
  studyInstanceUID: string;
  events: AuditEvent[];
};

export type StudyWorkspace = {
  worklistRow: WorklistRow | null;
  reports: ReportRecord[];
  aiJobs: AIJobRecord[];
  derivedResults: DerivedResultRecord[];
  audit: AuditEvent[];
};

export type ClinicalPlatformConfig = {
  mode: AppMode;
  experimentalRoutesEnabled: boolean;
  viewerBaseUrl: string;
  aiDefaultWorkflowMode: WorkflowMode;
  aiAllowActive: boolean;
};
