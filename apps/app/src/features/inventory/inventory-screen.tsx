import type { ProductUnitKind, StockListResponse } from "@pisto/contracts";
import { AlertTriangle, Search } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";
import { ReadOnlyNotice } from "../catalog/route-state";
import { formatQuantityMinorUnits } from "./quantity";

type StockItem = StockListResponse["data"]["items"][number];

export type InventoryCollectionState =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "denied" }
  | { status: "error" }
  | {
      status: "ready";
      hasNextPage: boolean;
      items: StockItem[];
      loadingMore: boolean;
      stale?: boolean;
    };

export interface InventoryScreenCopy {
  title: string;
  description: string;
  eyebrow: string;
  searchLabel: string;
  searchPlaceholder: string;
  showAll: string;
  showLowStock: string;
  loading: string;
  offlineTitle: string;
  offlineDescription: string;
  deniedTitle: string;
  deniedDescription: string;
  errorTitle: string;
  errorDescription: string;
  retry: string;
  stale: string;
  emptyTitle: string;
  emptyDescription: string;
  lowStock: string;
  threshold: string;
  noThreshold: string;
  onHand: string;
  loadMore: string;
  loadingMore: string;
  readOnlyTitle: string;
  readOnlyDescription: string;
  unitLabels: Record<ProductUnitKind, string>;
  openHistory: (name: string) => string;
}

interface InventoryScreenProps {
  copy: InventoryScreenCopy;
  lowStockOnly: boolean;
  onLoadMore: () => void;
  onLowStockOnlyChange: (enabled: boolean) => void;
  onOpenHistory: (productId: string) => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  search: string;
  showReadOnlyNotice: boolean;
  state: InventoryCollectionState;
}

function InventoryFailure({
  copy,
  onRetry,
  status,
}: {
  copy: InventoryScreenCopy;
  onRetry: () => void;
  status: "denied" | "error" | "loading" | "offline";
}) {
  if (status === "loading") {
    return (
      <View className="min-h-56 items-start justify-center gap-3 border-y border-border">
        <LoadingIndicator />
        <Text className="font-sans text-sm text-muted-foreground">{copy.loading}</Text>
      </View>
    );
  }
  const title =
    status === "denied"
      ? copy.deniedTitle
      : status === "offline"
        ? copy.offlineTitle
        : copy.errorTitle;
  const description =
    status === "denied"
      ? copy.deniedDescription
      : status === "offline"
        ? copy.offlineDescription
        : copy.errorDescription;
  return (
    <Alert icon={AlertTriangle} variant="destructive">
      <AlertTitle className="leading-6">{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {status === "error" ? (
        <Button
          className="mb-2 ml-6 mt-2 self-start"
          label={copy.retry}
          onPress={onRetry}
          variant="outline"
        />
      ) : null}
    </Alert>
  );
}

export function InventoryScreen({
  copy,
  lowStockOnly,
  onLoadMore,
  onLowStockOnlyChange,
  onOpenHistory,
  onRetry,
  onSearchChange,
  search,
  showReadOnlyNotice,
  state,
}: InventoryScreenProps) {
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<StockItem>[]>(
    () => [
      {
        id: "name",
        header: t("dataTable.columns.name"),
        meta: { primary: true },
        cell: ({
          row: {
            original: { product },
          },
        }) => (
          <Button
            accessibilityLabel={t("dataTable.openRecord", { name: product.name })}
            accessibilityHint={copy.openHistory(product.name)}
            className="justify-start px-0"
            label={product.name}
            onPress={() => onOpenHistory(product.id)}
            size="sm"
            variant="ghost"
          />
        ),
      },
      {
        id: "sku",
        header: t("dataTable.columns.sku"),
        cell: ({
          row: {
            original: { product },
          },
        }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {product.sku ?? t("catalog.list.noSku")}
          </Text>
        ),
      },
      {
        id: "stock",
        header: t("dataTable.columns.stock"),
        meta: { align: "end" },
        cell: ({
          row: {
            original: { product, stock },
          },
        }) => (
          <Text className="font-ui text-sm text-foreground">
            {formatQuantityMinorUnits(stock.onHandMinorUnits, stock.quantityPrecision)}{" "}
            {copy.unitLabels[product.unitKind]}
          </Text>
        ),
      },
      {
        id: "minimum",
        header: t("dataTable.columns.minimum"),
        meta: { align: "end" },
        cell: ({
          row: {
            original: { stock },
          },
        }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {stock.lowStockThresholdMinorUnits === null
              ? copy.noThreshold
              : formatQuantityMinorUnits(
                  stock.lowStockThresholdMinorUnits,
                  stock.quantityPrecision,
                )}
          </Text>
        ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({
          row: {
            original: { stock },
          },
        }) => (
          <Text
            className={
              stock.lowStock
                ? "font-ui text-sm text-destructive"
                : "font-sans text-sm text-muted-foreground"
            }
          >
            {stock.lowStock ? copy.lowStock : copy.onHand}
          </Text>
        ),
      },
    ],
    [copy, onOpenHistory, t],
  );
  if (state.status === "denied") {
    return (
      <Page>
        <InventoryFailure copy={copy} onRetry={onRetry} status="denied" />
      </Page>
    );
  }
  return (
    <Page contentContainerClassName="gap-8">
      <ScreenHeader description={copy.description} eyebrow={copy.eyebrow} title={copy.title} />

      {showReadOnlyNotice ? <ReadOnlyNotice description={copy.readOnlyDescription} /> : null}

      <FilterToolbar label={copy.title}>
        <View className="min-w-0 flex-1 lg:max-w-[620px]">
          <Field
            accessibilityLabel={copy.searchLabel}
            label={copy.searchLabel}
            onChangeText={onSearchChange}
            placeholder={copy.searchPlaceholder}
            trailing={<Search color={mutedColor} size={18} />}
            value={search}
          />
        </View>
        <FilterBar
          label={copy.title}
          onChange={(value) => onLowStockOnlyChange(value === "low-stock")}
          options={[
            { value: "all", label: copy.showAll },
            { value: "low-stock", label: copy.showLowStock },
          ]}
          value={lowStockOnly ? "low-stock" : "all"}
        />
      </FilterToolbar>

      {state.status !== "ready" ? (
        <InventoryFailure copy={copy} onRetry={onRetry} status={state.status} />
      ) : (
        <View>
          {state.stale ? (
            <View className="mb-5 border-l-4 border-warning bg-muted p-3">
              <Text className="font-sans text-sm text-foreground">{copy.stale}</Text>
            </View>
          ) : null}
          {state.items.length === 0 ? (
            <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
          ) : (
            <DataTable
              caption={copy.title}
              columns={columns}
              data={state.items}
              getRowId={({ product }) => product.id}
            />
          )}
          {state.hasNextPage ? (
            <Button
              className="mt-6 self-start"
              label={state.loadingMore ? copy.loadingMore : copy.loadMore}
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
