/**
 * Utilities for converting raw tool-call names into past-tense verb labels
 * and grouping consecutive same-type calls.
 */

const SHELL_COMMANDS = new Set([
  "awk",
  "bash",
  "cat",
  "chmod",
  "cp",
  "echo",
  "find",
  "grep",
  "head",
  "ls",
  "mv",
  "open",
  "pip",
  "pip3",
  "python",
  "python3",
  "rm",
  "sed",
  "sh",
  "tail",
  "wc",
  "which",
  "zsh",
]);

/** Maps canonical type keys to first-token aliases (lowercased). */
const TYPE_ALIASES: Record<string, string> = {
  write: "write",
  edit: "edit",
  read: "read",
  readfile: "read",
  read_file: "read",
  shell: "shell",
  search: "search",
  web_search: "search",
  websearch: "search",
  glob: "search",
  grep: "search",
};

interface VerbEntry {
  verb: string;
  noun: string;
}

const VERB_MAP: Record<string, VerbEntry> = {
  write: { verb: "Edited", noun: "files" },
  edit: { verb: "Edited", noun: "files" },
  read: { verb: "Read", noun: "files" },
  shell: { verb: "Ran", noun: "commands" },
  search: { verb: "Searched", noun: "queries" },
};

/**
 * Extracts a canonical type key from a raw tool name.
 *
 * Examples:
 *   "Write weather-dashboard.html" → "write"
 *   "Shell"                        → "shell"
 *   "ls /tmp"                      → "shell"
 *   "readFile"                     → "read"
 *   "web_search"                   → "search"
 *   "Create PDF about whales"      → undefined (unrecognized)
 */
export function getToolType(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;

  // Try the full lowercased name first (handles "readFile", "web_search", etc.)
  const lower = trimmed.toLowerCase();
  if (TYPE_ALIASES[lower] !== undefined) {
    return TYPE_ALIASES[lower];
  }

  // Extract the first token
  const firstToken = lower.split(/\s+/)[0];

  // Check if it's a known shell command
  if (SHELL_COMMANDS.has(firstToken)) {
    return "shell";
  }

  // Check aliases for the first token
  if (TYPE_ALIASES[firstToken] !== undefined) {
    return TYPE_ALIASES[firstToken];
  }

  return undefined;
}

/**
 * Extracts the detail portion from a tool name.
 *
 * For alias-recognized names (Write, Read, Edit, Shell, etc.), returns
 * everything after the first token:
 *   "Write weather-dashboard.html" → "weather-dashboard.html"
 *   "Shell"                        → undefined
 *   "readFile"                     → undefined
 *
 * For shell-command names (python3, ls, grep, etc.), returns the full
 * original string since the entire thing is the command:
 *   "python3 create_whales.py"     → "python3 create_whales.py"
 *   "ls -lh whales.pdf"            → "ls -lh whales.pdf"
 *   "ls"                           → undefined (single token, nothing useful)
 */
export function getToolDetail(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;

  const parts = trimmed.split(/\s+/);
  const firstToken = parts[0].toLowerCase();

  // Shell commands: the whole string is the command detail
  if (SHELL_COMMANDS.has(firstToken)) {
    return parts.length > 1 ? trimmed : undefined;
  }

  // Alias-recognized names: detail is everything after first token
  if (TYPE_ALIASES[firstToken] !== undefined && parts.length > 1) {
    return parts.slice(1).join(" ");
  }

  return undefined;
}

/**
 * Builds a human-friendly display label.
 *
 * @param type     - canonical type from getToolType()
 * @param count    - number of grouped items (1 = solo)
 * @param detail   - from getToolDetail() (solo items only)
 * @param rawName  - original name, used as fallback for unknown types
 *
 * Examples:
 *   ("write", 1, "foo.html")        → "Edited foo.html"
 *   ("write", 1, undefined)         → "Edited"
 *   ("write", 3)                    → "Edited 3 files"
 *   ("shell", 1, "ls /tmp")         → "Ran ls /tmp"
 *   (undefined, 1, undefined, "X")  → "X"
 */
export function getToolLabel(
  type: string | undefined,
  count: number,
  detail?: string,
  rawName?: string,
): string {
  if (!type || !VERB_MAP[type]) {
    return rawName ?? "Tool";
  }

  const { verb, noun } = VERB_MAP[type];

  if (count > 1) {
    return `${verb} ${count} ${noun}`;
  }

  if (detail) {
    return `${verb} ${detail}`;
  }

  return verb;
}

export function getToolVerb(type: string | undefined): string | undefined {
  if (!type || !VERB_MAP[type]) return undefined;
  return VERB_MAP[type].verb;
}

const PATH_ARG_KEYS = [
  "path",
  "file_path",
  "filePath",
  "filepath",
  "filename",
  "output_path",
  "target",
  "to",
  "destination",
];

/**
 * Extracts a filename from a path string.
 */
function fileNameFromPath(pathStr: string): string | undefined {
  const segments = pathStr.split("/");
  const last = segments[segments.length - 1];
  return last?.includes(".") ? last : undefined;
}

/**
 * Extracts a filename detail from multiple sources:
 * 1. The tool name itself (e.g. "Write foo.html" → "foo.html")
 * 2. Common path keys in tool arguments
 * 3. First file path found in result text
 */
export function extractFileDetail(
  name: string,
  args?: Record<string, unknown>,
  result?: string,
): string | undefined {
  const fromName = getToolDetail(name);
  if (fromName) return fromName;

  if (args) {
    for (const key of PATH_ARG_KEYS) {
      const val = args[key];
      if (typeof val === "string" && val) {
        const fn = fileNameFromPath(val);
        if (fn) return fn;
      }
    }
  }

  if (result) {
    const match = result.match(/\/?(?:[\w.-]+\/)+?([\w.-]+\.\w+)/);
    if (match?.[1]) return match[1];
  }

  return undefined;
}
