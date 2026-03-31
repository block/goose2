import type { ProjectInfo } from "../api/projects";

export interface ProjectFolderOption {
  id: string;
  name: string;
  path?: string;
}

function trimValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getProjectFolderName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  if (!normalized) {
    return path;
  }

  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

export function getProjectFolderOption(
  project: Pick<ProjectInfo, "workingDir"> | null | undefined,
): ProjectFolderOption | null {
  const workingDir = trimValue(project?.workingDir);
  if (!workingDir) {
    return null;
  }

  return {
    id: workingDir,
    name: getProjectFolderName(workingDir),
    path: workingDir,
  };
}

export function buildProjectSystemPrompt(
  project: ProjectInfo | null | undefined,
): string | undefined {
  if (!project) {
    return undefined;
  }

  const settings: string[] = [`Project name: ${project.name}`];
  const description = trimValue(project.description);
  const workingDir = trimValue(project.workingDir);
  const prompt = trimValue(project.prompt);

  if (description) {
    settings.push(`Project description: ${description}`);
  }
  if (workingDir) {
    settings.push(`Working directory: ${workingDir}`);
  }
  if (project.preferredProvider) {
    settings.push(`Preferred provider: ${project.preferredProvider}`);
  }
  if (project.preferredModel) {
    settings.push(`Preferred model: ${project.preferredModel}`);
  }
  settings.push(
    `Use git worktrees for branch isolation: ${
      project.useWorktrees ? "yes" : "no"
    }`,
  );

  const sections = [
    `<project-settings>\n${settings.join("\n")}\n</project-settings>`,
  ];

  if (prompt) {
    sections.push(`<project-instructions>\n${prompt}\n</project-instructions>`);
  }

  return sections.join("\n\n");
}

export function composeSystemPrompt(
  ...parts: Array<string | null | undefined>
): string | undefined {
  const combined = parts
    .map((part) => trimValue(part))
    .filter((part): part is string => part !== null);

  return combined.length > 0 ? combined.join("\n\n") : undefined;
}
