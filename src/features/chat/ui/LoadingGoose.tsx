import { useTranslation } from "react-i18next";
import { AnimatedIcons } from "./AnimatedIcons";
import { FlyingBird } from "./FlyingBird";

export type LoadingChatState =
  | "idle"
  | "thinking"
  | "streaming"
  | "waiting"
  | "compacting";

interface LoadingGooseProps {
  chatState?: LoadingChatState;
}

const STATE_ICONS: Record<LoadingChatState, React.ReactNode> = {
  idle: null,
  thinking: <AnimatedIcons className="shrink-0" cycleInterval={600} />,
  streaming: <FlyingBird className="shrink-0" cycleInterval={150} />,
  waiting: (
    <AnimatedIcons className="shrink-0" cycleInterval={600} variant="waiting" />
  ),
  compacting: <AnimatedIcons className="shrink-0" cycleInterval={600} />,
};

export function LoadingGoose({ chatState = "idle" }: LoadingGooseProps) {
  const { t } = useTranslation("chat");
  if (chatState === "idle") {
    return null;
  }

  const message = t(`loading.${chatState}`);
  const icon = STATE_ICONS[chatState];

  return (
    <div
      className="px-4 animate-in fade-in duration-300 motion-reduce:animate-none"
      role="status"
      aria-label={message}
    >
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          {icon}
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}
