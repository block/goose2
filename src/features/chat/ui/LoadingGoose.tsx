import { AnimatedIcons } from "./AnimatedIcons";
import { FlyingBird } from "./FlyingBird";

export type LoadingChatState =
  | "idle"
  | "thinking"
  | "streaming"
  | "waiting"
  | "compacting";

interface LoadingGooseProps {
  agentName?: string;
  chatState?: LoadingChatState;
}

const STATE_MESSAGES: Record<LoadingChatState, string> = {
  idle: "",
  thinking: "is thinking…",
  streaming: "is working on it…",
  waiting: "is waiting…",
  compacting: "is compacting the conversation…",
};

const STATE_ICONS: Record<LoadingChatState, React.ReactNode> = {
  idle: null,
  thinking: <AnimatedIcons className="shrink-0" cycleInterval={600} />,
  streaming: <FlyingBird className="shrink-0" cycleInterval={150} />,
  waiting: (
    <AnimatedIcons className="shrink-0" cycleInterval={600} variant="waiting" />
  ),
  compacting: <AnimatedIcons className="shrink-0" cycleInterval={600} />,
};

export function LoadingGoose({
  agentName = "Goose",
  chatState = "idle",
}: LoadingGooseProps) {
  if (chatState === "idle") {
    return null;
  }

  const message = STATE_MESSAGES[chatState];
  const icon = STATE_ICONS[chatState];

  return (
    <div
      className="px-4 animate-in fade-in duration-300 motion-reduce:animate-none"
      role="status"
      aria-label={`${agentName} ${message}`}
    >
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          {icon}
          <span>
            {agentName} {message}
          </span>
        </div>
      </div>
    </div>
  );
}
