import type { Receivable } from "@pisto/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";

import type { ReceivablesCopy, ReceivablesLoadState } from "./types";

type ReceivableFilter = "all" | "open" | "overdue" | "paid" | "voided";

type ReceivablesScreenProps = {
  canManage: boolean;
  copy: ReceivablesCopy;
  customerNameFor: (customerId: string) => string;
  filter: ReceivableFilter;
  formatDate: (date: string) => string;
  formatMoney: (minorUnits: string, currency: string, digits: number) => string;
  onCreate: () => void;
  onFilterChange: (filter: ReceivableFilter) => void;
  onLoadMore: () => void;
  onOpenReceivable: (receivableId: string) => void;
  onRetry: () => void;
  state: ReceivablesLoadState;
};

export function ReceivablesScreen({
  canManage,
  copy,
  customerNameFor,
  filter,
  formatDate,
  formatMoney,
  onCreate,
  onFilterChange,
  onLoadMore,
  onOpenReceivable,
  onRetry,
  state,
}: ReceivablesScreenProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<Receivable>[]>(
    () => [
      {
        id: "description",
        header: t("dataTable.columns.description"),
        meta: { primary: true },
        cell: ({ row: { original: item } }) => (
          <Button
            accessibilityLabel={t("dataTable.openRecord", { name: item.description })}
            className="justify-start px-0"
            label={item.description}
            onPress={() => onOpenReceivable(item.id)}
            size="sm"
            variant="ghost"
          />
        ),
      },
      {
        id: "customer",
        header: t("dataTable.columns.customer"),
        cell: ({ row: { original: item } }) => (
          <Text className="font-sans text-sm text-foreground">
            {customerNameFor(item.customerId)}
          </Text>
        ),
      },
      {
        id: "date",
        header: t("dataTable.columns.date"),
        cell: ({ row: { original: item } }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {formatDate(item.postedDate)}
          </Text>
        ),
      },
      {
        id: "outstanding",
        header: t("dataTable.columns.outstanding"),
        meta: { align: "end" },
        cell: ({ row: { original: item } }) => (
          <Text className="font-ui text-sm text-foreground">
            {formatMoney(item.outstandingMinorUnits, item.currency, item.currencyMinorUnitDigits)}
          </Text>
        ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({ row: { original: item } }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {
              { open: copy.open, overdue: copy.overdue, paid: copy.paid, voided: copy.voided }[
                item.state
              ]
            }
          </Text>
        ),
      },
    ],
    [copy, customerNameFor, formatDate, formatMoney, onOpenReceivable, t],
  );
  const successful = state.kind === "empty" || state.kind === "ready";
  const summary = successful ? state.summary : null;
  const filterLabels: Record<ReceivableFilter, string> = {
    all: copy.all,
    open: copy.open,
    overdue: copy.overdue,
    paid: copy.paid,
    voided: copy.voided,
  };
  return (
    <Page contentContainerClassName="gap-8">
      <ScreenHeader
        action={
          canManage && successful ? (
            <Button label={copy.charge} onPress={onCreate} variant="default" />
          ) : undefined
        }
        description={copy.description}
        title={copy.title}
      />
      {summary ? (
        <View className="gap-3">
          <Text
            accessibilityRole="header"
            aria-level={2}
            className="font-heading text-lg text-foreground"
          >
            {t("reports.position.title")}
          </Text>
          <Text className="font-sans text-sm text-muted-foreground">
            {t("reports.position.description", {
              localDate: formatDate(summary.businessLocalDate),
            })}
          </Text>
          <View className="gap-5 border-y border-border py-6 lg:flex-row">
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-xs font-ui text-muted-foreground">{copy.outstanding}</Text>
              <Text className="text-3xl font-heading text-foreground">
                {formatMoney(
                  summary.outstandingMinorUnits,
                  summary.currency,
                  summary.currencyMinorUnitDigits,
                )}
              </Text>
              <Text className="font-sans text-sm text-muted-foreground">
                {copy.openCount}: {summary.openReceivableCount}
              </Text>
            </View>
            <View className="min-w-0 flex-1 gap-1 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <Text className="text-xs font-ui text-muted-foreground">{copy.overdue}</Text>
              <Text className="text-2xl font-heading text-destructive">
                {formatMoney(
                  summary.overdueMinorUnits,
                  summary.currency,
                  summary.currencyMinorUnitDigits,
                )}
              </Text>
              <Text className="font-sans text-sm text-muted-foreground">
                {copy.overdueCount}: {summary.overdueReceivableCount}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
      {state.kind !== "denied" ? (
        <FilterToolbar label={copy.filterLabel}>
          <FilterBar
            label={copy.filterLabel}
            onChange={onFilterChange}
            options={(Object.keys(filterLabels) as ReceivableFilter[]).map((value) => ({
              label: filterLabels[value],
              value,
            }))}
            value={filter}
          />
        </FilterToolbar>
      ) : null}
      {successful && state.stale ? (
        <View className="border-l-4 border-warning bg-muted p-3">
          <Text className="font-sans text-sm text-foreground">{copy.stale}</Text>
        </View>
      ) : null}
      {state.kind === "loading" ? (
        <View className="min-h-56 items-start justify-center gap-3 border-y border-border">
          <LoadingIndicator />
          <Text className="font-sans text-sm text-muted-foreground">{copy.loading}</Text>
        </View>
      ) : state.kind === "offline" || state.kind === "denied" || state.kind === "error" ? (
        <View className="min-h-56 items-start justify-center gap-3 border-y border-border py-8">
          <Text
            accessibilityRole="header"
            aria-level={2}
            className="text-xl font-heading text-foreground"
          >
            {state.kind === "offline"
              ? copy.offlineTitle
              : state.kind === "denied"
                ? copy.deniedTitle
                : copy.errorTitle}
          </Text>
          <Text className="font-sans max-w-[540px] text-sm leading-5 text-muted-foreground">
            {state.kind === "offline"
              ? copy.offlineDescription
              : state.kind === "denied"
                ? copy.deniedDescription
                : copy.errorDescription}
          </Text>
          {state.kind === "error" ? (
            <Button label={copy.retry} onPress={onRetry} variant="outline" />
          ) : null}
        </View>
      ) : state.kind === "empty" ? (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          action={
            canManage ? (
              <Button label={copy.emptyAction} onPress={onCreate} variant="outline" />
            ) : undefined
          }
        />
      ) : (
        <View className="gap-4">
          <DataTable
            caption={t("filters.history")}
            columns={columns}
            data={state.items}
            getRowId={(item) => item.id}
          />
          {state.nextCursor ? (
            <Button
              label={copy.loadMore}
              loading={state.loadingMore}
              onPress={onLoadMore}
              variant="outline"
            />
          ) : null}
        </View>
      )}
    </Page>
  );
}
