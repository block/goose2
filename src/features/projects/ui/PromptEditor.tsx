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
      // We visually highlight include lines anywhere in the editor, even though
      // only the leading include block is treated as working directory metadata.
      const match = line.match(INCLUDE_RE);
      if (match) {
        return `<div><span class="bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5 font-mono text-xs">${escapeHtml(line)}</span></div>`;
      }
      // Use <br> inside empty divs so the line is still editable
      return `<div>${line === "" ? "<br>" : escapeHtml(line)}</div>`;
    })
    .join("");
}

/** Return the caret position as {line, col} relative to the div-per-line structure. */
function getCaretPosition(el: HTMLElement): { line: number; col: number } {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { line: 0, col: 0 };

  const range = sel.getRangeAt(0);
  const node: Node | null = range.startContainer;
  const offset = range.startOffset;

  // If the selection is directly on the contentEditable root, translate
  // the child-index offset into a line number with col 0.
  if (node === el) {
    return { line: Math.min(offset, el.childNodes.length - 1), col: 0 };
  }

  // Walk up to find which direct-child div this node lives in.
  let lineDiv: Node | null = node;
  while (lineDiv && lineDiv.parentNode !== el) {
    lineDiv = lineDiv.parentNode;
  }
  if (!lineDiv) return { line: 0, col: 0 };

  const divs = Array.from(el.childNodes);
  const line = divs.indexOf(lineDiv as ChildNode);

  // Measure the visible text from the start of the line up to the caret.
  // This works for both text-node and element-node selection containers.
  const lineRange = document.createRange();
  lineRange.selectNodeContents(lineDiv);
  lineRange.setEnd(node, offset);
  const col = lineRange.toString().length;

  return { line: Math.max(line, 0), col };
}

/** Restore the caret to a given {line, col} inside the element's div children. */
function setCaretPosition(el: HTMLElement, pos: { line: number; col: number }) {
  const sel = window.getSelection();
  if (!sel) return;

  const divs = el.childNodes;
  if (divs.length === 0) return;

  const lineIdx = Math.min(pos.line, divs.length - 1);
  const lineDiv = divs[lineIdx];

  // Find the text node and offset within this line div.
  const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT);
  let remaining = pos.col;
  let textNode: Text | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: walker iteration
  while ((textNode = walker.nextNode() as Text | null)) {
    if (remaining <= textNode.length) {
      const range = document.createRange();
      range.setStart(textNode, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= textNode.length;
  }

  // No text nodes (empty line with <br>): place caret at start of the div
  const range = document.createRange();
  range.setStart(lineDiv, 0);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Return the set of line indices that match INCLUDE_RE. */
function getIncludeLineSet(text: string): Set<number> {
  const set = new Set<number>();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (INCLUDE_RE.test(lines[i])) set.add(i);
  }
  return set;
}

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

export function PromptEditor({
  value,
  onChange,
  placeholder,
}: PromptEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastPushedValue = useRef<string | null>(null);
  const includeLines = useRef<Set<number>>(new Set());
  const isComposing = useRef(false);

  // Sync HTML when value changes externally (including initial mount)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== lastPushedValue.current) {
      lastPushedValue.current = value;
      includeLines.current = getIncludeLineSet(value);
      el.innerHTML = value === "" ? "" : renderLines(value);
    }
  }, [value]);

  const syncFromDom = (skipRerender: boolean) => {
    const el = ref.current;
    if (!el) return;

    const text = el.innerText;
    const normalized = text.replace(/\n$/, "");
    lastPushedValue.current = normalized;

    const newIncludeLines = getIncludeLineSet(normalized);
    if (!skipRerender && !setsEqual(newIncludeLines, includeLines.current)) {
      includeLines.current = newIncludeLines;
      const caret = getCaretPosition(el);
      el.innerHTML = normalized === "" ? "" : renderLines(normalized);
      setCaretPosition(el, caret);
    } else {
      includeLines.current = newIncludeLines;
    }

    onChange(normalized);
  };

  const handleInput = () => {
    syncFromDom(isComposing.current);
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = () => {
    isComposing.current = false;
    syncFromDom(false);
  };

  const insertTextAtSelection = (text: string) => {
    const el = ref.current;
    if (!el) return;

    const selection = window.getSelection();
    if (!selection) {
      el.focus();
      return;
    }

    if (selection.rangeCount === 0) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    insertTextAtSelection(text);
    syncFromDom(isComposing.current);
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
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
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
