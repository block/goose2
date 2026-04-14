import { useTranslation } from "react-i18next";
import { useLocaleFormatting } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

interface ContextPopoverContentProps {
  tokens: number;
  limit: number;
}

export function ContextPopoverContent({ tokens, limit }: ContextPopoverContentProps) {
  const { t } = useTranslation("chat");
  const { formatNumber } = useLocaleFormatting();

  const progress = limit > 0 ? Math.min(tokens / limit, 1) : 0;
  const percent = Math.round(progress * 100);
  const remaining = Math.max(limit - tokens, 0);
  const isWarning = progress >= 0.8;
  const isCritical = progress >= 0.95;

  return (
    <div className="space-y-2">
      <div className="font-medium text-sm">{t("toolbar.contextUsage")}</div>
      <div className="flex justify-between text-muted-foreground">
        <span>{t("context.popoverUsed")}</span>
        <span className="tabular-nums text-foreground">
          {formatNumber(tokens)}
        </span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>{t("context.popoverLimit")}</span>
        <span className="tabular-nums text-foreground">
          {formatNumber(limit)}
        </span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>{t("context.popoverRemaining")}</span>
        <span
          className={cn(
            "tabular-nums",
            isCritical
              ? "text-danger"
              : isWarning
                ? "text-warning"
                : "text-foreground",
          )}
        >
          {formatNumber(remaining)}
        </span>
      </div>
      {isWarning && (
        <p
          className={cn(
            "pt-1 text-[11px]",
            isCritical ? "text-danger" : "text-warning",
          )}
        >
          {isCritical
            ? t("context.warningCritical", { percent })
            : t("context.warningHigh", { percent })}
        </p>
      )}
    </div>
  );
}
