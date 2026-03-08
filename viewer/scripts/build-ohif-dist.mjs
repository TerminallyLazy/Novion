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
  const resolved = window.__RADSYSX_LAUNCH__;
  const runtime = resolved?.viewerRuntime ?? {};
  window.config = {
    name: "config/radsysx-clinical.js",
    routerBasename: runtime.viewerBasePath ?? "/viewer",
    extensions: [
      window.__RADSYSX_OHIF_EXTENSION__,
      "@ohif/extension-default",
      "@ohif/extension-cornerstone",
      "@ohif/extension-measurement-tracking",
      "@ohif/extension-cornerstone-dicom-sr",
      "@ohif/extension-cornerstone-dicom-seg",
      "@ohif/extension-dicom-pdf",
      "@ohif/extension-dicom-video",
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
        namespace: "@ohif/extension-default.dataSourcesModule.dicomweb",
        sourceName: "dicomweb",
        configuration: {
          friendlyName: "RadSysX Clinical DICOMweb",
          name: "radsysxOrthanc",
          qidoRoot: runtime.qidoRoot ?? "/dicom-web",
          wadoRoot: runtime.wadoRoot ?? "/dicom-web",
          wadoUriRoot: runtime.wadoUriRoot ?? "/dicom-web",
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

  html = html.replace("window.PUBLIC_URL = '/';", "window.PUBLIC_URL = '/viewer/';");
  html = html.replace(/(src|href)=\"\//g, '$1="/viewer/');
  html = html.replace(
    '<script rel="preload" as="script" src="/viewer/app-config.js"></script>',
    [
      '<script src="/viewer/react.production.min.js"></script>',
      '<script src="/viewer/radsysx-bootstrap.js"></script>',
      '<script src="/viewer/radsysx-ohif-extension.js"></script>',
      '<script src="/viewer/radsysx-ohif-mode.js"></script>',
      '<script rel="preload" as="script" src="/viewer/app-config.js"></script>',
    ].join(""),
  );
  html = html.replace(
    "</head>",
    '<link href="/viewer/radsysx-viewer.css" rel="stylesheet"></head>',
  );

  fs.writeFileSync(indexPath, html, "utf8");
}
