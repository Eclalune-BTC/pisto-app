import type { ArchiveCustomerRequest } from "@pisto/contracts";
import * as Crypto from "expo-crypto";
import { TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { ConfirmCommandDialog } from "./confirm-command-dialog";
import type { ConfirmableCommand } from "./use-confirmable-command";

export function CustomerArchiveDialog({
  action,
  customerName,
}: {
  action: ConfirmableCommand<ArchiveCustomerRequest>;
  customerName: string;
}) {
  const { t } = useTranslation();
  const { state } = action;
  return (
    <ConfirmCommandDialog
      cancelLabel={t("common.cancel")}
      confirmLabel={
        state.phase === "uncertain"
          ? t("common.retrySameConfirmation")
          : t("customers.archive.confirm")
      }
      description={t("customers.archive.description", { name: customerName })}
      destructive
      error={state.phase === "failed" ? state.message : undefined}
      onConfirm={() => action.confirm(() => ({ idempotencyKey: Crypto.randomUUID() }))}
      onOpenChange={action.onOpenChange}
      open={action.open}
      pending={state.phase === "pending"}
      title={t("customers.archive.title")}
    >
      {state.phase === "uncertain" ? (
        <Alert icon={TriangleAlert} variant="warning">
          <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </ConfirmCommandDialog>
  );
}
