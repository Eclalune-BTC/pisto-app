import { AlertTriangle, Search } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type {
  ProductUnitKind,
  StockListResponse,
} from "../../../../../packages/contracts/src/catalog";
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
      <View className="min-h-56 items-start justify-center gap-3 border-y border-line dark:border-[#304239]">
        <ActivityIndicator color="#237A55" />
        <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{copy.loading}</Text>
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
    <View className="gap-4 border-l-4 border-danger bg-[#FFF1F1] p-5 dark:bg-[#3A2020]">
      <View className="flex-row items-start gap-3">
        <AlertTriangle color="#B94242" size={20} />
        <View className="min-w-0 flex-1 gap-1">
          <Text accessibilityRole="alert" className="font-bold text-danger dark:text-[#FFBABA]">
            {title}
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
            {description}
          </Text>
        </View>
      </View>
      {status === "error" ? (
        <Button className="self-start" label={copy.retry} onPress={onRetry} variant="secondary" />
      ) : null}
    </View>
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
  return (
    <Page contentContainerClassName="gap-8">
      <ScreenHeader description={copy.description} eyebrow={copy.eyebrow} title={copy.title} />

      {showReadOnlyNotice ? <ReadOnlyNotice description={copy.readOnlyDescription} /> : null}

      <View className="gap-4 border-y border-line py-5 dark:border-[#304239] lg:flex-row lg:items-end lg:justify-between">
        <View className="min-w-0 flex-1 lg:max-w-[620px]">
          <Field
            accessibilityLabel={copy.searchLabel}
            label={copy.searchLabel}
            onChangeText={onSearchChange}
            placeholder={copy.searchPlaceholder}
            trailing={<Search color="#617168" size={18} />}
            value={search}
          />
        </View>
        <View accessibilityRole="tablist" className="flex-row gap-6">
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: !lowStockOnly }}
            className={!lowStockOnly ? "border-b-2 border-positive py-2" : "py-2"}
            onPress={() => onLowStockOnlyChange(false)}
          >
            <Text className="font-semibold text-ink dark:text-white">{copy.showAll}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: lowStockOnly }}
            className={lowStockOnly ? "border-b-2 border-positive py-2" : "py-2"}
            onPress={() => onLowStockOnlyChange(true)}
          >
            <Text className="font-semibold text-ink dark:text-white">{copy.showLowStock}</Text>
          </Pressable>
        </View>
      </View>

      {state.status !== "ready" ? (
        <InventoryFailure copy={copy} onRetry={onRetry} status={state.status} />
      ) : (
        <View>
          {state.stale ? (
            <View className="mb-5 border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
              <Text className="text-sm text-ink dark:text-[#F2E4D2]">{copy.stale}</Text>
            </View>
          ) : null}
          {state.items.length === 0 ? (
            <View className="gap-2 py-12">
              <Text className="text-xl font-black text-ink dark:text-white">{copy.emptyTitle}</Text>
              <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                {copy.emptyDescription}
              </Text>
            </View>
          ) : (
            state.items.map(({ product, stock }) => (
              <Pressable
                accessibilityLabel={copy.openHistory(product.name)}
                accessibilityRole="button"
                className="gap-3 border-b border-line py-5 active:opacity-70 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between"
                key={product.id}
                onPress={() => onOpenHistory(product.id)}
              >
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-lg font-black text-ink dark:text-white">
                    {product.name}
                  </Text>
                  <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                    {product.sku ?? product.unitKind}
                  </Text>
                </View>
                <View className="gap-1 sm:min-w-[220px] sm:items-end">
                  <Text className="text-2xl font-black text-ink dark:text-white">
                    {formatQuantityMinorUnits(stock.onHandMinorUnits, stock.quantityPrecision)}{" "}
                    <Text className="text-base font-semibold text-ink-muted dark:text-[#AAB8B0]">
                      {copy.unitLabels[product.unitKind]}
                    </Text>
                  </Text>
                  <Text
                    className={
                      stock.lowStock
                        ? "text-sm font-semibold text-danger dark:text-[#FFBABA]"
                        : "text-sm text-ink-muted dark:text-[#AAB8B0]"
                    }
                  >
                    {stock.lowStock ? copy.lowStock : copy.onHand}
                  </Text>
                  <Text className="text-xs text-ink-muted dark:text-[#91A198]">
                    {stock.lowStockThresholdMinorUnits === null
                      ? copy.noThreshold
                      : `${copy.threshold}: ${formatQuantityMinorUnits(
                          stock.lowStockThresholdMinorUnits,
                          stock.quantityPrecision,
                        )}`}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
          {state.hasNextPage ? (
            <Button
              className="mt-6 self-start"
              label={state.loadingMore ? copy.loadingMore : copy.loadMore}
              loading={state.loadingMore}
              onPress={onLoadMore}
              variant="secondary"
            />
          ) : null}
        </View>
      )}
    </Page>
  );
}
