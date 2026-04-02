import { INCLUDE_RE } from "./includePattern";

/** Build the editor text from separate workingDirs + prompt. */
export function buildEditorText(workingDirs: string[], prompt: string): string {
  const includeLines = workingDirs.map((directory) => `include: ${directory}`);
  if (includeLines.length === 0) return prompt;
  if (prompt === "") return includeLines.join("\n");
  return [prompt, "", ...includeLines].join("\n");
}

/** Parse editor text into { prompt, workingDirs }.
 *  Only `include:` lines at the bottom of the text (after the last
 *  non-include, non-blank line) are treated as working directories. */
export function parseEditorText(text: string): {
  prompt: string;
  workingDirs: string[];
} {
  const lines = text.split("\n");
  const workingDirs: string[] = [];

  // Walk backwards from the end to find the trailing include block.
  // The block may contain include lines and blank lines, but ends as
  // soon as we hit a non-include, non-blank line.
  let trailingStart = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(INCLUDE_RE);
    if (match) {
      trailingStart = i;
      continue;
    }
    if (lines[i].trim() === "") {
      continue;
    }
    // Hit a non-include, non-blank line — stop.
    break;
  }

  // Collect working dirs from the trailing block (in forward order).
  for (let i = trailingStart; i < lines.length; i++) {
    const match = lines[i].match(INCLUDE_RE);
    if (match) {
      workingDirs.push(match[1].trim());
    }
  }

  // Everything before the trailing block is the prompt.
  const promptLines = lines.slice(0, trailingStart);

  // Trim leading/trailing blank lines from the prompt.
  while (promptLines[0]?.trim() === "") {
    promptLines.shift();
  }
  while (promptLines[promptLines.length - 1]?.trim() === "") {
    promptLines.pop();
  }

  return {
    prompt: promptLines.join("\n"),
    workingDirs,
  };
}

export function insertWorkingDir(text: string, directory: string): string {
  if (text === "") {
    return `include: ${directory}`;
  }

  const { prompt, workingDirs } = parseEditorText(text);
  return buildEditorText([...workingDirs, directory], prompt);
}

export function hasEquivalentWorkingDir(
  text: string,
  directory: string,
  homeDir: string | null,
): boolean {
  const normalizedDirectory = normalizeWorkingDirPath(directory, homeDir);

  return parseEditorText(text).workingDirs.some(
    (existingDirectory) =>
      normalizeWorkingDirPath(existingDirectory, homeDir) ===
      normalizedDirectory,
  );
}

function normalizeWorkingDirPath(
  directory: string,
  homeDir: string | null,
): string {
  const trimmedDirectory = directory.trim();
  const trimmedHomeDir = homeDir?.trim().replace(/[\\/]+$/, "") ?? null;

  if (!trimmedHomeDir) {
    return trimmedDirectory.replace(/[\\/]+$/, "");
  }

  if (trimmedDirectory === "~") {
    return trimmedHomeDir;
  }

  if (trimmedDirectory.startsWith("~/") || trimmedDirectory.startsWith("~\\")) {
    return `${trimmedHomeDir}${trimmedDirectory.slice(1)}`.replace(
      /[\\/]+$/,
      "",
    );
  }

  return trimmedDirectory.replace(/[\\/]+$/, "");
}
