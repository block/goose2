import { useTranslation } from "react-i18next";
import { IconActivity } from "@tabler/icons-react";
import { Widget } from "./Widget";

export function ProcessesWidget() {
  const { t } = useTranslation("chat");

  return (
    <Widget
      title={t("contextPanel.widgets.processes")}
      icon={<IconActivity className="size-3.5" />}
    >
      <p className="text-foreground-subtle">
        {t("contextPanel.empty.noActiveProcesses")}
      </p>
    </Widget>
  );
}
