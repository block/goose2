import { create } from "zustand";
import { apiFetch } from "@/shared/api";
import type { Skill } from "@/types";

interface SkillStore {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  loadSkills: () => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
}

export const useSkillStore = create<SkillStore>()((set) => ({
  skills: [],
  loading: false,
  error: null,

  loadSkills: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiFetch("/skills/list");
      if (!res.ok) throw new Error(`Failed to load skills: ${res.status}`);
      const data = await res.json();
      set({ skills: data.skills ?? [], loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load skills",
        loading: false,
      });
    }
  },

  deleteSkill: async (id) => {
    const res = await apiFetch(`/skills/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete skill: ${res.status}`);
    set((state) => ({ skills: state.skills.filter((s) => s.id !== id) }));
  },
}));
