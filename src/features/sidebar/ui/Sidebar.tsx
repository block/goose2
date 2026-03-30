import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Search,
  User,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { GooseIcon } from "@/shared/ui/icons/GooseIcon";
import type { AppView } from "@/app/AppShell";

interface SidebarProps {
  collapsed: boolean;
  width?: number;
  onCollapse: () => void;
  onSettingsClick?: () => void;
  onSearchClick?: () => void;
  onNewChat?: () => void;
  onNavigate?: (view: AppView) => void;
  activeView?: AppView;
  className?: string;
}

const NAV_ITEMS: readonly { id: AppView; label: string; icon: typeof Bot }[] = [
  { id: "agents", label: "Agents", icon: Bot },
  { id: "skills", label: "Skills", icon: BookOpen },
];

const RECENT_CHATS = [
  { id: "1", name: "Debug login flow", time: "2m" },
  { id: "2", name: "API refactor notes", time: "1h" },
  { id: "3", name: "Weekend deploy plan", time: "3h" },
  { id: "4", name: "Design review", time: "1d" },
] as const;

export function Sidebar({
  collapsed,
  width = 240,
  onCollapse,
  onSettingsClick,
  onSearchClick,
  onNewChat,
  onNavigate,
  activeView,
  className,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(!collapsed);
  const prevCollapsed = useRef(collapsed);

  useEffect(() => {
    if (collapsed) {
      setExpanded(false);
    } else if (prevCollapsed.current && !collapsed) {
      const timer = setTimeout(() => setExpanded(true), 60);
      return () => clearTimeout(timer);
    } else {
      setExpanded(true);
    }
    prevCollapsed.current = collapsed;
  }, [collapsed]);

  const labelTransition = "transition-all duration-300 ease-out";
  const labelVisible = expanded && !collapsed;

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden bg-background-secondary border border-border-secondary/50",
        "transition-[width] duration-300 ease-in-out",
        className,
      )}
      style={{ width: collapsed ? 48 : width }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-3 border-b border-border-secondary flex-shrink-0"
          data-tauri-drag-region
        >
          <button
            type="button"
            onClick={() => onNavigate?.("home")}
            className="hover:opacity-70 transition-opacity flex-shrink-0"
            title="Home"
          >
            <GooseIcon className="w-[18px] h-[18px]" />
          </button>

          <button
            type="button"
            onClick={onCollapse}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md",
              "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
              "transition-opacity duration-200",
              collapsed ? "opacity-0 pointer-events-none" : "opacity-100",
            )}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Expand button (collapsed only) */}
        <div
          className={cn(
            "flex justify-center py-1.5 flex-shrink-0 transition-all duration-300",
            collapsed
              ? "opacity-100 h-auto"
              : "opacity-0 h-0 overflow-hidden pointer-events-none",
          )}
        >
          <button
            type="button"
            onClick={onCollapse}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md",
              "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
            )}
            aria-label="Expand sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar */}
        <div
          className={cn(
            "flex-shrink-0 transition-all duration-300 ease-out",
            collapsed ? "px-0 py-1.5 flex justify-center" : "px-3 py-2",
          )}
        >
          <button
            type="button"
            onClick={onSearchClick}
            className={cn(
              "flex items-center rounded-md transition-all duration-300 ease-out",
              collapsed
                ? "justify-center w-7 h-7 mx-auto text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50"
                : "gap-2 w-full px-2.5 py-1.5 border border-border-secondary text-xs text-foreground-secondary hover:text-foreground hover:border-foreground-secondary/30",
            )}
            title={collapsed ? "Search ⌘K" : undefined}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span
              className={cn(
                labelTransition,
                labelVisible
                  ? "opacity-100 w-auto flex-1 text-left"
                  : "opacity-0 w-0 overflow-hidden",
              )}
            >
              Search...
            </span>
            <kbd
              className={cn(
                "text-[10px] text-foreground-tertiary px-1 py-0.5 rounded font-mono flex-shrink-0",
                labelTransition,
                labelVisible
                  ? "opacity-100 w-auto"
                  : "opacity-0 w-0 overflow-hidden px-0",
              )}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation (scrollable) */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1">
          <div className="space-y-0.5">
            {/* New Chat */}
            <button
              type="button"
              onClick={onNewChat}
              title={collapsed ? "New Chat" : undefined}
              className={cn(
                "flex items-center w-full rounded-md text-[13px] transition-all duration-200 text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
                collapsed
                  ? "justify-center px-0 py-1.5"
                  : "gap-2.5 px-3 py-1.5",
              )}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span
                className={cn(
                  labelTransition,
                  labelVisible
                    ? "opacity-100 w-auto"
                    : "opacity-0 w-0 overflow-hidden",
                )}
              >
                New Chat
              </span>
            </button>

            {/* Nav items */}
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center w-full rounded-md text-[13px] transition-all duration-200",
                    collapsed
                      ? "justify-center px-0 py-1.5"
                      : "gap-2.5 px-3 py-1.5",
                    isActive
                      ? "bg-background-secondary text-foreground"
                      : "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    transitionDelay:
                      !collapsed && expanded ? `${index * 30}ms` : "0ms",
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span
                    className={cn(
                      labelTransition,
                      labelVisible
                        ? "opacity-100 w-auto"
                        : "opacity-0 w-0 overflow-hidden",
                    )}
                    style={{
                      transitionDelay: labelVisible
                        ? `${index * 30 + 60}ms`
                        : "0ms",
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div
            className={cn(
              "my-2 mx-auto bg-border-secondary transition-all duration-300",
              collapsed ? "w-5 h-px" : "w-full h-px mx-1.5",
            )}
          />

          {/* Recent section */}
          <div
            className={cn(
              labelTransition,
              labelVisible
                ? "opacity-100 max-h-[2000px]"
                : collapsed
                  ? "opacity-100 max-h-[2000px]"
                  : "opacity-0 max-h-0 overflow-hidden",
            )}
          >
            {/* Section header (expanded only) */}
            <div
              className={cn(
                "flex items-center transition-all duration-300",
                collapsed ? "px-0 pt-0 pb-1 justify-center" : "px-3 pt-2 pb-1",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider text-foreground-secondary/70",
                  labelTransition,
                  labelVisible
                    ? "opacity-100 w-auto"
                    : "opacity-0 w-0 overflow-hidden",
                )}
              >
                Recent
              </span>
            </div>

            {/* Chat items */}
            {collapsed ? (
              <div className="flex flex-col items-center gap-1">
                {RECENT_CHATS.map((chat) => (
                  <button
                    type="button"
                    key={chat.id}
                    title={chat.name}
                    className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200",
                      "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-0.5">
                {RECENT_CHATS.map((chat, index) => (
                  <button
                    key={chat.id}
                    type="button"
                    className={cn(
                      "group flex items-center gap-2 w-full py-1.5 rounded-md text-[13px]",
                      "transition-colors duration-150 px-2.5",
                      "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
                    )}
                    style={{
                      transitionDelay:
                        !collapsed && expanded
                          ? `${(NAV_ITEMS.length + index) * 30}ms`
                          : "0ms",
                    }}
                  >
                    <span className="flex-1 min-w-0 truncate text-left">
                      {chat.name}
                    </span>
                    <span className="text-[10px] text-foreground-secondary/60 flex-shrink-0">
                      {chat.time}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "flex items-center border-t border-border-secondary flex-shrink-0 transition-all duration-300",
            collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
          )}
        >
          <button
            type="button"
            onClick={onSettingsClick}
            className="w-7 h-7 rounded-full bg-background-tertiary flex items-center justify-center overflow-hidden hover:bg-background-tertiary/80 transition-colors cursor-pointer"
            title="Settings"
          >
            <User className="w-3.5 h-3.5 text-foreground-secondary" />
          </button>
        </div>
      </div>
    </div>
  );
}
