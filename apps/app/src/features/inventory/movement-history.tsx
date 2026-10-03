import type { InventoryMovement, Product, ProductStock, ProductUnitKind } from "@pisto/contracts";
import { AlertTriangle, ArrowLeft } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";
import { ReadOnlyNotice } from "../catalog/route-state";
import { formatQuantityMinorUnits } from "./quantity";

export type MovementHistoryState =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "denied" }
  | { status: "error" }
  | {
      status: "ready";
      hasNextPage: boolean;
      items: InventoryMovement[];
      loadingMore: boolean;
      stale?: boolean;
    };

export interface MovementHistoryCopy {
  back: string;
  title: string;
  description: string;
  addMovement: string;
  onHand: string;
  lowStock: string;
  threshold: string;
  noThreshold: string;
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
  actions: Record<InventoryMovement["action"], string>;
  reversed: string;
  reverses: string;
  reverse: string;
  loadMore: string;
  loadingMore: string;
  readOnlyTitle: string;
  readOnlyDescription: string;
  unitLabels: Record<ProductUnitKind, string>;
  occurrence: (date: string, time: string, timeZone: string) => string;
}

interface MovementHistoryProps {
  canManage: boolean;
  copy: MovementHistoryCopy;
  onAddMovement: () => void;
  onBack: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onReverse: (movement: InventoryMovement) => void;
  product: Product;
  showReadOnlyNotice: boolean;
  state: MovementHistoryState;
  stock: ProductStock;
}

function Failure({
  copy,
  onRetry,
  status,
}: {
  copy: MovementHistoryCopy;
  onRetry: () => void;
  status: "denied" | "error" | "loading" | "offline";
}) {
  const destructiveColor = useCSSVariable("--color-destructive") as string;
  if (status === "loading") {
    return (
      <View className="min-h-56 items-start justify-center gap-3">
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
    <View className="gap-4 border-l-4 border-destructive bg-muted p-5">
      <View className="flex-row items-start gap-3">
        <AlertTriangle color={destructiveColor} size={20} />
        <View className="min-w-0 flex-1 gap-1">
          <Text accessibilityRole="alert" className="font-ui text-destructive">
            {title}
          </Text>
          <Text className="font-sans text-sm leading-5 text-muted-foreground">{description}</Text>
        </View>
      </View>
      {status === "error" ? (
        <Button className="self-start" label={copy.retry} onPress={onRetry} variant="outline" />
      ) : null}
    </View>
  );
}

export function MovementHistory({
  canManage,
  copy,
  onAddMovement,
  onBack,
  onLoadMore,
  onRetry,
  onReverse,
  product,
  showReadOnlyNotice,
  state,
  stock,
}: MovementHistoryProps) {
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<InventoryMovement>[]>(
    () => [
      {
        id: "type",
        header: t("dataTable.columns.type"),
        meta: { primary: true },
        cell: ({ row: { original: movement } }) => (
          <Text className="font-ui text-sm text-foreground">
            {copy.actions[movement.action]}
            {movement.reversedByMovementId ? `\n${copy.reversed}` : null}
          </Text>
        ),
      },
      {
        id: "description",
        header: t("dataTable.columns.description"),
        cell: ({ row: { original: movement } }) => (
          <Text className="font-sans text-sm text-foreground">{movement.reason}</Text>
        ),
      },
      {
        id: "date",
        header: t("dataTable.columns.date"),
        cell: ({ row: { original: movement } }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {copy.occurrence(
              movement.occurredLocalDate,
              movement.occurredLocalTime,
              movement.timeZone,
            )}
          </Text>
        ),
      },
      {
        id: "quantity",
        header: t("dataTable.columns.quantity"),
        meta: { align: "end" },
        cell: ({ row: { original: movement } }) => (
          <Text className="font-ui text-sm text-foreground">
            {movement.deltaMinorUnits.startsWith("-") ? "−" : "+"}
            {formatQuantityMinorUnits(
              movement.deltaMinorUnits.replace("-", ""),
              movement.quantityPrecision,
            )}
          </Text>
        ),
      },
      {
        id: "reference",
        header: t("dataTable.columns.reference"),
        cell: ({ row: { original: movement } }) =>
          movement.reversesMovementId ? (
            <Text className="font-sans text-sm text-muted-foreground">
              {copy.reverses}: {movement.reversesMovementId}
            </Text>
          ) : null,
      },
      ...(canManage && product.status === "active"
        ? [
            {
              id: "actions",
              header: t("dataTable.columns.actions"),
              cell: ({ row: { original: movement } }) =>
                movement.action !== "reverse" && movement.reversedByMovementId === null ? (
                  <Button
                    label={copy.reverse}
                    onPress={() => onReverse(movement)}
                    size="sm"
                    variant="outline"
                  />
                ) : null,
            } satisfies DataTableColumn<InventoryMovement>,
          ]
        : []),
    ],
    [canManage, copy, onReverse, product.status, t],
  );
  if (state.status === "denied") {
    return (
      <Page>
        <Failure copy={copy} onRetry={onRetry} status="denied" />
      </Page>
    );
  }
  return (
    <Page contentContainerClassName="gap-8">
      <Button className="self-start px-0" onPress={onBack} size="sm" variant="ghost">
        <ArrowLeft color={mutedColor} size={18} />
        <Text className="text-muted-foreground">{copy.back}</Text>
      </Button>
      <ScreenHeader
        action={
          canManage && product.status === "active" ? (
            <Button label={copy.addMovement} onPress={onAddMovement} variant="default" />
          ) : undefined
        }
        description={copy.description}
        eyebrow={product.name}
        title={copy.title}
      />

      {showReadOnlyNotice ? <ReadOnlyNotice description={copy.readOnlyDescription} /> : null}

      <View className="gap-2 border-y border-border py-6 sm:flex-row sm:items-end sm:justify-between">
        <View className="gap-1">
          <Text className="text-sm font-ui text-muted-foreground">{copy.onHand}</Text>
          <Text className="text-[38px] font-heading leading-[44px] text-foreground">
            {formatQuantityMinorUnits(stock.onHandMinorUnits, stock.quantityPrecision)}{" "}
            <Text className="text-base font-ui text-muted-foreground">
              {copy.unitLabels[product.unitKind]}
            </Text>
          </Text>
        </View>
        <View className="gap-1 sm:items-end">
          <Text className={stock.lowStock ? "font-ui text-destructive" : "font-ui text-foreground"}>
            {stock.lowStock ? copy.lowStock : copy.onHand}
          </Text>
          <Text className="font-sans text-sm text-muted-foreground">
            {stock.lowStockThresholdMinorUnits === null
              ? copy.noThreshold
              : `${copy.threshold}: ${formatQuantityMinorUnits(
                  stock.lowStockThresholdMinorUnits,
                  stock.quantityPrecision,
                )}`}
          </Text>
        </View>
      </View>

      {state.status !== "ready" ? (
        <Failure copy={copy} onRetry={onRetry} status={state.status} />
      ) : (
        <View>
          {state.stale ? (
            <View className="mb-5 border-l-4 border-warning bg-muted p-3">
              <Text className="font-sans text-sm text-foreground">{copy.stale}</Text>
            </View>
          ) : null}
          {state.items.length === 0 ? (
            <View className="gap-2 py-12">
              <Text className="text-xl font-heading text-foreground">{copy.emptyTitle}</Text>
              <Text className="font-sans max-w-[560px] text-sm leading-5 text-muted-foreground">
                {copy.emptyDescription}
              </Text>
            </View>
          ) : (
            <DataTable
              caption={copy.title}
              columns={columns}
              data={state.items}
              getRowId={(movement) => movement.id}
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
