import type { Sale, SaleStatusFilter } from "@pisto/contracts";
import { AlertTriangle } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { Heading } from "@/components/ui/heading";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";

import type { SalesHistoryState } from "./state";
import { saleStatusFilters } from "./state";

export type SalesHistoryCopy = {
  deniedDescription: string;
  deniedTitle: string;
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  filterLabel: string;
  loadMore: string;
  loading: string;
  loadingMore: string;
  noDescription: string;
  offlineTitle: string;
  posted: string;
  retry: string;
  stale: string;
  statusAll: string;
  statusPosted: string;
  statusVoided: string;
  title: string;
  unavailableTitle: string;
  voidReason: string;
  voided: string;
  correct: string;
};

type SalesHistoryProps = {
  copy: SalesHistoryCopy;
  filter: SaleStatusFilter;
  formatDateTime: (value: string) => string;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  formatQueriedAt: (value: string) => string;
  onCorrectSale: (saleId: string) => void;
  onFilterChange: (filter: SaleStatusFilter) => void;
  onLoadMore: () => void;
  onOpenSale: (saleId: string) => void;
  onRetry: () => void;
  state: SalesHistoryState;
};

export function SalesHistory({
  copy,
  filter,
  formatDateTime,
  formatMoney,
  formatQueriedAt,
  onCorrectSale,
  onFilterChange,
  onLoadMore,
  onOpenSale,
  onRetry,
  state,
}: SalesHistoryProps) {
  const { t } = useTranslation();
  const canCorrect = state.kind === "ready" && state.canCorrect;
  const columns = useMemo<DataTableColumn<Sale>[]>(
    () => [
      {
        id: "description",
        header: t("dataTable.columns.description"),
        meta: { primary: true },
        cell: ({ row: { original: sale } }) => (
          <Button
            accessibilityLabel={t("dataTable.openRecord", {
              name: sale.description ?? copy.noDescription,
            })}
            className="justify-start px-0"
            label={sale.description ?? copy.noDescription}
            onPress={() => onOpenSale(sale.id)}
            size="sm"
            variant="ghost"
          />
        ),
      },
      {
        id: "date",
        header: t("dataTable.columns.date"),
        cell: ({ row: { original: sale } }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {formatDateTime(sale.occurredAt)}
          </Text>
        ),
      },
      {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        cell: ({ row: { original: sale } }) => (
          <Text className="font-ui text-sm text-foreground">
            {formatMoney(sale.grossMinorUnits, sale.currency, sale.currencyMinorUnitDigits)}
          </Text>
        ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({ row: { original: sale } }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {sale.status === "posted" ? copy.posted : copy.voided}
            {sale.status === "voided" && sale.correction
              ? `\n${copy.voidReason}: ${sale.correction.reason}`
              : null}
          </Text>
        ),
      },
      ...(canCorrect
        ? [
            {
              id: "actions",
              header: t("dataTable.columns.actions"),
              cell: ({ row: { original: sale } }) =>
                sale.status === "posted" && sale.correction === null ? (
                  <Button
                    label={copy.correct}
                    onPress={() => onCorrectSale(sale.id)}
                    size="sm"
                    variant="outline"
                  />
                ) : null,
            } satisfies DataTableColumn<Sale>,
          ]
        : []),
    ],
    [canCorrect, copy, formatDateTime, formatMoney, onCorrectSale, onOpenSale, t],
  );
  const filterLabels: Record<SaleStatusFilter, string> = {
    all: copy.statusAll,
    posted: copy.statusPosted,
    voided: copy.statusVoided,
  };
  const answered = state.kind === "empty" || state.kind === "ready";
  return (
    <View className="gap-5">
      <View className="gap-1">
        <Heading level={2} size="section">
          {copy.title}
        </Heading>
        <Text className="font-sans max-w-[620px] text-sm leading-5 text-muted-foreground">
          {copy.description}
        </Text>
      </View>

      {state.kind !== "denied" ? (
        <FilterToolbar label={copy.filterLabel}>
          <FilterBar
            label={copy.filterLabel}
            onChange={onFilterChange}
            options={saleStatusFilters.map((value) => ({ label: filterLabels[value], value }))}
            value={filter}
          />
        </FilterToolbar>
      ) : null}

      {answered && state.stale ? (
        <Alert icon={AlertTriangle} variant="default">
          <AlertDescription>{copy.stale}</AlertDescription>
        </Alert>
      ) : null}

      {state.kind === "loading" ? (
        <View className="min-h-40 items-start justify-center gap-3 border-y border-border">
          <LoadingIndicator />
          <Text className="font-sans text-sm text-muted-foreground">{copy.loading}</Text>
        </View>
      ) : state.kind === "denied" || state.kind === "offline" || state.kind === "error" ? (
        <View className="min-h-40 items-start justify-center gap-3 border-y border-border py-8">
          <Heading level={3} size="section">
            {state.kind === "denied"
              ? copy.deniedTitle
              : state.kind === "offline"
                ? copy.offlineTitle
                : copy.unavailableTitle}
          </Heading>
          <Text className="font-sans max-w-[560px] text-sm leading-5 text-muted-foreground">
            {state.kind === "denied" ? copy.deniedDescription : state.message}
          </Text>
          {state.kind === "error" ? (
            <Button label={copy.retry} onPress={onRetry} variant="outline" />
          ) : null}
        </View>
      ) : state.kind === "empty" ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : (
        <View className="gap-4">
          <DataTable
            caption={copy.title}
            columns={columns}
            data={state.items}
            getRowId={(sale) => sale.id}
          />
          {state.hasMore ? (
            <Button
              className="self-start"
              label={state.loadingMore ? copy.loadingMore : copy.loadMore}
              loading={state.loadingMore}
              onPress={onLoadMore}
              variant="outline"
            />
          ) : null}
        </View>
      )}

      {answered ? (
        <Text className="font-sans text-xs leading-5 text-muted-foreground">
          {formatQueriedAt(state.queriedAt)}
        </Text>
      ) : null}
    </View>
  );
}
