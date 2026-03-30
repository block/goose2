import { useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { Persona } from "@/shared/types/agents";
import { PersonaCard } from "@/features/agents/ui/PersonaCard";

interface PersonaGalleryProps {
  personas: Persona[];
  activePersonaId?: string;
  onSelectPersona: (persona: Persona) => void;
  onEditPersona: (persona: Persona) => void;
  onDuplicatePersona: (persona: Persona) => void;
  onDeletePersona: (persona: Persona) => void;
  onExportPersona?: (persona: Persona) => void;
  onCreatePersona: () => void;
  isLoading?: boolean;
}

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col items-center gap-3 rounded-xl border border-border p-5 motion-safe:animate-pulse"
    >
      <div className="h-12 w-12 rounded-full bg-background-secondary" />
      <div className="h-4 w-24 rounded bg-background-secondary" />
      <div className="h-3 w-full rounded bg-background-secondary" />
      <div className="h-3 w-3/4 rounded bg-background-secondary" />
    </div>
  );
}

export function PersonaGallery({
  personas,
  activePersonaId,
  onSelectPersona,
  onEditPersona,
  onDuplicatePersona,
  onDeletePersona,
  onExportPersona,
  onCreatePersona,
  isLoading = false,
}: PersonaGalleryProps) {
  const sorted = useMemo(() => {
    const builtins = personas
      .filter((p) => p.isBuiltin)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    const custom = personas
      .filter((p) => !p.isBuiltin)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    return [...builtins, ...custom];
  }, [personas]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading personas"
        className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {sorted.map((persona) => (
        <PersonaCard
          key={persona.id}
          persona={persona}
          isActive={persona.id === activePersonaId}
          onSelect={onSelectPersona}
          onEdit={onEditPersona}
          onDuplicate={onDuplicatePersona}
          onDelete={onDeletePersona}
          onExport={onExportPersona}
        />
      ))}

      {/* Create new card */}
      <button
        type="button"
        onClick={onCreatePersona}
        aria-label="Create new persona"
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-5",
          "text-foreground-secondary/60 transition-colors",
          "hover:border-border-primary/50 hover:text-foreground-secondary hover:bg-background-secondary/50",
        )}
      >
        <Plus className="h-8 w-8" />
        <span className="text-sm font-medium">New Persona</span>
      </button>
    </div>
  );
}
