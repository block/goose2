import { ArrowUp } from "lucide-react";

export function ChatView() {
  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex flex-1 flex-col items-center justify-center min-h-0 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl w-full text-center">
          <p className="text-sm text-foreground-tertiary">
            Start a conversation with Goose
          </p>
        </div>
      </div>

      {/* Chat input at bottom */}
      <div className="px-4 pb-6 pt-2">
        <div className="mx-auto max-w-3xl">
          <div className="relative rounded-2xl bg-background-secondary border border-border px-4 pt-4 pb-3 shadow-lg">
            <div className="mb-3 min-h-[36px] w-full px-1 text-sm leading-relaxed text-foreground-tertiary">
              Type your message here...
            </div>
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
  );
}
