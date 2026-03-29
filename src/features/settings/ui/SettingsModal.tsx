import { useState, useEffect } from "react";
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Trigger entrance animations after mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Content transition on section change
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 150);
    return () => clearTimeout(timer);
  }, [activeSection]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300",
        isLoaded ? "opacity-100" : "opacity-0",
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "flex h-[600px] w-full max-w-3xl overflow-hidden rounded-xl border bg-background shadow-2xl transition-all duration-500 ease-out",
          isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95",
          isTransitioning ? "scale-[0.98]" : "scale-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div
          className={cn(
            "flex w-44 flex-col border-r bg-background-secondary/50 transition-all duration-700 ease-out",
            isLoaded
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-6",
          )}
        >
          <div
            className={cn(
              "px-4 py-4 transition-all duration-500 ease-out",
              isLoaded
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-2",
            )}
          >
            <h2 className="text-sm font-semibold">Settings</h2>
          </div>
          <nav className="flex flex-col gap-1 px-2">
            {NAV_ITEMS.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-[600ms] ease-out",
                  activeSection === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground-secondary hover:bg-background-secondary/50 hover:text-foreground duration-300",
                  isLoaded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4",
                )}
                style={{
                  transitionDelay: isLoaded
                    ? "0ms"
                    : `${index * 40 + 300}ms`,
                }}
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
            className="absolute right-4 top-4 rounded-md p-1 text-foreground-secondary transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            className={cn(
              "px-6 py-4 transition-all duration-[400ms] ease-out",
              isTransitioning
                ? "opacity-0 translate-y-2"
                : "opacity-100 translate-y-0",
            )}
          >
            <div
              className={cn(
                "transition-all duration-[600ms] ease-out",
                isLoaded
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4",
              )}
              style={{
                transitionDelay: isLoaded ? "400ms" : "0ms",
              }}
            >
              {activeSection === "appearance" && <AppearanceSettings />}
              {activeSection === "general" && (
                <div>
                  <h3 className="text-lg font-semibold">General</h3>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    General settings will appear here.
                  </p>
                </div>
              )}
              {activeSection === "about" && (
                <div>
                  <h3 className="text-lg font-semibold">About</h3>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    About information will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
