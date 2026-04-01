import { invoke } from "@tauri-apps/api/core";

export async function getHomeDir(): Promise<string> {
  return invoke("get_home_dir");
}
