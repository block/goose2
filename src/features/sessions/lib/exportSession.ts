import type { Message } from "@/shared/types/messages";

export interface ExportedSession {
  version: 1;
  exportedAt: string;
  session: {
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    projectId?: string | null;
    personaId?: string;
    providerId?: string;
    modelName?: string;
    userSetName?: boolean;
  };
  messages: Message[];
}

interface SessionMetadata {
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  projectId?: string | null;
  personaId?: string;
  providerId?: string;
  modelName?: string;
  userSetName?: boolean;
}

export function buildExportPayload(
  session: SessionMetadata,
  messages: Message[],
): string {
  const exported: ExportedSession = {
    version: 1,
    exportedAt: new Date().toISOString(),
    session: {
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount,
      ...(session.projectId != null && { projectId: session.projectId }),
      ...(session.personaId && { personaId: session.personaId }),
      ...(session.providerId && { providerId: session.providerId }),
      ...(session.modelName && { modelName: session.modelName }),
      ...(session.userSetName != null && {
        userSetName: session.userSetName,
      }),
    },
    messages,
  };

  return JSON.stringify(exported, null, 2);
}

export function defaultExportFilename(title: string): string {
  const sanitized = title
    .trim()
    .replaceAll(/[<>:"/\\|?*]/g, "-")
    .replaceAll(/[\r\n\t]/g, "-")
    .split("")
    .map((char) => (char < " " ? "-" : char))
    .join("")
    .replace(/\s+/g, " ")
    .slice(0, 120);

  return `${sanitized || "session"}.json`;
}

export function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
