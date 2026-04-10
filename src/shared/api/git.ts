import { invoke } from "@tauri-apps/api/core";
import type { GitState } from "@/shared/types/git";

export async function getGitState(path: string): Promise<GitState> {
  return invoke("get_git_state", { path });
}

export async function switchBranch(
  path: string,
  branch: string,
): Promise<void> {
  return invoke("git_switch_branch", { path, branch });
}
