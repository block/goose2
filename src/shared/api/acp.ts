import { invoke } from "@tauri-apps/api/core";

export interface AcpProvider {
  id: string;
  label: string;
  binaryPath: string;
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
): Promise<void> {
  return invoke("acp_send_message", {
    sessionId,
    providerId,
    prompt,
  });
}
