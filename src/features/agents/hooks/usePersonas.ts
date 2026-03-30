import { useEffect, useCallback } from "react";
import { useAgentStore } from "../stores/agentStore";
import type {
  CreatePersonaRequest,
  UpdatePersonaRequest,
} from "@/shared/types/agents";
import * as api from "@/shared/api/agents";

export function usePersonas() {
  const store = useAgentStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: store is stable and should not trigger re-creation
  const loadPersonas = useCallback(async () => {
    store.setPersonasLoading(true);
    try {
      const personas = await api.listPersonas();
      store.setPersonas(personas);
    } catch (error) {
      console.error("Failed to load personas:", error);
      // Fall back to empty list - builtins will come from backend
    } finally {
      store.setPersonasLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: store is stable and should not trigger re-creation
  const createPersona = useCallback(async (req: CreatePersonaRequest) => {
    const persona = await api.createPersona(req);
    store.addPersona(persona);
    return persona;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: store is stable and should not trigger re-creation
  const updatePersona = useCallback(
    async (id: string, req: UpdatePersonaRequest) => {
      const persona = await api.updatePersona(id, req);
      store.updatePersona(id, persona);
      return persona;
    },
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: store is stable and should not trigger re-creation
  const deletePersona = useCallback(async (id: string) => {
    await api.deletePersona(id);
    store.removePersona(id);
  }, []);

  return {
    personas: store.personas,
    isLoading: store.personasLoading,
    createPersona,
    updatePersona,
    deletePersona,
    refresh: loadPersonas,
  };
}
