import type { Message } from "@/shared/types/messages";

interface ParsedImport {
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

export function parseImportedSession(jsonString: string): ParsedImport {
  const data = JSON.parse(jsonString);

  // Goose2 export format (has version field)
  if (data.version || (data.session && data.messages)) {
    const messages = data.messages;
    if (!Array.isArray(messages)) {
      throw new Error("Invalid session file: missing messages");
    }
    return {
      session: {
        title: data.session?.title ?? "Imported Session",
        createdAt: data.session?.createdAt ?? new Date().toISOString(),
        updatedAt: data.session?.updatedAt ?? new Date().toISOString(),
        messageCount: messages.length,
        projectId: data.session?.projectId,
        personaId: data.session?.personaId,
        providerId: data.session?.providerId,
        modelName: data.session?.modelName,
        userSetName: data.session?.userSetName,
      },
      messages,
    };
  }

  // OG goose format (has name + conversation fields)
  if (data.conversation || data.name) {
    const messages = data.conversation ?? [];
    if (!Array.isArray(messages)) {
      throw new Error("Invalid session file: missing messages");
    }
    return {
      session: {
        title: data.name ?? "Imported Session",
        createdAt: data.created_at ?? new Date().toISOString(),
        updatedAt: data.updated_at ?? new Date().toISOString(),
        messageCount: messages.length,
      },
      messages,
    };
  }

  throw new Error("Invalid session file: missing messages");
}
