import { invoke } from "@tauri-apps/api/core";

let cachedBaseUrl: string | null = null;
let cachedSecretKey: string | null = null;

async function getServerConfig(): Promise<{
  baseUrl: string;
  secretKey: string;
}> {
  if (cachedBaseUrl && cachedSecretKey) {
    return { baseUrl: cachedBaseUrl, secretKey: cachedSecretKey };
  }

  const url = await invoke<string | null>("get_sidecar_url");
  const secret = await invoke<string | null>("get_sidecar_secret");

  if (!url || !secret) {
    throw new Error("Sidecar not running");
  }

  cachedBaseUrl = url;
  cachedSecretKey = secret;
  return { baseUrl: url, secretKey: secret };
}

export function clearServerConfigCache(): void {
  cachedBaseUrl = null;
  cachedSecretKey = null;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const { baseUrl, secretKey } = await getServerConfig();

  const headers = new Headers(options.headers);
  headers.set("X-Secret-Key", secretKey);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${baseUrl}${path}`, { ...options, headers });
}
