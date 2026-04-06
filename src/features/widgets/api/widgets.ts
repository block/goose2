import { invoke } from "@tauri-apps/api/core";
import type { WidgetManifest } from "../types";

export async function discoverWidgets(
  projectDir?: string | null,
): Promise<WidgetManifest[]> {
  return invoke<WidgetManifest[]>("discover_widgets", {
    projectDir: projectDir ?? null,
  });
}
