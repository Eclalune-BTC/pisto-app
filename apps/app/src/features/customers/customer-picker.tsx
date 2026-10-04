import type { Customer } from "@pisto/contracts";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { FocusReturnRef } from "./focus-return";
import { customerContact } from "./format";
import { CUSTOMER_SEARCH_MAX_LENGTH } from "./list-params";
import { customersQueryOptions } from "./queries";
import { readState } from "./read-state";
import { pickerStatus, RecordPicker } from "./record-picker";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "./use-debounced-value";

type CustomerPickerDialogProps = {
  businessId: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: Customer) => void;
  open: boolean;
  /** The control that opened the picker; focus returns to it when the picker closes. */
  returnFocusRef?: FocusReturnRef;
  selectedId: string | null;
  /** New charges accept only active customers; history filters may also pick archived ones. */
  status: "active" | "all";
};

export function CustomerPickerDialog({
  businessId,
  onOpenChange,
  onSelect,
  open,
  returnFocusRef,
  selectedId,
  status,
}: CustomerPickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const customers = useInfiniteQuery({
    ...customersQueryOptions(businessId, { query: query || undefined, status }),
    enabled: open,
    // Narrowing a search keeps the previous choices visible instead of flashing placeholders.
    placeholderData: keepPreviousData,
  });
  const close = (next: boolean) => {
    if (!next) setSearch("");
    onOpenChange(next);
  };

  return (
    <RecordPicker
      description={
        status === "active"
          ? t("customers.picker.activeDescription")
          : t("customers.picker.allDescription")
      }
      emptyText={query ? t("customers.picker.noMatches") : t("customers.picker.empty")}
      getKey={(customer) => customer.id}
      hasNextPage={customers.hasNextPage}
      items={customers.data?.pages.flatMap((page) => page.items) ?? []}
      label={t("customers.picker.title")}
      loadMoreLabel={t("common.loadMore")}
      loadingMore={customers.isFetchingNextPage}
      onLoadMore={() => void customers.fetchNextPage()}
      onOpenChange={close}
      onRetry={() => void customers.refetch()}
      onSelect={(customer) => {
        onSelect(customer);
        close(false);
      }}
      open={open}
      renderItem={(customer) => ({
        detail: customerContact(customer),
        label: customer.name,
        tag: customer.status === "archived" ? t("customers.status.archived") : undefined,
      })}
      returnFocusRef={returnFocusRef}
      search={{
        busy: search.trim() !== query || customers.isPlaceholderData,
        label: t("customers.list.searchLabel"),
        maxLength: CUSTOMER_SEARCH_MAX_LENGTH,
        onChange: setSearch,
        placeholder: t("customers.list.searchPlaceholder"),
        value: search,
      }}
      selectedKey={selectedId}
      status={pickerStatus(readState([customers]))}
      title={t("customers.picker.title")}
    />
  );
}
