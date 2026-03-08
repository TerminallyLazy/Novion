import { getBackendBaseUrl } from "@/lib/env";
import type {
  AIJobRecord,
  AIJobRequest,
  AuditStudyResponse,
  ClinicalPlatformConfig,
  DerivedResultRequest,
  ImagingLaunchRequest,
  ImagingLaunchResolveResponse,
  ImagingLaunchResponse,
  ReportDraftRequest,
  ReportRecord,
  StudyWorkspace,
  WorklistResponse,
} from "@/lib/clinical/contracts";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const clinicalApi = {
  getPlatformConfig(): Promise<ClinicalPlatformConfig> {
    return requestJson("/api/platform/config");
  },

  getWorklist(role = "radiologist", userId = "demo-radiologist"): Promise<WorklistResponse> {
    const params = new URLSearchParams({ role, user_id: userId });
    return requestJson(`/api/worklist?${params.toString()}`);
  },

  launchImaging(payload: ImagingLaunchRequest): Promise<ImagingLaunchResponse> {
    return requestJson("/api/imaging/launch", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  resolveLaunch(launchToken: string): Promise<ImagingLaunchResolveResponse> {
    const params = new URLSearchParams({ launch: launchToken });
    return requestJson(`/api/imaging/launch/resolve?${params.toString()}`);
  },

  saveDraft(payload: ReportDraftRequest): Promise<ReportRecord> {
    return requestJson("/api/reports/draft", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  createAIJob(payload: AIJobRequest): Promise<AIJobRecord> {
    return requestJson("/api/ai/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  storeDerivedResults(payload: DerivedResultRequest) {
    return requestJson("/api/derived-results", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getAuditForStudy(studyInstanceUID: string): Promise<AuditStudyResponse> {
    return requestJson(`/api/audit/studies/${encodeURIComponent(studyInstanceUID)}`);
  },

  getStudyWorkspace(
    studyInstanceUID: string,
    role = "radiologist",
    userId = "demo-radiologist",
  ): Promise<StudyWorkspace> {
    const params = new URLSearchParams({ role, user_id: userId });
    return requestJson(
      `/api/studies/${encodeURIComponent(studyInstanceUID)}/workspace?${params.toString()}`,
    );
  },
};
