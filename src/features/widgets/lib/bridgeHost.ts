import { invoke } from "@tauri-apps/api/core";
import type { WidgetPermission } from "../types";

interface BridgeRequest {
  type: "goose:bridge";
  id: string;
  method: string;
  args: unknown[];
}

interface BridgeResponse {
  type: "goose:response";
  id: string;
  result?: unknown;
  error?: string;
}

const PERMISSION_MAP: Record<string, WidgetPermission> = {
  "git.getState": "git",
  "shell.run": "shell",
  "chat.send": "chat",
};

function requiresPermission(method: string): WidgetPermission | null {
  return PERMISSION_MAP[method] ?? null;
}

export async function handleBridgeRequest(
  widgetId: string,
  permissions: WidgetPermission[],
  method: string,
  args: unknown[],
): Promise<unknown> {
  const required = requiresPermission(method);
  if (required && !permissions.includes(required)) {
    throw new Error(
      `Widget "${widgetId}" lacks "${required}" permission for ${method}`,
    );
  }

  switch (method) {
    case "git.getState": {
      return invoke("get_git_state", { path: "." });
    }

    case "shell.run": {
      const [command, options] = args as [string, { cwd?: string } | undefined];
      return invoke("widget_shell_run", {
        command,
        cwd: options?.cwd ?? null,
      });
    }

    case "chat.send": {
      return undefined;
    }

    case "storage.get": {
      const [getKey] = args as [string];
      return invoke("widget_storage_get", { widgetId, key: getKey });
    }

    case "storage.set": {
      const [setKey, setValue] = args as [string, unknown];
      return invoke("widget_storage_set", {
        widgetId,
        key: setKey,
        value: setValue,
      });
    }

    case "storage.remove": {
      const [removeKey] = args as [string];
      return invoke("widget_storage_remove", { widgetId, key: removeKey });
    }

    case "storage.clear": {
      return invoke("widget_storage_clear", { widgetId });
    }

    default:
      throw new Error(`Unknown bridge method: ${method}`);
  }
}

export function createMessageHandler(
  widgetId: string,
  permissions: WidgetPermission[],
  iframeWindow: Window,
  callbacks?: {
    onReady?: () => void;
    onResize?: (height: number) => void;
    onSetTitle?: (title: string) => void;
    onClose?: () => void;
  },
) {
  return (event: MessageEvent) => {
    if (event.source !== iframeWindow) return;

    const data = event.data;
    if (!data || typeof data.type !== "string") return;

    if (data.type === "goose:ready") {
      callbacks?.onReady?.();
      return;
    }

    if (data.type === "goose:resize") {
      callbacks?.onResize?.(data.height);
      return;
    }

    if (data.type === "goose:widget") {
      if (data.action === "setTitle") callbacks?.onSetTitle?.(data.title);
      if (data.action === "close") callbacks?.onClose?.();
      return;
    }

    if (data.type === "goose:bridge") {
      const req = data as BridgeRequest;
      handleBridgeRequest(widgetId, permissions, req.method, req.args)
        .then((result) => {
          const response: BridgeResponse = {
            type: "goose:response",
            id: req.id,
            result,
          };
          iframeWindow.postMessage(response, "*");
        })
        .catch((err) => {
          const response: BridgeResponse = {
            type: "goose:response",
            id: req.id,
            error: err instanceof Error ? err.message : String(err),
          };
          iframeWindow.postMessage(response, "*");
        });
    }
  };
}

export interface ThemePayload {
  mode: "light" | "dark";
  accent: string;
  density: string;
  variables: Record<string, string>;
}

export function collectThemeVariables(): ThemePayload {
  const root = document.documentElement;
  const style = getComputedStyle(root);

  const varNames = [
    "--color-background",
    "--color-foreground",
    "--color-brand",
    "--color-brand-foreground",
    "--background",
    "--background-alt",
    "--background-muted",
    "--foreground",
    "--text-muted",
    "--text-subtle",
    "--card",
    "--popover",
    "--muted",
    "--border",
    "--input",
    "--ring",
    "--text-accent",
    "--text-danger",
    "--text-success",
    "--background-accent",
    "--background-danger",
    "--background-success",
    "--background-info",
    "--background-warning",
    "--density-spacing",
    "--font-sans",
    "--font-mono",
  ];

  const variables: Record<string, string> = {};
  for (const name of varNames) {
    const val = style.getPropertyValue(name).trim();
    if (val) variables[name] = val;
  }

  return {
    mode: root.classList.contains("dark") ? "dark" : "light",
    accent: style.getPropertyValue("--color-brand").trim() || "#3b82f6",
    density: style.getPropertyValue("--density-spacing").trim() || "1",
    variables,
  };
}

export function sendThemeToWidget(
  iframeWindow: Window,
  theme: ThemePayload,
): void {
  iframeWindow.postMessage({ type: "goose:theme", theme }, "*");
}
