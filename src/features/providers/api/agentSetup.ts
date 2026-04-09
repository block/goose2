import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface AgentSetupOutput {
  providerId: string;
  line: string;
}

export async function checkAgentInstalled(
  providerId: string,
): Promise<boolean> {
  const t0 = performance.now();
  const result = await invoke<boolean>("check_agent_installed", { providerId });
  console.log(
    `[model-debug] checkAgentInstalled(${providerId}) = ${result} in ${(performance.now() - t0).toFixed(0)}ms`,
  );
  return result;
}

export async function checkAgentAuth(providerId: string): Promise<boolean> {
  const t0 = performance.now();
  const result = await invoke<boolean>("check_agent_auth", { providerId });
  console.log(
    `[model-debug] checkAgentAuth(${providerId}) = ${result} in ${(performance.now() - t0).toFixed(0)}ms`,
  );
  return result;
}

export async function installAgent(providerId: string): Promise<void> {
  return invoke("install_agent", { providerId });
}

export async function authenticateAgent(providerId: string): Promise<void> {
  return invoke("authenticate_agent", { providerId });
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
