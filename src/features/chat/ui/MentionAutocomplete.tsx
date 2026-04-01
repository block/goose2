import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sparkles, User } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { Persona } from "@/shared/types/agents";

interface MentionAutocompleteProps {
  personas: Persona[];
  query: string;
  isOpen: boolean;
  onSelect: (persona: Persona) => void;
  /** Optional close handler (called on Escape). */
  onClose?: (() => void) | undefined;
  anchorRect?: DOMRect | null;
  /** Index of the currently highlighted item (controlled by parent). */
  selectedIndex?: number;
}

export function MentionAutocomplete({
  personas,
  query,
  isOpen,
  onSelect,
  anchorRect,
  selectedIndex: controlledIndex,
}: MentionAutocompleteProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const selectedIndex = controlledIndex ?? internalIndex;
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return personas;
    return personas.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [personas, query]);

  // Reset index when results change
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on query/result changes
  useEffect(() => {
    setInternalIndex(0);
  }, [filtered.length, query]);

  const handleSelect = useCallback(
    (persona: Persona) => {
      onSelect(persona);
    },
    [onSelect],
  );

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute z-50 w-64 rounded-lg border border-border bg-background shadow-lg"
      style={{
        bottom: anchorRect ? "calc(100% + 4px)" : undefined,
        left: anchorRect ? 16 : undefined,
      }}
      role="listbox"
      aria-label="Mention suggestions"
    >
      <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-foreground-tertiary">
        Mention a persona
      </div>
      <div className="max-h-48 overflow-y-auto px-1 pb-1">
        {filtered.map((persona, index) => (
          <button
            key={persona.id}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
              index === selectedIndex
                ? "bg-background-tertiary text-foreground"
                : "text-foreground-secondary hover:bg-background-tertiary/50",
            )}
            onClick={() => handleSelect(persona)}
            onMouseEnter={() => setInternalIndex(index)}
          >
            <MentionAvatar persona={persona} />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{persona.displayName}</span>
              {persona.provider && (
                <span className="text-[10px] text-foreground-tertiary">
                  {persona.provider}
                  {persona.model
                    ? ` / ${persona.model.split("-").slice(0, 2).join("-")}`
                    : ""}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MentionAvatar({ persona }: { persona: Persona }) {
  if (persona.avatarUrl) {
    return (
      <img
        src={persona.avatarUrl}
        alt={persona.displayName}
        className="h-7 w-7 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full",
        persona.isBuiltin
          ? "bg-foreground/10 text-foreground"
          : "bg-brand/10 text-brand",
      )}
    >
      {persona.isBuiltin ? (
        <Sparkles className="h-3.5 w-3.5" />
      ) : (
        <User className="h-3.5 w-3.5" />
      )}
    </div>
  );
}

// Hook to manage mention detection and keyboard navigation in a textarea
export function useMentionDetection(personas: Persona[] = []) {
  const [mentionState, setMentionState] = useState<{
    isOpen: boolean;
    query: string;
    startIndex: number;
    selectedIndex: number;
  }>({ isOpen: false, query: "", startIndex: -1, selectedIndex: 0 });

  const filtered = useMemo(() => {
    if (!mentionState.isOpen) return personas;
    const q = mentionState.query.toLowerCase();
    if (!q) return personas;
    return personas.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [personas, mentionState.isOpen, mentionState.query]);

  const detectMention = useCallback(
    (value: string, cursorPos: number) => {
      // Look backwards from cursor for an unmatched @
      const beforeCursor = value.slice(0, cursorPos);
      const lastAt = beforeCursor.lastIndexOf("@");

      if (lastAt === -1) {
        if (mentionState.isOpen) {
          setMentionState({
            isOpen: false,
            query: "",
            startIndex: -1,
            selectedIndex: 0,
          });
        }
        return;
      }

      // @ must be at start of input or preceded by whitespace
      if (lastAt > 0 && !/\s/.test(beforeCursor[lastAt - 1])) {
        if (mentionState.isOpen) {
          setMentionState({
            isOpen: false,
            query: "",
            startIndex: -1,
            selectedIndex: 0,
          });
        }
        return;
      }

      const query = beforeCursor.slice(lastAt + 1);

      // Close if there's a space after the query (mention completed) or too long
      if (query.includes(" ") || query.length > 30) {
        if (mentionState.isOpen) {
          setMentionState({
            isOpen: false,
            query: "",
            startIndex: -1,
            selectedIndex: 0,
          });
        }
        return;
      }

      setMentionState((prev) => ({
        isOpen: true,
        query,
        startIndex: lastAt,
        selectedIndex: prev.query !== query ? 0 : prev.selectedIndex,
      }));
    },
    [mentionState.isOpen],
  );

  const closeMention = useCallback(() => {
    setMentionState({
      isOpen: false,
      query: "",
      startIndex: -1,
      selectedIndex: 0,
    });
  }, []);

  /** Move highlight up/down. Returns true if the event was consumed. */
  const navigateMention = useCallback(
    (direction: "up" | "down"): boolean => {
      if (!mentionState.isOpen || filtered.length === 0) return false;
      setMentionState((prev) => {
        const delta = direction === "down" ? 1 : -1;
        const next =
          (prev.selectedIndex + delta + filtered.length) % filtered.length;
        return { ...prev, selectedIndex: next };
      });
      return true;
    },
    [mentionState.isOpen, filtered.length],
  );

  /** Confirm the currently highlighted item. Returns the persona or null. */
  const confirmMention = useCallback((): Persona | null => {
    if (!mentionState.isOpen || filtered.length === 0) return null;
    return filtered[mentionState.selectedIndex] ?? null;
  }, [mentionState.isOpen, mentionState.selectedIndex, filtered]);

  return {
    mentionOpen: mentionState.isOpen,
    mentionQuery: mentionState.query,
    mentionStartIndex: mentionState.startIndex,
    mentionSelectedIndex: mentionState.selectedIndex,
    detectMention,
    closeMention,
    navigateMention,
    confirmMention,
  };
}
