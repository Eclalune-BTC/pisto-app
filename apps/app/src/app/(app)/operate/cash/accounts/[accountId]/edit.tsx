import { useLocalSearchParams } from "expo-router";

import { CashAccountEditorController } from "@/features/cash/cash-account-editor-controller";

export default function EditCashAccountRoute() {
  const params = useLocalSearchParams<{ accountId?: string | string[] }>();
  const accountId = Array.isArray(params.accountId) ? params.accountId[0] : params.accountId;
  return <CashAccountEditorController accountId={accountId} mode="update" />;
}
