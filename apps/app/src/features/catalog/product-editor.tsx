import type { Category, ProductUnitKind } from "@pisto/contracts";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react-native";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";

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
  retrySameConfirmation: string;
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
  isStale: boolean;
  isRefreshing: boolean;
  onRetryRead: () => void;
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
  isStale,
  isRefreshing,
  onRetryRead,
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
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const destructiveColor = useCSSVariable("--color-destructive") as string;
  const primaryForegroundColor = useCSSVariable("--color-primary-foreground") as string;
  const review = reviewItems !== null;
  const controlsDisabled = mutationState === "pending" || mutationState === "uncertain";
  const unitKinds = Object.keys(copy.unitLabels) as ProductUnitKind[];
  const precisions = [0, 1, 2, 3] as const;
  const selectPrecision = (value: string) => {
    if (controlsDisabled) return;
    const quantityPrecision = precisions.find((precision) => String(precision) === value);
    if (quantityPrecision === undefined)
      throw new Error("The selected quantity precision is unavailable.");
    onDraftChange({ ...draft, quantityPrecision });
  };
  return (
    <Page width="form">
      <Button
        className="self-start px-0"
        disabled={mutationState === "pending" || mutationState === "uncertain"}
        onPress={mutationState === "pending" || mutationState === "uncertain" ? undefined : onBack}
        size="sm"
        variant="ghost"
      >
        <ArrowLeft color={mutedColor} size={18} />
        <Text className="text-muted-foreground">{copy.back}</Text>
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

      {isStale ? <StaleNotice loading={isRefreshing} onRetry={onRetryRead} /> : null}

      {review ? (
        <View className="gap-7">
          <DetailList items={reviewItems} />
          {mutationState === "error" || mutationState === "uncertain" ? (
            <View className="flex-row items-start gap-3 border-l-4 border-destructive bg-destructive-surface p-4">
              <AlertTriangle color={destructiveColor} size={20} />
              <View className="min-w-0 flex-1 gap-1">
                <Text accessibilityRole="alert" className="font-ui text-destructive ">
                  {mutationState === "uncertain" ? copy.uncertainTitle : copy.failedTitle}
                </Text>
                <Text className="text-sm leading-5 text-muted-foreground">
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
                label={copy.retrySameConfirmation}
                onPress={onResolveUncertain}
                variant="outline"
              />
            ) : (
              <>
                <Button
                  disabled={isStale}
                  loading={mutationState === "pending"}
                  onPress={mutationState === "pending" || isStale ? undefined : onConfirm}
                  variant="default"
                >
                  <Check color={primaryForegroundColor} size={18} strokeWidth={2.8} />
                  <Text>{mode === "create" ? copy.confirmCreate : copy.confirmUpdate}</Text>
                </Button>
                <Button
                  disabled={mutationState === "pending"}
                  label={copy.edit}
                  onPress={mutationState === "pending" ? undefined : onEditReview}
                  variant="outline"
                />
              </>
            )}
          </View>
        </View>
      ) : (
        <View className="gap-6">
          {errors.form ? (
            <View className="border-l-4 border-warning bg-warning-surface p-3">
              <Text accessibilityRole="alert" className="text-sm text-foreground">
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
          <View className="gap-5 sm:flex-row">
            <View className="min-w-0 sm:flex-1">
              <Field
                autoCapitalize="characters"
                error={errors.sku}
                label={copy.sku}
                maxLength={64}
                onChangeText={(sku) => onDraftChange({ ...draft, sku })}
                placeholder={copy.skuPlaceholder}
                value={draft.sku}
              />
            </View>
            <View className="min-w-0 sm:flex-1">
              <Field
                error={errors.sellingPrice}
                keyboardType="decimal-pad"
                label={copy.price}
                onChangeText={(sellingPrice) => onDraftChange({ ...draft, sellingPrice })}
                placeholder={copy.pricePlaceholder}
                trailing={<Text className="font-ui text-muted-foreground">{currency}</Text>}
                value={draft.sellingPrice}
              />
            </View>
          </View>

          <View className="gap-5 sm:flex-row">
            <View className="min-w-0 gap-2 sm:flex-1">
              <SelectField
                label={copy.category}
                onChange={(value) =>
                  onDraftChange({ ...draft, categoryId: value === "none" ? null : value })
                }
                options={[
                  { value: "none", label: copy.noCategory },
                  ...categories
                    .filter(
                      (category) =>
                        category.status === "active" || category.id === draft.categoryId,
                    )
                    .map((category) => ({
                      value: category.id,
                      label:
                        category.status === "archived"
                          ? `${category.name} · ${copy.archivedCategory}`
                          : category.name,
                    })),
                ]}
                value={draft.categoryId ?? "none"}
              />
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
                <View className="gap-2 border-l-4 border-warning bg-warning-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                  <Text accessibilityRole="alert" className="text-sm text-foreground">
                    {copy.categoriesUnavailable}
                  </Text>
                  <Button
                    label={copy.retryCategories}
                    onPress={onRetryCategories}
                    size="sm"
                    variant="outline"
                  />
                </View>
              ) : null}
            </View>

            <View className="min-w-0 sm:flex-1">
              <SelectField
                disabled={controlsDisabled}
                label={copy.unit}
                onChange={(value) => {
                  if (controlsDisabled) return;
                  const unitKind = unitKinds.find((kind) => kind === value);
                  if (!unitKind) throw new Error("The selected product unit is unavailable.");
                  onDraftChange({ ...draft, unitKind });
                }}
                options={unitKinds.map((value) => ({ value, label: copy.unitLabels[value] }))}
                value={draft.unitKind}
              />
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-ui text-foreground">{copy.precision}</Text>
            <RadioGroup
              accessibilityLabel={copy.precision}
              className="flex-row flex-wrap gap-x-6 gap-y-2"
              disabled={controlsDisabled}
              onValueChange={selectPrecision}
              value={String(draft.quantityPrecision)}
            >
              {precisions.map((quantityPrecision) => (
                <View className="min-h-12 flex-row items-center gap-3" key={quantityPrecision}>
                  <RadioGroupItem
                    accessibilityLabel={String(quantityPrecision)}
                    aria-labelledby={`product-precision-${quantityPrecision}-label`}
                    disabled={controlsDisabled}
                    hitSlop={14}
                    nativeID={`product-precision-${quantityPrecision}`}
                    value={String(quantityPrecision)}
                  />
                  <Label
                    className="min-h-11 min-w-11 py-3 leading-5"
                    disabled={controlsDisabled}
                    nativeID={`product-precision-${quantityPrecision}-label`}
                    onPress={() => selectPrecision(String(quantityPrecision))}
                  >
                    {String(quantityPrecision)}
                  </Label>
                </View>
              ))}
            </RadioGroup>
          </View>

          <View className="gap-3 border-t border-border pt-5  sm:flex-row sm:items-center sm:justify-between">
            <View className="max-w-[520px] gap-1">
              <Label
                className="min-h-11 flex-1 py-3 leading-5"
                disabled={controlsDisabled}
                nativeID="product-tracked-label"
                onPress={() => {
                  if (!controlsDisabled) onDraftChange({ ...draft, tracked: !draft.tracked });
                }}
              >
                {copy.tracked}
              </Label>
              <Text className="text-sm leading-5 text-muted-foreground">
                {copy.trackedDescription}
              </Text>
            </View>
            <Switch
              accessibilityLabel={copy.tracked}
              aria-labelledby="product-tracked-label"
              hitSlop={14}
              checked={draft.tracked}
              disabled={controlsDisabled}
              onCheckedChange={(tracked) => {
                if (!controlsDisabled) onDraftChange({ ...draft, tracked });
              }}
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

          <Button
            className="self-start"
            disabled={isStale || mutationState === "pending" || mutationState === "uncertain"}
            label={copy.review}
            onPress={
              isStale || mutationState === "pending" || mutationState === "uncertain"
                ? undefined
                : onReview
            }
            variant="default"
          />
        </View>
      )}
    </Page>
  );
}
