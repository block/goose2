import { useEffect } from "react";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { useChatStore } from "@/features/chat/stores/chatStore";

export function useAppStartup() {
  useEffect(() => {
    (async () => {
      const store = useAgentStore.getState();
      const loadPersonas = async () => {
        store.setPersonasLoading(true);
        try {
          const { listPersonas } = await import("@/shared/api/agents");
          const personas = await listPersonas();
          store.setPersonas(personas);
        } catch (err) {
          console.error("Failed to load personas on startup:", err);
        } finally {
          store.setPersonasLoading(false);
        }
      };

      const loadProviders = async () => {
        store.setProvidersLoading(true);
        try {
          const { discoverAcpProviders } = await import("@/shared/api/acp");
          const providers = await discoverAcpProviders();
          store.setProviders(providers);
        } catch (err) {
          console.error("Failed to load ACP providers on startup:", err);
        } finally {
          store.setProvidersLoading(false);
        }
      };

      const loadSessionState = async () => {
        const sessionStore = useChatSessionStore.getState();
        await sessionStore.loadSessions();
        sessionStore.setActiveSession(null);

        // Reconstruct fork trees from all sessions
        const allSessions = sessionStore.getAllSessions();
        const chatStore = useChatStore.getState();
        const rootSessionIds = new Set<string>();
        for (const s of allSessions) {
          if (!s.forkedFrom) {
            rootSessionIds.add(s.id);
          }
        }
        for (const rootId of rootSessionIds) {
          chatStore.buildForkTreeFromSessions(rootId, allSessions);
        }
      };

      await Promise.allSettled([
        loadPersonas(),
        loadProviders(),
        loadSessionState(),
      ]);
    })();
  }, []);
}
