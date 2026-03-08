import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, "..");
const distRoot = path.join(viewerRoot, "dist");
const workspaceRoot = path.resolve(viewerRoot, "..");
const candidateSourceDists = [
  path.join(viewerRoot, "node_modules", "@ohif", "app", "dist"),
  path.join(workspaceRoot, "node_modules", "@ohif", "app", "dist"),
];
const sourceDist = candidateSourceDists.find((candidate) => fs.existsSync(candidate));

if (!sourceDist) {
  throw new Error(
    "OHIF dist was not found. Run `npm install` from the workspace root before building the viewer.",
  );
}

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(distRoot, { recursive: true });
fs.cpSync(sourceDist, distRoot, { recursive: true });

copyViewerAsset("radsysx-bootstrap.js");
copyViewerAsset("radsysx-ohif-extension.js");
copyViewerAsset("radsysx-ohif-mode.js");
copyViewerAsset("radsysx-viewer.css");
copyWorkspaceAsset(["react", "umd", "react.production.min.js"], "react.production.min.js");
writeAppConfig();
patchIndexHtml();
patchRuntimePublicPath();
patchCssAssetUrls();
patchManifest();
patchServiceWorkerInit();

function copyViewerAsset(fileName) {
  fs.copyFileSync(
    path.join(viewerRoot, "assets", fileName),
    path.join(distRoot, fileName),
  );
}

function copyWorkspaceAsset(relativeParts, outputName) {
  const assetPath = path.join(workspaceRoot, "node_modules", ...relativeParts);
  if (!fs.existsSync(assetPath)) {
    throw new Error(`Required viewer asset was not found: ${assetPath}`);
  }
  fs.copyFileSync(assetPath, path.join(distRoot, outputName));
}

function writeAppConfig() {
  const config = `/** @type {AppTypes.Config} */
(function radsysxAppConfig() {
  window.config = {
    name: "config/radsysx-clinical.js",
    routerBasename: window.__RADSYSX_VIEWER_BASE_PATH__ ?? null,
    extensions: [
      "@ohif/extension-default",
      "@ohif/extension-cornerstone",
      "@ohif/extension-measurement-tracking",
      "@ohif/extension-cornerstone-dicom-sr",
      "@ohif/extension-cornerstone-dicom-seg",
      "@ohif/extension-dicom-pdf",
      "@ohif/extension-dicom-video",
      window.__RADSYSX_OHIF_EXTENSION__,
    ],
    modes: [
      window.__RADSYSX_OHIF_MODE__,
    ],
    customizationService: {},
    showStudyList: false,
    maxNumberOfWebWorkers: 3,
    showWarningMessageForCrossOrigin: true,
    showCPUFallbackMessage: true,
    showLoadingIndicator: true,
    defaultDataSourceName: "dicomweb",
    dataSources: [
      {
        namespace: "@radsysx/extension-clinical.dataSourcesModule.dicomweb",
        sourceName: "dicomweb",
        configuration: {
          friendlyName: "RadSysX Clinical DICOMweb",
          name: "radsysxOrthanc",
          qidoRoot: null,
          wadoRoot: null,
          wadoUriRoot: null,
          qidoSupportsIncludeField: true,
          supportsReject: false,
          supportsStow: false,
          dicomUploadEnabled: false,
          imageRendering: "wadors",
          thumbnailRendering: "wadors",
          enableStudyLazyLoad: true,
          supportsFuzzyMatching: true,
          supportsWildcard: true,
          omitQuotationForMultipartRequest: true,
          singlepart: "bulkdata,video",
        },
      },
    ],
  };
})();
`;

  fs.writeFileSync(path.join(distRoot, "app-config.js"), config, "utf8");
}

function patchIndexHtml() {
  const indexPath = path.join(distRoot, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const publicUrlBootstrap = [
    "window.__RADSYSX_VIEWER_BASE_PATH__ = (function resolveViewerBasePath() {",
    "  const pathname = window.location.pathname || '/';",
    "  const normalized = pathname.replace(/\\/+$/, '');",
    "  return normalized || '/';",
    "})();",
    "window.__RADSYSX_PUBLIC_URL__ =",
    "  window.__RADSYSX_VIEWER_BASE_PATH__ === '/' ? '/' : `${window.__RADSYSX_VIEWER_BASE_PATH__}/`;",
    "document.write('<base href=\"' + window.__RADSYSX_PUBLIC_URL__.replace(/\"/g, '&quot;') + '\">');",
    "window.PUBLIC_URL = window.__RADSYSX_PUBLIC_URL__;",
  ].join(" ");

  html = html.replace("window.PUBLIC_URL = '/';", publicUrlBootstrap);
  html = html.replace("window.PUBLIC_URL = '/';", "window.PUBLIC_URL = window.__RADSYSX_PUBLIC_URL__;");
  html = html.replace(/(src|href|content)=\"\/assets\//g, '$1="assets/');
  html = html.replace(/(src|href)=\"\//g, '$1="');
  html = html.replace(
    '<script rel="preload" as="script" src="app-config.js"></script>',
    [
      '<script src="react.production.min.js"></script>',
      '<script src="radsysx-bootstrap.js"></script>',
      '<script src="radsysx-ohif-extension.js"></script>',
      '<script src="radsysx-ohif-mode.js"></script>',
      '<script rel="preload" as="script" src="app-config.js"></script>',
    ].join(""),
  );
  html = html.replace(
    "</head>",
    '<link href="radsysx-viewer.css" rel="stylesheet"></head>',
  );

  fs.writeFileSync(indexPath, html, "utf8");
}

function patchRuntimePublicPath() {
  const bundlePaths = fs
    .readdirSync(distRoot)
    .filter((fileName) => fileName.endsWith(".js"))
    .map((fileName) => path.join(distRoot, fileName));
  const current = '__webpack_require__.p = "/";';
  const next =
    '__webpack_require__.p = self.__RADSYSX_PUBLIC_URL__ || self.PUBLIC_URL || window.__RADSYSX_PUBLIC_URL__ || window.PUBLIC_URL || "/";';
  let patchedCount = 0;

  for (const bundlePath of bundlePaths) {
    const bundle = fs.readFileSync(bundlePath, "utf8");
    if (!bundle.includes(current)) {
      continue;
    }

    fs.writeFileSync(bundlePath, bundle.replaceAll(current, next), "utf8");
    patchedCount += 1;
  }

  if (patchedCount === 0) {
    throw new Error("Unable to patch OHIF runtime public path in copied dist bundles.");
  }
}

function patchCssAssetUrls() {
  const cssPaths = fs
    .readdirSync(distRoot)
    .filter((fileName) => fileName.endsWith(".css"))
    .map((fileName) => path.join(distRoot, fileName));

  for (const cssPath of cssPaths) {
    const css = fs.readFileSync(cssPath, "utf8");
    const normalized = css.replace(/url\((['"]?)\//g, "url($1");
    if (normalized !== css) {
      fs.writeFileSync(cssPath, normalized, "utf8");
    }
  }
}

function patchManifest() {
  const manifestPath = path.join(distRoot, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf8");
  const normalized = manifest.replace(/"src": "\/assets\//g, '"src": "assets/');
  if (normalized !== manifest) {
    fs.writeFileSync(manifestPath, normalized, "utf8");
  }
}

function patchServiceWorkerInit() {
  const initPath = path.join(distRoot, "init-service-worker.js");
  if (!fs.existsSync(initPath)) {
    return;
  }

  const source = fs.readFileSync(initPath, "utf8");
  const current = `navigator.serviceWorker.getRegistrations().then(function (registrations) {
  for (let registration of registrations) {
    registration.unregister();
  }
});
`;
  const next = `if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}
`;

  if (source.includes(current)) {
    fs.writeFileSync(initPath, source.replace(current, next), "utf8");
  }
}
