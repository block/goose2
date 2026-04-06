import { useEffect } from "react";
import { useWidgetStore } from "../stores/widgetStore";
import type { WidgetPlacement } from "../types";

export function useWidgets(
  placement: WidgetPlacement,
  projectDir?: string | null,
) {
  const discover = useWidgetStore((s) => s.discover);
  const isDiscovering = useWidgetStore((s) => s.isDiscovering);
  const getWidgetsForPlacement = useWidgetStore(
    (s) => s.getWidgetsForPlacement,
  );

  useEffect(() => {
    void discover(projectDir);
  }, [discover, projectDir]);

  return {
    widgets: getWidgetsForPlacement(placement),
    isDiscovering,
    refresh: () => discover(projectDir),
  };
}
