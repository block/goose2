import { useState, useEffect, useRef, useMemo } from "react";
import {
  Wrench,
  Loader2,
  Check,
  XCircle,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { ToolCallStatus } from "@/shared/types/messages";
import type {
  ArtifactPathCandidate,
  ArtifactCandidateKind,
} from "@/features/chat/lib/artifactPathPolicy";
import { useArtifactPolicyContext } from "@/features/chat/hooks/ArtifactPolicyContext";

interface ToolCallCardProps {
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  isError?: boolean;
  variant?: "default" | "subtle";
  expandable?: boolean;
}

const pillColors: Record<ToolCallStatus, string> = {
  pending: "bg-background-tertiary text-foreground-secondary border-border",
  idle: "bg-background-tertiary text-foreground-secondary border-border",
  executing: "bg-amber-500/[0.08] text-foreground-primary border-amber-500/20",
  completed: "bg-background-tertiary text-foreground-secondary border-border",
  error: "bg-red-500/[0.08] text-foreground-primary border-red-500/20",
  stopped: "bg-background-tertiary text-foreground-secondary border-border",
} as Record<string, string>;

const MAX_TOOL_NAME_LENGTH = 48;

function formatToolName(name: string): string {
  if (name.length <= MAX_TOOL_NAME_LENGTH) {
    return name;
  }

  return `${name.slice(0, MAX_TOOL_NAME_LENGTH - 1)}…`;
}

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
  variant = "default",
  expandable = true,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [moreOutputsOpen, setMoreOutputsOpen] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const elapsed = useElapsedTime(status);
  const displayName = formatToolName(name);
  const { resolveToolCardDisplay, openResolvedPath } =
    useArtifactPolicyContext();

  const hasContent = Object.keys(args).length > 0 || result != null;
  const canExpand = expandable && hasContent;
  const display = useMemo(
    () => resolveToolCardDisplay(args, name, result),
    [args, name, resolveToolCardDisplay, result],
  );
  const canShowArtifactActions =
    display.role === "primary_host" && Boolean(display.primaryCandidate);

  const labelForCandidate = (candidate: ArtifactPathCandidate): string => {
    const kindToLabel: Record<ArtifactCandidateKind, string> = {
      file: "Open file",
      folder: "Open folder",
      path: "Open path",
    };
    return kindToLabel[candidate.kind];
  };

  const displayPath = (candidate: ArtifactPathCandidate): string =>
    candidate.rawPath || candidate.resolvedPath;

  const openCandidate = async (candidate: ArtifactPathCandidate) => {
    if (!candidate.allowed) {
      setOpenError(
        candidate.blockedReason ||
          "Path is outside allowed project/artifacts roots.",
      );
      return;
    }
    try {
      setOpenError(null);
      await openResolvedPath(candidate.resolvedPath);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => canExpand && setExpanded(!expanded)}
        title={name}
        className={cn(
          "inline-flex max-w-full items-center justify-start gap-1.5 rounded-md border px-2.5 py-1 text-left text-xs transition-all duration-150",
          canExpand && "cursor-pointer",
          !canExpand && "cursor-default",
          variant === "subtle" && "opacity-80",
          pillColors[status] ?? pillColors.pending,
        )}
      >
        <Wrench className="w-3 h-3 shrink-0" />
        <span className="max-w-[12rem] truncate text-left text-xs font-medium sm:max-w-[18rem] md:max-w-[22rem]">
          {displayName}
        </span>
        <StatusIndicator status={status} />
        {status === "executing" && elapsed >= 3 && (
          <span className="text-[10px] tabular-nums text-foreground-tertiary">
            {elapsed}s
          </span>
        )}
        {canExpand && (
          <ChevronRight
            className={cn(
              "w-3 h-3 shrink-0 transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        )}
      </button>

      {canShowArtifactActions && display.primaryCandidate && (
        <div className="mt-1.5 ml-1 space-y-1.5">
          <button
            type="button"
            onClick={() => {
              if (!display.primaryCandidate) return;
              void openCandidate(display.primaryCandidate);
            }}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
              display.primaryCandidate.allowed
                ? "border-accent/45 bg-accent/20 text-accent-foreground shadow-sm hover:bg-accent/30"
                : "cursor-not-allowed border-red-500/30 bg-red-500/[0.04] text-red-500/70",
            )}
            disabled={!display.primaryCandidate.allowed}
            title={display.primaryCandidate.resolvedPath}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {labelForCandidate(display.primaryCandidate)}
            </span>
            <span className="truncate text-[10px] text-foreground-tertiary">
              {displayPath(display.primaryCandidate)}
            </span>
            {display.primaryCandidate.confidence === "low" && (
              <span className="text-[10px] text-foreground-tertiary">
                detected
              </span>
            )}
          </button>

          {display.primaryCandidate.blockedReason && (
            <p className="text-[11px] text-red-500/80">
              {display.primaryCandidate.blockedReason}
            </p>
          )}

          {display.secondaryCandidates.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setMoreOutputsOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] text-foreground-tertiary hover:text-foreground-secondary"
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 transition-transform",
                    moreOutputsOpen && "rotate-90",
                  )}
                />
                More outputs ({display.secondaryCandidates.length})
              </button>

              {moreOutputsOpen && (
                <div className="space-y-1.5 pl-4">
                  {display.secondaryCandidates.map((candidate) => (
                    <div key={candidate.id} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => void openCandidate(candidate)}
                        className={cn(
                          "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors",
                          candidate.allowed
                            ? "border-border bg-background-tertiary text-foreground-tertiary hover:bg-background-secondary hover:text-foreground-secondary"
                            : "cursor-not-allowed border-red-500/20 bg-red-500/[0.03] text-red-500/70",
                        )}
                        disabled={!candidate.allowed}
                        title={candidate.resolvedPath}
                      >
                        <FolderOpen className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {labelForCandidate(candidate)}
                        </span>
                        <span className="truncate text-[10px] text-foreground-tertiary">
                          {displayPath(candidate)}
                        </span>
                        {candidate.confidence === "low" && (
                          <span className="text-[10px] text-foreground-tertiary">
                            detected
                          </span>
                        )}
                      </button>
                      {candidate.blockedReason && (
                        <p className="text-[11px] text-red-500/80">
                          {candidate.blockedReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {openError && <p className="text-[11px] text-red-500">{openError}</p>}
        </div>
      )}

      {expanded && canExpand && (
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
