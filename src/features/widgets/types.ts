export type WidgetPlacement = "context-panel" | "home" | "project-page";

export type WidgetPermission =
  | "git"
  | "shell"
  | "chat"
  | "fs"
  | "mcp"
  | "events";

export type WidgetSize = "standard" | "wide" | "full";

export interface WidgetManifest {
  id: string;
  name: string;
  description?: string;
  entry: string;
  path: string;
  size: WidgetSize;
  placement: WidgetPlacement[];
  permissions: WidgetPermission[];
  scope: "user" | "project";
}
