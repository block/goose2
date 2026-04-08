import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDisplaySessionTitle } from "@/features/chat/lib/sessionTitle";
import { SearchBar } from "@/shared/ui/SearchBar";
import { Button } from "@/shared/ui/button";
import { SessionCard } from "./SessionCard";
import { groupSessionsByDate } from "../lib/groupSessionsByDate";
import { filterSessions } from "../lib/filterSessions";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import type { ChatSession } from "@/features/chat/stores/chatSessionStore";

interface SessionHistoryViewProps {
  onSelectSession?: (sessionId: string) => void;
  onRenameChat?: (sessionId: string, nextTitle: string) => void;
  onArchiveChat?: (sessionId: string) => void;
}

export function SessionHistoryView({
  onSelectSession,
  onRenameChat,
  onArchiveChat,
}: SessionHistoryViewProps) {
  const { t, i18n } = useTranslation(["sessions", "common"]);
  const sessions = useChatSessionStore((s) => s.sessions);
  const activeSessions = useMemo(
    () => sessions.filter((session) => !session.draft),
    [sessions],
  );
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  const loadArchived = useCallback(() => {
    // TODO: Wire to ACP when archived sessions are supported
    // For now, archived sessions aren't persisted to the backend
    setArchivedSessions([]);
  }, []);

  useEffect(loadArchived, [loadArchived]);

  const displaySessions = showArchived ? archivedSessions : activeSessions;

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
  const filtered = filterSessions(displaySessions, search, resolvers, {
    locale: i18n.resolvedLanguage,
    getDisplayTitle: (session) =>
      getDisplaySessionTitle(session.title, t("common:session.defaultTitle")),
  });
  const dateGroups = groupSessionsByDate(filtered, {
    locale: i18n.resolvedLanguage,
    todayLabel: t("dateGroups.today"),
    yesterdayLabel: t("dateGroups.yesterday"),
  });

  const handleUnarchive = useCallback(
    async (sessionId: string) => {
      try {
        await useChatSessionStore.getState().unarchiveSession(sessionId);
        loadArchived();
      } catch {
        // best-effort
      }
    },
    [loadArchived],
  );

  const handleArchive = useCallback(
    async (sessionId: string) => {
      onArchiveChat?.(sessionId);
      // Refresh archived list after a short delay so the backend has time to persist
      setTimeout(loadArchived, 300);
    },
    [onArchiveChat, loadArchived],
  );

  const emptyLabel = showArchived
    ? t("history.emptyArchived")
    : t("history.emptyTitle");
  const emptyHint = showArchived
    ? t("history.emptyArchivedHint")
    : t("history.emptyHint");

  return (
    <div className="flex flex-1 flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-5 page-transition">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold font-display tracking-tight">
                {showArchived ? t("history.archivedTitle") : t("history.title")}
              </h1>
              <p className="text-xs text-muted-foreground">
                {showArchived
                  ? t("history.archivedSubtitle")
                  : t("history.subtitle")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost-light"
              size="xs"
              onClick={() => {
                setShowArchived((prev) => !prev);
                setSearch("");
              }}
            >
              <Archive className="size-3.5" />
              {showArchived
                ? t("history.backToActive")
                : t("history.toggleArchived")}
            </Button>
          </div>

          {/* Search */}
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={
              showArchived
                ? t("history.searchArchivedPlaceholder")
                : t("history.searchPlaceholder")
            }
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
                      onRename={onRenameChat}
                      onArchive={handleArchive}
                      onUnarchive={handleUnarchive}
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
                  {displaySessions.length === 0
                    ? emptyLabel
                    : t("history.emptyNoMatches")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {displaySessions.length === 0
                    ? emptyHint
                    : t("history.emptyNoMatchesHint")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
