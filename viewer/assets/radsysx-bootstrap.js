// @ts-check

/** @typedef {import("@radsysx/clinical-web/contracts").ImagingLaunchResolveResponse} ImagingLaunchResolveResponse */
/** @typedef {import("@radsysx/clinical-web/contracts").SessionResponse} SessionResponse */

(async function radsysxBootstrap() {
  const LAUNCH_STORAGE_KEY = "radsysx.clinical.launchToken";
  const REQUEST_TIMEOUT_MS = 10000;
  const loader = await ensureLoader();
  const params = new URLSearchParams(window.location.search);
  const launchFromUrl = params.get("launch");
  const initialViewerBasePath = normalizeViewerBasePath(window.location.pathname) ?? "/";

  window.__RADSYSX_VIEWER_BASE_PATH__ = initialViewerBasePath;

  window.__RADSYSX_BOOTSTRAP_PROMISE__ = bootstrap();

  try {
    await window.__RADSYSX_BOOTSTRAP_PROMISE__;
  } catch (error) {
    clearStoredLaunchToken();
    fail(error instanceof Error ? error.message : "Unable to bootstrap the viewer.");
  }

  async function bootstrap() {
    if (launchFromUrl) {
      persistLaunchToken(launchFromUrl);
      stripSensitiveQuery();
    }

    const launchToken = window.__RADSYSX_LAUNCH__ ? null : getStoredLaunchToken() ?? launchFromUrl;
    if (!launchToken && !window.__RADSYSX_LAUNCH__) {
      throw new Error("The OHIF viewer requires a governed launch session.");
    }

    /** @type {SessionResponse} */
    const session = await requestJson("/api/auth/session");
    if (!session.authenticated || !session.session) {
      if (launchToken) {
        const preserved = persistLaunchToken(launchToken);
        if (!preserved) {
          clearStoredLaunchToken();
          throw new Error(
            "Sign-in is required, but the viewer could not preserve the governed launch for a login redirect.",
          );
        }
      }
      window.location.replace(
        `/login?next=${encodeURIComponent(window.__RADSYSX_VIEWER_BASE_PATH__ ?? "/")}`,
      );
      return;
    }

    /** @type {ImagingLaunchResolveResponse} */
    let resolved = window.__RADSYSX_LAUNCH__;
    if (!resolved) {
      try {
        resolved = await requestJson(
          `/api/imaging/launch/resolve?launch=${encodeURIComponent(launchToken ?? "")}`,
        );
      } catch (error) {
        clearStoredLaunchToken();
        throw error;
      }
    }

    window.__RADSYSX_LAUNCH__ = resolved;
    window.__RADSYSX_VIEWER_RUNTIME__ = resolved.viewerRuntime;
    window.__RADSYSX_VIEWER_BASE_PATH__ =
      normalizeViewerBasePath(resolved.viewerRuntime?.viewerBasePath) ??
      window.__RADSYSX_VIEWER_BASE_PATH__;
    applyResolvedViewerRuntime();
    window.__RADSYSX_CLEAN_VIEWER_URL__ = function cleanViewerUrl() {
      stripSensitiveQuery();
    };
    clearStoredLaunchToken();
    stripSensitiveQuery();
    loader.dataset.state = "ready";
    loader.querySelector("[data-role='title']").textContent = "Governed launch resolved";
    loader.querySelector("[data-role='body']").textContent =
      "Preparing the OHIF runtime and workspace panels.";
  }

  async function requestJson(path) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(path, {
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = (await response.text()) || `Request failed with ${response.status}`;
        throw new Error(detail);
      }

      return response.json();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Viewer bootstrap timed out while contacting the backend.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function stripSensitiveQuery() {
    const cleanParams = new URLSearchParams(window.location.search);
    cleanParams.delete("launch");
    cleanParams.delete("_rsc");
    cleanParams.delete("StudyInstanceUIDs");
    cleanParams.delete("studyInstanceUIDs");
    cleanParams.delete("SeriesInstanceUIDs");
    cleanParams.delete("seriesInstanceUIDs");
    const nextUrl = cleanParams.toString()
      ? `${window.location.pathname}?${cleanParams.toString()}`
      : window.location.pathname;
    history.replaceState(history.state, "", nextUrl);
  }

  function applyResolvedViewerRuntime() {
    const runtime = window.__RADSYSX_VIEWER_RUNTIME__;
    const config = window.config;
    if (!runtime || !config) {
      return;
    }

    config.routerBasename = window.__RADSYSX_VIEWER_BASE_PATH__ ?? config.routerBasename;

    const dicomwebSource = config.dataSources?.find((entry) => entry?.sourceName === "dicomweb");
    if (!dicomwebSource?.configuration) {
      return;
    }

    dicomwebSource.configuration.qidoRoot = runtime.qidoRoot;
    dicomwebSource.configuration.wadoRoot = runtime.wadoRoot;
    dicomwebSource.configuration.wadoUriRoot = runtime.wadoUriRoot;
    dicomwebSource.configuration.stowRoot = runtime.stowRoot;
  }

  function persistLaunchToken(token) {
    try {
      window.sessionStorage.setItem(LAUNCH_STORAGE_KEY, token);
      return true;
    } catch (error) {
      console.warn("Unable to persist launch token for login handoff.", error);
      return false;
    }
  }

  function getStoredLaunchToken() {
    try {
      return window.sessionStorage.getItem(LAUNCH_STORAGE_KEY);
    } catch (error) {
      console.warn("Unable to read stored launch token.", error);
      return null;
    }
  }

  function clearStoredLaunchToken() {
    try {
      window.sessionStorage.removeItem(LAUNCH_STORAGE_KEY);
    } catch (error) {
      console.warn("Unable to clear stored launch token.", error);
    }
  }

  function normalizeViewerBasePath(value) {
    if (!value) {
      return null;
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.replace(/\/+$/, "");
    return normalized || "/";
  }

  async function ensureLoader() {
    const existing = document.getElementById("radsysx-loader");
    if (existing) {
      return existing;
    }

    if (!document.body) {
      await new Promise((resolve) => {
        if (document.body) {
          resolve(undefined);
          return;
        }

        document.addEventListener("DOMContentLoaded", () => resolve(undefined), { once: true });
      });
    }

    const element = document.createElement("div");
    element.id = "radsysx-loader";
    element.innerHTML = `
      <div class="radsysx-loader-card">
        <div class="radsysx-loader-kicker">RadSysX Clinical Viewer</div>
        <div class="radsysx-loader-title" data-role="title">Resolving governed launch</div>
        <div class="radsysx-loader-body" data-role="body">Preparing the OHIF runtime...</div>
      </div>
    `;
    (document.body ?? document.documentElement).appendChild(element);
    return element;
  }

  function fail(message) {
    loader.dataset.state = "error";
    loader.querySelector("[data-role='title']").textContent = "Viewer bootstrap failed";
    loader.querySelector("[data-role='body']").textContent = message;
  }
})();
