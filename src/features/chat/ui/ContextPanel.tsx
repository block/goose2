import { type ReactNode, useState } from "react";
import {
  IconFolder,
  IconGitBranch,
  IconRefresh,
  IconServer,
  IconFileCode,
  IconActivity,
} from "@tabler/icons-react";
import { FilesList } from "./FilesList";
import { useGitState } from "@/shared/hooks/useGitState";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

interface ContextPanelProps {
  projectName?: string;
  projectColor?: string;
  projectWorkingDirs?: string[];
}

type ContextPanelTab = "details" | "files";

function Widget({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex h-8 items-center justify-between bg-background-alt px-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          {icon}
          <span>{title}</span>
        </div>
        {action}
      </div>
      <div className="px-3 py-2.5 text-xs text-foreground-subtle">
        {children}
      </div>
    </div>
  );
}

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
          <Widget
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
            <div className="space-y-2">
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
          </Widget>

          <Widget title="Changes" icon={<IconFileCode className="size-3.5" />}>
            <p className="text-foreground-subtle">No changes</p>
          </Widget>

          <Widget
            title="MCP Servers"
            icon={<IconServer className="size-3.5" />}
          >
            <p className="text-foreground-subtle">No servers configured</p>
          </Widget>

          <Widget
            title="Processes"
            icon={<IconActivity className="size-3.5" />}
          >
            <p className="text-foreground-subtle">No active processes</p>
          </Widget>
        </div>
      </TabsContent>

      <TabsContent value="files" className="flex-1 overflow-y-auto">
        <FilesList />
      </TabsContent>
    </Tabs>
  );
}
