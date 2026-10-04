import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { FocusReturnRef } from "@/features/customers/focus-return";
import { readState } from "@/features/customers/read-state";
import { pickerStatus, RecordPicker } from "@/features/customers/record-picker";

import { type CashAccountChoice, cashAccountChoicesQueryOptions } from "./cash-account-source";

type CashAccountPickerDialogProps = {
  businessId: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (account: CashAccountChoice) => void;
  open: boolean;
  /** The control that opened the picker; focus returns to it when the picker closes. */
  returnFocusRef?: FocusReturnRef;
  selectedId: string | null;
};

/** Only an active account can receive a payment, so archived accounts are never offered. */
export function CashAccountPickerDialog({
  businessId,
  onOpenChange,
  onSelect,
  open,
  returnFocusRef,
  selectedId,
}: CashAccountPickerDialogProps) {
  const { t } = useTranslation();
  const accounts = useInfiniteQuery({
    ...cashAccountChoicesQueryOptions(businessId, "active"),
    enabled: open,
  });
  return (
    <RecordPicker
      description={t("receivables.accountPicker.description")}
      emptyText={t("receivables.accountPicker.empty")}
      getKey={(account) => account.id}
      hasNextPage={accounts.hasNextPage}
      items={accounts.data?.pages.flatMap((page) => page.items) ?? []}
      label={t("receivables.accountPicker.title")}
      loadMoreLabel={t("common.loadMore")}
      loadingMore={accounts.isFetchingNextPage}
      onLoadMore={() => void accounts.fetchNextPage()}
      onOpenChange={onOpenChange}
      onRetry={() => void accounts.refetch()}
      onSelect={(account) => {
        onSelect(account);
        onOpenChange(false);
      }}
      open={open}
      renderItem={(account) => ({ label: account.name })}
      returnFocusRef={returnFocusRef}
      selectedKey={selectedId}
      status={pickerStatus(readState([accounts]))}
      title={t("receivables.accountPicker.title")}
    />
  );
}
