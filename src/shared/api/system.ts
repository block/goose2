import { invoke } from "@tauri-apps/api/core";

export async function getHomeDir(): Promise<string> {
  return invoke("get_home_dir");
}

export async function writeTextFile(
  path: string,
  contents: string,
): Promise<void> {
  return invoke("write_text_file", { path, contents });
}

export async function pathExists(path: string): Promise<boolean> {
  return invoke("path_exists", { path });
}
