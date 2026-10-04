import type { Customer } from "@pisto/contracts";
import { useTranslation } from "react-i18next";

import { StatusBadge } from "@/components/ui/status-badge";

export function CustomerStatusBadge({ status }: { status: Customer["status"] }) {
  const { t } = useTranslation();
  return status === "archived" ? (
    <StatusBadge label={t("customers.status.archived")} tone="exception" />
  ) : (
    <StatusBadge label={t("customers.status.active")} tone="normal" />
  );
}
