// @ts-check

/** @typedef {import("@novion/clinical-web/contracts").ImagingLaunchResolveResponse} ImagingLaunchResolveResponse */
/** @typedef {import("@novion/clinical-web/contracts").StudyWorkspace} StudyWorkspace */
/** @typedef {import("@novion/clinical-web/contracts").ReportRecord} ReportRecord */

(function novionBridge() {
  /** @type {ImagingLaunchResolveResponse | undefined} */
  const resolved = window["__NOVION_LAUNCH__"];
  if (!resolved) {
    return;
  }

  const state = {
    workspace: /** @type {StudyWorkspace | null} */ (null),
    message: /** @type {string | null} */ (null),
    error: /** @type {string | null} */ (null),
    draftFindings: "",
    draftImpression: "",
  };

  const panel = document.createElement("aside");
  panel.id = "novion-sidecar";
  document.body.appendChild(panel);

  void refreshWorkspace();

  async function refreshWorkspace() {
    try {
      state.workspace = await requestJson(
        `/api/studies/${encodeURIComponent(resolved.context.studyInstanceUID)}/workspace`,
      );
      hydrateDrafts();
      state.error = null;
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Unable to load workspace.";
    }
    render();
    const loader = document.getElementById("novion-loader");
    if (loader) {
      loader.remove();
    }
  }

  function hydrateDrafts() {
    const latest = latestReport();
    if (!latest) {
      return;
    }
    state.draftFindings = latest.findingsSummary ?? "";
    state.draftImpression = latest.impression ?? "";
  }

  function latestReport() {
    return state.workspace?.reports?.[0] ?? null;
  }

  function render() {
    const report = latestReport();
    panel.innerHTML = `
      <div class="novion-panel-shell">
        <div class="novion-panel-header">
          <div>
            <div class="novion-panel-kicker">Novion Clinical Workspace</div>
            <div class="novion-panel-title">${escapeHtml(resolved.context.studyInstanceUID)}</div>
            <div class="novion-panel-subtitle">${escapeHtml(
              resolved.context.accessionNumber ?? "No accession",
            )} · ${escapeHtml(resolved.viewerRuntime.viewerKind)}</div>
          </div>
          <button class="novion-ghost-button" data-action="refresh" type="button">Refresh</button>
        </div>

        ${
          state.message
            ? `<div class="novion-status novion-status-success">${escapeHtml(state.message)}</div>`
            : ""
        }
        ${
          state.error
            ? `<div class="novion-status novion-status-error">${escapeHtml(state.error)}</div>`
            : ""
        }

        <section class="novion-section">
          <div class="novion-section-title">Report</div>
          <label class="novion-field">
            <span>Findings</span>
            <textarea id="novion-findings" rows="5">${escapeHtml(state.draftFindings)}</textarea>
          </label>
          <label class="novion-field">
            <span>Impression</span>
            <textarea id="novion-impression" rows="4">${escapeHtml(state.draftImpression)}</textarea>
          </label>
          <div class="novion-row">
            <button class="novion-primary-button" data-action="save-draft" type="button">Save draft</button>
            <button class="novion-ghost-button" data-action="finalize-report" type="button">Finalize</button>
          </div>
          <div class="novion-caption">Latest status: ${escapeHtml(report?.status ?? "No report yet")}</div>
        </section>

        <section class="novion-section">
          <div class="novion-section-title">Assistive Actions</div>
          <div class="novion-row novion-row-stack">
            <button class="novion-ghost-button" data-action="queue-ai" type="button">Queue shadow triage</button>
          </div>
          <div class="novion-upload-block">
            <label class="novion-upload-label">
              <span>Upload DICOM SR</span>
              <input id="novion-upload-sr" type="file" accept=".dcm,application/dicom" />
            </label>
            <button class="novion-ghost-button" data-action="upload-sr" type="button">STOW SR</button>
          </div>
          <div class="novion-upload-block">
            <label class="novion-upload-label">
              <span>Upload DICOM SEG</span>
              <input id="novion-upload-seg" type="file" accept=".dcm,application/dicom" />
            </label>
            <button class="novion-ghost-button" data-action="upload-seg" type="button">STOW SEG</button>
          </div>
        </section>

        <section class="novion-section">
          <div class="novion-section-title">Persisted State</div>
          <div class="novion-list">
            ${renderItems(state.workspace?.reports?.map((item) => ({
              title: `${item.status} · ${item.reportId}`,
              body: item.updatedAt,
            })), "No reports persisted.")}
          </div>
        </section>

        <section class="novion-section">
          <div class="novion-section-title">AI Jobs</div>
          <div class="novion-list">
            ${renderItems(state.workspace?.aiJobs?.map((item) => ({
              title: `${item.kind} · ${item.workflowMode}`,
              body: `${item.jobId} · ${item.status}`,
            })), "No governed AI jobs queued.")}
          </div>
        </section>

        <section class="novion-section">
          <div class="novion-section-title">Derived Results</div>
          <div class="novion-list">
            ${renderItems(state.workspace?.derivedResults?.map((item) => ({
              title: `${item.objectType} · ${item.storageClass}`,
              body: item.payloadRef ?? item.id,
            })), "No derived DICOM objects persisted.")}
          </div>
        </section>

        <section class="novion-section">
          <div class="novion-section-title">Audit</div>
          <div class="novion-list">
            ${renderItems(state.workspace?.audit?.slice(0, 6).map((item) => ({
              title: item.action,
              body: `${item.actorUserId} · ${item.occurredAt}`,
            })), "No audit events recorded yet.")}
          </div>
        </section>
      </div>
    `;

    panel.querySelector("[data-action='refresh']")?.addEventListener("click", () => {
      state.message = null;
      void refreshWorkspace();
    });
    panel.querySelector("[data-action='save-draft']")?.addEventListener("click", () => {
      void saveReport("draft");
    });
    panel.querySelector("[data-action='finalize-report']")?.addEventListener("click", () => {
      void saveReport("final");
    });
    panel.querySelector("[data-action='queue-ai']")?.addEventListener("click", () => {
      void queueShadowTriage();
    });
    panel.querySelector("[data-action='upload-sr']")?.addEventListener("click", () => {
      void uploadDerived("sr", "SR", "novion-upload-sr");
    });
    panel.querySelector("[data-action='upload-seg']")?.addEventListener("click", () => {
      void uploadDerived("seg", "SEG", "novion-upload-seg");
    });
  }

  async function saveReport(status) {
    state.message = null;
    state.error = null;
    const findings = /** @type {HTMLTextAreaElement | null} */ (
      panel.querySelector("#novion-findings")
    );
    const impression = /** @type {HTMLTextAreaElement | null} */ (
      panel.querySelector("#novion-impression")
    );
    state.draftFindings = findings?.value ?? "";
    state.draftImpression = impression?.value ?? "";

    try {
      const report = latestReport();
      await requestJson("/api/reports/draft", {
        method: "POST",
        body: JSON.stringify({
          reportId: report?.reportId,
          studyInstanceUID: resolved.context.studyInstanceUID,
          status,
          findingsSummary: state.draftFindings,
          impression: state.draftImpression,
        }),
      });
      state.message =
        status === "final"
          ? "Report finalized through the governed backend contract."
          : "Draft report saved.";
      await refreshWorkspace();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Unable to save report.";
      render();
    }
  }

  async function queueShadowTriage() {
    state.message = null;
    state.error = null;
    try {
      await requestJson("/api/ai/jobs", {
        method: "POST",
        body: JSON.stringify({
          kind: "triage",
          workflowMode: "shadow",
          studyInstanceUID: resolved.context.studyInstanceUID,
          modelId: "triage-model",
          modelVersion: "1.0.0",
          inputHash: `study:${resolved.context.studyInstanceUID}:shadow`,
        }),
      });
      state.message = "Shadow triage queued.";
      await refreshWorkspace();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Unable to queue AI job.";
      render();
    }
  }

  async function uploadDerived(objectType, storageClass, inputId) {
    state.message = null;
    state.error = null;
    const input = /** @type {HTMLInputElement | null} */ (panel.querySelector(`#${inputId}`));
    const file = input?.files?.[0];
    if (!file) {
      state.error = `Select a ${storageClass} DICOM file first.`;
      render();
      return;
    }

    const form = new FormData();
    form.set("studyInstanceUID", resolved.context.studyInstanceUID);
    form.set("objectType", objectType);
    form.set("storageClass", storageClass);
    form.set("metadata", JSON.stringify({ source: "novion-ohif-sidecar" }));
    form.append("files", file, file.name);

    try {
      const response = await fetch("/api/derived-results/stow", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error((await response.text()) || "STOW request failed.");
      }
      state.message = `${storageClass} persisted through backend STOW.`;
      await refreshWorkspace();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Unable to persist derived DICOM.";
      render();
    }
  }

  async function requestJson(path, init) {
    const response = await fetch(path, {
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

    return response.json();
  }

  function renderItems(items, empty) {
    if (!items || items.length === 0) {
      return `<div class="novion-empty">${escapeHtml(empty)}</div>`;
    }
    return items
      .map(
        (item) => `
          <div class="novion-item">
            <div class="novion-item-title">${escapeHtml(item.title)}</div>
            <div class="novion-item-body">${escapeHtml(item.body)}</div>
          </div>
        `,
      )
      .join("");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
