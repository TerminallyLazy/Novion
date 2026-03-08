// @ts-check

/** @typedef {import("@radsysx/clinical-web/contracts").ImagingLaunchResolveResponse} ImagingLaunchResolveResponse */
/** @typedef {import("@radsysx/clinical-web/contracts").SessionResponse} SessionResponse */

(function radsysxBootstrap() {
  const loader = ensureLoader();
  const params = new URLSearchParams(window.location.search);
  const launchToken = params.get("launch");

  if (!launchToken && !window.__RADSYSX_LAUNCH__) {
    fail("The OHIF viewer requires a governed launch session.");
    return;
  }

  try {
    /** @type {SessionResponse} */
    const session = syncJson("/api/auth/session");
    if (!session.authenticated || !session.session) {
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.replace(`/login?next=${next}`);
      return;
    }

    /** @type {ImagingLaunchResolveResponse} */
    const resolved =
      window.__RADSYSX_LAUNCH__ ??
      syncJson(`/api/imaging/launch/resolve?launch=${encodeURIComponent(launchToken ?? "")}`);
    window.__RADSYSX_LAUNCH__ = resolved;
    window.__RADSYSX_CLEAN_VIEWER_URL__ = function cleanViewerUrl() {
      history.replaceState(null, "", window.location.pathname);
    };

    params.delete("launch");
    params.set("StudyInstanceUIDs", resolved.context.studyInstanceUID);
    if (resolved.context.seriesInstanceUIDs?.length) {
      params.set("SeriesInstanceUIDs", resolved.context.seriesInstanceUIDs.join(","));
    } else {
      params.delete("SeriesInstanceUIDs");
    }

    history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    loader.dataset.state = "ready";
    loader.querySelector("[data-role='title']").textContent = "Governed launch resolved";
    loader.querySelector("[data-role='body']").textContent =
      "Preparing the OHIF runtime and workspace panels.";
  } catch (error) {
    fail(error instanceof Error ? error.message : "Unable to bootstrap the viewer.");
  }

  function syncJson(path) {
    const request = new XMLHttpRequest();
    request.open("GET", path, false);
    request.withCredentials = true;
    request.send(null);

    if (request.status < 200 || request.status >= 300) {
      const detail = request.responseText || `Request failed with ${request.status}`;
      throw new Error(detail);
    }

    return JSON.parse(request.responseText);
  }

  function ensureLoader() {
    const existing = document.getElementById("radsysx-loader");
    if (existing) {
      return existing;
    }

    const element = document.createElement("div");
    element.id = "radsysx-loader";
    element.innerHTML = `
      <div class="radsysx-loader-card">
        <div class="radsysx-loader-kicker">RadSysX Clinical Viewer</div>
        <div class="radsysx-loader-title" data-role="title">Resolving launch token</div>
        <div class="radsysx-loader-body" data-role="body">Preparing the OHIF runtime...</div>
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
