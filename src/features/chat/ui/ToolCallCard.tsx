import { useState } from "react";
import {
  Wrench,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { ToolCallStatus } from "@/shared/types/messages";

interface ToolCallCardProps {
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  isError?: boolean;
}

const statusConfig: Record<
  ToolCallStatus,
  {
    icon: typeof CheckCircle2 | typeof Loader2 | typeof XCircle | typeof Wrench;
    color: string;
    borderColor: string;
    spin?: boolean;
  }
> = {
  pending: {
    icon: Wrench,
    color: "text-foreground-tertiary",
    borderColor: "border-border-primary",
  },
  executing: {
    icon: Loader2,
    color: "text-foreground-warning",
    borderColor: "border-border-warning",
    spin: true,
  },
  completed: {
    icon: CheckCircle2,
    color: "text-foreground-success",
    borderColor: "border-border-success",
  },
  error: {
    icon: XCircle,
    color: "text-foreground-danger",
    borderColor: "border-border-danger",
  },
  stopped: {
    icon: XCircle,
    color: "text-foreground-tertiary",
    borderColor: "border-border-primary",
  },
};

export function ToolCallCard({
  name,
  arguments: args,
  status,
  result,
  isError,
}: ToolCallCardProps) {
  const [argsExpanded, setArgsExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "my-1.5 overflow-hidden rounded-lg border bg-background-secondary",
        config.borderColor,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Wrench size={14} className="shrink-0 text-foreground-tertiary" />
        <span className="font-mono text-xs font-medium text-foreground-secondary">
          {name}
        </span>
        <StatusIcon
          size={14}
          className={cn(
            "ml-auto shrink-0",
            config.color,
            config.spin && "animate-spin motion-reduce:animate-none",
          )}
          aria-label={status}
        />
      </div>

      {/* Collapsible arguments */}
      {Object.keys(args).length > 0 && (
        <div className="border-t border-border-secondary">
          <button
            type="button"
            onClick={() => setArgsExpanded(!argsExpanded)}
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] text-foreground-tertiary transition-colors hover:text-foreground-secondary"
            aria-expanded={argsExpanded}
          >
            <ChevronRight
              size={10}
              className={cn(
                "shrink-0 transition-transform duration-150 motion-reduce:transition-none",
                argsExpanded && "rotate-90",
              )}
            />
            Arguments
          </button>
          {argsExpanded && (
            <pre className="overflow-x-auto px-3 pb-2 text-[11px] leading-relaxed text-foreground-tertiary">
              {JSON.stringify(args, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Collapsible result */}
      {result != null && (
        <div className="border-t border-border-secondary">
          <button
            type="button"
            onClick={() => setResultExpanded(!resultExpanded)}
            className={cn(
              "flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] transition-colors hover:text-foreground-secondary",
              isError ? "text-foreground-danger" : "text-foreground-tertiary",
            )}
            aria-expanded={resultExpanded}
          >
            <ChevronRight
              size={10}
              className={cn(
                "shrink-0 transition-transform duration-150 motion-reduce:transition-none",
                resultExpanded && "rotate-90",
              )}
            />
            {isError ? "Error" : "Result"}
          </button>
          {resultExpanded && (
            <pre
              className={cn(
                "max-h-48 overflow-auto px-3 pb-2 text-[11px] leading-relaxed",
                isError ? "text-foreground-danger" : "text-foreground-tertiary",
              )}
            >
              {result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
