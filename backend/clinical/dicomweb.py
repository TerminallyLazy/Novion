from __future__ import annotations

from typing import Protocol

import httpx

from .config import ClinicalPlatformSettings
from .contracts import (
    DerivedDicomObject,
    SeriesMetadata,
    StoreResult,
    StudyMetadata,
    StudyQuery,
    StudySearchPage,
)


class DICOMwebAdapter(Protocol):
    async def search_studies(self, query: StudyQuery) -> StudySearchPage: ...

    async def get_study_metadata(self, study_uid: str) -> StudyMetadata: ...

    async def get_series_metadata(self, study_uid: str, series_uid: str) -> SeriesMetadata: ...

    async def get_wado_rs_uri(self, study_uid: str, series_uid: str | None = None) -> str: ...

    async def store_derived_objects(self, objects: list[DerivedDicomObject]) -> StoreResult: ...


class OrthancDICOMwebAdapter:
    def __init__(self, settings: ClinicalPlatformSettings) -> None:
        self._settings = settings

    async def search_studies(self, query: StudyQuery) -> StudySearchPage:
        if not self._settings.orthanc_base_url:
            return StudySearchPage(items=[], total=0)

        params: dict[str, str | int] = {"limit": query.limit}
        if query.study_instance_uid:
            params["StudyInstanceUID"] = query.study_instance_uid
        if query.accession_number:
            params["AccessionNumber"] = query.accession_number
        if query.modality:
            params["ModalitiesInStudy"] = query.modality

        async with self._client() as client:
            response = await client.get("/studies", params=params)
            response.raise_for_status()
            payload = response.json()

        items = [
            StudyMetadata(
                study_instance_uid=item.get("0020000D", {}).get("Value", ["unknown"])[0],
                patient_ref=item.get("00100020", {}).get("Value", ["unknown"])[0],
                accession_number=item.get("00080050", {}).get("Value", [None])[0],
                modality=item.get("00080061", {}).get("Value", ["OT"])[0],
                description=item.get("00081030", {}).get("Value", ["Untitled study"])[0],
                study_date=item.get("00080020", {}).get("Value", [""])[0],
                archive_ref=self._settings.orthanc_base_url,
            )
            for item in payload
        ]
        return StudySearchPage(items=items, total=len(items))

    async def get_study_metadata(self, study_uid: str) -> StudyMetadata:
        wado_rs = await self.get_wado_rs_uri(study_uid)
        return StudyMetadata(
            study_instance_uid=study_uid,
            patient_ref="external",
            modality="OT",
            description="External DICOMweb study",
            study_date="",
            archive_ref=wado_rs,
        )

    async def get_series_metadata(self, study_uid: str, series_uid: str) -> SeriesMetadata:
        return SeriesMetadata(
            study_instance_uid=study_uid,
            series_instance_uid=series_uid,
            modality="OT",
            description="External DICOMweb series",
        )

    async def get_wado_rs_uri(self, study_uid: str, series_uid: str | None = None) -> str:
        base = self._settings.orthanc_base_url or "dicomweb://unconfigured"
        if series_uid:
            return f"{base}/studies/{study_uid}/series/{series_uid}"
        return f"{base}/studies/{study_uid}"

    async def store_derived_objects(self, objects: list[DerivedDicomObject]) -> StoreResult:
        # This foundation pass persists the contract and storage intent, not bulk DICOM blobs.
        stored = [
            object_.payload_ref
            or f"{object_.object_type}:{object_.study_instance_uid}:{index}"
            for index, object_ in enumerate(objects, start=1)
        ]
        warnings: list[str] = []
        if not self._settings.orthanc_base_url:
            warnings.append("Orthanc DICOMweb endpoint is not configured; results were staged logically only.")
        return StoreResult(stored=stored, warnings=warnings)

    def _client(self) -> httpx.AsyncClient:
        auth = None
        if self._settings.orthanc_username and self._settings.orthanc_password:
            auth = (self._settings.orthanc_username, self._settings.orthanc_password)

        return httpx.AsyncClient(
            base_url=self._settings.orthanc_base_url,
            auth=auth,
            timeout=10.0,
        )
