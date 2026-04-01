import { useState } from "react";
import { Bot, Copy, Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface StatusBarProps {
  modelName?: string;
  sessionId?: string;
  tokenCount?: number;
}

export function StatusBar({
  modelName,
  sessionId,
  tokenCount = 0,
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
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <Bot className="h-3.5 w-3.5 flex-shrink-0 text-foreground-tertiary" />
          <span className="truncate text-foreground-secondary">
            {modelName ?? "No model"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {sessionId && (
          <button
            type="button"
            onClick={handleCopySessionId}
            className="flex items-center gap-1 rounded px-1 py-0.5 text-foreground-tertiary hover:text-foreground-secondary transition-colors"
            title={`Session: ${sessionId}`}
          >
            <span className="font-mono">{sessionId.slice(0, 8)}</span>
            {copied ? <Check size={10} /> : <Copy size={10} />}
          </button>
        )}
        {tokenCount > 0 && (
          <span className="text-foreground-tertiary">
            {tokenCount.toLocaleString()} tokens
          </span>
        )}
      </div>
    </div>
  );
}
