import type { Sale, SaleStatusFilter } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import { Lock, Pencil, Plus, ReceiptText, TriangleAlert } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Section } from "@/components/layout/section";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { OfflineState } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { Icon } from "@/components/ui/icon";
import { RowActions } from "@/components/ui/row-actions";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { SaleStatusBadge, saleAmount } from "./sale-facts";
import { canCorrectSale, type SalesHistoryState, saleStatusFilters } from "./state";

type SalesHistoryProps = {
  canCreate: boolean;
  /** The role may correct sales; the column stays even while the page cannot offer it. */
  canCorrect: boolean;
  filter: SaleStatusFilter;
  onCorrect: (saleId: string) => void;
  onFilterChange: (filter: SaleStatusFilter) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  state: SalesHistoryState;
  /** The business time zone in which the read time is reported. */
  timeZone: string;
};

/** The server-ordered, cursor-paged sale history with its status filter. */
export function SalesHistory({
  canCreate,
  canCorrect,
  filter,
  onCorrect,
  onFilterChange,
  onLoadMore,
  onRetry,
  state,
  timeZone,
}: SalesHistoryProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  // Minimum widths keep the figures in place when a filter or a refresh changes the rows.
  const columns = useMemo<DataTableColumn<Sale>[]>(
    () => [
      {
        id: "date",
        header: t("sales.fields.moment"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="min-w-32 text-[13px] tabular-nums" numberOfLines={1}>
            {formatLocalizedDateTime(original.occurredAt, locale, original.timeZone)}
          </Text>
        ),
      },
      {
        id: "description",
        header: t("dataTable.columns.description"),
        // A two-line clamp lets a long note wrap; a single-line clamp would force the table
        // wider than its container on tablets.
        cell: ({ row: { original } }) =>
          original.description ? (
            <Text className="text-[13px]" numberOfLines={2}>
              {original.description}
            </Text>
          ) : (
            <Text className="text-[13px]">
              <Text aria-hidden className="text-[13px] text-muted-foreground">
                —
              </Text>
              <Text className="sr-only">{t("common.noDescription")}</Text>
            </Text>
          ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({ row: { original } }) => (
          <View className="min-w-24 items-start">
            <SaleStatusBadge status={original.status} />
          </View>
        ),
      },
      {
        id: "amount",
        header: t("sales.fields.total"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <Text
            className={cn(
              "min-w-24 text-right font-ui text-[13px] tabular-nums",
              original.status === "voided" && "text-muted-foreground line-through",
            )}
          >
            {saleAmount(original, locale)}
          </Text>
        ),
      },
    ],
    [locale, t],
  );
  const filterLabels: Record<SaleStatusFilter, string> = {
    all: t("sales.list.statusAll"),
    posted: t("sales.list.statusPosted"),
    voided: t("sales.list.statusVoided"),
  };
  const offerCorrection = state.kind === "ready" && state.canCorrect;

  return (
    <Section description={t("sales.list.sortNote")} title={t("sales.list.title")}>
      {state.kind !== "denied" ? (
        <FilterBar
          label={t("common.status")}
          onChange={onFilterChange}
          options={saleStatusFilters.map((value) => ({ label: filterLabels[value], value }))}
          value={filter}
        />
      ) : null}
      {state.kind === "loading" ? (
        <ContentSkeleton label={t("sales.list.loading")} variant="section" />
      ) : state.kind === "denied" ? (
        <StatePanel
          description={t("sales.list.deniedDescription")}
          icon={Lock}
          level={3}
          title={t("sales.list.deniedTitle")}
        />
      ) : state.kind === "offline" ? (
        <OfflineState level={3} />
      ) : state.kind === "error" ? (
        <StatePanel
          action={
            <Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />
          }
          description={t("sales.list.unavailableDescription")}
          icon={TriangleAlert}
          level={3}
          title={t("sales.list.unavailableTitle")}
          tone="destructive"
        />
      ) : (
        <View className="gap-3">
          {state.kind === "empty" ? (
            filter === "all" ? (
              <EmptyState
                action={
                  canCreate ? (
                    <Link asChild href="/operate/sales/new">
                      <Button accessibilityRole="link" size="sm" variant="outline">
                        <Icon as={Plus} size={16} />
                        <Text>{t("sales.register")}</Text>
                      </Button>
                    </Link>
                  ) : undefined
                }
                description={t("sales.list.emptyDescription")}
                icon={ReceiptText}
                title={t("sales.list.emptyTitle")}
              />
            ) : (
              <EmptyState
                action={
                  <Button
                    label={t("sales.list.showAll")}
                    onPress={() => onFilterChange("all")}
                    size="sm"
                    variant="outline"
                  />
                }
                description={t("sales.list.emptyFilteredDescription")}
                icon={ReceiptText}
                title={
                  filter === "posted"
                    ? t("sales.list.emptyPostedTitle")
                    : t("sales.list.emptyVoidedTitle")
                }
              />
            )
          ) : (
            <DataTable
              caption={t("sales.list.title")}
              columns={columns}
              data={state.items}
              getRowHref={(sale): Href => ({
                pathname: "/operate/sales/[saleId]",
                params: { saleId: sale.id },
              })}
              getRowId={(sale) => sale.id}
              rowActions={
                canCorrect
                  ? (sale) =>
                      offerCorrection && canCorrectSale(sale) ? (
                        <RowActions
                          actions={[
                            {
                              icon: Pencil,
                              label: t("sales.correction.open"),
                              onPress: () => onCorrect(sale.id),
                            },
                          ]}
                          label={t("sales.list.rowActions", {
                            date: formatLocalizedDateTime(sale.occurredAt, locale, sale.timeZone),
                          })}
                        />
                      ) : (
                        // Rows without a menu keep its width, so every amount shares one edge.
                        <View aria-hidden className="size-8 native:size-10" />
                      )
                  : undefined
              }
            />
          )}
          <View className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Text className="text-xs leading-4 text-muted-foreground tabular-nums">
              {t("sales.list.queriedAt", {
                date: formatLocalizedDateTime(state.queriedAt, locale, timeZone),
              })}
            </Text>
            {state.kind === "ready" && state.hasMore ? (
              <Button
                label={state.loadingMore ? t("common.loadingMore") : t("common.loadMore")}
                loading={state.loadingMore}
                onPress={onLoadMore}
                size="sm"
                variant="outline"
              />
            ) : null}
          </View>
        </View>
      )}
    </Section>
  );
}
