import { openPath } from "@tauri-apps/plugin-opener";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { Message } from "@/shared/types/messages";
import { pathExists } from "@/shared/api/system";
import {
  buildArtifactsIndexForMessages,
  resolveMarkdownLocalHref,
  type ArtifactPathCandidate,
} from "@/features/chat/lib/artifactPathPolicy";

export interface ToolCardDisplay {
  role: "primary_host" | "none";
  primaryCandidate: ArtifactPathCandidate | null;
  secondaryCandidates: ArtifactPathCandidate[];
}

interface ArtifactPolicyContextValue {
  resolveToolCardDisplay: (
    args: Record<string, unknown>,
    name: string,
    result?: string,
  ) => ToolCardDisplay;
  resolveMarkdownHref: (href: string) => ArtifactPathCandidate | null;
  pathExists: (path: string) => Promise<boolean>;
  openResolvedPath: (path: string) => Promise<void>;
}

const EMPTY_DISPLAY: ToolCardDisplay = {
  role: "none",
  primaryCandidate: null,
  secondaryCandidates: [],
};

const DEFAULT_CONTEXT_VALUE: ArtifactPolicyContextValue = {
  resolveToolCardDisplay: () => EMPTY_DISPLAY,
  resolveMarkdownHref: () => null,
  pathExists: async () => false,
  openResolvedPath: async () => {},
};

const ArtifactPolicyContext = createContext<ArtifactPolicyContextValue>(
  DEFAULT_CONTEXT_VALUE,
);

export function ArtifactPolicyProvider({
  messages,
  allowedRoots,
  children,
}: {
  messages: Message[];
  allowedRoots: string[];
  children: ReactNode;
}) {
  const normalizedRoots = useMemo(
    () => [...new Set(allowedRoots.map((root) => root.trim()).filter(Boolean))],
    [allowedRoots],
  );
  const lastOpenAtByPathRef = useRef(new Map<string, number>());

  const { argsToToolCallId, toolCardDisplayByToolCallId } = useMemo(() => {
    const index = buildArtifactsIndexForMessages(messages, normalizedRoots);
    const displayByToolCallId = new Map<string, ToolCardDisplay>();

    for (const ranking of index.byMessageId.values()) {
      for (const [toolCallId, candidates] of ranking.candidatesByToolCallId) {
        if (candidates.length === 0) continue;
        displayByToolCallId.set(toolCallId, {
          role: "primary_host",
          primaryCandidate: candidates[0],
          secondaryCandidates: candidates.slice(1),
        });
      }
    }

    return {
      argsToToolCallId: index.argsToToolCallId,
      toolCardDisplayByToolCallId: displayByToolCallId,
    };
  }, [messages, normalizedRoots]);

  const resolveToolCardDisplay = useCallback(
    (args: Record<string, unknown>, _name: string, _result?: string) => {
      const toolCallId = argsToToolCallId.get(args);
      if (!toolCallId) return EMPTY_DISPLAY;
      return toolCardDisplayByToolCallId.get(toolCallId) ?? EMPTY_DISPLAY;
    },
    [argsToToolCallId, toolCardDisplayByToolCallId],
  );

  const resolveMarkdownHref = useCallback(
    (href: string) => resolveMarkdownLocalHref(href, normalizedRoots),
    [normalizedRoots],
  );

  const checkPathExists = useCallback((path: string) => pathExists(path), []);

  const openResolvedPath = useCallback(
    async (path: string) => {
      const exists = await checkPathExists(path);
      if (!exists) {
        throw new Error(`File not found: ${path}`);
      }

      const key = path.trim().toLowerCase();
      const now = Date.now();
      const lastOpenAt = lastOpenAtByPathRef.current.get(key) ?? 0;
      if (now - lastOpenAt < 1200) {
        return;
      }
      lastOpenAtByPathRef.current.set(key, now);
      await openPath(path);
    },
    [checkPathExists],
  );

  const contextValue = useMemo<ArtifactPolicyContextValue>(
    () => ({
      resolveToolCardDisplay,
      resolveMarkdownHref,
      pathExists: checkPathExists,
      openResolvedPath,
    }),
    [
      checkPathExists,
      openResolvedPath,
      resolveMarkdownHref,
      resolveToolCardDisplay,
    ],
  );

  return (
    <ArtifactPolicyContext.Provider value={contextValue}>
      {children}
    </ArtifactPolicyContext.Provider>
  );
}

export function useArtifactPolicyContext(): ArtifactPolicyContextValue {
  return useContext(ArtifactPolicyContext);
}
