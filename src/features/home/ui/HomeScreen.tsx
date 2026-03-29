import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

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

export function HomeScreen() {
  const [hour] = useState(() => new Date().getHours());
  const greeting = getGreeting(hour);

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
          <div className="px-4 pb-6 pt-2">
            <div className="relative rounded-2xl bg-background-secondary border border-border px-4 pt-4 pb-3 shadow-lg">
              {/* Textarea placeholder */}
              <div className="mb-3 min-h-[36px] w-full px-1 text-sm leading-relaxed text-foreground-tertiary">
                Ask Goose anything...
              </div>
              {/* Bottom bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-foreground-tertiary">
                  <span className="rounded-md border border-border px-2 py-0.5">
                    Claude Sonnet 4
                  </span>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground-secondary transition-all"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
