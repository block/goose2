import { invoke } from "@tauri-apps/api/core";

export async function getHomeDir(): Promise<string> {
  return invoke("get_home_dir");
}

export async function saveExportedSessionFile(
  defaultFilename: string,
  contents: string,
): Promise<string | null> {
  return invoke("save_exported_session_file", { defaultFilename, contents });
}

export async function pathExists(path: string): Promise<boolean> {
  return invoke("path_exists", { path });
}
