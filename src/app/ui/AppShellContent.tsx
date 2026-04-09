import { HomeScreen } from "@/features/home/ui/HomeScreen";
import { ChatView } from "@/features/chat/ui/ChatView";
import { SkillsView } from "@/features/skills/ui/SkillsView";
import { AgentsView } from "@/features/agents/ui/AgentsView";
import { ProjectsView } from "@/features/projects/ui/ProjectsView";
import { SessionHistoryView } from "@/features/sessions/ui/SessionHistoryView";
import type { ChatSession } from "@/features/chat/stores/chatSessionStore";
import type { PastedImage } from "@/shared/types/messages";
import type { ProjectInfo } from "@/features/projects/api/projects";
import type { AppView } from "../AppShell";

interface AppShellContentProps {
  activeView: AppView;
  activeSession?: ChatSession;
  activeSessionPersonaId?: string;
  homeSelectedProvider?: string;
  homeSelectedPersonaId?: string;
  pendingInitialMessage?: string;
  pendingInitialImages?: PastedImage[];
  onArchiveChat: (sessionId: string) => Promise<void>;
  onCreateProject: (options?: {
    initialWorkingDir?: string | null;
    onCreated?: (projectId: string) => void;
  }) => void;
  onHomeStartChat: (
    initialMessage?: string,
    providerId?: string,
    personaId?: string,
    projectId?: string | null,
    images?: PastedImage[],
  ) => void;
  onInitialMessageConsumed: () => void;
  onRenameChat: (sessionId: string, nextTitle: string) => void;
  onSelectSession: (sessionId: string) => void;
  onStartChatFromProject: (project: ProjectInfo) => void;
}

export function AppShellContent({
  activeView,
  activeSession,
  activeSessionPersonaId,
  homeSelectedProvider,
  homeSelectedPersonaId,
  pendingInitialMessage,
  pendingInitialImages,
  onArchiveChat,
  onCreateProject,
  onHomeStartChat,
  onInitialMessageConsumed,
  onRenameChat,
  onSelectSession,
  onStartChatFromProject,
}: AppShellContentProps) {
  switch (activeView) {
    case "skills":
      return <SkillsView />;
    case "agents":
      return <AgentsView />;
    case "projects":
      return <ProjectsView onStartChat={onStartChatFromProject} />;
    case "session-history":
      return (
        <SessionHistoryView
          onSelectSession={onSelectSession}
          onRenameChat={onRenameChat}
          onArchiveChat={onArchiveChat}
        />
      );
    case "chat":
    case "home":
      return activeSession ? (
        <ChatView
          key={activeSession.id}
          sessionId={activeSession.id}
          initialProvider={homeSelectedProvider}
          initialPersonaId={activeSessionPersonaId ?? homeSelectedPersonaId}
          initialMessage={pendingInitialMessage}
          initialImages={pendingInitialImages}
          onCreateProject={onCreateProject}
          onInitialMessageConsumed={onInitialMessageConsumed}
        />
      ) : (
        <HomeScreen
          onStartChat={onHomeStartChat}
          onCreateProject={onCreateProject}
        />
      );
  }
}
