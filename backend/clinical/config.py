from __future__ import annotations

import os
from functools import lru_cache
from typing import cast

from .contracts import AppMode, WorkflowMode
from .db import default_database_url


class ClinicalPlatformSettings:
    def __init__(self) -> None:
        self.app_mode = self._read_mode("NOVION_APP_MODE", AppMode.RESEARCH)
        self.allowed_origins = self._read_csv(
            "NOVION_ALLOWED_ORIGINS",
            ["http://localhost:3000", "http://localhost:8000"],
        )
        self.viewer_base_url = os.getenv(
            "NOVION_VIEWER_BASE_URL",
            "http://localhost:3000/viewer",
        )
        self.clinical_api_secret = os.getenv(
            "NOVION_CLINICAL_API_SECRET",
            "development-only-secret-change-me",
        )
        self.clinical_database_url = os.getenv(
            "NOVION_CLINICAL_DATABASE_URL",
            default_database_url(),
        )
        self.launch_ttl_seconds = int(os.getenv("NOVION_LAUNCH_TTL_SECONDS", "900"))
        self.orthanc_base_url = os.getenv("ORTHANC_DICOMWEB_URL", "").rstrip("/")
        self.orthanc_username = os.getenv("ORTHANC_USERNAME")
        self.orthanc_password = os.getenv("ORTHANC_PASSWORD")
        self.ai_default_workflow_mode = self._read_workflow_mode(
            "NOVION_AI_DEFAULT_WORKFLOW_MODE",
            WorkflowMode.SHADOW,
        )
        self.ai_allow_active = self._read_bool("NOVION_AI_ALLOW_ACTIVE", False)

    @property
    def allow_wildcard_cors(self) -> bool:
        return self.app_mode == AppMode.RESEARCH

    @property
    def experimental_routes_enabled(self) -> bool:
        return self.app_mode == AppMode.RESEARCH

    @staticmethod
    def _read_csv(name: str, default: list[str]) -> list[str]:
        raw = os.getenv(name)
        if not raw:
            return default
        return [item.strip() for item in raw.split(",") if item.strip()]

    @staticmethod
    def _read_bool(name: str, default: bool) -> bool:
        raw = os.getenv(name)
        if raw is None:
            return default
        return raw.strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _read_mode(name: str, default: AppMode) -> AppMode:
        raw = os.getenv(name, default.value).strip().lower()
        try:
            return AppMode(raw)
        except ValueError:
            return default

    @staticmethod
    def _read_workflow_mode(name: str, default: WorkflowMode) -> WorkflowMode:
        raw = os.getenv(name, default.value).strip().lower()
        try:
            return WorkflowMode(raw)
        except ValueError:
            return default


@lru_cache(maxsize=1)
def get_settings() -> ClinicalPlatformSettings:
    return cast(ClinicalPlatformSettings, ClinicalPlatformSettings())
