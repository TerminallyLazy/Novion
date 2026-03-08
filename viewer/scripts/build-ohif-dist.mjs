import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, "..");
const distRoot = path.join(viewerRoot, "dist");
const candidateSourceDists = [
  path.join(viewerRoot, "node_modules", "@ohif", "app", "dist"),
  path.join(viewerRoot, "..", "node_modules", "@ohif", "app", "dist"),
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

copyAsset("novion-bootstrap.js");
copyAsset("novion-bridge.js");
copyAsset("novion-bridge.css");
writeAppConfig();
patchIndexHtml();

function copyAsset(fileName) {
  fs.copyFileSync(
    path.join(viewerRoot, "assets", fileName),
    path.join(distRoot, fileName),
  );
}

function writeAppConfig() {
  const config = `/** @type {AppTypes.Config} */
(function novionAppConfig() {
  const resolved = window.__NOVION_LAUNCH__;
  const runtime = resolved?.viewerRuntime ?? {};
  window.config = {
    name: "config/novion-clinical.js",
    routerBasename: runtime.viewerBasePath ?? "/viewer",
    extensions: [
      "@ohif/extension-default",
      "@ohif/extension-cornerstone",
      "@ohif/extension-measurement-tracking",
      "@ohif/extension-cornerstone-dicom-sr",
      "@ohif/extension-cornerstone-dicom-seg",
      "@ohif/extension-dicom-pdf",
      "@ohif/extension-dicom-video",
    ],
    modes: [
      "@ohif/mode-longitudinal",
      "@ohif/mode-segmentation",
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
          friendlyName: "Novion Clinical DICOMweb",
          name: "novionOrthanc",
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
    '<script src="/viewer/novion-bootstrap.js"></script><script rel="preload" as="script" src="/viewer/app-config.js"></script>',
  );
  html = html.replace(
    '</head>',
    '<link href="/viewer/novion-bridge.css" rel="stylesheet"></head>',
  );
  html = html.replace(
    "</body>",
    '<script defer="defer" src="/viewer/novion-bridge.js"></script></body>',
  );

  fs.writeFileSync(indexPath, html, "utf8");
}
