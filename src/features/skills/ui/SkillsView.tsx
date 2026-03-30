import { useState, useEffect, useCallback } from "react";
import { AtSign, Plus, Trash2 } from "lucide-react";
import { SearchBar } from "@/shared/ui/SearchBar";
import { CreateSkillDialog } from "./CreateSkillDialog";
import { listSkills, deleteSkill, type SkillInfo } from "../api/skills";

export function SkillsView() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSkills = useCallback(async () => {
    try {
      const result = await listSkills();
      setSkills(result);
    } catch {
      // skills directory may not exist yet
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleDelete = async (name: string) => {
    try {
      await deleteSkill(name);
      await loadSkills();
    } catch {
      // best-effort
    }
  };

  const filtered = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-5 page-transition">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Skills</h1>
            <p className="text-xs text-foreground-secondary">
              Reusable instructions for your AI personas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-background-tertiary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Skill
            </button>
          </div>
        </div>

        {/* Search */}
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search skills by name or description..."
        />

        {/* Skills list */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((skill) => (
              <div
                key={skill.name}
                className="flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium font-mono">{skill.name}</p>
                  {skill.description && (
                    <p className="text-xs text-foreground-secondary mt-0.5">
                      {skill.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(skill.name)}
                  className="shrink-0 rounded-md p-1 text-foreground-secondary hover:text-foreground-danger hover:bg-background-secondary transition-colors"
                  aria-label={`Delete ${skill.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-foreground-secondary">
            <AtSign className="h-10 w-10 opacity-30" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {skills.length === 0 ? "No skills yet" : "No matching skills"}
              </p>
              <p className="text-xs text-foreground-secondary/60 mt-1">
                {skills.length === 0
                  ? "Skills you add will appear here."
                  : "Try a different search term."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CreateSkillDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={loadSkills}
      />
    </div>
  );
}
