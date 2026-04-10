import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilesList } from "./FilesList";
import { useGitState } from "@/shared/hooks/useGitState";
import { switchBranch } from "@/shared/api/git";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useChatSessionStore } from "../stores/chatSessionStore";
import type { WorkingContext } from "../stores/chatSessionStore";
import { WorkspaceWidget } from "./widgets/WorkspaceWidget";
import { ChangesWidget } from "./widgets/ChangesWidget";
import { McpServersWidget } from "./widgets/McpServersWidget";
import { ProcessesWidget } from "./widgets/ProcessesWidget";

interface ContextPanelProps {
  sessionId: string;
  projectName?: string;
  projectColor?: string;
  projectWorkingDirs?: string[];
}

type ContextPanelTab = "details" | "files";

export function ContextPanel({
  sessionId,
  projectName,
  projectColor,
  projectWorkingDirs = [],
}: ContextPanelProps) {
  const { t } = useTranslation("chat");
  const [activeTab, setActiveTab] = useState<ContextPanelTab>("details");
  const primaryWorkingDir = projectWorkingDirs[0] ?? null;

  const activeContext = useChatSessionStore(
    (s) => s.activeWorkingContextBySession[sessionId],
  );
  const setActiveWorkingContext = useChatSessionStore(
    (s) => s.setActiveWorkingContext,
  );

  const {
    data: gitState,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGitState(primaryWorkingDir, activeTab === "details");

  const handleContextChange = useCallback(
    (context: WorkingContext) => {
      setActiveWorkingContext(sessionId, context);
    },
    [sessionId, setActiveWorkingContext],
  );

  const handleSwitchBranch = useCallback(
    async (path: string, branch: string) => {
      await switchBranch(path, branch);
      await refetch();
    },
    [refetch],
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as ContextPanelTab)}
      className="flex h-full min-w-0 flex-1 flex-col"
    >
      <div className="shrink-0 border-b border-border px-3 pb-2 pt-2.5">
        <TabsList variant="buttons">
          <TabsTrigger value="details" variant="buttons">
            {t("contextPanel.tabs.details")}
          </TabsTrigger>
          <TabsTrigger value="files" variant="buttons">
            {t("contextPanel.tabs.files")}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="details" className="flex-1 overflow-y-auto">
        <div className="space-y-2.5 px-3 pb-3 pt-2">
          <WorkspaceWidget
            projectName={projectName}
            projectColor={projectColor}
            projectWorkingDirs={projectWorkingDirs}
            gitState={gitState}
            isLoading={isLoading}
            isFetching={isFetching}
            error={error}
            activeContext={activeContext}
            onContextChange={handleContextChange}
            onSwitchBranch={handleSwitchBranch}
            onRefresh={() => void refetch()}
          />
          <ChangesWidget />
          <McpServersWidget />
          <ProcessesWidget />
        </div>
      </TabsContent>

      <TabsContent value="files" className="flex-1 overflow-y-auto">
        <FilesList />
      </TabsContent>
    </Tabs>
  );
}
