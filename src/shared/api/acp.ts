import { invoke } from "@tauri-apps/api/core";

export interface AcpProvider {
  id: string;
  label: string;
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
  systemPrompt?: string,
  workingDir?: string,
): Promise<void> {
  return invoke("acp_send_message", {
    sessionId,
    providerId,
    prompt,
    systemPrompt: systemPrompt ?? null,
    workingDir: workingDir ?? null,
  });
}

/** Cancel an in-progress ACP session so the backend stops streaming. */
export async function acpCancelSession(sessionId: string): Promise<boolean> {
  return invoke("acp_cancel_session", { sessionId });
}
