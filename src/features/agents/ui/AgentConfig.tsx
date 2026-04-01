import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/shared/ui/button";
import type {
  Agent,
  Persona,
  ProviderType,
  AgentConnectionType,
  CreateAgentRequest,
} from "@/shared/types/agents";

interface AgentConfigProps {
  agent?: Agent;
  personas: Persona[];
  onSave: (config: CreateAgentRequest) => void;
  onCancel: () => void;
}

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: "goose", label: "Goose" },
  { value: "claude", label: "Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "ollama", label: "Ollama" },
  { value: "custom", label: "Custom" },
];

export function AgentConfig({
  agent,
  personas,
  onSave,
  onCancel,
}: AgentConfigProps) {
  const [name, setName] = useState(agent?.name ?? "");
  const [personaId, setPersonaId] = useState(agent?.personaId ?? "");
  const connectionType: AgentConnectionType = "builtin";
  const [provider, setProvider] = useState<ProviderType>(
    agent?.provider ?? "goose",
  );
  const [model, setModel] = useState(agent?.model ?? "");
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt ?? "");
  const [promptExpanded, setPromptExpanded] = useState(false);

  const selectedPersona = useMemo(
    () => personas.find((p) => p.id === personaId),
    [personas, personaId],
  );

  // Sync inherited fields when persona changes
  useEffect(() => {
    if (selectedPersona) {
      setProvider(selectedPersona.provider ?? "goose");
      setModel(selectedPersona.model ?? "");
      setSystemPrompt(selectedPersona.systemPrompt);
    }
  }, [selectedPersona]);

  const isValid = name.trim().length > 0 && !!provider;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid) return;

      const config: CreateAgentRequest = {
        name: name.trim(),
        personaId: personaId || undefined,
        provider,
        model: model.trim(),
        systemPrompt: systemPrompt.trim() || undefined,
        connectionType,
      };
      onSave(config);
    },
    [isValid, name, personaId, provider, model, systemPrompt, onSave],
  );

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Agent configuration"
      className="space-y-4"
    >
      {/* Name */}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          Name <span className="text-destructive">*</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="My Agent"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
        />
      </label>

      {/* Persona selector */}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          Persona
        </span>
        <select
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
        >
          <option value="">None</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
              {p.isBuiltin ? " (built-in)" : ""}
            </option>
          ))}
        </select>
      </label>

      {/* Provider */}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          Provider
          {selectedPersona?.provider && (
            <span className="ml-1 text-muted-foreground">
              (from persona: {selectedPersona.provider})
            </span>
          )}
        </span>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderType)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
        >
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* Model override */}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          Model
          {selectedPersona?.model && (
            <span className="ml-1 text-muted-foreground">
              (from persona: {selectedPersona.model})
            </span>
          )}
        </span>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="e.g. claude-sonnet-4-20250514"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
        />
      </label>

      {/* System prompt override */}
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setPromptExpanded((v) => !v)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          System Prompt Override {promptExpanded ? "[-]" : "[+]"}
        </button>
        {promptExpanded && (
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            placeholder="Override the persona system prompt..."
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!isValid}>
          {agent ? "Update Agent" : "Create Agent"}
        </Button>
      </div>
    </form>
  );
}
