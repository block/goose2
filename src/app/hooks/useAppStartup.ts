import { useEffect } from "react";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";

export function useAppStartup() {
  useEffect(() => {
    (async () => {
      const store = useAgentStore.getState();

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

      const { loadSessions, loadTabState } = useChatSessionStore.getState();
      await loadSessions();
      await loadTabState();
      useChatSessionStore.getState().setActiveTab(null);
    })();
  }, []);
}
