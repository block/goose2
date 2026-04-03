import { type ReactNode, useState } from "react";
import {
  Activity,
  FileCode,
  FileText,
  FolderOpen,
  GitBranch,
  RefreshCw,
  Server,
} from "lucide-react";
import { useGitState } from "@/shared/hooks/useGitState";
import { Badge } from "@/shared/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

interface ContextPanelProps {
  projectName?: string;
  projectColor?: string;
  projectWorkingDir?: string | null;
}

type ContextPanelTab = "details" | "files";

function PanelSection({
  value,
  title,
  icon,
  children,
}: {
  value: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="px-4 py-2.5 text-xs font-medium hover:bg-background-secondary/60 hover:no-underline">
        <span className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-3">{children}</AccordionContent>
    </AccordionItem>
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
  const [activeTab, setActiveTab] = useState<ContextPanelTab>("details");
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
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as ContextPanelTab)}
      className="h-full"
    >
      <div className="border-b border-border px-3 pb-2 pt-2.5">
        <TabsList variant="buttons">
          <TabsTrigger value="details" variant="buttons">
            Details
          </TabsTrigger>
          <TabsTrigger value="files" variant="buttons">
            Files
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="details">
        <div className="h-full overflow-y-auto">
          <Accordion
            type="multiple"
            defaultValue={["workspace", "processes", "changes", "mcpServers"]}
          >
            <PanelSection
              value="workspace"
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
              value="processes"
              title="Processes"
              icon={<Activity className="h-3.5 w-3.5" />}
            >
              <p className="text-xs text-foreground-secondary">
                Not wired yet in goose2: running/background process state and
                stop actions.
              </p>
            </PanelSection>

            <PanelSection
              value="changes"
              title="Changes"
              icon={<FileCode className="h-3.5 w-3.5" />}
            >
              <p className="text-xs text-foreground-secondary">
                Not wired yet in goose2: git file changes and diff counts.
              </p>
            </PanelSection>

            <PanelSection
              value="mcpServers"
              title="MCP Servers"
              icon={<Server className="h-3.5 w-3.5" />}
            >
              <p className="text-xs text-foreground-secondary">
                Not wired yet in goose2: configured MCP server discovery and
                status.
              </p>
            </PanelSection>
          </Accordion>
        </div>
      </TabsContent>

      <TabsContent value="files">
        <div className="h-full overflow-y-auto">
          <div className="px-4 pb-4 pt-3">
            <div className="flex items-center gap-2 text-xs text-foreground-secondary">
              <FileText className="h-3.5 w-3.5" />
              <span>Files for this session</span>
            </div>
            <p className="mt-2 text-xs text-foreground-secondary">
              Not wired yet in goose2: artifact list and file opening behavior.
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
