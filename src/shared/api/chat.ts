import { invoke } from "@tauri-apps/api/core";
import type { Message } from "@/shared/types/messages";
import type { Session } from "@/shared/types/chat";

export async function createSession(
  agentId?: string,
  projectId?: string,
): Promise<Session> {
  return invoke("create_session", { agentId, projectId });
}

export async function listSessions(): Promise<Session[]> {
  return invoke("list_sessions");
}

export async function listArchivedSessions(): Promise<Session[]> {
  return invoke("list_archived_sessions");
}

export async function getSessionMessages(
  sessionId: string,
): Promise<Message[]> {
  return invoke("get_session_messages", { sessionId });
}

export async function sendMessage(
  sessionId: string,
  message: Message,
): Promise<Message> {
  return invoke("chat_send_message", { sessionId, message });
}

export async function updateSession(
  sessionId: string,
  update: {
    title?: string;
    providerId?: string;
    personaId?: string;
    modelName?: string;
    projectId?: string | null;
  },
): Promise<void> {
  return invoke("update_session", { sessionId, update });
}

export async function deleteSession(sessionId: string): Promise<void> {
  return invoke("delete_session", { sessionId });
}

export async function archiveSession(sessionId: string): Promise<void> {
  return invoke("archive_session", { sessionId });
}

export async function unarchiveSession(sessionId: string): Promise<void> {
  return invoke("unarchive_session", { sessionId });
}
