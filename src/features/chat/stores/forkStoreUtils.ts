import type { Message } from "@/shared/types/messages";
import type { Session } from "@/shared/types/chat";
import type { ForkTree } from "../types/forks";

/**
 * Build a fork tree from a set of sessions rooted at rootSessionId.
 */
export function buildForkTree(
  rootSessionId: string,
  allSessions: Session[],
): ForkTree {
  const treeSessionIds = new Set<string>([rootSessionId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of allSessions) {
      if (
        s.forkedFrom &&
        treeSessionIds.has(s.forkedFrom) &&
        !treeSessionIds.has(s.id)
      ) {
        treeSessionIds.add(s.id);
        changed = true;
      }
    }
  }

  const tree: ForkTree = {};
  for (const s of allSessions) {
    if (!s.forkedFrom || !s.forkPointMessageId || !treeSessionIds.has(s.id))
      continue;
    const key = s.forkPointMessageId;
    const existing = tree[key];
    if (existing) {
      if (!existing.branches.some((b) => b.sessionId === s.id)) {
        existing.branches.push({ sessionId: s.id });
        existing.activeBranchIndex = existing.branches.length - 1;
      }
    } else {
      tree[key] = {
        sourceSessionId: s.forkedFrom,
        branches: [{ sessionId: s.forkedFrom }, { sessionId: s.id }],
        activeBranchIndex: 1,
      };
    }
  }

  return tree;
}

/**
 * Walk the fork tree to produce a flat list of display messages,
 * switching to forked branches at each fork point.
 */
export function computeDisplayMessages(
  rootSessionId: string,
  tree: ForkTree,
  messagesBySession: Record<string, Message[]>,
): Message[] {
  const rootMessages = messagesBySession[rootSessionId] ?? [];

  if (Object.keys(tree).length === 0) {
    return rootMessages;
  }

  const result: Message[] = [];
  let currentMessages = rootMessages;
  let i = 0;

  while (i < currentMessages.length) {
    const msg = currentMessages[i];
    result.push(msg);

    if (msg.role === "user" && tree[msg.id]) {
      const branch = tree[msg.id];
      const activeBranch = branch.branches[branch.activeBranchIndex];
      if (activeBranch && activeBranch.sessionId !== rootSessionId) {
        const branchMessages = messagesBySession[activeBranch.sessionId] ?? [];
        const forkIdx = branchMessages.findIndex((m) => m.id === msg.id);
        if (forkIdx !== -1) {
          currentMessages = branchMessages;
          i = forkIdx + 1;
          continue;
        }
      }
    }

    i++;
  }

  return result;
}

/**
 * Walk the fork tree to find the leaf (most-branched) session ID.
 */
export function computeLeafSessionId(
  rootSessionId: string,
  tree: ForkTree,
  messagesBySession: Record<string, Message[]>,
): string {
  if (Object.keys(tree).length === 0) {
    return rootSessionId;
  }

  let currentSessionId = rootSessionId;
  let currentMessages = messagesBySession[rootSessionId] ?? [];
  let i = 0;

  while (i < currentMessages.length) {
    const msg = currentMessages[i];

    if (msg.role === "user" && tree[msg.id]) {
      const branch = tree[msg.id];
      const activeBranch = branch.branches[branch.activeBranchIndex];
      if (activeBranch && activeBranch.sessionId !== currentSessionId) {
        const branchMessages = messagesBySession[activeBranch.sessionId] ?? [];
        const forkIdx = branchMessages.findIndex((m) => m.id === msg.id);
        if (forkIdx !== -1) {
          currentSessionId = activeBranch.sessionId;
          currentMessages = branchMessages;
          i = forkIdx + 1;
          continue;
        }
      }
    }

    i++;
  }

  return currentSessionId;
}
