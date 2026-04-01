import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  FolderOpen,
  GitBranch,
  Info,
  Server,
  X,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface ContextPanelProps {
  projectName?: string;
  projectColor?: string;
  projectWorkingDir?: string | null;
}

function PanelSection({
  title,
  count,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  return (
    <section className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium hover:bg-background-secondary/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </span>
        <span className="flex items-center gap-1.5 text-foreground-secondary">
          {count ? <span>{count}</span> : null}
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
      {isExpanded ? <div className="px-4 pb-3">{children}</div> : null}
    </section>
  );
}

export function ContextPanel({
  projectName,
  projectColor,
  projectWorkingDir,
}: ContextPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "files">("details");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current) return;
      if (
        event.target instanceof Node &&
        !panelRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 shadow-sm",
          "text-xs text-foreground-secondary hover:text-foreground hover:border-foreground-secondary/30",
          "transition-all duration-150",
        )}
        title="Session context"
      >
        <Activity className="h-3.5 w-3.5" />
        <span>Context</span>
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "w-[340px] max-h-[70vh] overflow-hidden rounded-xl border border-border bg-background shadow-xl",
        "animate-in fade-in-0 zoom-in-95 duration-150 origin-top-right",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 pb-2 pt-2.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === "details"
                ? "bg-background-secondary text-foreground"
                : "text-foreground-secondary hover:text-foreground",
            )}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("files")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === "files"
                ? "bg-background-secondary text-foreground"
                : "text-foreground-secondary hover:text-foreground",
            )}
          >
            Files
          </button>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-md p-1.5 text-foreground-secondary hover:bg-background-secondary hover:text-foreground"
          aria-label="Close context panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto">
        {activeTab === "details" ? (
          <>
            <PanelSection
              title="Workspace"
              icon={<FolderOpen className="h-3.5 w-3.5" />}
            >
              <div className="space-y-2 text-xs text-foreground-secondary">
                {projectName ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: projectColor }}
                    />
                    <span className="truncate text-foreground">
                      {projectName}
                    </span>
                  </div>
                ) : (
                  <p>No project assigned.</p>
                )}
                <p className="truncate">
                  {projectWorkingDir
                    ? `Folder: ${projectWorkingDir}`
                    : "Folder not set"}
                </p>
                <p className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5" />
                  Branch: not wired yet
                </p>
                <p className="flex items-center gap-2 text-[11px] text-foreground-secondary/80">
                  <Info className="h-3.5 w-3.5" />
                  Project switching actions are not wired yet in goose2.
                </p>
              </div>
            </PanelSection>

            <PanelSection
              title="Processes"
              icon={<Activity className="h-3.5 w-3.5" />}
            >
              <p className="text-xs text-foreground-secondary">
                Not wired yet in goose2: running/background process state and
                stop actions.
              </p>
            </PanelSection>

            <PanelSection
              title="Changes"
              icon={<FileCode className="h-3.5 w-3.5" />}
            >
              <p className="text-xs text-foreground-secondary">
                Not wired yet in goose2: git file changes and diff counts.
              </p>
            </PanelSection>

            <PanelSection
              title="MCP Servers"
              icon={<Server className="h-3.5 w-3.5" />}
            >
              <p className="text-xs text-foreground-secondary">
                Not wired yet in goose2: configured MCP server discovery and
                status.
              </p>
            </PanelSection>
          </>
        ) : (
          <div className="px-4 pb-4 pt-3">
            <div className="flex items-center gap-2 text-xs text-foreground-secondary">
              <FileText className="h-3.5 w-3.5" />
              <span>Files for this session</span>
            </div>
            <p className="mt-2 text-xs text-foreground-secondary">
              Not wired yet in goose2: artifact list and file opening behavior.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
