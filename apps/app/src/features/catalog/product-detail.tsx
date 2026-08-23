import { AlertTriangle, ArrowLeft } from "lucide-react-native";
import { ActivityIndicator, Text, View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { formatMinorUnits } from "@/lib/money";
import type { ProductDetail, ProductUnitKind } from "../../../../../packages/contracts/src/catalog";
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
  resolveUncertain: string;
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
  if (state.status === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" />
        <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{copy.loading}</Text>
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
        <Text accessibilityRole="alert" className="text-xl font-black text-ink dark:text-white">
          {title}
        </Text>
        <Text className="max-w-[460px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {description}
        </Text>
        {state.status === "error" ? (
          <Button label={copy.retry} onPress={onRetry} variant="secondary" />
        ) : null}
      </View>
    );
  }

  const { product, stock } = state.detail;
  return (
    <Page width="form">
      <Button className="self-start px-0" onPress={onBack} size="sm" variant="ghost">
        <ArrowLeft color="#617168" size={18} />
        <ButtonText className="text-ink-muted dark:text-[#AAB8B0]" variant="ghost">
          {copy.back}
        </ButtonText>
      </Button>
      <ScreenHeader description={copy.description} eyebrow={copy.title} title={product.name} />
      {state.stale ? (
        <View className="border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
          <Text className="text-sm text-ink dark:text-[#F2E4D2]">{copy.stale}</Text>
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
        <View className="gap-5 border-y border-line py-6 dark:border-[#304239]">
          <View className="gap-1">
            <Text
              accessibilityRole="header"
              className="text-xl font-black text-ink dark:text-white"
            >
              {copy.archiveTitle}
            </Text>
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
              {copy.archiveDescription}
            </Text>
          </View>
          {archiveState === "error" || archiveState === "uncertain" ? (
            <View className="flex-row items-start gap-3 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
              <AlertTriangle color="#B94242" size={20} />
              <View className="min-w-0 flex-1 gap-1">
                <Text
                  accessibilityRole="alert"
                  className="font-bold text-danger dark:text-[#FFBABA]"
                >
                  {archiveState === "uncertain" ? copy.uncertainTitle : copy.archiveFailedTitle}
                </Text>
                <Text className="text-sm text-ink-muted dark:text-[#C9D4CE]">
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
                label={copy.resolveUncertain}
                onPress={onResolveUncertain}
                variant="secondary"
              />
            ) : (
              <>
                <Button
                  label={copy.confirmArchive}
                  loading={archiveState === "pending"}
                  onPress={onArchive}
                  variant="danger"
                />
                <Button label={copy.cancel} onPress={onCancelArchive} variant="secondary" />
              </>
            )}
          </View>
        </View>
      ) : canManage && product.status === "active" ? (
        <View className="gap-3 sm:flex-row">
          <Button label={copy.edit} onPress={onEdit} variant="accent" />
          <Button label={copy.archive} onPress={onRequestArchive} variant="danger" />
        </View>
      ) : showReadOnlyNotice && product.status === "active" ? (
        <ReadOnlyNotice description={copy.readOnlyDescription} />
      ) : null}
    </Page>
  );
}
