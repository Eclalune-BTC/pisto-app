import type { Customer } from "@pisto/contracts";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

export function CustomerStatusBadge({ status }: { status: Customer["status"] }) {
  const { t } = useTranslation();
  return (
    <Badge variant={status === "archived" ? "outline" : "secondary"}>
      <Text>
        {status === "archived" ? t("customers.status.archived") : t("customers.status.active")}
      </Text>
    </Badge>
  );
}
