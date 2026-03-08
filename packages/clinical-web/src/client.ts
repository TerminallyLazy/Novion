import { getBackendBaseUrl } from "./env";
import type {
  AIJobRecord,
  AIJobRequest,
  AuditStudyResponse,
  ClinicalPlatformConfig,
  DerivedResultRequest,
  DerivedResultResponse,
  DerivedResultStowRequest,
  ImagingLaunchRequest,
  ImagingLaunchResolveResponse,
  ImagingLaunchResponse,
  LocalLoginRequest,
  LocalLoginResponse,
  ReportDraftRequest,
  ReportRecord,
  SessionResponse,
  StudyWorkspace,
  WorklistResponse,
} from "./contracts";

type ClinicalApiOptions = {
  baseUrl?: string;
};

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options?: ClinicalApiOptions,
): Promise<T> {
  const response = await fetch(`${options?.baseUrl ?? getBackendBaseUrl()}${path}`, {
    credentials: "include",
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

async function requestMultipart<T>(
  path: string,
  form: FormData,
  options?: ClinicalApiOptions,
): Promise<T> {
  const response = await fetch(`${options?.baseUrl ?? getBackendBaseUrl()}${path}`, {
    method: "POST",
    body: form,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function createClinicalApi(options?: ClinicalApiOptions) {
  return {
    getSession(): Promise<SessionResponse> {
      return requestJson("/api/auth/session", undefined, options);
    },

    localLogin(payload: LocalLoginRequest): Promise<LocalLoginResponse> {
      return requestJson("/api/auth/local-login", {
        method: "POST",
        body: JSON.stringify(payload),
      }, options);
    },

    logout(): Promise<SessionResponse> {
      return requestJson("/api/auth/logout", { method: "POST" }, options);
    },

    getPlatformConfig(): Promise<ClinicalPlatformConfig> {
      return requestJson("/api/platform/config", undefined, options);
    },

    getWorklist(): Promise<WorklistResponse> {
      return requestJson("/api/worklist", undefined, options);
    },

    launchImaging(payload: ImagingLaunchRequest): Promise<ImagingLaunchResponse> {
      return requestJson("/api/imaging/launch", {
        method: "POST",
        body: JSON.stringify(payload),
      }, options);
    },

    resolveLaunch(launchToken: string): Promise<ImagingLaunchResolveResponse> {
      const params = new URLSearchParams({ launch: launchToken });
      return requestJson(`/api/imaging/launch/resolve?${params.toString()}`, undefined, options);
    },

    saveDraft(payload: ReportDraftRequest): Promise<ReportRecord> {
      return requestJson("/api/reports/draft", {
        method: "POST",
        body: JSON.stringify(payload),
      }, options);
    },

    createAIJob(payload: AIJobRequest): Promise<AIJobRecord> {
      return requestJson("/api/ai/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      }, options);
    },

    storeDerivedResults(payload: DerivedResultRequest): Promise<DerivedResultResponse> {
      return requestJson("/api/derived-results", {
        method: "POST",
        body: JSON.stringify(payload),
      }, options);
    },

    storeDerivedResultsStow(
      payload: DerivedResultStowRequest,
      files: File[],
    ): Promise<DerivedResultResponse> {
      const form = new FormData();
      form.set("studyInstanceUID", payload.studyInstanceUID);
      form.set("objectType", payload.objectType);
      form.set("storageClass", payload.storageClass);
      if (payload.seriesInstanceUID) {
        form.set("seriesInstanceUID", payload.seriesInstanceUID);
      }
      if (payload.sopInstanceUID) {
        form.set("sopInstanceUID", payload.sopInstanceUID);
      }
      form.set("contentType", payload.contentType ?? "application/dicom");
      form.set("metadata", JSON.stringify(payload.metadata ?? {}));
      if (payload.traceId) {
        form.set("traceId", payload.traceId);
      }
      for (const file of files) {
        form.append("files", file, file.name);
      }
      return requestMultipart("/api/derived-results/stow", form, options);
    },

    getAuditForStudy(studyInstanceUID: string): Promise<AuditStudyResponse> {
      return requestJson(`/api/audit/studies/${encodeURIComponent(studyInstanceUID)}`, undefined, options);
    },

    getStudyWorkspace(studyInstanceUID: string): Promise<StudyWorkspace> {
      return requestJson(`/api/studies/${encodeURIComponent(studyInstanceUID)}/workspace`, undefined, options);
    },
  };
}

export const clinicalApi = createClinicalApi();
