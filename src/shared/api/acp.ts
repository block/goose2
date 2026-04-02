import { invoke } from "@tauri-apps/api/core";
import type { ModelOption, ModelSelectionSource } from "@/shared/types/chat";

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

export interface AcpModelState {
  source: ModelSelectionSource;
  configId?: string;
  currentModelId: string;
  currentModelName?: string;
  availableModels: ModelOption[];
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

/** Load or create an ACP session and return its model state. */
export async function acpGetModelState(
  sessionId: string,
  providerId: string,
  options: {
    personaId?: string;
    workingDir?: string;
    persistSession?: boolean;
  } = {},
): Promise<AcpModelState> {
  return invoke("acp_get_model_state", {
    sessionId,
    providerId,
    personaId: options.personaId ?? null,
    workingDir: options.workingDir ?? null,
    persistSession: options.persistSession ?? true,
  });
}

/** Set the active model for an existing ACP session. */
export async function acpSetModel(
  sessionId: string,
  providerId: string,
  modelId: string,
  options: {
    source?: ModelSelectionSource;
    configId?: string;
    personaId?: string;
    workingDir?: string;
  } = {},
): Promise<void> {
  return invoke("acp_set_model", {
    sessionId,
    providerId,
    modelId,
    source: options.source ?? "session_model",
    configId: options.configId ?? null,
    personaId: options.personaId ?? null,
    workingDir: options.workingDir ?? null,
  });
}
