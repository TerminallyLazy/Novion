// @ts-check

(function radsysxOHIFMode() {
  window.__RADSYSX_OHIF_MODE__ = {
    id: "@radsysx/mode-clinical",
    async modeFactory({ modeConfiguration, loadModules }) {
      const [longitudinalMode] = await loadModules(["@ohif/mode-longitudinal"]);
      const baseMode = longitudinalMode.modeFactory({ modeConfiguration });
      const workspacePanel = "@radsysx/extension-clinical.panelModule.workspace";
      const baseRoute = baseMode.routes?.[0];

      return {
        ...baseMode,
        id: "@radsysx/mode-clinical",
        routeName: "viewer",
        displayName: "RadSysX Clinical Viewer",
        routes: baseRoute
          ? [
              {
                ...baseRoute,
                layoutTemplate: () => {
                  const layout = baseRoute.layoutTemplate();
                  const props = layout?.props ?? {};
                  const rightPanels = Array.isArray(props.rightPanels)
                    ? [...props.rightPanels]
                    : [];
                  if (!rightPanels.includes(workspacePanel)) {
                    rightPanels.push(workspacePanel);
                  }

                  return {
                    ...layout,
                    props: {
                      ...props,
                      rightPanels,
                      rightPanelClosed: false,
                      rightPanelResizable: true,
                    },
                  };
                },
              },
            ]
          : baseMode.routes,
        extensions: {
          ...(baseMode.extensions ?? {}),
          "@radsysx/extension-clinical": "^0.1.0",
        },
      };
    },
  };
})();
