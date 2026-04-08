import { useState, useEffect, useRef, useMemo } from "react";
import { FolderOpen, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/shared/ui/ai-elements/tool";
import { toolStatusMap } from "../lib/toolStatusMap";
import type { ToolCallStatus } from "@/shared/types/messages";
import { useArtifactPolicyContext } from "@/features/chat/hooks/ArtifactPolicyContext";
import type { ArtifactPathCandidate } from "@/features/chat/lib/artifactPathPolicy";

interface ToolCallAdapterProps {
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  isError?: boolean;
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

function ArtifactActions({
  args,
  name,
  result,
}: {
  args: Record<string, unknown>;
  name: string;
  result?: string;
}) {
  const [moreOutputsOpen, setMoreOutputsOpen] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const { resolveToolCardDisplay, pathExists, openResolvedPath } =
    useArtifactPolicyContext();

  const display = useMemo(
    () => resolveToolCardDisplay(args, name, result),
    [args, name, resolveToolCardDisplay, result],
  );

  if (display.role !== "primary_host" || !display.primaryCandidate) return null;

  const openCandidate = async (
    candidate: ArtifactPathCandidate,
    allowFallback: boolean,
  ) => {
    const candidates = allowFallback
      ? [
          candidate,
          ...display.secondaryCandidates.filter((c) => c.id !== candidate.id),
        ]
      : [candidate];

    try {
      setOpenError(null);
      for (const c of candidates) {
        const exists = await pathExists(c.resolvedPath);
        if (c.allowed && exists) {
          await openResolvedPath(c.resolvedPath);
          return;
        }
      }
      for (const c of candidates) {
        const exists = await pathExists(c.resolvedPath);
        if (exists && !c.allowed) {
          setOpenError(
            c.blockedReason ||
              "Path is outside allowed project/artifacts roots.",
          );
          return;
        }
      }
      const firstAllowed = candidates.find((c) => c.allowed);
      if (firstAllowed) {
        setOpenError(`File not found: ${firstAllowed.resolvedPath}`);
        return;
      }
      setOpenError(
        candidate.blockedReason ||
          "Path is outside allowed project/artifacts roots.",
      );
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : String(error));
    }
  };

  const primary = display.primaryCandidate;
  const kindLabel: Record<string, string> = {
    file: "Open file",
    folder: "Open folder",
    path: "Open path",
  };

  return (
    <div className="mt-1.5 ml-1 space-y-1.5">
      <button
        type="button"
        onClick={() => void openCandidate(primary, true)}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
          primary.allowed
            ? "border-accent/45 bg-accent/20 text-accent-foreground shadow-sm hover:bg-accent/30"
            : "cursor-not-allowed border-red-500/30 bg-red-500/[0.04] text-red-500/70",
        )}
        disabled={!primary.allowed}
        title={primary.resolvedPath}
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{kindLabel[primary.kind] ?? "Open"}</span>
        <span className="truncate text-[10px] text-muted-foreground">
          {primary.rawPath || primary.resolvedPath}
        </span>
        {primary.confidence === "low" && (
          <span className="text-[10px] text-muted-foreground/70 italic">
            detected
          </span>
        )}
      </button>
      {!primary.allowed && primary.blockedReason && (
        <p className="text-[11px] text-destructive ml-1">
          {primary.blockedReason}
        </p>
      )}

      {display.secondaryCandidates.length > 0 && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setMoreOutputsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
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
                    onClick={() => void openCandidate(candidate, false)}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors",
                      candidate.allowed
                        ? "border-border bg-accent text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                        : "cursor-not-allowed border-red-500/20 bg-red-500/[0.03] text-red-500/70",
                    )}
                    disabled={!candidate.allowed}
                    title={candidate.resolvedPath}
                  >
                    <FolderOpen className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {kindLabel[candidate.kind] ?? "Open"}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {candidate.rawPath || candidate.resolvedPath}
                    </span>
                    {candidate.confidence === "low" && (
                      <span className="text-[10px] text-muted-foreground/70 italic">
                        detected
                      </span>
                    )}
                  </button>
                  {!candidate.allowed && candidate.blockedReason && (
                    <p className="text-[11px] text-destructive">
                      {candidate.blockedReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {openError && <p className="text-[11px] text-destructive">{openError}</p>}
    </div>
  );
}

export function ToolCallAdapter({
  name,
  arguments: args,
  status,
  result,
  isError,
}: ToolCallAdapterProps) {
  const elapsed = useElapsedTime(status);
  const state = toolStatusMap[status];

  const elapsedSeconds =
    status === "executing" && elapsed >= 3 ? elapsed : undefined;

  return (
    <div>
      <Tool>
        <ToolHeader
          type="dynamic-tool"
          toolName={name}
          title={name}
          state={state}
          showIcon={false}
          elapsedSeconds={elapsedSeconds}
        />
        <ToolContent>
          {Object.keys(args).length > 0 && <ToolInput input={args} />}
          <ToolOutput
            output={isError ? undefined : result}
            errorText={isError ? result : undefined}
          />
        </ToolContent>
      </Tool>
      <ArtifactActions args={args} name={name} result={result} />
    </div>
  );
}
