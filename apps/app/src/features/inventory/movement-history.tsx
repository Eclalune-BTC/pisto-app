import { AlertTriangle, ArrowLeft, Plus } from "lucide-react-native";
import { ActivityIndicator, Text, View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import type {
  InventoryMovement,
  Product,
  ProductStock,
  ProductUnitKind,
} from "../../../../../packages/contracts/src/catalog";
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
  if (status === "loading") {
    return (
      <View className="min-h-56 items-start justify-center gap-3">
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
  return (
    <Page contentContainerClassName="gap-8">
      <Button className="self-start px-0" onPress={onBack} size="sm" variant="ghost">
        <ArrowLeft color="#617168" size={18} />
        <ButtonText className="text-ink-muted dark:text-[#AAB8B0]" variant="ghost">
          {copy.back}
        </ButtonText>
      </Button>
      <ScreenHeader
        action={
          canManage && product.status === "active" ? (
            <Button onPress={onAddMovement} variant="accent">
              <Plus color="#14241D" size={18} />
              <ButtonText variant="accent">{copy.addMovement}</ButtonText>
            </Button>
          ) : undefined
        }
        description={copy.description}
        eyebrow={product.name}
        title={copy.title}
      />

      {showReadOnlyNotice ? <ReadOnlyNotice description={copy.readOnlyDescription} /> : null}

      <View className="gap-2 border-y border-line py-6 dark:border-[#304239] sm:flex-row sm:items-end sm:justify-between">
        <View className="gap-1">
          <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
            {copy.onHand}
          </Text>
          <Text className="text-[38px] font-black leading-[44px] text-ink dark:text-white">
            {formatQuantityMinorUnits(stock.onHandMinorUnits, stock.quantityPrecision)}{" "}
            <Text className="text-base font-semibold text-ink-muted dark:text-[#AAB8B0]">
              {copy.unitLabels[product.unitKind]}
            </Text>
          </Text>
        </View>
        <View className="gap-1 sm:items-end">
          <Text
            className={
              stock.lowStock
                ? "font-bold text-danger dark:text-[#FFBABA]"
                : "font-semibold text-ink dark:text-white"
            }
          >
            {stock.lowStock ? copy.lowStock : copy.onHand}
          </Text>
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
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
            state.items.map((movement) => {
              const canReverse =
                canManage &&
                product.status === "active" &&
                movement.action !== "reverse" &&
                movement.reversedByMovementId === null;
              return (
                <View
                  className="gap-3 border-b border-line py-5 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between"
                  key={movement.id}
                >
                  <View className="min-w-0 flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="font-black text-ink dark:text-white">
                        {copy.actions[movement.action]}
                      </Text>
                      {movement.reversedByMovementId ? (
                        <Text className="text-xs font-semibold text-danger dark:text-[#FFBABA]">
                          {copy.reversed}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                      {movement.reason}
                    </Text>
                    <Text className="text-xs text-ink-muted dark:text-[#91A198]">
                      {copy.occurrence(
                        movement.occurredLocalDate,
                        movement.occurredLocalTime,
                        movement.timeZone,
                      )}
                    </Text>
                    {movement.reversesMovementId ? (
                      <Text className="text-xs text-ink-muted dark:text-[#91A198]">
                        {copy.reverses}: {movement.reversesMovementId}
                      </Text>
                    ) : null}
                  </View>
                  <View className="gap-2 sm:items-end">
                    <Text
                      className={
                        movement.deltaMinorUnits.startsWith("-")
                          ? "text-lg font-black text-danger dark:text-[#FFBABA]"
                          : "text-lg font-black text-positive dark:text-[#8DDEAF]"
                      }
                    >
                      {movement.deltaMinorUnits.startsWith("-") ? "−" : "+"}
                      {formatQuantityMinorUnits(
                        movement.deltaMinorUnits.replace("-", ""),
                        movement.quantityPrecision,
                      )}
                    </Text>
                    {canReverse ? (
                      <Button
                        label={copy.reverse}
                        onPress={() => onReverse(movement)}
                        size="sm"
                        variant="secondary"
                      />
                    ) : null}
                  </View>
                </View>
              );
            })
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
