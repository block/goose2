export interface WorktreeInfo {
  path: string;
  branch: string | null;
  isMain: boolean;
}

export interface GitState {
  isGitRepo: boolean;
  currentBranch: string | null;
  dirtyFileCount: number;
  worktrees: WorktreeInfo[];
  isWorktree: boolean;
  mainWorktreePath: string | null;
  localBranches: string[];
}
