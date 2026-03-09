// @ts-check

(function radsysxOHIFMode() {
  /** @type {any} */ (window).__RADSYSX_OHIF_MODE__ = {
    id: "@radsysx/mode-clinical",
    async modeFactory({ modeConfiguration, loadModules }) {
      const [longitudinalMode] = await loadModules(["@ohif/mode-longitudinal"]);
      const baseMode = longitudinalMode.modeFactory({ modeConfiguration });
      const workspacePanel = "@radsysx/extension-clinical.panelModule.workspace";
      const baseRoute = baseMode.routes?.[0];
      const originalOnModeEnter = baseMode.onModeEnter?.bind(baseMode);

      return {
        ...baseMode,
        id: "@radsysx/mode-clinical",
        routeName: "",
        displayName: "RadSysX Clinical Viewer",
        onModeEnter: (context) => {
          context?.servicesManager?.services?.panelService?.activatePanel?.(workspacePanel, true);
          return originalOnModeEnter?.(context);
        },
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
      };
    },
  };
})();
