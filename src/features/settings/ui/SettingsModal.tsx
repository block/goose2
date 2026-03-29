import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Palette, Settings2, Info, X } from "lucide-react";
import { AppearanceSettings } from "./AppearanceSettings";

const NAV_ITEMS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "general", label: "General", icon: Settings2 },
  { id: "about", label: "About", icon: Info },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]["id"];

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("appearance");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[600px] w-full max-w-3xl overflow-hidden rounded-xl border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="flex w-44 flex-col border-r bg-muted/50">
          <div className="px-4 py-4">
            <h2 className="text-sm font-semibold">Settings</h2>
          </div>
          <nav className="flex flex-col gap-1 px-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  activeSection === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-6 py-4">
            {activeSection === "appearance" && <AppearanceSettings />}
            {activeSection === "general" && (
              <div>
                <h3 className="text-lg font-semibold">General</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  General settings will appear here.
                </p>
              </div>
            )}
            {activeSection === "about" && (
              <div>
                <h3 className="text-lg font-semibold">About</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  About information will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
