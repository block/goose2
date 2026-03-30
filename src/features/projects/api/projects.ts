import { invoke } from "@tauri-apps/api/core";

export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: string;
  color: string;
  preferredProvider: string | null;
  preferredModel: string | null;
  workingDir: string | null;
  useWorktrees: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listProjects(): Promise<ProjectInfo[]> {
  return invoke("list_projects");
}

export async function createProject(
  name: string,
  description: string,
  prompt: string,
  icon: string,
  color: string,
  preferredProvider: string | null,
  preferredModel: string | null,
  workingDir: string | null,
  useWorktrees: boolean,
): Promise<ProjectInfo> {
  return invoke("create_project", {
    name,
    description,
    prompt,
    icon,
    color,
    preferredProvider,
    preferredModel,
    workingDir,
    useWorktrees,
  });
}

export async function updateProject(
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
): Promise<ProjectInfo> {
  return invoke("update_project", {
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
  });
}

export async function deleteProject(id: string): Promise<void> {
  return invoke("delete_project", { id });
}

export async function getProject(id: string): Promise<ProjectInfo> {
  return invoke("get_project", { id });
}
