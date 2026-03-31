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
}

export function MentionAutocomplete({
  personas,
  query,
  isOpen,
  onSelect,
  anchorRect,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return personas;
    return personas.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [personas, query]);

  // Reset index when results change
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on query/result changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length, query]);

  // Keyboard navigation is handled by the parent textarea's onKeyDown
  // The parent calls navigateMention() which updates selectedIndex
  // and confirmMention() which calls onSelect

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
            onMouseEnter={() => setSelectedIndex(index)}
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
          : "bg-accent/10 text-accent",
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

// Hook to manage mention detection in a textarea
export function useMentionDetection() {
  const [mentionState, setMentionState] = useState<{
    isOpen: boolean;
    query: string;
    startIndex: number;
  }>({ isOpen: false, query: "", startIndex: -1 });

  const detectMention = useCallback(
    (value: string, cursorPos: number) => {
      // Look backwards from cursor for an unmatched @
      const beforeCursor = value.slice(0, cursorPos);
      const lastAt = beforeCursor.lastIndexOf("@");

      if (lastAt === -1) {
        if (mentionState.isOpen) {
          setMentionState({ isOpen: false, query: "", startIndex: -1 });
        }
        return;
      }

      // @ must be at start of input or preceded by whitespace
      if (lastAt > 0 && !/\s/.test(beforeCursor[lastAt - 1])) {
        if (mentionState.isOpen) {
          setMentionState({ isOpen: false, query: "", startIndex: -1 });
        }
        return;
      }

      const query = beforeCursor.slice(lastAt + 1);

      // Close if there's a space after the query (mention completed) or too long
      if (query.includes(" ") || query.length > 30) {
        if (mentionState.isOpen) {
          setMentionState({ isOpen: false, query: "", startIndex: -1 });
        }
        return;
      }

      setMentionState({ isOpen: true, query, startIndex: lastAt });
    },
    [mentionState.isOpen],
  );

  const closeMention = useCallback(() => {
    setMentionState({ isOpen: false, query: "", startIndex: -1 });
  }, []);

  return {
    mentionOpen: mentionState.isOpen,
    mentionQuery: mentionState.query,
    mentionStartIndex: mentionState.startIndex,
    detectMention,
    closeMention,
  };
}
