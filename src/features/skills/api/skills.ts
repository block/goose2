import { invoke } from "@tauri-apps/api/core";

export interface SkillInfo {
  name: string;
  description: string;
  instructions: string;
  path: string;
}

export async function createSkill(
  name: string,
  description: string,
  instructions: string,
): Promise<void> {
  return invoke("create_skill", { name, description, instructions });
}

export async function listSkills(): Promise<SkillInfo[]> {
  return invoke("list_skills");
}

export async function deleteSkill(name: string): Promise<void> {
  return invoke("delete_skill", { name });
}
