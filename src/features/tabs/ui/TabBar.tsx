import { Home, PanelLeft, Plus, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { Tab } from "@/features/tabs/types";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
  onHomeClick: () => void;
  onSidebarToggle: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onHomeClick,
  onSidebarToggle,
}: TabBarProps) {
  return (
    <div
      data-tauri-drag-region
      className="flex h-10 w-full items-center border-b border-border bg-background/80 pl-20 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onSidebarToggle}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-background-secondary/50 hover:text-foreground"
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onHomeClick}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-background-secondary/50 hover:text-foreground"
        aria-label="Home"
      >
        <Home className="h-4 w-4" />
      </button>

      <div role="tablist" className="flex items-center gap-0.5 overflow-x-auto px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTabId}
            onClick={() => onTabSelect(tab.id)}
            className={cn(
              "group flex h-7 items-center gap-1.5 rounded-md px-3 text-xs transition-colors",
              tab.id === activeTabId
                ? "bg-background-secondary text-foreground"
                : "text-foreground-secondary hover:bg-background-secondary/50 hover:text-foreground",
            )}
          >
            <span className="truncate">{tab.title}</span>
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }
              }}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-background-secondary group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onNewTab}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-background-secondary/50 hover:text-foreground"
        aria-label="New tab"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
