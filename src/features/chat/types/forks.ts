export interface ForkBranchInfo {
  sourceSessionId: string;
  branches: { sessionId: string }[];
  activeBranchIndex: number;
}
export type ForkTree = Record<string, ForkBranchInfo>;
