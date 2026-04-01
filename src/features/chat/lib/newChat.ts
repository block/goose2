import type { Message } from "@/shared/types/messages";
import type { ChatSession } from "../stores/chatSessionStore";

interface NewChatRequest {
  title: string;
  projectId?: string;
  agentId?: string;
  providerId?: string;
  personaId?: string;
}

interface FindReusableNewChatSessionArgs {
  sessions: ChatSession[];
  activeTabId: string | null;
  openTabIds: string[];
  messagesBySession: Record<string, Message[]>;
  request: NewChatRequest;
}

function isMatchingContext(
  session: ChatSession,
  request: Omit<NewChatRequest, "title">,
): boolean {
  return (
    session.projectId === request.projectId &&
    session.agentId === request.agentId &&
    session.providerId === request.providerId &&
    session.personaId === request.personaId
  );
}

function isReusableNewChatSession(
  session: ChatSession,
  localMessages: Message[] | undefined,
): boolean {
  return (
    !session.archivedAt &&
    session.title === "New Chat" &&
    session.messageCount === 0 &&
    (localMessages?.length ?? 0) === 0
  );
}

export function findReusableNewChatSession({
  sessions,
  activeTabId,
  openTabIds,
  messagesBySession,
  request,
}: FindReusableNewChatSessionArgs): ChatSession | undefined {
  if (request.title !== "New Chat") {
    return undefined;
  }

  const openTabIdSet = new Set(openTabIds);
  const matchingSessions = sessions.filter(
    (session) =>
      (session.id === activeTabId || openTabIdSet.has(session.id)) &&
      isMatchingContext(session, request) &&
      isReusableNewChatSession(session, messagesBySession[session.id]),
  );

  if (matchingSessions.length === 0) {
    return undefined;
  }

  return (
    matchingSessions.find((session) => session.id === activeTabId) ??
    matchingSessions.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0]
  );
}
