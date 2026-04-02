import { useState, useEffect, useCallback, useRef } from "react";
import {
  AtSign,
  Plus,
  Trash2,
  MoreHorizontal,
  Pencil,
  Copy,
  Download,
  Upload,
} from "lucide-react";
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
import { useFileImportZone } from "@/shared/hooks/useFileImportZone";
import { CreateSkillDialog } from "./CreateSkillDialog";
import {
  listSkills,
  deleteSkill,
  createSkill,
  exportSkill,
  importSkills,
  type SkillInfo,
} from "../api/skills";

function SkillCardMenu({
  skill,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
}: {
  skill: SkillInfo;
  onEdit: (skill: SkillInfo) => void;
  onDuplicate: (skill: SkillInfo) => void;
  onExport: (skill: SkillInfo) => void;
  onDelete: (skill: SkillInfo) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Options for ${skill.name}`}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
        className="size-6 rounded-md text-muted-foreground hover:text-foreground"
      >
        <MoreHorizontal className="size-3.5" />
      </Button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-border bg-background py-1 shadow-popover"
        >
          <Button
            type="button"
            variant="ghost"
            size="xs"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onEdit(skill);
            }}
            className="w-full justify-start"
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onDuplicate(skill);
            }}
            className="w-full justify-start"
          >
            <Copy className="size-3.5" />
            Duplicate
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onExport(skill);
            }}
            className="w-full justify-start"
          >
            <Download className="size-3.5" />
            Export
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onDelete(skill);
            }}
            className="w-full justify-start text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

export function SkillsView() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<
    { name: string; description: string; instructions: string } | undefined
  >(undefined);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingSkill, setDeletingSkill] = useState<SkillInfo | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  const handleDelete = (skill: SkillInfo) => {
    setDeletingSkill(skill);
  };

  const handleConfirmDeleteSkill = async () => {
    if (!deletingSkill) return;
    try {
      await deleteSkill(deletingSkill.name);
      await loadSkills();
    } catch {
      // best-effort
    }
    setDeletingSkill(null);
  };

  const handleEdit = (skill: SkillInfo) => {
    setEditingSkill({
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
    });
    setDialogOpen(true);
  };

  const handleDuplicate = async (skill: SkillInfo) => {
    const existingNames = new Set(skills.map((s) => s.name));
    let copyName = `${skill.name}-copy`;
    let counter = 2;
    while (existingNames.has(copyName)) {
      copyName = `${skill.name}-copy-${counter}`;
      counter++;
    }
    try {
      await createSkill(copyName, skill.description, skill.instructions);
      await loadSkills();
    } catch {
      // best-effort
    }
  };

  const handleExport = async (skill: SkillInfo) => {
    try {
      const result = await exportSkill(skill.name);
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotification(`Exported to ${result.filename}`);
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error("Failed to export skill:", err);
    }
  };

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));
        await importSkills(bytes, file.name);
        await loadSkills();
      } catch (err) {
        console.error("Failed to import skill:", err);
      }

      // Reset the input so the same file can be re-selected
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    },
    [loadSkills],
  );

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingSkill(undefined);
  };

  const handleNewSkill = () => {
    setEditingSkill(undefined);
    setDialogOpen(true);
  };

  const handleDropImport = useCallback(
    async (fileBytes: number[], fileName: string) => {
      try {
        await importSkills(fileBytes, fileName);
        await loadSkills();
      } catch (err) {
        console.error("Failed to import skill:", err);
      }
    },
    [loadSkills],
  );

  const {
    fileInputRef: dropFileInputRef,
    isDragOver,
    dropHandlers,
    handleFileChange: handleDropFileChange,
  } = useFileImportZone({ onImportFile: handleDropImport });

  const filtered = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-1 flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-5 page-transition">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold font-display tracking-tight">
                Skills
              </h1>
              <p className="text-xs text-muted-foreground">
                Reusable instructions for your AI personas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".skill.json,.json"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="size-3.5" />
                Import
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleNewSkill}
              >
                <Plus className="size-3.5" />
                New Skill
              </Button>
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
                    <p className="text-sm font-medium font-mono">
                      {skill.name}
                    </p>
                    {skill.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {skill.description}
                      </p>
                    )}
                  </div>
                  <SkillCardMenu
                    skill={skill}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onExport={handleExport}
                    onDelete={handleDelete}
                  />
                </div>
              ))}

              {/* New Skill card */}
              <Button
                type="button"
                variant="ghost"
                onClick={handleNewSkill}
                {...dropHandlers}
                className={cn(
                  "h-auto w-full rounded-lg border border-dashed px-4 py-3 text-muted-foreground",
                  isDragOver
                    ? "border-ring bg-muted"
                    : "border-border hover:border-border hover:bg-accent/50",
                )}
              >
                <Plus className="size-4" />
                <span className="text-sm">New Skill</span>
                <span className="ml-1 text-xs">or drop a file</span>
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div
              {...dropHandlers}
              className={cn(
                "flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground rounded-lg border border-dashed transition-colors",
                isDragOver ? "border-ring bg-muted" : "border-transparent",
              )}
            >
              <AtSign className="h-10 w-10 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {skills.length === 0 ? "No skills yet" : "No matching skills"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {skills.length === 0
                    ? "Create a skill or drop a .skill.json file here."
                    : "Try a different search term."}
                </p>
              </div>
              {skills.length === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleNewSkill}
                  className="mt-2"
                >
                  <Plus className="size-3.5" />
                  New Skill
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for drag-and-drop import */}
      <input
        ref={dropFileInputRef}
        type="file"
        accept=".skill.json,.json"
        className="hidden"
        onChange={handleDropFileChange}
      />

      {/* Create / Edit dialog */}
      <CreateSkillDialog
        isOpen={dialogOpen}
        onClose={handleDialogClose}
        onCreated={loadSkills}
        editingSkill={editingSkill}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deletingSkill}
        onOpenChange={(open) => !open && setDeletingSkill(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete skill?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingSkill?.name}&quot;?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={handleConfirmDeleteSkill}
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
