export type AppMode = "research" | "pilot" | "clinical";

const DEFAULT_BACKEND_URL = "http://localhost:8000";

function normalizeMode(value: string | undefined): AppMode {
  switch ((value ?? "").trim().toLowerCase()) {
    case "pilot":
      return "pilot";
    case "clinical":
      return "clinical";
    default:
      return "research";
  }
}

export function getAppMode(): AppMode {
  return normalizeMode(
    process.env.NOVION_APP_MODE ?? process.env.NEXT_PUBLIC_NOVION_APP_MODE,
  );
}

export function getPublicAppMode(): AppMode {
  return normalizeMode(process.env.NEXT_PUBLIC_NOVION_APP_MODE);
}

export function isResearchMode(): boolean {
  return getAppMode() === "research";
}

export function isExperimentalImagingEnabled(): boolean {
  return getAppMode() === "research";
}

export function getBackendBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL).replace(/\/$/, "");
}

export function getViewerBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_VIEWER_BASE_URL ?? "/viewer").replace(/\/$/, "");
}

export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Configure it only for research workflows.",
    );
  }
  return apiKey;
}

export function validateEnv() {
  if (getAppMode() === "research") {
    try {
      getGeminiApiKey();
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
      console.warn("Research-only Gemini features are unavailable.");
    }
  }
}
