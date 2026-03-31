import { useMemo } from "react";
import { ChevronDown, Check, Plus, Sparkles, User } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import type { Persona } from "@/shared/types/agents";

interface PersonaPickerProps {
  personas: Persona[];
  selectedPersonaId: string | null;
  onPersonaChange: (personaId: string) => void;
  onCreatePersona?: () => void;
  compact?: boolean;
  className?: string;
}

export function PersonaPicker({
  personas,
  selectedPersonaId,
  onPersonaChange,
  onCreatePersona,
  compact = false,
  className,
}: PersonaPickerProps) {
  const selected = useMemo(
    () => personas.find((p) => p.id === selectedPersonaId) ?? personas[0],
    [personas, selectedPersonaId],
  );

  const builtinPersonas = useMemo(
    () => personas.filter((p) => p.isBuiltin),
    [personas],
  );
  const customPersonas = useMemo(
    () => personas.filter((p) => !p.isBuiltin),
    [personas],
  );

  const label = selected?.displayName ?? "Select persona";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background-tertiary",
            className,
          )}
          aria-label="Select persona"
        >
          <PersonaAvatar persona={selected} size="sm" />
          {!compact && <span>{label}</span>}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {builtinPersonas.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-foreground-tertiary">
              Built-in
            </DropdownMenuLabel>
            {builtinPersonas.map((persona) => (
              <PersonaMenuItem
                key={persona.id}
                persona={persona}
                isSelected={persona.id === selectedPersonaId}
                onSelect={() => onPersonaChange(persona.id)}
              />
            ))}
          </>
        )}
        {customPersonas.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-foreground-tertiary">
              Custom
            </DropdownMenuLabel>
            {customPersonas.map((persona) => (
              <PersonaMenuItem
                key={persona.id}
                persona={persona}
                isSelected={persona.id === selectedPersonaId}
                onSelect={() => onPersonaChange(persona.id)}
              />
            ))}
          </>
        )}
        {onCreatePersona && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onCreatePersona}>
              <Plus className="mr-2 h-3.5 w-3.5 text-foreground-tertiary" />
              <span className="text-sm">Create persona...</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PersonaMenuItem({
  persona,
  isSelected,
  onSelect,
}: {
  persona: Persona;
  isSelected: boolean;
  onSelect: () => void;
}) {
  // Extract a short description from the system prompt (first sentence)
  const shortDesc = useMemo(() => {
    const first = persona.systemPrompt.split(/\.\s/)[0] ?? "";
    return first.length > 60 ? `${first.slice(0, 57)}...` : first;
  }, [persona.systemPrompt]);

  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className="flex items-start gap-2.5 py-2"
    >
      <PersonaAvatar persona={persona} size="md" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{persona.displayName}</span>
        {shortDesc && (
          <span className="text-[11px] leading-snug text-foreground-tertiary">
            {shortDesc}
          </span>
        )}
      </div>
      {isSelected && (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground-secondary" />
      )}
    </DropdownMenuItem>
  );
}

function PersonaAvatar({
  persona,
  size = "sm",
}: {
  persona?: Persona;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  const iconDim = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";

  if (persona?.avatarUrl) {
    return (
      <img
        src={persona.avatarUrl}
        alt={persona.displayName}
        className={cn(dim, "rounded-full object-cover")}
      />
    );
  }

  const isBuiltin = persona?.isBuiltin ?? true;

  return (
    <div
      className={cn(
        dim,
        "flex items-center justify-center rounded-full",
        isBuiltin
          ? "bg-foreground/10 text-foreground"
          : "bg-accent/10 text-accent",
      )}
    >
      {isBuiltin ? (
        <Sparkles className={iconDim} />
      ) : (
        <User className={iconDim} />
      )}
    </div>
  );
}
