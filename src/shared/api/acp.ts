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
}

export interface AcpPrepareSessionOptions {
  workingDir?: string;
  personaId?: string;
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
  const { systemPrompt, workingDir, personaId, personaName, images } = options;
  return invoke("acp_send_message", {
    sessionId,
    providerId,
    prompt,
    systemPrompt: systemPrompt ?? null,
    workingDir: workingDir ?? null,
    personaId: personaId ?? null,
    personaName: personaName ?? null,
    images: images ?? [],
  });
}

/** Prepare or warm an ACP session ahead of the first prompt. */
export async function acpPrepareSession(
  sessionId: string,
  providerId: string,
  options: AcpPrepareSessionOptions = {},
): Promise<void> {
  const { workingDir, personaId } = options;
  return invoke("acp_prepare_session", {
    sessionId,
    providerId,
    workingDir: workingDir ?? null,
    personaId: personaId ?? null,
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
