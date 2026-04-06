import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "@/shared/theme/ThemeProvider";
import { Skeleton } from "@/shared/ui/skeleton";
import type { WidgetManifest } from "../types";
import {
  collectThemeVariables,
  createMessageHandler,
  sendThemeToWidget,
} from "../lib/bridgeHost";

type FrameStatus = "loading" | "ready" | "error";

interface WidgetFrameProps {
  manifest: WidgetManifest;
  onTitleChange?: (title: string) => void;
  onClose?: () => void;
}

const MIN_HEIGHT = 120;

export function WidgetFrame({
  manifest,
  onTitleChange,
  onClose,
}: WidgetFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<FrameStatus>("loading");
  const [frameHeight, setFrameHeight] = useState(MIN_HEIGHT);
  const { resolvedTheme, accentColor, density } = useTheme();
  const sendThemeRef = useRef<() => void>(() => {});

  const src = `goose://localhost/${manifest.id}/${manifest.entry}`;

  sendThemeRef.current = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const theme = collectThemeVariables();
    sendThemeToWidget(iframe.contentWindow, theme);
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const handler = createMessageHandler(
      manifest.id,
      manifest.permissions,
      iframe.contentWindow,
      {
        onReady: () => {
          setStatus("ready");
          sendThemeRef.current();
        },
        onResize: (h) => setFrameHeight(Math.max(MIN_HEIGHT, h)),
        onSetTitle: onTitleChange,
        onClose,
      },
    );

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [manifest.id, manifest.permissions, onTitleChange, onClose]);

  useEffect(() => {
    if (status !== "ready") return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    sendThemeToWidget(iframe.contentWindow, {
      mode: resolvedTheme,
      accent: accentColor,
      density,
      variables: collectThemeVariables().variables,
    });
  }, [resolvedTheme, accentColor, density, status]);

  const handleError = useCallback(() => {
    setStatus("error");
  }, []);

  if (status === "error") {
    return (
      <div className="flex items-center justify-center px-3 py-6 text-foreground-subtle">
        <p>Couldn't load {manifest.name}</p>
      </div>
    );
  }

  return (
    <div className="relative" style={{ minHeight: MIN_HEIGHT }}>
      {status === "loading" && (
        <div className="absolute inset-0 p-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        title={manifest.name}
        sandbox="allow-scripts"
        onError={handleError}
        className="block w-full border-0"
        style={{
          minHeight: MIN_HEIGHT,
          height: frameHeight,
          background: "transparent",
          opacity: status === "ready" ? 1 : 0,
          transition: "opacity 150ms ease-out",
        }}
      />
    </div>
  );
}
