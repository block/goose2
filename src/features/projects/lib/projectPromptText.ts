import { INCLUDE_RE } from "./includePattern";

/** Build the editor text from separate workingDirs + prompt. */
export function buildEditorText(workingDirs: string[], prompt: string): string {
  const includeLines = workingDirs.map((directory) => `include: ${directory}`);
  if (includeLines.length === 0) return prompt;
  return [...includeLines, "", prompt].join("\n");
}

/** Parse editor text into { prompt, workingDirs }.
 *  Only `include:` lines at the top of the text (before the first
 *  non-include, non-blank line) are treated as working directories. */
export function parseEditorText(text: string): {
  prompt: string;
  workingDirs: string[];
} {
  const lines = text.split("\n");
  const workingDirs: string[] = [];
  const promptLines: string[] = [];
  let parsingIncludeBlock = true;

  for (const line of lines) {
    const match = line.match(INCLUDE_RE);
    if (parsingIncludeBlock && match) {
      workingDirs.push(match[1].trim());
      continue;
    }

    if (line.trim() !== "") {
      parsingIncludeBlock = false;
    }

    promptLines.push(line);
  }

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
