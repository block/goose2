import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface StatusBarProps {
  modelName?: string;
  sessionId?: string;
  tokenCount?: number;
  status?: "connected" | "disconnected" | "loading";
}

const statusColor = {
  connected: "bg-green-500",
  disconnected: "bg-red-500",
  loading: "bg-yellow-500",
} as const;

export function StatusBar({
  modelName,
  sessionId,
  tokenCount = 0,
  status = "disconnected",
}: StatusBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopySessionId = () => {
    if (!sessionId) return;
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex h-6 w-full items-center justify-between border-t border-border",
        "bg-background/80 px-3 text-xs text-foreground-secondary",
      )}
    >
      {modelName ? <span>{modelName}</span> : <span />}

      <div className="flex items-center gap-2">
        {sessionId && (
          <div className="flex items-center gap-0.5">
            <span className="text-foreground-tertiary">{sessionId}</span>
            <button
              type="button"
              onClick={handleCopySessionId}
              className="rounded p-0.5 text-foreground-tertiary hover:text-foreground-primary transition-colors"
              aria-label={copied ? "Copied" : "Copy session ID"}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          </div>
        )}
        {tokenCount > 0 && <span>{tokenCount.toLocaleString()} tokens</span>}
        <div
          role="status"
          aria-label={status}
          className={cn("h-1.5 w-1.5 rounded-full", statusColor[status])}
        />
      </div>
    </div>
  );
}
