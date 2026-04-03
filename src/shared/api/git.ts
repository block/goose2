import { invoke } from "@tauri-apps/api/core";
import type { GitState } from "@/shared/types/git";

export async function getGitState(path: string): Promise<GitState> {
  return invoke("get_git_state", { path });
}
