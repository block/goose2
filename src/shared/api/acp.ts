import { invoke } from "@tauri-apps/api/core";

export interface AcpProvider {
  id: string;
  label: string;
}

export interface AcpSendMessageOptions {
  systemPrompt?: string;
  workingDir?: string;
  personaId?: string;
  personaName?: string;
  /** Image attachments as [base64Data, mimeType] pairs. */
  images?: [string, string][];
  skipUserMessage?: boolean;
}

/** Discover ACP providers installed on the system. */
export async function discoverAcpProviders(): Promise<AcpProvider[]> {
  return invoke("discover_acp_providers");
}

/** Send a message to an ACP agent. Response streams via Tauri events. */
export async function acpSendMessage(
  sessionId: string,
  providerId: string,
  prompt: string,
  options: AcpSendMessageOptions = {},
): Promise<void> {
  const {
    systemPrompt,
    workingDir,
    personaId,
    personaName,
    images,
    skipUserMessage,
  } = options;
  return invoke("acp_send_message", {
    sessionId,
    providerId,
    prompt,
    systemPrompt: systemPrompt ?? null,
    workingDir: workingDir ?? null,
    personaId: personaId ?? null,
    personaName: personaName ?? null,
    images: images ?? [],
    skipUserMessage: skipUserMessage ?? null,
  });
}

/** Cancel an in-progress ACP session so the backend stops streaming. */
export async function acpCancelSession(
  sessionId: string,
  personaId?: string,
): Promise<boolean> {
  return invoke("acp_cancel_session", {
    sessionId,
    personaId: personaId ?? null,
  });
}
