import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { PersonaPicker } from "@/features/chat/ui/PersonaPicker";
import {
  MentionAutocomplete,
  useMentionDetection,
} from "@/features/chat/ui/MentionAutocomplete";
import type { Persona } from "@/shared/types/agents";

function HomeClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = time
    .toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
    .replace(/\s?(AM|PM)$/i, "");
  const minutes = time
    .toLocaleTimeString("en-US", { minute: "2-digit" })
    .padStart(2, "0");
  const period = time.getHours() >= 12 ? "PM" : "AM";

  return (
    <div className="mb-1 flex items-baseline gap-1.5 pl-4">
      <span className="text-6xl font-light font-mono tracking-tight text-foreground">
        {hours}:{minutes}
      </span>
      <span className="text-lg text-foreground-secondary">{period}</span>
    </div>
  );
}

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface HomeInputProps {
  onStartChat?: (msg?: string, providerId?: string, personaId?: string) => void;
  personas: Persona[];
  selectedPersonaId: string;
  onPersonaChange: (id: string) => void;
  onCreatePersona?: () => void;
}

function HomeInput({
  onStartChat,
  personas,
  selectedPersonaId,
  onPersonaChange,
  onCreatePersona,
}: HomeInputProps) {
  const [value, setValue] = useState("");
  const [mentionPersonaId, setMentionPersonaId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    mentionOpen,
    mentionQuery,
    mentionStartIndex,
    mentionSelectedIndex,
    detectMention,
    closeMention,
    navigateMention,
    confirmMention,
  } = useMentionDetection(personas);

  const hasContent = value.trim().length > 0;
  const effectivePersonaId = mentionPersonaId ?? selectedPersonaId;
  const selectedPersona = personas.find((p) => p.id === effectivePersonaId);
  const personaName = selectedPersona?.displayName ?? "Goose";

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onStartChat?.(
      trimmed,
      selectedPersona?.provider ?? "goose",
      effectivePersonaId,
    );
    setValue("");
    setMentionPersonaId(null);
  };

  const handleMentionSelect = useCallback(
    (persona: Persona) => {
      const before = value.slice(0, mentionStartIndex);
      const after = value.slice(mentionStartIndex + 1 + mentionQuery.length);
      const newText = `${before}@${persona.displayName} ${after}`;
      setValue(newText);
      setMentionPersonaId(persona.id);
      closeMention();
      onPersonaChange(persona.id);

      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          const cursorPos = before.length + persona.displayName.length + 2;
          ta.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [value, mentionStartIndex, mentionQuery, closeMention, onPersonaChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        navigateMention(e.key === "ArrowDown" ? "down" : "up");
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const persona = confirmMention();
        if (persona) {
          e.preventDefault();
          handleMentionSelect(persona);
          return;
        }
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setValue(val);
    const cursorPos = e.target.selectionStart ?? val.length;
    detectMention(val, cursorPos);
  };

  return (
    <div className="px-4 pb-6 pt-2">
      <div className="relative mx-auto max-w-3xl rounded-2xl border border-border bg-background-secondary px-4 pb-3 pt-4 shadow-lg">
        <MentionAutocomplete
          personas={personas}
          query={mentionQuery}
          isOpen={mentionOpen}
          onSelect={handleMentionSelect}
          onClose={closeMention}
          selectedIndex={mentionSelectedIndex}
        />

        {mentionPersonaId && (
          <div className="mb-2 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
              @{personas.find((p) => p.id === mentionPersonaId)?.displayName}
              <button
                type="button"
                className="ml-0.5 inline-flex items-center opacity-60 hover:opacity-100"
                onClick={() => setMentionPersonaId(null)}
                aria-label="Remove mention"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={`Ask ${personaName} anything... (type @ to mention)`}
          rows={1}
          className="mb-3 min-h-[36px] max-h-[200px] w-full resize-none bg-transparent px-1 text-[14px] leading-relaxed placeholder:text-foreground-tertiary/60 focus:outline-none"
        />
        {/* Bottom bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center">
            <PersonaPicker
              personas={personas}
              selectedPersonaId={selectedPersonaId}
              onPersonaChange={onPersonaChange}
              onCreatePersona={onCreatePersona}
              className="rounded-md border border-border px-2 py-0.5"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-2 text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasContent}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                hasContent
                  ? "bg-foreground text-background-primary hover:opacity-90"
                  : "cursor-default bg-foreground/10 text-foreground-tertiary",
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-foreground-tertiary/40">
        ⏎ to send · ⇧⏎ for newline · @ to mention a persona
      </p>
    </div>
  );
}

interface HomeScreenProps {
  onStartChat?: (
    initialMessage?: string,
    providerId?: string,
    personaId?: string,
  ) => void;
}

export function HomeScreen({ onStartChat }: HomeScreenProps) {
  const [hour] = useState(() => new Date().getHours());
  const greeting = getGreeting(hour);

  const personas = useAgentStore((s) => s.personas);
  const [selectedPersonaId, setSelectedPersonaId] = useState("builtin-goose");

  const handleCreatePersona = useCallback(() => {
    useAgentStore.getState().openPersonaEditor();
  }, []);

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="relative flex min-h-full flex-col items-center justify-center px-6 pb-4">
        <div className="flex w-full max-w-[600px] flex-col">
          {/* Clock */}
          <HomeClock />

          {/* Greeting */}
          <p className="mb-6 pl-4 text-xl font-light text-foreground-secondary">
            {greeting}
          </p>

          {/* Chat input */}
          <HomeInput
            onStartChat={onStartChat}
            personas={personas}
            selectedPersonaId={selectedPersonaId}
            onPersonaChange={setSelectedPersonaId}
            onCreatePersona={handleCreatePersona}
          />
        </div>
      </div>
    </div>
  );
}
