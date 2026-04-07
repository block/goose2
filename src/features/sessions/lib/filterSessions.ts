import type { ChatSession } from "@/features/chat/stores/chatSessionStore";

export interface FilterResolvers {
  getPersonaName: (personaId: string) => string | undefined;
  getProjectName: (projectId: string) => string | undefined;
}

function buildSearchableString(
  session: ChatSession,
  resolvers: FilterResolvers,
): string {
  const parts: string[] = [session.title];

  if (session.personaId) {
    const name = resolvers.getPersonaName(session.personaId);
    if (name) parts.push(name);
  }

  if (session.projectId) {
    const name = resolvers.getProjectName(session.projectId);
    if (name) parts.push(name);
  }

  const date = new Date(session.updatedAt);
  parts.push(
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  );

  return parts.join(" ").toLowerCase();
}

export function filterSessions(
  sessions: ChatSession[],
  query: string,
  resolvers: FilterResolvers,
): ChatSession[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return sessions;

  return sessions.filter((session) =>
    buildSearchableString(session, resolvers).includes(trimmed),
  );
}
