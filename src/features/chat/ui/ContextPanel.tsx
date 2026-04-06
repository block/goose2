import { useState } from "react";
import {
  IconFolder,
  IconGitBranch,
  IconRefresh,
  IconServer,
  IconFileCode,
  IconActivity,
  IconPuzzle2,
} from "@tabler/icons-react";
import { FilesList } from "./FilesList";
import { useGitState } from "@/shared/hooks/useGitState";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { WidgetCard } from "@/features/widgets/ui/WidgetCard";
import { WidgetFrame } from "@/features/widgets/ui/WidgetFrame";
import { useWidgets } from "@/features/widgets/hooks/useWidgets";

interface ContextPanelProps {
  projectName?: string;
  projectColor?: string;
  projectWorkingDirs?: string[];
}

type ContextPanelTab = "details" | "files";

export function ContextPanel({
  projectName,
  projectColor,
  projectWorkingDirs = [],
}: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<ContextPanelTab>("details");
  const primaryWorkingDir = projectWorkingDirs[0] ?? null;
  const {
    data: gitState,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGitState(primaryWorkingDir, activeTab === "details");

  const { widgets: dynamicWidgets } = useWidgets(
    "context-panel",
    projectWorkingDir,
  );

  const gitErrorMessage =
    error instanceof Error ? error.message : "Unable to read git status.";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as ContextPanelTab)}
      className="flex h-full min-w-0 flex-1 flex-col"
    >
      <div className="shrink-0 border-b border-border px-3 pb-2 pt-2.5">
        <TabsList variant="buttons">
          <TabsTrigger value="details" variant="buttons">
            Details
          </TabsTrigger>
          <TabsTrigger value="files" variant="buttons">
            Files
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="details" className="flex-1 overflow-y-auto">
        <div className="space-y-2.5 px-3 pb-3 pt-2">
          <WidgetCard
            title="Workspace"
            icon={<IconFolder className="size-3.5" />}
            action={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => void refetch()}
                disabled={!primaryWorkingDir || isFetching}
                className="rounded-md"
                aria-label="Refresh git status"
                title="Refresh git status"
              >
                {isFetching ? (
                  <Spinner className="size-3" />
                ) : (
                  <IconRefresh className="size-3" />
                )}
              </Button>
            }
          >
            <div className="space-y-2 px-3 py-2.5">
              {projectName ? (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
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
                <p className="text-foreground-subtle">No project assigned.</p>
              )}
              {projectWorkingDirs.length > 0 ? (
                projectWorkingDirs.map((dir) => (
                  <p key={dir} className="truncate">
                    {dir}
                  </p>
                ))
              ) : (
                <p className="truncate">Folder not set</p>
              )}

              {!primaryWorkingDir ? null : isLoading && !gitState ? (
                <div className="flex items-center gap-2 text-foreground">
                  <Spinner className="size-3.5" />
                  <span>Loading git status…</span>
                </div>
              ) : error ? (
                <p className="text-destructive">{gitErrorMessage}</p>
              ) : gitState?.isGitRepo ? (
                <div className="space-y-1 border-t border-border pt-2">
                  {gitState.worktrees.map((wt) => (
                    <div
                      key={wt.path}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-1.5 text-foreground">
                        <IconGitBranch className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {wt.branch ?? "detached"}
                        </span>
                      </div>
                      {wt.isMain ? (
                        <Badge variant="outline" className="text-[10px]">
                          Main
                        </Badge>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p>Not a git repository.</p>
              )}
            </div>
          </WidgetCard>

          <WidgetCard
            title="Changes"
            icon={<IconFileCode className="size-3.5" />}
          >
            <p className="px-3 py-2.5 text-foreground-subtle">No changes</p>
          </WidgetCard>

          <WidgetCard
            title="MCP Servers"
            icon={<IconServer className="size-3.5" />}
          >
            <p className="px-3 py-2.5 text-foreground-subtle">
              No servers configured
            </p>
          </WidgetCard>

          <WidgetCard
            title="Processes"
            icon={<IconActivity className="size-3.5" />}
          >
            <p className="px-3 py-2.5 text-foreground-subtle">
              No active processes
            </p>
          </WidgetCard>

          {dynamicWidgets.map((manifest) => (
            <WidgetCard
              key={manifest.id}
              title={manifest.name}
              icon={<IconPuzzle2 className="size-3.5" />}
            >
              <WidgetFrame manifest={manifest} />
            </WidgetCard>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="files" className="flex-1 overflow-y-auto">
        <FilesList />
      </TabsContent>
    </Tabs>
  );
}
