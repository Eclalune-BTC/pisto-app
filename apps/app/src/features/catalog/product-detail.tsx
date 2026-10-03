import type { ProductDetail, ProductUnitKind } from "@pisto/contracts";
import { AlertTriangle, ArrowLeft } from "lucide-react-native";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";
import { formatMinorUnits } from "@/lib/money";
import { formatQuantityMinorUnits } from "../inventory/quantity";
import { ReadOnlyNotice } from "./route-state";

export type ProductDetailState =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "denied" }
  | { status: "notFound" }
  | { status: "error" }
  | { status: "ready"; detail: ProductDetail; stale?: boolean };

export interface ProductDetailCopy {
  back: string;
  title: string;
  description: string;
  edit: string;
  archive: string;
  status: string;
  active: string;
  archived: string;
  sku: string;
  noSku: string;
  price: string;
  noPrice: string;
  unit: string;
  unitLabels: Record<ProductUnitKind, string>;
  precision: string;
  category: string;
  noCategory: string;
  categoryUnavailable: string;
  tracked: string;
  yes: string;
  no: string;
  notTracked: string;
  onHand: string;
  lowStockThreshold: string;
  noThreshold: string;
  loading: string;
  offlineTitle: string;
  offlineDescription: string;
  deniedTitle: string;
  deniedDescription: string;
  notFoundTitle: string;
  notFoundDescription: string;
  errorTitle: string;
  errorDescription: string;
  retry: string;
  stale: string;
  archiveTitle: string;
  archiveDescription: string;
  confirmArchive: string;
  cancel: string;
  archiveFailedTitle: string;
  archiveFailedDescription: string;
  uncertainTitle: string;
  uncertainDescription: string;
  retrySameConfirmation: string;
  readOnlyTitle: string;
  readOnlyDescription: string;
}

interface ProductDetailProps {
  archiveReview: boolean;
  archiveState: "idle" | "pending" | "error" | "uncertain";
  canManage: boolean;
  categoryName: string | null;
  copy: ProductDetailCopy;
  locale: string;
  mutationMessage?: string;
  onArchive: () => void;
  onBack: () => void;
  onCancelArchive: () => void;
  onEdit: () => void;
  onRequestArchive: () => void;
  onResolveUncertain: () => void;
  onRetry: () => void;
  showReadOnlyNotice: boolean;
  state: ProductDetailState;
}

export function ProductDetailScreen({
  archiveReview,
  archiveState,
  canManage,
  categoryName,
  copy,
  locale,
  mutationMessage,
  onArchive,
  onBack,
  onCancelArchive,
  onEdit,
  onRequestArchive,
  onResolveUncertain,
  onRetry,
  showReadOnlyNotice,
  state,
}: ProductDetailProps) {
  const foregroundColor = useCSSVariable("--color-foreground") as string;
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const destructiveColor = useCSSVariable("--color-destructive") as string;
  if (state.status === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <LoadingIndicator color={foregroundColor} />
        <Text className="text-sm text-muted-foreground">{copy.loading}</Text>
      </View>
    );
  }
  if (state.status !== "ready") {
    const title =
      state.status === "denied"
        ? copy.deniedTitle
        : state.status === "notFound"
          ? copy.notFoundTitle
          : state.status === "offline"
            ? copy.offlineTitle
            : copy.errorTitle;
    const description =
      state.status === "denied"
        ? copy.deniedDescription
        : state.status === "notFound"
          ? copy.notFoundDescription
          : state.status === "offline"
            ? copy.offlineDescription
            : copy.errorDescription;
    return (
      <View className="flex-1 items-start justify-center gap-4 px-5 sm:px-8 lg:px-10">
        <Text accessibilityRole="alert" className="text-xl font-heading text-foreground">
          {title}
        </Text>
        <Text className="max-w-[460px] text-sm leading-5 text-muted-foreground">{description}</Text>
        {state.status === "error" ? (
          <Button label={copy.retry} onPress={onRetry} variant="outline" />
        ) : null}
      </View>
    );
  }

  const { product, stock } = state.detail;
  return (
    <Page width="form">
      <Button
        className="self-start px-0"
        disabled={archiveState === "pending" || archiveState === "uncertain"}
        onPress={archiveState === "pending" || archiveState === "uncertain" ? undefined : onBack}
        size="sm"
        variant="ghost"
      >
        <ArrowLeft color={mutedColor} size={18} />
        <Text className="text-muted-foreground">{copy.back}</Text>
      </Button>
      <ScreenHeader description={copy.description} eyebrow={copy.title} title={product.name} />
      {state.stale ? (
        <View className="border-l-4 border-warning bg-warning-surface p-3">
          <Text className="text-sm text-foreground">{copy.stale}</Text>
        </View>
      ) : null}
      <DetailList
        items={[
          {
            label: copy.status,
            value: product.status === "active" ? copy.active : copy.archived,
          },
          { label: copy.sku, value: product.sku ?? copy.noSku },
          {
            label: copy.price,
            value:
              product.sellingPriceMinorUnits === null ||
              product.sellingPriceCurrency === null ||
              product.sellingPriceCurrencyMinorUnitDigits === null
                ? copy.noPrice
                : formatMinorUnits(
                    product.sellingPriceMinorUnits,
                    product.sellingPriceCurrency,
                    product.sellingPriceCurrencyMinorUnitDigits,
                    locale,
                  ),
          },
          { label: copy.category, value: categoryName ?? copy.noCategory },
          { label: copy.unit, value: copy.unitLabels[product.unitKind] },
          { label: copy.precision, value: String(product.quantityPrecision) },
          { label: copy.tracked, value: product.tracked ? copy.yes : copy.no },
          {
            label: copy.onHand,
            value: stock
              ? formatQuantityMinorUnits(stock.onHandMinorUnits, stock.quantityPrecision)
              : copy.notTracked,
          },
          {
            label: copy.lowStockThreshold,
            value:
              stock?.lowStockThresholdMinorUnits == null
                ? copy.noThreshold
                : formatQuantityMinorUnits(
                    stock.lowStockThresholdMinorUnits,
                    stock.quantityPrecision,
                  ),
          },
        ]}
      />

      {archiveReview ? (
        <View className="gap-5 border-y border-border py-6 ">
          <View className="gap-1">
            <Text accessibilityRole="header" className="text-xl font-heading text-foreground">
              {copy.archiveTitle}
            </Text>
            <Text className="text-sm leading-5 text-muted-foreground">
              {copy.archiveDescription}
            </Text>
          </View>
          {archiveState === "error" || archiveState === "uncertain" ? (
            <View className="flex-row items-start gap-3 border-l-4 border-destructive bg-destructive-surface p-4">
              <AlertTriangle color={destructiveColor} size={20} />
              <View className="min-w-0 flex-1 gap-1">
                <Text accessibilityRole="alert" className="font-ui text-destructive ">
                  {archiveState === "uncertain" ? copy.uncertainTitle : copy.archiveFailedTitle}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {archiveState === "uncertain"
                    ? copy.uncertainDescription
                    : (mutationMessage ?? copy.archiveFailedDescription)}
                </Text>
              </View>
            </View>
          ) : null}
          <View className="gap-3 sm:flex-row">
            {archiveState === "uncertain" ? (
              <Button
                label={copy.retrySameConfirmation}
                onPress={onResolveUncertain}
                variant="outline"
              />
            ) : (
              <>
                <Button
                  label={copy.confirmArchive}
                  loading={archiveState === "pending"}
                  onPress={onArchive}
                  variant="destructive"
                />
                <Button
                  disabled={archiveState === "pending"}
                  label={copy.cancel}
                  onPress={archiveState === "pending" ? undefined : onCancelArchive}
                  variant="outline"
                />
              </>
            )}
          </View>
        </View>
      ) : canManage && product.status === "active" ? (
        <View className="gap-3 sm:flex-row">
          <Button label={copy.edit} onPress={onEdit} variant="default" />
          <Button label={copy.archive} onPress={onRequestArchive} variant="destructive" />
        </View>
      ) : showReadOnlyNotice && product.status === "active" ? (
        <ReadOnlyNotice description={copy.readOnlyDescription} />
      ) : null}
    </Page>
  );
}
