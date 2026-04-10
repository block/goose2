export interface WorktreeInfo {
  path: string;
  branch: string | null;
  isMain: boolean;
}

export interface GitState {
  isGitRepo: boolean;
  currentBranch: string | null;
  dirtyFileCount: number;
  incomingCommitCount: number;
  worktrees: WorktreeInfo[];
  isWorktree: boolean;
  mainWorktreePath: string | null;
  localBranches: string[];
}

export interface CreatedWorktree {
  path: string;
  branch: string;
}
