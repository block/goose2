import { useState, useMemo, useCallback, useRef } from "react";
import { Bot, Plus, Circle, Upload } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { SearchBar } from "@/shared/ui/SearchBar";
import { Button, buttonVariants } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { PersonaGallery } from "@/features/agents/ui/PersonaGallery";
import { PersonaEditor } from "@/features/agents/ui/PersonaEditor";
import { exportPersona, importPersonas } from "@/shared/api/agents";
import { usePersonas } from "@/features/agents/hooks/usePersonas";
import type {
  Persona,
  Agent,
  AgentStatus,
  CreatePersonaRequest,
  UpdatePersonaRequest,
} from "@/shared/types/agents";

const STATUS_STYLES: Record<AgentStatus, { dot: string; label: string }> = {
  online: { dot: "text-green-500", label: "Online" },
  offline: { dot: "text-muted-foreground", label: "Offline" },
  starting: { dot: "text-yellow-500", label: "Starting" },
  error: { dot: "text-red-500", label: "Error" },
};

function AgentRow({ agent }: { agent: Agent }) {
  const status = STATUS_STYLES[agent.status];
  return (
    <li className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3 min-w-0">
        <Bot className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{agent.name}</p>
          {agent.persona && (
            <p className="text-xs text-muted-foreground truncate">
              {agent.persona.displayName}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Circle
          className={cn("h-2.5 w-2.5 fill-current", status.dot)}
          aria-hidden="true"
        />
        <span className="text-xs text-muted-foreground">{status.label}</span>
      </div>
    </li>
  );
}

export function AgentsView() {
  const [search, setSearch] = useState("");
  const [deletingPersona, setDeletingPersona] = useState<Persona | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const personas = useAgentStore((s) => s.personas);
  const personasLoading = useAgentStore((s) => s.personasLoading);
  const agents = useAgentStore((s) => s.agents);
  const personaEditorOpen = useAgentStore((s) => s.personaEditorOpen);
  const editingPersona = useAgentStore((s) => s.editingPersona);
  const openPersonaEditor = useAgentStore((s) => s.openPersonaEditor);
  const closePersonaEditor = useAgentStore((s) => s.closePersonaEditor);
  const addPersona = useAgentStore((s) => s.addPersona);

  const {
    createPersona,
    updatePersona: updatePersonaViaHook,
    deletePersona,
    refreshFromDisk,
  } = usePersonas();

  const lowerSearch = search.toLowerCase();

  const filteredPersonas = useMemo(
    () =>
      personas.filter(
        (p) =>
          p.displayName.toLowerCase().includes(lowerSearch) ||
          p.systemPrompt.toLowerCase().includes(lowerSearch),
      ),
    [personas, lowerSearch],
  );

  const filteredAgents = useMemo(
    () =>
      agents.filter(
        (a) =>
          a.name.toLowerCase().includes(lowerSearch) ||
          a.persona?.displayName.toLowerCase().includes(lowerSearch),
      ),
    [agents, lowerSearch],
  );

  const handleSavePersona = useCallback(
    async (data: CreatePersonaRequest | UpdatePersonaRequest) => {
      if (editingPersona) {
        await updatePersonaViaHook(
          editingPersona.id,
          data as UpdatePersonaRequest,
        );
      } else {
        await createPersona(data as CreatePersonaRequest);
      }
      closePersonaEditor();
    },
    [editingPersona, createPersona, updatePersonaViaHook, closePersonaEditor],
  );

  const handleDuplicatePersona = useCallback(
    (persona: Persona) => {
      const duplicate: Persona = {
        ...persona,
        id: crypto.randomUUID(),
        displayName: `${persona.displayName} (Copy)`,
        isBuiltin: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addPersona(duplicate);
    },
    [addPersona],
  );

  const handleDeletePersona = useCallback((persona: Persona) => {
    if (persona.isBuiltin) return;
    setDeletingPersona(persona);
  }, []);

  const handleConfirmDeletePersona = useCallback(async () => {
    if (!deletingPersona) return;
    try {
      await deletePersona(deletingPersona.id);
    } catch (err) {
      console.error("Failed to delete persona:", err);
    }
    setDeletingPersona(null);
  }, [deletingPersona, deletePersona]);

  const handleExportPersona = useCallback(async (persona: Persona) => {
    try {
      const result = await exportPersona(persona.id);
      // Trigger a browser download with the JSON content
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.suggestedFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotification(`Exported to ${result.suggestedFilename}`);
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error("Failed to export persona:", err);
    }
  }, []);

  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));
        await importPersonas(bytes, file.name);
        await refreshFromDisk();
      } catch (err) {
        console.error("Failed to import persona:", err);
      }

      // Reset the input so the same file can be re-selected
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    },
    [refreshFromDisk],
  );

  const handleImportFileBytes = useCallback(
    async (fileBytes: number[], fileName: string) => {
      try {
        await importPersonas(fileBytes, fileName);
        await refreshFromDisk();
      } catch (err) {
        console.error("Failed to import persona:", err);
      }
    },
    [refreshFromDisk],
  );

  return (
    <div className="flex flex-1 flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-5 page-transition">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">Personas</h1>
              <p className="text-xs text-muted-foreground">
                Custom persona configurations for specific workflows
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".persona.json,.json"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openPersonaEditor()}
              >
                <Plus className="w-3.5 h-3.5" />
                New Persona
              </Button>
            </div>
          </div>

          {/* Search */}
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search personas..."
          />

          {/* Personas section */}
          <section aria-labelledby="personas-heading">
            <h2 id="personas-heading" className="text-sm font-semibold mb-3">
              Personas
            </h2>
            <PersonaGallery
              personas={filteredPersonas}
              onSelectPersona={(p) => openPersonaEditor(p)}
              onEditPersona={(p) => openPersonaEditor(p)}
              onDuplicatePersona={handleDuplicatePersona}
              onDeletePersona={handleDeletePersona}
              onExportPersona={handleExportPersona}
              onCreatePersona={() => openPersonaEditor()}
              onImportFile={handleImportFileBytes}
              isLoading={personasLoading}
            />
          </section>

          {/* Active Agents section */}
          <section aria-labelledby="agents-heading">
            <h2 id="agents-heading" className="text-sm font-semibold mb-3">
              Active Agents
            </h2>
            {filteredAgents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <Bot className="h-10 w-10 opacity-30" />
                <div className="text-center">
                  <p className="text-sm font-medium">No active agents</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create an agent from a persona to get started.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="space-y-2" aria-label="Active agents">
                {filteredAgents.map((agent) => (
                  <AgentRow key={agent.id} agent={agent} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Persona editor modal */}
      <PersonaEditor
        persona={editingPersona ?? undefined}
        isOpen={personaEditorOpen}
        onClose={closePersonaEditor}
        onSave={handleSavePersona}
        onDuplicate={handleDuplicatePersona}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deletingPersona}
        onOpenChange={(open) => !open && setDeletingPersona(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete persona?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {deletingPersona?.displayName}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={handleConfirmDeletePersona}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export notification toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-background px-4 py-3 shadow-popover text-sm animate-in fade-in slide-in-from-bottom-2">
          {notification}
        </div>
      )}
    </div>
  );
}
