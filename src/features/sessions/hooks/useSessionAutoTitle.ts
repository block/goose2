import { useEffect, useRef } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { generateSessionTitle } from "@/shared/api/chat";

/**
 * Automatically generates a session title after the first exchange completes.
 * Watches for the transition from streaming → idle when messageCount === 2.
 * Skips sessions where the user has manually set a title.
 */
export function useSessionAutoTitle(sessionId: string) {
  const firedRef = useRef(false);
  const prevChatStateRef = useRef<string | null>(null);

  const chatState = useChatStore(
    (s) => s.getSessionRuntime(sessionId).chatState,
  );
  const session = useChatSessionStore((s) =>
    s.sessions.find((candidate) => candidate.id === sessionId),
  );

  useEffect(() => {
    if (firedRef.current) return;
    if (!session || session.userSetName) return;
    if (session.messageCount !== 2) {
      prevChatStateRef.current = chatState;
      return;
    }

    const wasStreaming = prevChatStateRef.current === "streaming";
    prevChatStateRef.current = chatState;

    if (chatState !== "idle" || !wasStreaming) return;

    firedRef.current = true;

    generateSessionTitle(sessionId)
      .then((title) => {
        useChatSessionStore
          .getState()
          .updateSession(sessionId, { title, userSetName: false });
      })
      .catch(() => {
        // Fallback: use first 50 chars of first user message
        const messages =
          useChatStore.getState().messagesBySession[sessionId] ?? [];
        const firstUserMessage = messages.find((m) => m.role === "user");
        const textBlock = firstUserMessage?.content.find(
          (c) => c.type === "text",
        );
        if (textBlock && "text" in textBlock) {
          const fallback = textBlock.text.trim().slice(0, 50);
          useChatSessionStore
            .getState()
            .updateSession(sessionId, { title: fallback, userSetName: false });
        }
      });
  }, [sessionId, chatState, session]);
}
