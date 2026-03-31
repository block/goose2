import { useState, useEffect, useRef } from "react";
import { ArrowUp, Paperclip, Bot, ChevronDown, Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { discoverAcpProviders, type AcpProvider } from "@/shared/api/acp";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";

function HomeClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = time
    .toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
    .replace(/\s?(AM|PM)$/i, "");
  const minutes = time
    .toLocaleTimeString("en-US", { minute: "2-digit" })
    .padStart(2, "0");
  const period = time.getHours() >= 12 ? "PM" : "AM";

  return (
    <div className="mb-1 flex items-baseline gap-1.5 pl-4">
      <span className="text-6xl font-light font-mono tracking-tight text-foreground">
        {hours}:{minutes}
      </span>
      <span className="text-lg text-foreground-secondary">{period}</span>
    </div>
  );
}

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface HomeInputProps {
  onStartChat?: (msg?: string, providerId?: string) => void;
  providers: AcpProvider[];
  selectedProvider: string;
  onProviderChange: (id: string) => void;
}

function HomeInput({
  onStartChat,
  providers,
  selectedProvider,
  onProviderChange,
}: HomeInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = value.trim().length > 0;

  const providerLabel =
    providers.find((p) => p.id === selectedProvider)?.label ?? selectedProvider;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onStartChat?.(trimmed, selectedProvider);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-4 pb-6 pt-2">
      <div className="relative max-w-3xl mx-auto rounded-2xl px-4 pt-4 pb-3 bg-background-secondary border border-border shadow-lg">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask ${providerLabel} anything...`}
          rows={1}
          className="w-full resize-none bg-transparent text-[14px] leading-relaxed px-1 placeholder:text-muted-foreground/60 focus:outline-none min-h-[36px] max-h-[200px] mb-3"
        />
        {/* Bottom bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-background-tertiary"
                  aria-label="Select provider"
                >
                  <Bot className="h-3 w-3" />
                  <span>{providerLabel}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Provider</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {providers.length > 0 ? (
                  providers.map((provider) => (
                    <DropdownMenuItem
                      key={provider.id}
                      onSelect={() => onProviderChange(provider.id)}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium">
                        {provider.label}
                      </span>
                      {provider.id === selectedProvider && (
                        <Check className="h-4 w-4 shrink-0 text-foreground-secondary" />
                      )}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>
                    <span className="text-xs text-foreground-tertiary">
                      No providers detected
                    </span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasContent}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                hasContent
                  ? "bg-foreground text-background hover:opacity-90"
                  : "bg-foreground/10 text-muted-foreground cursor-default",
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
        ⏎ to send · ⇧⏎ for newline
      </p>
    </div>
  );
}

interface HomeScreenProps {
  onStartChat?: (initialMessage?: string, providerId?: string) => void;
}

export function HomeScreen({ onStartChat }: HomeScreenProps) {
  const [hour] = useState(() => new Date().getHours());
  const greeting = getGreeting(hour);

  const [providers, setProviders] = useState<AcpProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("goose");

  useEffect(() => {
    discoverAcpProviders()
      .then((discovered) => {
        setProviders(discovered);
        setSelectedProvider((current) => {
          if (
            discovered.length > 0 &&
            !discovered.some((p) => p.id === current)
          ) {
            return discovered[0].id;
          }
          return current;
        });
      })
      .catch(() => setProviders([]));
  }, []);

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="relative flex min-h-full flex-col items-center justify-center px-6 pb-4">
        <div className="flex w-full max-w-[600px] flex-col">
          {/* Clock */}
          <HomeClock />

          {/* Greeting */}
          <p className="mb-6 pl-4 text-xl font-light text-foreground-secondary">
            {greeting}
          </p>

          {/* Chat input */}
          <HomeInput
            onStartChat={onStartChat}
            providers={providers}
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
          />
        </div>
      </div>
    </div>
  );
}
