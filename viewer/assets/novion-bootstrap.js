// @ts-check

/** @typedef {import("@novion/clinical-web/contracts").ImagingLaunchResolveResponse} ImagingLaunchResolveResponse */
/** @typedef {import("@novion/clinical-web/contracts").SessionResponse} SessionResponse */

(function novionBootstrap() {
  const loader = ensureLoader();
  const params = new URLSearchParams(window.location.search);
  const launchToken = params.get("launch");

  if (!launchToken) {
    fail("The OHIF viewer requires an opaque launch token.");
    return;
  }

  /** @type {SessionResponse} */
  const session = syncJson("/api/auth/session");
  if (!session.authenticated || !session.session) {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.replace(`/login?next=${next}`);
    return;
  }

  /** @type {ImagingLaunchResolveResponse} */
  const resolved = syncJson(`/api/imaging/launch/resolve?launch=${encodeURIComponent(launchToken)}`);
  window["__NOVION_LAUNCH__"] = resolved;

  params.set("StudyInstanceUIDs", resolved.context.studyInstanceUID);
  if (resolved.context.seriesInstanceUIDs?.length) {
    params.set("SeriesInstanceUIDs", resolved.context.seriesInstanceUIDs.join(","));
  }
  history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  loader.dataset.state = "ready";
  loader.querySelector("[data-role='title']").textContent = "Launching OHIF clinical viewer";
  loader.querySelector("[data-role='body']").textContent =
    `${resolved.context.studyInstanceUID} · ${resolved.context.accessionNumber ?? "no accession"}`;

  function syncJson(path) {
    const request = new XMLHttpRequest();
    request.open("GET", path, false);
    request.withCredentials = true;
    request.send(null);

    if (request.status < 200 || request.status >= 300) {
      const detail = request.responseText || `Request failed with ${request.status}`;
      fail(detail);
      throw new Error(detail);
    }

    return JSON.parse(request.responseText);
  }

  function ensureLoader() {
    const existing = document.getElementById("novion-loader");
    if (existing) {
      return existing;
    }

    const element = document.createElement("div");
    element.id = "novion-loader";
    element.innerHTML = `
      <div class="novion-loader-card">
        <div class="novion-loader-kicker">Novion Clinical Viewer</div>
        <div class="novion-loader-title" data-role="title">Resolving launch token</div>
        <div class="novion-loader-body" data-role="body">Preparing the OHIF runtime...</div>
      </div>
    `;
    document.body.appendChild(element);
    return element;
  }

  function fail(message) {
    loader.dataset.state = "error";
    loader.querySelector("[data-role='title']").textContent = "Viewer bootstrap failed";
    loader.querySelector("[data-role='body']").textContent = message;
  }
})();
