import { create } from "zustand";
import { discoverWidgets } from "../api/widgets";
import type { WidgetManifest, WidgetPlacement } from "../types";

interface WidgetState {
  widgets: WidgetManifest[];
  isDiscovering: boolean;
  discover: (projectDir?: string | null) => Promise<void>;
  getWidgetsForPlacement: (placement: WidgetPlacement) => WidgetManifest[];
}

export const useWidgetStore = create<WidgetState>((set, get) => ({
  widgets: [],
  isDiscovering: false,

  discover: async (projectDir) => {
    set({ isDiscovering: true });
    try {
      const widgets = await discoverWidgets(projectDir);
      set({ widgets });
    } catch (err) {
      console.error("Widget discovery failed:", err);
    } finally {
      set({ isDiscovering: false });
    }
  },

  getWidgetsForPlacement: (placement) => {
    return get().widgets.filter((w) => w.placement.includes(placement));
  },
}));
