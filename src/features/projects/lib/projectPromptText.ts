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
  let i = 0;

  for (; i < lines.length; i++) {
    const match = lines[i].match(INCLUDE_RE);
    if (match) {
      workingDirs.push(match[1].trim());
      continue;
    }

    if (lines[i].trim() !== "") {
      break;
    }
  }

  return {
    prompt: lines.slice(i).join("\n"),
    workingDirs,
  };
}

export function insertWorkingDir(text: string, directory: string): string {
  const lines = text === "" ? [] : text.split("\n");
  let insertAt = 0;

  while (insertAt < lines.length) {
    if (INCLUDE_RE.test(lines[insertAt]) || lines[insertAt].trim() === "") {
      insertAt++;
      continue;
    }

    break;
  }

  const nextLines = [...lines];
  nextLines.splice(insertAt, 0, `include: ${directory}`);

  return nextLines.join("\n");
}
