import { useState, useEffect, useRef } from "react";
import { Wrench, Loader2, Check, XCircle, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { ToolCallStatus } from "@/shared/types/messages";

interface ToolCallCardProps {
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  isError?: boolean;
}

const pillColors: Record<ToolCallStatus, string> = {
  pending: "bg-background-tertiary text-foreground-secondary border-border",
  idle: "bg-background-tertiary text-foreground-secondary border-border",
  executing: "bg-amber-500/[0.08] text-foreground-primary border-amber-500/20",
  completed: "bg-background-tertiary text-foreground-secondary border-border",
  error: "bg-red-500/[0.08] text-foreground-primary border-red-500/20",
  stopped: "bg-background-tertiary text-foreground-secondary border-border",
} as Record<string, string>;

function StatusIndicator({ status }: { status: ToolCallStatus }) {
  switch (status) {
    case "executing":
      return (
        <Loader2 className="w-3 h-3 shrink-0 animate-spin text-amber-500" />
      );
    case "completed":
      return <Check className="w-3 h-3 shrink-0 text-green-500" />;
    case "error":
      return <XCircle className="w-3 h-3 shrink-0 text-red-500" />;
    default:
      return null;
  }
}

function useElapsedTime(status: ToolCallStatus) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "executing") {
      startRef.current = Date.now();
      setElapsed(0);
      const interval = setInterval(() => {
        if (startRef.current) {
          setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
    startRef.current = null;
  }, [status]);

  return elapsed;
}

export function ToolCallCard({
  name,
  arguments: args,
  status,
  result,
  isError,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const elapsed = useElapsedTime(status);

  const hasContent = Object.keys(args).length > 0 || result != null;

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => hasContent && setExpanded(!expanded)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-all duration-150",
          hasContent && "cursor-pointer",
          !hasContent && "cursor-default",
          pillColors[status] ?? pillColors.pending,
        )}
      >
        <Wrench className="w-3 h-3 shrink-0" />
        <span className="text-xs font-medium">{name}</span>
        <StatusIndicator status={status} />
        {status === "executing" && elapsed >= 3 && (
          <span className="text-[10px] tabular-nums text-foreground-tertiary">
            {elapsed}s
          </span>
        )}
        {hasContent && (
          <ChevronRight
            className={cn(
              "w-3 h-3 shrink-0 transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        )}
      </button>

      {expanded && hasContent && (
        <div className="mt-1.5 p-3 rounded-md bg-background-tertiary border border-border">
          {Object.keys(args).length > 0 && (
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-foreground-tertiary">
                Arguments
              </span>
              <pre className="mt-1 text-xs font-mono text-foreground-secondary whitespace-pre-wrap break-all">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result != null && (
            <div className={Object.keys(args).length > 0 ? "mt-2" : ""}>
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide",
                  isError ? "text-red-500" : "text-foreground-tertiary",
                )}
              >
                {isError ? "Error" : "Result"}
              </span>
              <pre
                className={cn(
                  "mt-1 max-h-48 overflow-auto text-xs font-mono whitespace-pre-wrap break-all",
                  isError ? "text-red-500" : "text-foreground-secondary",
                )}
              >
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
