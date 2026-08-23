import type { Category, ProductUnitKind } from "@pisto/contracts";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export interface ProductDraftFields {
  categoryId: string | null;
  lowStockThreshold: string;
  name: string;
  quantityPrecision: 0 | 1 | 2 | 3;
  sellingPrice: string;
  sku: string;
  tracked: boolean;
  unitKind: ProductUnitKind;
}

export type ProductDraftErrors = Partial<
  Record<"form" | "lowStockThreshold" | "name" | "sellingPrice" | "sku", string>
>;

export interface ProductEditorCopy {
  back: string;
  createTitle: string;
  editTitle: string;
  createDescription: string;
  editDescription: string;
  reviewTitle: string;
  reviewDescription: string;
  name: string;
  namePlaceholder: string;
  sku: string;
  skuPlaceholder: string;
  price: string;
  pricePlaceholder: string;
  category: string;
  noCategory: string;
  archivedCategory: string;
  unit: string;
  unitLabels: Record<ProductUnitKind, string>;
  precision: string;
  tracked: string;
  trackedDescription: string;
  enableTracking: string;
  disableTracking: string;
  lowStockThreshold: string;
  lowStockPlaceholder: string;
  review: string;
  edit: string;
  confirmCreate: string;
  confirmUpdate: string;
  failedTitle: string;
  failedDescription: string;
  uncertainTitle: string;
  uncertainDescription: string;
  resolveUncertain: string;
  loadMoreCategories: string;
  retryCategories: string;
  categoriesUnavailable: string;
}

interface ProductEditorProps {
  categories: Category[];
  categoriesError: boolean;
  categoriesHasNextPage: boolean;
  categoriesLoadingMore: boolean;
  copy: ProductEditorCopy;
  currency: string;
  draft: ProductDraftFields;
  errors: ProductDraftErrors;
  mode: "create" | "edit";
  mutationMessage?: string;
  mutationState: "idle" | "pending" | "error" | "uncertain";
  onBack: () => void;
  onConfirm: () => void;
  onDraftChange: (draft: ProductDraftFields) => void;
  onEditReview: () => void;
  onLoadMoreCategories: () => void;
  onResolveUncertain: () => void;
  onRetryCategories: () => void;
  onReview: () => void;
  reviewItems: { label: string; value: string }[] | null;
}

function Choice({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className={
        selected
          ? "min-h-11 justify-center border-b-2 border-positive px-1"
          : "min-h-11 justify-center px-1"
      }
      onPress={onPress}
    >
      <Text className="font-semibold text-ink dark:text-white">{label}</Text>
    </Pressable>
  );
}

export function ProductEditor({
  categories,
  categoriesError,
  categoriesHasNextPage,
  categoriesLoadingMore,
  copy,
  currency,
  draft,
  errors,
  mode,
  mutationMessage,
  mutationState,
  onBack,
  onConfirm,
  onDraftChange,
  onEditReview,
  onLoadMoreCategories,
  onResolveUncertain,
  onRetryCategories,
  onReview,
  reviewItems,
}: ProductEditorProps) {
  const review = reviewItems !== null;
  return (
    <Page width="form">
      <Button className="self-start px-0" onPress={onBack} size="sm" variant="ghost">
        <ArrowLeft color="#617168" size={18} />
        <ButtonText className="text-ink-muted dark:text-[#AAB8B0]" variant="ghost">
          {copy.back}
        </ButtonText>
      </Button>

      <ScreenHeader
        description={
          review
            ? copy.reviewDescription
            : mode === "create"
              ? copy.createDescription
              : copy.editDescription
        }
        title={review ? copy.reviewTitle : mode === "create" ? copy.createTitle : copy.editTitle}
      />

      {review ? (
        <View className="gap-7">
          <DetailList items={reviewItems} />
          {mutationState === "error" || mutationState === "uncertain" ? (
            <View className="flex-row items-start gap-3 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
              <AlertTriangle color="#B94242" size={20} />
              <View className="min-w-0 flex-1 gap-1">
                <Text
                  accessibilityRole="alert"
                  className="font-bold text-danger dark:text-[#FFBABA]"
                >
                  {mutationState === "uncertain" ? copy.uncertainTitle : copy.failedTitle}
                </Text>
                <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
                  {mutationState === "uncertain"
                    ? copy.uncertainDescription
                    : (mutationMessage ?? copy.failedDescription)}
                </Text>
              </View>
            </View>
          ) : null}
          <View className="gap-3 sm:flex-row">
            {mutationState === "uncertain" ? (
              <Button
                label={copy.resolveUncertain}
                onPress={onResolveUncertain}
                variant="secondary"
              />
            ) : (
              <>
                <Button loading={mutationState === "pending"} onPress={onConfirm} variant="accent">
                  <Check color="#14241D" size={18} strokeWidth={2.8} />
                  <ButtonText variant="accent">
                    {mode === "create" ? copy.confirmCreate : copy.confirmUpdate}
                  </ButtonText>
                </Button>
                <Button label={copy.edit} onPress={onEditReview} variant="secondary" />
              </>
            )}
          </View>
        </View>
      ) : (
        <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
          {errors.form ? (
            <View className="border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
              <Text accessibilityRole="alert" className="text-sm text-ink dark:text-[#F2E4D2]">
                {errors.form}
              </Text>
            </View>
          ) : null}
          <Field
            error={errors.name}
            label={copy.name}
            maxLength={120}
            onChangeText={(name) => onDraftChange({ ...draft, name })}
            placeholder={copy.namePlaceholder}
            value={draft.name}
          />
          <Field
            autoCapitalize="characters"
            error={errors.sku}
            label={copy.sku}
            maxLength={64}
            onChangeText={(sku) => onDraftChange({ ...draft, sku })}
            placeholder={copy.skuPlaceholder}
            value={draft.sku}
          />
          <Field
            error={errors.sellingPrice}
            keyboardType="decimal-pad"
            label={copy.price}
            onChangeText={(sellingPrice) => onDraftChange({ ...draft, sellingPrice })}
            placeholder={copy.pricePlaceholder}
            trailing={
              <Text className="font-bold text-ink-muted dark:text-[#AAB8B0]">{currency}</Text>
            }
            value={draft.sellingPrice}
          />

          <View className="gap-2">
            <Text className="text-sm font-semibold text-ink dark:text-[#E7EEE9]">
              {copy.category}
            </Text>
            <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-x-5 gap-y-1">
              <Choice
                label={copy.noCategory}
                onPress={() => onDraftChange({ ...draft, categoryId: null })}
                selected={draft.categoryId === null}
              />
              {categories
                .filter(
                  (category) => category.status === "active" || category.id === draft.categoryId,
                )
                .map((category) => (
                  <Choice
                    key={category.id}
                    label={
                      category.status === "archived"
                        ? `${category.name} · ${copy.archivedCategory}`
                        : category.name
                    }
                    onPress={() => onDraftChange({ ...draft, categoryId: category.id })}
                    selected={draft.categoryId === category.id}
                  />
                ))}
            </View>
            {categoriesHasNextPage ? (
              <Button
                className="self-start"
                label={copy.loadMoreCategories}
                loading={categoriesLoadingMore}
                onPress={onLoadMoreCategories}
                size="sm"
                variant="ghost"
              />
            ) : null}
            {categoriesError ? (
              <View className="gap-2 border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18] sm:flex-row sm:items-center sm:justify-between">
                <Text accessibilityRole="alert" className="text-sm text-ink dark:text-[#F2E4D2]">
                  {copy.categoriesUnavailable}
                </Text>
                <Button
                  label={copy.retryCategories}
                  onPress={onRetryCategories}
                  size="sm"
                  variant="secondary"
                />
              </View>
            ) : null}
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-ink dark:text-[#E7EEE9]">{copy.unit}</Text>
            <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-x-5 gap-y-1">
              {(Object.keys(copy.unitLabels) as ProductUnitKind[]).map((unitKind) => (
                <Choice
                  key={unitKind}
                  label={copy.unitLabels[unitKind]}
                  onPress={() => onDraftChange({ ...draft, unitKind })}
                  selected={draft.unitKind === unitKind}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-ink dark:text-[#E7EEE9]">
              {copy.precision}
            </Text>
            <View accessibilityRole="radiogroup" className="flex-row gap-6">
              {([0, 1, 2, 3] as const).map((quantityPrecision) => (
                <Choice
                  key={quantityPrecision}
                  label={String(quantityPrecision)}
                  onPress={() => onDraftChange({ ...draft, quantityPrecision })}
                  selected={draft.quantityPrecision === quantityPrecision}
                />
              ))}
            </View>
          </View>

          <View className="gap-3 border-t border-line pt-5 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between">
            <View className="max-w-[520px] gap-1">
              <Text className="font-bold text-ink dark:text-white">{copy.tracked}</Text>
              <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                {copy.trackedDescription}
              </Text>
            </View>
            <Button
              label={draft.tracked ? copy.disableTracking : copy.enableTracking}
              onPress={() => onDraftChange({ ...draft, tracked: !draft.tracked })}
              variant="secondary"
            />
          </View>

          {draft.tracked ? (
            <Field
              error={errors.lowStockThreshold}
              keyboardType="decimal-pad"
              label={copy.lowStockThreshold}
              onChangeText={(lowStockThreshold) => onDraftChange({ ...draft, lowStockThreshold })}
              placeholder={copy.lowStockPlaceholder}
              value={draft.lowStockThreshold}
            />
          ) : null}

          <Button className="self-start" label={copy.review} onPress={onReview} variant="accent" />
        </View>
      )}
    </Page>
  );
}
