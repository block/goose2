import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { cn } from "@/shared/lib/cn";

const WARNING_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;

interface ContextWarningBannerProps {
  tokens: number;
  limit: number;
}

export function ContextWarningBanner({
  tokens,
  limit,
}: ContextWarningBannerProps) {
  const { t } = useTranslation("chat");
  const [dismissed, setDismissed] = useState(false);

  if (limit <= 0 || dismissed) return null;

  const progress = tokens / limit;
  if (progress < WARNING_THRESHOLD) return null;

  const isCritical = progress >= CRITICAL_THRESHOLD;
  const percent = Math.round(progress * 100);

  return (
    <div
      role="status"
      className={cn(
        "mx-auto flex w-full max-w-3xl items-center gap-2 rounded-md border px-3 py-2 text-xs",
        isCritical
          ? "border-danger/30 bg-danger/10 text-danger"
          : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      <IconAlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">
        {isCritical
          ? t("context.warningCritical", { percent })
          : t("context.warningHigh", { percent })}
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-0.5 hover:bg-foreground/10"
        aria-label={t("context.dismiss")}
      >
        <IconX className="size-3.5" />
      </button>
    </div>
  );
}
