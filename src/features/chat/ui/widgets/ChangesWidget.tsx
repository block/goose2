import { useTranslation } from "react-i18next";
import { IconFileCode } from "@tabler/icons-react";
import { Widget } from "./Widget";

export function ChangesWidget() {
  const { t } = useTranslation("chat");

  return (
    <Widget
      title={t("contextPanel.widgets.changes")}
      icon={<IconFileCode className="size-3.5" />}
    >
      <p className="text-foreground-subtle">
        {t("contextPanel.empty.noChanges")}
      </p>
    </Widget>
  );
}
