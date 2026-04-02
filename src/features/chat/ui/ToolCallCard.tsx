import { useState, useEffect, useRef } from "react";
import { Wrench, Loader2, Check, XCircle, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import type { ToolCallStatus } from "@/shared/types/messages";

interface ToolCallCardProps {
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  isError?: boolean;
}

const pillColors: Record<ToolCallStatus, string> = {
  pending: "bg-accent text-muted-foreground border-border",
  idle: "bg-accent text-muted-foreground border-border",
  executing: "bg-amber-500/[0.08] text-foreground border-amber-500/20",
  completed: "bg-accent text-muted-foreground border-border",
  error: "bg-red-500/[0.08] text-foreground border-red-500/20",
  stopped: "bg-accent text-muted-foreground border-border",
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
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => hasContent && setExpanded(!expanded)}
        className={cn(
          "h-auto gap-1.5 border px-2.5 py-1",
          hasContent ? "cursor-pointer" : "cursor-default",
          pillColors[status] ?? pillColors.pending,
        )}
      >
        <Wrench className="size-3 shrink-0" />
        <span className="text-xs font-medium">{name}</span>
        <StatusIndicator status={status} />
        {status === "executing" && elapsed >= 3 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {elapsed}s
          </span>
        )}
        {hasContent && (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        )}
      </Button>

      {expanded && hasContent && (
        <div className="mt-1.5 p-3 rounded-md bg-accent border border-border">
          {Object.keys(args).length > 0 && (
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Arguments
              </span>
              <pre className="mt-1 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result != null && (
            <div className={Object.keys(args).length > 0 ? "mt-2" : ""}>
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide",
                  isError ? "text-red-500" : "text-muted-foreground",
                )}
              >
                {isError ? "Error" : "Result"}
              </span>
              <pre
                className={cn(
                  "mt-1 max-h-48 overflow-auto text-xs font-mono whitespace-pre-wrap break-all",
                  isError ? "text-red-500" : "text-muted-foreground",
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
