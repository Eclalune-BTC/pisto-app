import type {
  CashAccount,
  CashAccountKind,
  CreateCashAccountRequest,
  UpdateCashAccountRequest,
} from "@pisto/contracts";
import { CircleAlert } from "lucide-react-native";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { CommandReview } from "@/components/command-review";
import type { DescriptionItem } from "@/components/layout/description-list";
import { FormActions } from "@/components/layout/form-actions";
import { FormSection } from "@/components/layout/form-section";
import { PageHeader } from "@/components/layout/page-header";
import { ChangedValue } from "@/components/layout/review-values";
import { Page } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";
import { formatLocalMoment } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import type { MutationPhase } from "@/lib/mutation-phase";
import { ChoiceList } from "./choice-list";
import { cashAccountKindLabels } from "./copy";
import type { AccountDraftValues } from "./drafts";
import { LocalDateTimeFields } from "./local-date-time-fields";

export type CashAccountEditorDraft = AccountDraftValues;

export type CashAccountEditorErrors = Partial<
  Record<keyof CashAccountEditorDraft | "form", string>
>;

type CashAccountEditorScreenProps = {
  /** The account being edited; null when creating one. */
  account: CashAccount | null;
  /** Access or freshness was lost after the review was prepared. */
  canConfirm: boolean;
  /** Prepared command; when present the screen shows its review. */
  command: CreateCashAccountRequest | UpdateCashAccountRequest | null;
  currency: string;
  draft: CashAccountEditorDraft;
  errorMessage?: string;
  errors: CashAccountEditorErrors;
  formatMoney: (minorUnits: string, currency: string) => string;
  onCancel: () => void;
  onConfirm: () => void;
  onDraftChange: (next: CashAccountEditorDraft) => void;
  onEdit: () => void;
  onPrepareReview: () => void;
  phase: MutationPhase;
};

function isCreateCommand(
  command: CreateCashAccountRequest | UpdateCashAccountRequest,
): command is CreateCashAccountRequest {
  return "currency" in command;
}

export function CashAccountEditorScreen({
  account,
  canConfirm,
  command,
  currency,
  draft,
  errorMessage,
  errors,
  formatMoney,
  onCancel,
  onConfirm,
  onDraftChange,
  onEdit,
  onPrepareReview,
  phase,
}: CashAccountEditorScreenProps) {
  const { i18n, t } = useTranslation();
  const policyId = useId();
  const kinds = cashAccountKindLabels(t);
  const creating = account === null;

  if (command) {
    const createCommand = isCreateCommand(command) ? command : null;
    const original = createCommand ?? account;
    if (!original) throw new Error("A cash account update review requires its original account");
    const policy = (allowed: boolean) =>
      allowed ? t("cash.accountDetail.negativeAllowed") : t("cash.accountDetail.negativeProtected");
    // An update shows each changed field next to the value it replaces.
    const reviewed = (before: string, after: string) =>
      before === after ? after : <ChangedValue after={after} before={before} />;
    const items: DescriptionItem[] = [
      {
        label: t("cash.accountEditor.name"),
        value: reviewed(original.name, command.name ?? original.name),
      },
      {
        label: t("cash.accountEditor.kind"),
        value: reviewed(kinds[original.kind], kinds[command.kind ?? original.kind]),
      },
      {
        label: t("cash.accountDetail.negativePolicy"),
        value: reviewed(
          policy(original.allowNegativeBalance),
          policy(command.allowNegativeBalance ?? original.allowNegativeBalance),
        ),
      },
    ];
    if (createCommand) {
      const opening = createCommand.opening;
      items.push(
        { label: t("cash.accountDetail.currency"), value: createCommand.currency },
        {
          label: t("cash.accountEditor.openingBalance"),
          numeric: true,
          value: formatMoney(
            // Concatenating the sign keeps the reviewed amount exact; no arithmetic is involved.
            opening?.direction === "out"
              ? `-${opening.amountMinorUnits}`
              : (opening?.amountMinorUnits ?? "0"),
            createCommand.currency,
          ),
        },
      );
      if (opening) {
        items.push(
          { label: t("cash.fields.reason"), value: opening.reason },
          {
            label: t("cash.fields.occurredAt"),
            numeric: true,
            value: formatLocalMoment(
              opening.occurredLocalDate,
              opening.occurredLocalTime,
              requireSupportedLocale(i18n.resolvedLanguage),
            ),
          },
        );
      }
    }
    return (
      <Page width="form">
        <PageHeader
          description={t("cash.accountEditor.reviewDescription")}
          title={
            creating
              ? t("cash.accountEditor.reviewCreateTitle")
              : t("cash.accountEditor.reviewUpdateTitle")
          }
        />
        <CommandReview
          confirmLabel={
            creating ? t("cash.accountEditor.confirmCreate") : t("cash.accountEditor.confirmUpdate")
          }
          disabled={!canConfirm}
          note={
            creating ? t("cash.accountEditor.createEffect") : t("cash.accountEditor.updateEffect")
          }
          errorMessage={errorMessage}
          items={items}
          onConfirm={onConfirm}
          onEdit={onEdit}
          phase={phase}
          title={
            creating
              ? t("cash.accountEditor.reviewCreateTitle")
              : t("cash.accountEditor.reviewUpdateTitle")
          }
        />
      </Page>
    );
  }

  const togglePolicy = () =>
    onDraftChange({
      ...draft,
      negativePolicy: draft.negativePolicy === "allowed" ? "protected" : "allowed",
    });

  return (
    <Page width="form">
      <PageHeader
        description={
          creating
            ? t("cash.accountEditor.createDescription")
            : t("cash.accountEditor.updateDescription")
        }
        title={creating ? t("cash.accountEditor.createTitle") : t("cash.accountEditor.updateTitle")}
      />

      <FormSection title={t("cash.accountEditor.accountSection")}>
        <Field
          error={errors.name}
          label={t("cash.accountEditor.name")}
          maxLength={80}
          onChangeText={(name) => onDraftChange({ ...draft, name })}
          value={draft.name}
        />
        <SelectField<CashAccountKind>
          label={t("cash.accountEditor.kind")}
          onChange={(kind) => onDraftChange({ ...draft, kind })}
          options={(Object.keys(kinds) as CashAccountKind[]).map((value) => ({
            label: kinds[value],
            value,
          }))}
          value={draft.kind}
        />
      </FormSection>

      {creating ? (
        <FormSection
          description={t("cash.accountEditor.openingDescription")}
          title={t("cash.accountEditor.openingBalance")}
        >
          <ChoiceList
            label={t("cash.accountEditor.openingMode")}
            onChange={(openingMode) => onDraftChange({ ...draft, openingMode })}
            options={[
              { label: t("cash.accountEditor.startAtZero"), value: "zero" },
              { label: t("cash.accountEditor.moneyIn"), value: "in" },
              { label: t("cash.accountEditor.moneyOut"), value: "out" },
            ]}
            value={draft.openingMode}
          />
          {draft.openingMode !== "zero" ? (
            <>
              <Field
                error={errors.openingAmount}
                keyboardType="decimal-pad"
                label={t("cash.fields.amount")}
                onChangeText={(openingAmount) => onDraftChange({ ...draft, openingAmount })}
                trailing={<Text className="font-ui text-sm text-muted-foreground">{currency}</Text>}
                value={draft.openingAmount}
              />
              <Field
                error={errors.openingReason}
                label={t("cash.fields.reason")}
                maxLength={240}
                onChangeText={(openingReason) => onDraftChange({ ...draft, openingReason })}
                value={draft.openingReason}
              />
              <LocalDateTimeFields
                date={draft.openingLocalDate}
                dateError={errors.openingLocalDate}
                onDateChange={(openingLocalDate) => onDraftChange({ ...draft, openingLocalDate })}
                onTimeChange={(openingLocalTime) => onDraftChange({ ...draft, openingLocalTime })}
                time={draft.openingLocalTime}
                timeError={errors.openingLocalTime}
              />
            </>
          ) : null}
        </FormSection>
      ) : null}

      <FormSection title={t("cash.accountDetail.negativePolicy")}>
        <View className="flex-row items-start gap-3">
          <Checkbox
            accessibilityLabel={t("cash.accountEditor.allowNegative")}
            aria-labelledby={`${policyId}-label`}
            checked={draft.negativePolicy === "allowed"}
            className="mt-0.5"
            nativeID={policyId}
            onCheckedChange={togglePolicy}
          />
          <View className="min-w-0 flex-1 gap-1">
            <Label nativeID={`${policyId}-label`} onPress={togglePolicy}>
              {t("cash.accountEditor.allowNegative")}
            </Label>
            <Text className="text-[13px] leading-5 text-muted-foreground">
              {t("cash.accountEditor.allowNegativeDescription")}
            </Text>
          </View>
        </View>
      </FormSection>

      {errors.form ? (
        <Alert icon={CircleAlert}>
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions
        onCancel={onCancel}
        onSubmit={onPrepareReview}
        submitLabel={
          creating ? t("cash.accountEditor.reviewCreate") : t("cash.accountEditor.reviewUpdate")
        }
      />
    </Page>
  );
}
