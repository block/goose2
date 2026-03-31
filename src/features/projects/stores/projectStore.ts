import { create } from "zustand";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  type ProjectInfo,
} from "../api/projects";

interface ProjectState {
  projects: ProjectInfo[];
  loading: boolean;
  activeProjectId: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  addProject: (
    name: string,
    description: string,
    prompt: string,
    icon: string,
    color: string,
    preferredProvider: string | null,
    preferredModel: string | null,
    workingDir: string | null,
    useWorktrees: boolean,
  ) => Promise<ProjectInfo>;
  editProject: (
    id: string,
    name: string,
    description: string,
    prompt: string,
    icon: string,
    color: string,
    preferredProvider: string | null,
    preferredModel: string | null,
    workingDir: string | null,
    useWorktrees: boolean,
  ) => Promise<ProjectInfo>;
  removeProject: (id: string) => Promise<void>;
  setActiveProject: (id: string | null) => void;
  getActiveProject: () => ProjectInfo | null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  activeProjectId: null,

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const projects = await listProjects();
      set({ projects, loading: false });
    } catch {
      set({ projects: [], loading: false });
    }
  },

  addProject: async (
    name,
    description,
    prompt,
    icon,
    color,
    preferredProvider,
    preferredModel,
    workingDir,
    useWorktrees,
  ) => {
    const project = await createProject(
      name,
      description,
      prompt,
      icon,
      color,
      preferredProvider,
      preferredModel,
      workingDir,
      useWorktrees,
    );
    set((state) => ({ projects: [...state.projects, project] }));
    return project;
  },

  editProject: async (
    id,
    name,
    description,
    prompt,
    icon,
    color,
    preferredProvider,
    preferredModel,
    workingDir,
    useWorktrees,
  ) => {
    const project = await updateProject(
      id,
      name,
      description,
      prompt,
      icon,
      color,
      preferredProvider,
      preferredModel,
      workingDir,
      useWorktrees,
    );
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? project : p)),
    }));
    return project;
  },

  removeProject: async (id) => {
    await deleteProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId:
        state.activeProjectId === id ? null : state.activeProjectId,
    }));
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId) ?? null;
  },
}));
