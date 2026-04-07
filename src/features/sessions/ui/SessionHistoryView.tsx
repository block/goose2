import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { SearchBar } from "@/shared/ui/SearchBar";
import { SessionCard } from "./SessionCard";
import { groupSessionsByDate } from "../lib/groupSessionsByDate";
import { filterSessions } from "../lib/filterSessions";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import { listArchivedSessions } from "@/shared/api/chat";
import type { ChatSession } from "@/features/chat/stores/chatSessionStore";

interface SessionHistoryViewProps {
  onSelectSession?: (sessionId: string) => void;
}

export function SessionHistoryView({
  onSelectSession,
}: SessionHistoryViewProps) {
  const activeSessions = useChatSessionStore((s) =>
    s.sessions.filter((session) => !session.draft),
  );
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listArchivedSessions()
      .then((sessions) =>
        setArchivedSessions(
          sessions.map((s) => ({
            id: s.id,
            title: s.title,
            projectId: s.projectId,
            agentId: s.agentId,
            providerId: s.providerId,
            personaId: s.personaId,
            modelName: s.modelName,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            archivedAt: s.archivedAt,
            messageCount: s.messageCount,
            userSetName: s.userSetName,
          })),
        ),
      )
      .catch(() => setArchivedSessions([]));
  }, []);

  const allSessions = [...activeSessions, ...archivedSessions];

  const getPersonaName = useCallback(
    (personaId: string) =>
      useAgentStore.getState().getPersonaById(personaId)?.displayName,
    [],
  );

  const projects = useProjectStore((s) => s.projects);
  const getProjectName = useCallback(
    (projectId: string) => projects.find((p) => p.id === projectId)?.name,
    [projects],
  );

  const getProjectColor = useCallback(
    (projectId: string) => projects.find((p) => p.id === projectId)?.color,
    [projects],
  );

  const getWorkingDir = useCallback(
    (projectId: string) =>
      projects.find((p) => p.id === projectId)?.workingDirs[0],
    [projects],
  );

  const resolvers = { getPersonaName, getProjectName };
  const filtered = filterSessions(allSessions, search, resolvers);
  const dateGroups = groupSessionsByDate(filtered);

  return (
    <div className="flex flex-1 flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-5 page-transition">
          {/* Header */}
          <div>
            <h1 className="text-lg font-semibold font-display tracking-tight">
              Session History
            </h1>
            <p className="text-xs text-muted-foreground">
              Browse and search past sessions
            </p>
          </div>

          {/* Search */}
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search sessions by title, persona, or project..."
          />

          {/* Session cards grouped by date */}
          {dateGroups.length > 0 &&
            dateGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1 z-10">
                  {group.label}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {group.sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      id={session.id}
                      title={session.title}
                      updatedAt={session.updatedAt}
                      messageCount={session.messageCount}
                      personaName={
                        session.personaId
                          ? getPersonaName(session.personaId)
                          : undefined
                      }
                      projectName={
                        session.projectId
                          ? getProjectName(session.projectId)
                          : undefined
                      }
                      projectColor={
                        session.projectId
                          ? getProjectColor(session.projectId)
                          : undefined
                      }
                      workingDir={
                        session.projectId
                          ? getWorkingDir(session.projectId)
                          : undefined
                      }
                      archivedAt={session.archivedAt}
                      onSelect={onSelectSession}
                    />
                  ))}
                </div>
              </div>
            ))}

          {/* Empty state */}
          {dateGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <History className="h-10 w-10 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {allSessions.length === 0
                    ? "No sessions yet"
                    : "No matching sessions"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {allSessions.length === 0
                    ? "Start a chat to see it here."
                    : "Try a different search term."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
