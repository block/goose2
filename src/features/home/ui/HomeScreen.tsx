import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function HomeScreen() {
  const time = useClock();
  const hour = time.getHours();
  const greeting = getGreeting(hour);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 pb-4">
      <div className="flex max-w-[600px] flex-col items-center text-center">
        {/* Clock */}
        <div className="mb-2 text-6xl font-light tracking-tight font-mono text-foreground">
          {formatTime(time)}
        </div>

        {/* Greeting */}
        <p className="mb-8 text-xl font-light text-foreground-secondary">
          {greeting}
        </p>

        {/* Chat input placeholder */}
        <div className="w-full max-w-[480px]">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background-secondary/50 px-4 py-3 backdrop-blur">
            <span className="flex-1 text-sm text-foreground-tertiary">
              What can I help you with?
            </span>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background transition-colors hover:bg-foreground/90"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
