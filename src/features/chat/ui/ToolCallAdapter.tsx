import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { FolderOpen, ArrowUpRight, ChevronDownIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import {
  Tool,
  ToolInput,
  ToolOutput,
  getStatusBadge,
} from "@/shared/ui/ai-elements/tool";
import { CollapsibleTrigger } from "@/shared/ui/collapsible";
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
  displayLabel?: string;
  displayVerb?: string;
  displayDetail?: string;
  flat?: boolean;
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

function getFileName(pathStr: string): string {
  const segments = pathStr.split("/");
  return segments[segments.length - 1] || pathStr;
}

function ArtifactActions({
  args,
  name,
  result,
  inline,
  children,
}: {
  args: Record<string, unknown>;
  name: string;
  result?: string;
  inline?: boolean;
  children?: React.ReactNode;
}) {
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

  const allCandidates = [
    display.primaryCandidate,
    ...display.secondaryCandidates,
  ];

  if (inline) {
    const primary = display.primaryCandidate;
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void openCandidate(primary, true);
          }}
          className={cn(
            "inline-flex items-center gap-1",
            primary.allowed
              ? "text-muted-foreground hover:text-foreground"
              : "cursor-not-allowed text-red-500/50",
          )}
          disabled={!primary.allowed}
          title={primary.resolvedPath}
        >
          {children}
          <ArrowUpRight className="h-3 w-3" />
        </button>
        {openError && (
          <p className="text-[11px] text-destructive whitespace-nowrap">
            {openError}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {allCandidates.map((candidate, i) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => void openCandidate(candidate, i === 0)}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] transition-colors",
              candidate.allowed
                ? "text-muted-foreground hover:text-foreground"
                : "cursor-not-allowed text-red-500/50",
            )}
            disabled={!candidate.allowed}
            title={candidate.resolvedPath}
          >
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span className="truncate underline underline-offset-2 decoration-border">
              {getFileName(candidate.rawPath || candidate.resolvedPath)}
            </span>
          </button>
        ))}
      </div>
      {openError && <p className="text-[11px] text-destructive">{openError}</p>}
    </div>
  );
}

function FlatFileLabel({
  title,
  args,
  name,
  result,
  statusBadge,
}: {
  title: string;
  args: Record<string, unknown>;
  name: string;
  result?: string;
  statusBadge: React.ReactNode;
}) {
  const { resolveToolCardDisplay } = useArtifactPolicyContext();
  const display = useMemo(
    () => resolveToolCardDisplay(args, name, result),
    [args, name, resolveToolCardDisplay, result],
  );
  const hasArtifact =
    display.role === "primary_host" && display.primaryCandidate;

  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      {hasArtifact ? (
        <ArtifactActions args={args} name={name} result={result} inline>
          <span className="text-xs">{title}</span>
        </ArtifactActions>
      ) : (
        <span className="text-xs">{title}</span>
      )}
      {statusBadge}
    </div>
  );
}

export function ToolCallAdapter({
  name,
  arguments: args,
  status,
  result,
  isError,
  displayLabel,
  displayVerb,
  displayDetail,
  flat,
}: ToolCallAdapterProps) {
  const elapsed = useElapsedTime(status);
  const [isOpen, setIsOpen] = useState(false);
  const state = toolStatusMap[status];

  const baseTitle = displayLabel ?? name;
  const title =
    status === "executing" && elapsed >= 3
      ? `${baseTitle} (${elapsed}s)`
      : baseTitle;

  if (flat) {
    return (
      <div className="w-full">
        <div className="space-y-2">
          {Object.keys(args).length > 0 && <ToolInput input={args} />}
          <ToolOutput
            output={isError ? undefined : result}
            errorText={isError ? result : undefined}
            hideLabel
          />
        </div>
        <div className="pt-0.5">
          <FlatFileLabel
            title={title}
            args={args}
            name={name}
            result={result}
            statusBadge={getStatusBadge(state)}
          />
        </div>
      </div>
    );
  }

  const verb = displayVerb;
  const fileDetail = displayDetail;

  return (
    <LayoutGroup>
      <div className="relative w-full">
        <Tool open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <motion.button
              layout
              type="button"
              className="flex w-full items-center gap-1.5 py-px text-muted-foreground"
              transition={{ duration: 0.15 }}
            >
              <motion.span
                layout="position"
                transition={{ duration: 0.15 }}
                className="font-medium text-sm"
              >
                {verb ?? title}
              </motion.span>
              <AnimatePresence mode="popLayout">
                {!isOpen && fileDetail && (
                  <motion.span
                    key="file-detail"
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="font-medium text-sm"
                  >
                    {fileDetail}
                  </motion.span>
                )}
              </AnimatePresence>
              {getStatusBadge(state)}
              <motion.div
                layout="position"
                animate={{ rotate: isOpen ? 0 : -90 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronDownIcon className="size-3.5 text-muted-foreground" />
              </motion.div>
            </motion.button>
          </CollapsibleTrigger>
        </Tool>
        {isOpen && (
          <div className="ml-[7px] mt-1 border-l border-border py-3 pl-4 animate-in slide-in-from-top-2 fade-in-0 duration-200">
            <div className="space-y-4">
              {Object.keys(args).length > 0 && <ToolInput input={args} />}
              <ToolOutput
                output={isError ? undefined : result}
                errorText={isError ? result : undefined}
                hideLabel
              />
            </div>
            <FlatFileLabel
              title={fileDetail ?? title}
              args={args}
              name={name}
              result={result}
              statusBadge={fileDetail ? null : getStatusBadge(state)}
            />
          </div>
        )}
      </div>
    </LayoutGroup>
  );
}
