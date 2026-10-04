import type { Customer } from "@pisto/contracts";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

/** The exception carries the emphasis: an archived customer stands out from the active ones. */
export function CustomerStatusBadge({ status }: { status: Customer["status"] }) {
  const { t } = useTranslation();
  return (
    <Badge variant={status === "archived" ? "secondary" : "outline"}>
      <Text>
        {status === "archived" ? t("customers.status.archived") : t("customers.status.active")}
      </Text>
    </Badge>
  );
}
