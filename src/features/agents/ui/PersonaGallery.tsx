import { useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { Persona } from "@/shared/types/agents";
import { PersonaCard } from "@/features/agents/ui/PersonaCard";
import { useFileImportZone } from "@/shared/hooks/useFileImportZone";

interface PersonaGalleryProps {
  personas: Persona[];
  activePersonaId?: string;
  onSelectPersona: (persona: Persona) => void;
  onEditPersona: (persona: Persona) => void;
  onDuplicatePersona: (persona: Persona) => void;
  onDeletePersona: (persona: Persona) => void;
  onExportPersona?: (persona: Persona) => void;
  onCreatePersona: () => void;
  onImportFile?: (fileBytes: number[], fileName: string) => void;
  isLoading?: boolean;
}

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col items-center gap-3 rounded-xl border border-border p-5 motion-safe:animate-pulse"
    >
      <div className="h-12 w-12 rounded-full bg-muted" />
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-3/4 rounded bg-muted" />
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
  onImportFile,
  isLoading = false,
}: PersonaGalleryProps) {
  const { fileInputRef, isDragOver, dropHandlers, handleFileChange } =
    useFileImportZone({
      onImportFile: onImportFile ?? (() => {}),
    });
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
        {...dropHandlers}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5",
          "text-muted-foreground transition-colors",
          "hover:border-border hover:text-muted-foreground hover:bg-muted/50",
          isDragOver
            ? "border-border bg-muted/50 text-muted-foreground"
            : "border-border",
        )}
      >
        <Plus className="h-8 w-8" />
        <span className="text-sm font-medium">New Persona</span>
        {onImportFile && (
          <span className="text-[11px] text-muted-foreground">
            or drop a file
          </span>
        )}
      </button>
      {onImportFile && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".persona.json,.json"
          className="hidden"
          onChange={handleFileChange}
        />
      )}
    </div>
  );
}
