import { useRef, useEffect } from "react";
import { cn } from "@/shared/lib/cn";
import { INCLUDE_RE } from "../lib/includePattern";

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function renderLines(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(INCLUDE_RE);
      if (match) {
        return `<div><span class="bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5 font-mono text-xs">${escapeHtml(line)}</span></div>`;
      }
      // Use <br> inside empty divs so the line is still editable
      return `<div>${line === "" ? "<br>" : escapeHtml(line)}</div>`;
    })
    .join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function PromptEditor({
  value,
  onChange,
  placeholder,
}: PromptEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastPushedValue = useRef(value);

  // Sync HTML when value changes externally
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Only update DOM when the change came from outside (e.g. directory button)
    if (value !== lastPushedValue.current) {
      lastPushedValue.current = value;
      el.innerHTML = value === "" ? "" : renderLines(value);
    }
  }, [value]);

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    // innerText preserves newlines from contentEditable divs
    const text = el.innerText;
    // contentEditable may add a trailing newline; normalise it
    const normalized = text.replace(/\n$/, "");
    lastPushedValue.current = normalized;
    onChange(normalized);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const showPlaceholder = value === "";

  return (
    // biome-ignore lint/a11y/useSemanticElements: contentEditable div needed for rich capsule rendering
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onPaste={handlePaste}
      role="textbox"
      tabIndex={0}
      aria-multiline="true"
      aria-label={placeholder ?? "Instructions"}
      data-placeholder={placeholder}
      className={cn(
        "w-full overflow-y-auto resize-y rounded-lg border border-border bg-background-secondary px-3 py-2 text-xs font-mono leading-relaxed",
        "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
        "whitespace-pre-wrap min-h-[120px]",
        showPlaceholder &&
          "empty:before:content-[attr(data-placeholder)] empty:before:text-foreground-secondary/40",
      )}
    />
  );
}
