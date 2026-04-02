import { type ReactNode, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  FolderOpen,
  GitBranch,
  RefreshCw,
  Server,
} from "lucide-react";
import { useGitState } from "@/shared/hooks/useGitState";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";

interface ContextPanelProps {
  projectName?: string;
  projectColor?: string;
  projectWorkingDir?: string | null;
}

function PanelSection({
  title,
  count,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  return (
    <section className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors hover:bg-background-secondary/60"
      >
        <span className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </span>
        <span className="flex items-center gap-1.5 text-foreground-secondary">
          {count ? <span>{count}</span> : null}
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
      {isExpanded ? <div className="px-4 pb-3">{children}</div> : null}
    </section>
  );
}

function formatDirtyFileCount(count: number) {
  if (count === 0) {
    return "Clean";
  }

  return count === 1 ? "1 file changed" : `${count} files changed`;
}

export function ContextPanel({
  projectName,
  projectColor,
  projectWorkingDir,
}: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<"details" | "files">("details");
  const {
    data: gitState,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGitState(projectWorkingDir, activeTab === "details");

  const branchName = gitState?.currentBranch ?? "Detached HEAD";
  const dirtyLabel = gitState
    ? formatDirtyFileCount(gitState.dirtyFileCount)
    : null;
  const gitErrorMessage =
    error instanceof Error ? error.message : "Unable to read git status.";

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 pb-2 pt-2.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={activeTab === "details" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("details")}
            className="rounded-md"
          >
            Details
          </Button>
          <Button
            type="button"
            variant={activeTab === "files" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("files")}
            className="rounded-md"
          >
            Files
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "details" ? (
          <>
            <PanelSection
              title="Workspace"
              icon={<FolderOpen className="h-3.5 w-3.5" />}
            >
              <div className="space-y-3 text-xs text-foreground-secondary">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-2">
                    {projectName ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={
                            projectColor
                              ? { backgroundColor: projectColor }
                              : undefined
                          }
                        />
                        <span className="truncate text-foreground">
                          {projectName}
                        </span>
                      </div>
                    ) : (
                      <p>No project assigned.</p>
                    )}
                    <p className="truncate">
                      {projectWorkingDir
                        ? `Folder: ${projectWorkingDir}`
                        : "Folder not set"}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => void refetch()}
                    disabled={!projectWorkingDir || isFetching}
                    className="rounded-md"
                    aria-label="Refresh git status"
                    title="Refresh git status"
                  >
                    {isFetching ? (
                      <Spinner className="size-3" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                  </Button>
                </div>

                {!projectWorkingDir ? null : isLoading && !gitState ? (
                  <div className="flex items-center gap-2 text-foreground">
                    <Spinner className="size-3.5" />
                    <span>Loading git status...</span>
                  </div>
                ) : error ? (
                  <p className="text-destructive">{gitErrorMessage}</p>
                ) : gitState?.isGitRepo ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-foreground">
                        <GitBranch className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{branchName}</span>
                      </div>
                      <Badge variant="outline">
                        {gitState.isWorktree ? "Worktree" : "Main repo"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span>{dirtyLabel}</span>
                      <Badge
                        variant={
                          gitState.dirtyFileCount > 0 ? "secondary" : "outline"
                        }
                      >
                        {gitState.dirtyFileCount > 0 ? "Changed" : "Clean"}
                      </Badge>
                    </div>

                    {gitState.worktrees.length > 1 ? (
                      <p>{`${gitState.worktrees.length} worktrees detected`}</p>
                    ) : null}
                  </div>
                ) : (
                  <p>Not a git repository.</p>
                )}
              </div>
            </PanelSection>

            <PanelSection
              title="Processes"
              icon={<Activity className="h-3.5 w-3.5" />}
            >
              <p className="text-xs text-foreground-secondary">
                Not wired yet in goose2: running/background process state and
                stop actions.
              </p>
            </PanelSection>

            <PanelSection
              title="Changes"
              icon={<FileCode className="h-3.5 w-3.5" />}
            >
              <p className="text-xs text-foreground-secondary">
                Not wired yet in goose2: git file changes and diff counts.
              </p>
            </PanelSection>

            <PanelSection
              title="MCP Servers"
              icon={<Server className="h-3.5 w-3.5" />}
            >
              <p className="text-xs text-foreground-secondary">
                Not wired yet in goose2: configured MCP server discovery and
                status.
              </p>
            </PanelSection>
          </>
        ) : (
          <div className="px-4 pb-4 pt-3">
            <div className="flex items-center gap-2 text-xs text-foreground-secondary">
              <FileText className="h-3.5 w-3.5" />
              <span>Files for this session</span>
            </div>
            <p className="mt-2 text-xs text-foreground-secondary">
              Not wired yet in goose2: artifact list and file opening behavior.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
