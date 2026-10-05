import type { Category, ProductUnitKind } from "@pisto/contracts";
import { CircleAlert } from "lucide-react-native";
import type { RefObject } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import type { DescriptionItem } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import type { MutationPhase } from "@/lib/mutation-phase";
import { FormSection } from "../cash/form-section";
import { CommandReview } from "./command-review";
import {
  type ProductDraftErrors,
  type ProductDraftField,
  type ProductDraftFields,
  quantityPrecisions,
} from "./product-draft";

const NO_CATEGORY = "none";

const unitKinds: readonly ProductUnitKind[] = [
  "unit",
  "kilogram",
  "gram",
  "liter",
  "milliliter",
  "meter",
];

export type ProductFieldRefs = Record<ProductDraftField, RefObject<TextInput | null>>;

type ProductFormScreenProps = {
  /** Every category of the business; archived ones are offered only when already chosen. */
  categories: Category[];
  categoriesError: boolean;
  categoriesLoading: boolean;
  currency: string;
  draft: ProductDraftFields;
  errors: ProductDraftErrors;
  fieldRefs: ProductFieldRefs;
  /** Movements exist, so the unit, the decimals and tracking can no longer change. */
  historyLocked: boolean;
  isRefreshing: boolean;
  isStale: boolean;
  mode: "create" | "edit";
  mutationMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
  onDraftChange: (draft: ProductDraftFields) => void;
  onEditReview: () => void;
  onRetryCategories: () => void;
  onRetryRead: () => void;
  onReview: () => void;
  phase: MutationPhase;
  /** The prepared command's summary; the screen shows its review while it is present. */
  reviewItems: DescriptionItem[] | null;
};

export function ProductFormScreen({
  categories,
  categoriesError,
  categoriesLoading,
  currency,
  draft,
  errors,
  fieldRefs,
  historyLocked,
  isRefreshing,
  isStale,
  mode,
  mutationMessage,
  onCancel,
  onConfirm,
  onDraftChange,
  onEditReview,
  onRetryCategories,
  onRetryRead,
  onReview,
  phase,
  reviewItems,
}: ProductFormScreenProps) {
  const { t } = useTranslation();
  const trackedId = useId();
  const creating = mode === "create";
  const staleNotice = isStale ? <StaleNotice loading={isRefreshing} onRetry={onRetryRead} /> : null;

  if (reviewItems) {
    const title = creating
      ? t("catalog.form.reviewCreateTitle")
      : t("catalog.form.reviewEditTitle");
    return (
      <Page width="form">
        <PageHeader
          description={
            creating
              ? t("catalog.form.reviewCreateDescription")
              : t("catalog.form.reviewEditDescription")
          }
          title={title}
        />
        {staleNotice}
        <CommandReview
          confirmLabel={
            creating ? t("catalog.form.confirmCreate") : t("catalog.form.confirmUpdate")
          }
          disabled={isStale}
          errorMessage={mutationMessage}
          failedTitle={t("catalog.form.failedTitle")}
          items={reviewItems}
          onConfirm={onConfirm}
          onEdit={onEditReview}
          phase={phase}
          title={title}
          uncertainDescription={t("catalog.form.uncertainDescription")}
        />
      </Page>
    );
  }

  const offeredCategories = categories.filter(
    (category) => category.status === "active" || category.id === draft.categoryId,
  );
  const chosenCategoryKnown =
    draft.categoryId === null || offeredCategories.some(({ id }) => id === draft.categoryId);
  const toggleTracked = (tracked: boolean) => {
    if (!historyLocked) onDraftChange({ ...draft, tracked });
  };

  return (
    <Page width="form">
      <PageHeader
        description={
          creating ? t("catalog.form.createDescription") : t("catalog.form.editDescription")
        }
        title={creating ? t("catalog.form.createTitle") : t("catalog.form.editTitle")}
      />
      {staleNotice}

      <FormSection title={t("catalog.form.identitySection")}>
        <Field
          error={errors.name}
          label={t("catalog.form.name")}
          maxLength={120}
          onChangeText={(name) => onDraftChange({ ...draft, name })}
          placeholder={t("catalog.form.namePlaceholder")}
          ref={fieldRefs.name}
          value={draft.name}
        />
        <Field
          autoCapitalize="characters"
          autoCorrect={false}
          description={t("catalog.form.skuDescription")}
          error={errors.sku}
          label={t("catalog.form.sku")}
          maxLength={64}
          onChangeText={(sku) => onDraftChange({ ...draft, sku })}
          placeholder={t("catalog.form.skuPlaceholder")}
          ref={fieldRefs.sku}
          value={draft.sku}
        />
        <View className="min-w-0 gap-2">
          <SelectField
            disabled={categoriesLoading}
            error={categoriesError ? t("catalog.form.categoriesUnavailable") : undefined}
            label={t("catalog.form.category")}
            onChange={(value) =>
              onDraftChange({ ...draft, categoryId: value === NO_CATEGORY ? null : value })
            }
            options={[
              { label: t("catalog.form.noCategory"), value: NO_CATEGORY },
              ...offeredCategories.map((category) => ({
                label:
                  category.status === "archived"
                    ? t("catalog.list.archivedCategory", { name: category.name })
                    : category.name,
                value: category.id,
              })),
            ]}
            placeholder={t("catalog.list.loadingCategories")}
            // A chosen category that is not read yet is shown as loading, not as unavailable.
            value={
              categoriesLoading && !chosenCategoryKnown ? null : (draft.categoryId ?? NO_CATEGORY)
            }
          />
          {categoriesError ? (
            <Button
              className="self-start"
              label={t("common.retry")}
              onPress={onRetryCategories}
              size="sm"
              variant="outline"
            />
          ) : null}
        </View>
      </FormSection>

      <FormSection title={t("catalog.form.priceSection")}>
        <Field
          className="tabular-nums"
          description={t("catalog.form.priceDescription", { currency })}
          error={errors.sellingPrice}
          inputMode="decimal"
          keyboardType="decimal-pad"
          label={t("catalog.form.price")}
          onChangeText={(sellingPrice) => onDraftChange({ ...draft, sellingPrice })}
          placeholder="0.00"
          ref={fieldRefs.sellingPrice}
          trailing={<Text className="font-ui text-sm text-muted-foreground">{currency}</Text>}
          value={draft.sellingPrice}
        />
      </FormSection>

      <FormSection title={t("catalog.form.inventorySection")}>
        {/* The reason sits next to the controls it disables, not in the narrow title column. */}
        {historyLocked ? (
          <Text className="text-[13px] leading-5 text-muted-foreground">
            {t("catalog.form.historyLocked")}
          </Text>
        ) : null}
        <View className="min-w-0 flex-row items-start justify-between gap-4">
          <View className="min-w-0 flex-1 gap-1">
            <Label nativeID={`${trackedId}-label`} onPress={() => toggleTracked(!draft.tracked)}>
              {t("catalog.form.tracked")}
            </Label>
            <Text className="text-[13px] leading-5 text-muted-foreground">
              {t("catalog.form.trackedDescription")}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t("catalog.form.tracked")}
            aria-labelledby={`${trackedId}-label`}
            checked={draft.tracked}
            className="mt-0.5"
            disabled={historyLocked}
            onCheckedChange={toggleTracked}
          />
        </View>
        <SelectField<ProductUnitKind>
          disabled={historyLocked}
          label={t("catalog.form.unit")}
          onChange={(unitKind) => onDraftChange({ ...draft, unitKind })}
          options={unitKinds.map((value) => ({
            label: t(`catalog.unitLabels.${value}`),
            value,
          }))}
          value={draft.unitKind}
        />
        <View className="min-w-0 gap-1.5">
          <Label className="text-[13px]">{t("catalog.form.precision")}</Label>
          <FilterBar
            disabled={historyLocked}
            label={t("catalog.form.precision")}
            onChange={(value) => {
              const quantityPrecision = quantityPrecisions.find(
                (precision) => String(precision) === value,
              );
              if (quantityPrecision === undefined) {
                throw new Error("The selected quantity precision is unavailable.");
              }
              onDraftChange({ ...draft, quantityPrecision });
            }}
            options={quantityPrecisions.map((precision) => ({
              label:
                precision === 0
                  ? t("catalog.form.wholeNumbers")
                  : t("catalog.form.precisionOption", { count: precision }),
              value: String(precision),
            }))}
            value={String(draft.quantityPrecision)}
          />
          <Text className="text-xs leading-4 text-muted-foreground">
            {t("catalog.form.precisionDescription")}
          </Text>
        </View>
        {draft.tracked ? (
          <Field
            className="tabular-nums"
            description={t("catalog.form.thresholdDescription")}
            error={errors.lowStockThreshold}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label={t("catalog.form.threshold")}
            onChangeText={(lowStockThreshold) => onDraftChange({ ...draft, lowStockThreshold })}
            ref={fieldRefs.lowStockThreshold}
            value={draft.lowStockThreshold}
          />
        ) : null}
      </FormSection>

      {errors.form ? (
        <Alert icon={CircleAlert} variant="destructive">
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      ) : null}

      <View className="flex-row flex-wrap justify-end gap-2">
        <Button label={t("common.cancel")} onPress={onCancel} variant="outline" />
        <Button
          disabled={isStale}
          label={t("catalog.form.review")}
          onPress={isStale ? undefined : onReview}
        />
      </View>
    </Page>
  );
}
