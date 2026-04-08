import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface AgentSetupOutput {
  providerId: string;
  line: string;
}

export async function checkAgentInstalled(
  binaryName: string,
): Promise<boolean> {
  return invoke("check_agent_installed", { binaryName });
}

export async function checkAgentAuth(
  authStatusCommand: string,
): Promise<boolean> {
  return invoke("check_agent_auth", { authStatusCommand });
}

export async function installAgent(
  providerId: string,
  installCommand: string,
): Promise<void> {
  return invoke("install_agent", { providerId, installCommand });
}

export async function authenticateAgent(
  providerId: string,
  authCommand: string,
): Promise<void> {
  return invoke("authenticate_agent", { providerId, authCommand });
}

export function onAgentSetupOutput(
  providerId: string,
  callback: (line: string) => void,
): Promise<UnlistenFn> {
  return listen<AgentSetupOutput>("agent-setup:output", (event) => {
    if (event.payload.providerId === providerId) {
      callback(event.payload.line);
    }
  });
}
