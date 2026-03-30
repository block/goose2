import { useState } from "react";
import { Bot, Plus } from "lucide-react";
import { SearchBar } from "@/shared/ui/SearchBar";

export function AgentsView() {
  const [search, setSearch] = useState("");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-5 page-transition">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Agents</h1>
            <p className="text-xs text-foreground-secondary">
              Custom agent configurations for specific workflows
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-background-tertiary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Agent
            </button>
          </div>
        </div>

        {/* Search */}
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search agents by name or description..."
        />

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-foreground-secondary">
          <Bot className="h-10 w-10 opacity-30" />
          <div className="text-center">
            <p className="text-sm font-medium">No agents yet</p>
            <p className="text-xs text-foreground-secondary/60 mt-1">
              Create an agent or add a YAML file to your agents folder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
