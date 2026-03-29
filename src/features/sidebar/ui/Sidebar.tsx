import { Plus, MessageCircle, Hash, Settings2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface SidebarProps {
  isOpen: boolean;
  onSettingsClick?: () => void;
}

const recentItems = [
  { id: "1", icon: MessageCircle, label: "Debug login flow" },
  { id: "2", icon: Hash, label: "API refactor notes" },
  { id: "3", icon: MessageCircle, label: "Weekend deploy plan" },
  { id: "4", icon: Hash, label: "Design review" },
];

export function Sidebar({ isOpen, onSettingsClick }: SidebarProps) {
  return (
    <aside
      className={cn(
        "h-full flex-shrink-0 bg-background-secondary/90 backdrop-blur-xl border-r border-border/50 transition-[width] duration-300 ease-in-out overflow-hidden",
        isOpen ? "w-56" : "w-12"
      )}
    >
      <div
        className={cn(
          "flex flex-col h-full",
          isOpen ? "w-56" : "w-12"
        )}
      >
        {/* New Chat button */}
        <div className={cn("py-2", isOpen ? "px-3" : "px-1")}>
          <button
            type="button"
            title="New Chat"
            className={cn(
              "flex items-center rounded-md text-sm text-foreground-secondary hover:text-foreground hover:bg-background-secondary/50 cursor-pointer transition-colors w-full",
              isOpen ? "gap-2 px-3 py-1.5" : "justify-center px-0 py-1.5"
            )}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {isOpen && <span>New Chat</span>}
          </button>
        </div>

        {/* Recent section */}
        <div className="mt-4 flex flex-col gap-0.5">
          {isOpen && (
            <span className="px-3 py-1.5 text-xs font-medium text-foreground-tertiary uppercase tracking-wider">
              Recent
            </span>
          )}
          <nav className={cn("flex flex-col gap-0.5", isOpen ? "px-1.5" : "px-1")}>
            {recentItems.map((item) => (
              <button
                type="button"
                key={item.id}
                title={item.label}
                className={cn(
                  "flex items-center rounded-md text-sm text-foreground-secondary hover:text-foreground hover:bg-background-secondary/50 cursor-pointer transition-colors",
                  isOpen ? "gap-2 px-3 py-1.5" : "justify-center px-0 py-1.5"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {isOpen && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer — pinned to bottom */}
        <div className={cn(
          "mt-auto flex items-center border-t border-border flex-shrink-0 transition-all duration-300",
          isOpen ? "px-3 py-2" : "justify-center px-0 py-2"
        )}>
          <button
            type="button"
            onClick={onSettingsClick}
            title="Settings"
            className={cn(
              "flex items-center rounded-md text-sm text-foreground-secondary hover:text-foreground hover:bg-background-secondary/50 w-full transition-colors cursor-pointer",
              isOpen ? "gap-2 px-2 py-1.5" : "justify-center px-0 py-1.5"
            )}
          >
            <Settings2 className="h-4 w-4 shrink-0" />
            {isOpen && <span>Settings</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
