import type {
  AssistantDraft,
  AssistantDraftKind,
  AssistantField,
  AssistantPurchaseDraft,
  AssistantSaleDraft,
} from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { TranscriptMarker } from "@/components/ui/transcript-highlight";
import { formatQuantity } from "@/features/inventory/quantity";
import { formatLocalDate, formatLocalMoment } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { type DraftFormProps, type DraftFormSlots, useFieldMarker } from "./draft-slots";

function Marked({ field, children }: { field: AssistantField; children: string }) {
  const marker = useFieldMarker(field);
  return (
    <View className="min-w-0 flex-row items-center gap-2">
      {marker === null ? null : <TranscriptMarker marker={marker} />}
      <Text className="min-w-0 shrink text-sm leading-5">{children}</Text>
    </View>
  );
}

function useFormatters() {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  // The review route renders a draft only for the loaded active business.
  if (!business) throw new Error("A draft preview needs the active business");
  return {
    t,
    locale,
    money: (minorUnits: string | null) =>
      minorUnits === null
        ? t("assistant.values.notStated")
        : formatMinorUnits(minorUnits, business.currency, business.currencyMinorUnitDigits, locale),
  };
}

type Formatters = ReturnType<typeof useFormatters>;

function party(
  f: Formatters,
  value: { heard: string | null; match: { name: string } | null },
): string {
  if (value.match) return value.match.name;
  if (value.heard) return f.t("assistant.values.heardNoMatch", { heard: value.heard });
  return f.t("assistant.values.notStated");
}

function lineItems(
  f: Formatters,
  lines: AssistantSaleDraft["lines"] | AssistantPurchaseDraft["lines"],
): DescriptionItem[] {
  return lines.map((line, index) => {
    const product = line.product?.name ?? f.t("assistant.values.heardAs", { heard: line.heard });
    const quantity =
      line.quantityMinorUnits !== null && line.quantityPrecision !== null
        ? formatQuantity(line.quantityMinorUnits, line.quantityPrecision, f.locale)
        : f.t("assistant.values.notStated");
    const text =
      line.unitAmountMinorUnits !== null && line.subtotalMinorUnits !== null
        ? f.t("assistant.values.line", {
            product,
            quantity,
            unit: f.money(line.unitAmountMinorUnits),
            subtotal: f.money(line.subtotalMinorUnits),
          })
        : f.t("assistant.values.lineNoPrice", { product, quantity });
    return {
      label: f.t("assistant.fields.product", { position: index + 1 }),
      value: <Marked field="product">{text}</Marked>,
    };
  });
}

function common(f: Formatters, draft: AssistantDraft): DescriptionItem[] {
  return [
    {
      label: f.t("assistant.fields.kind"),
      value: <Marked field="kind">{f.t(`assistant.kinds.${draft.kind}`)}</Marked>,
    },
    {
      label: f.t("assistant.fields.date"),
      value: (
        <Marked field="date">
          {formatLocalMoment(draft.occurredLocalDate, draft.occurredLocalTime, f.locale)}
        </Marked>
      ),
      numeric: true,
    },
  ];
}

function account(f: Formatters, value: { name: string } | null): DescriptionItem {
  return {
    label: f.t("assistant.fields.account"),
    value: <Marked field="account">{value?.name ?? f.t("assistant.values.notStated")}</Marked>,
  };
}

function method(f: Formatters, value: "cash" | "transfer" | "card" | null): DescriptionItem {
  return {
    label: f.t("assistant.fields.paymentMethod"),
    value: (
      <Marked field="paymentMethod">
        {value ? f.t(`assistant.values.methods.${value}`) : f.t("assistant.values.notStated")}
      </Marked>
    ),
  };
}

function dueDate(f: Formatters, value: string | null): DescriptionItem[] {
  return value
    ? [
        {
          label: f.t("assistant.fields.dueDate"),
          value: <Marked field="dueDate">{formatLocalDate(value, f.locale)}</Marked>,
          numeric: true,
        },
      ]
    : [];
}

function money(f: Formatters, field: AssistantField, label: string, value: string | null) {
  return { label, value: <Marked field={field}>{f.money(value)}</Marked>, numeric: true };
}

function items(f: Formatters, draft: AssistantDraft): DescriptionItem[] {
  switch (draft.kind) {
    case "sale":
      return [
        ...common(f, draft),
        {
          label: f.t("assistant.fields.customer"),
          value: <Marked field="customer">{party(f, draft.customer)}</Marked>,
        },
        ...lineItems(f, draft.lines),
        money(f, "amount", f.t("assistant.fields.total"), draft.totalMinorUnits),
        money(f, "received", f.t("assistant.fields.received"), draft.receivedMinorUnits),
        method(f, draft.paymentMethod),
        account(f, draft.account),
        money(f, "credit", f.t("assistant.fields.credit"), draft.creditMinorUnits),
        ...dueDate(f, draft.dueDate),
        ...(draft.description
          ? [
              {
                label: f.t("assistant.fields.description"),
                value: <Marked field="description">{draft.description}</Marked>,
              },
            ]
          : []),
      ];
    case "expense":
      return [
        ...common(f, draft),
        money(f, "amount", f.t("assistant.fields.amount"), draft.amountMinorUnits),
        {
          label: f.t("assistant.fields.category"),
          value: (
            <Marked field="category">
              {draft.category
                ? f.t(`expenses.categories.${draft.category}`)
                : f.t("assistant.values.notStated")}
            </Marked>
          ),
        },
        {
          label: f.t("assistant.fields.description"),
          value: (
            <Marked field="description">
              {draft.description ?? f.t("assistant.values.notStated")}
            </Marked>
          ),
        },
        {
          label: f.t("assistant.fields.payee"),
          value: (
            <Marked field="supplier">{draft.payee ?? f.t("assistant.values.notStated")}</Marked>
          ),
        },
        account(f, draft.account),
      ];
    case "purchase":
      return [
        ...common(f, draft),
        {
          label: f.t("assistant.fields.supplier"),
          value: <Marked field="supplier">{party(f, draft.supplier)}</Marked>,
        },
        {
          label: f.t("assistant.fields.invoice"),
          value: (
            <Marked field="invoice">
              {draft.invoiceNumber ?? f.t("assistant.values.notStated")}
            </Marked>
          ),
        },
        ...lineItems(f, draft.lines),
        money(f, "amount", f.t("assistant.fields.total"), draft.totalMinorUnits),
        {
          label: f.t("assistant.fields.paymentTerms"),
          value: (
            <Marked field="credit">
              {draft.paymentTerms
                ? f.t(`assistant.values.terms.${draft.paymentTerms}`)
                : f.t("assistant.values.notStated")}
            </Marked>
          ),
        },
        account(f, draft.account),
        ...dueDate(f, draft.dueDate),
        {
          label: f.t("assistant.fields.goodsReceived"),
          value:
            draft.received === null
              ? f.t("assistant.values.notStated")
              : draft.received
                ? f.t("assistant.values.goods.received")
                : f.t("assistant.values.goods.pending"),
        },
      ];
    case "receivable_payment":
      return [
        ...common(f, draft),
        {
          label: f.t("assistant.fields.customer"),
          value: <Marked field="customer">{party(f, draft.customer)}</Marked>,
        },
        {
          label: f.t("assistant.fields.receivable"),
          value: draft.receivable
            ? f.t("assistant.values.receivableBalance", {
                description: draft.receivable.description,
                balance: f.money(draft.receivable.balanceMinorUnits),
              })
            : f.t("assistant.values.notStated"),
        },
        money(f, "amount", f.t("assistant.fields.amount"), draft.amountMinorUnits),
        account(f, draft.account),
      ];
    case "supplier_payment":
      return [
        ...common(f, draft),
        {
          label: f.t("assistant.fields.supplier"),
          value: <Marked field="supplier">{party(f, draft.supplier)}</Marked>,
        },
        {
          label: f.t("assistant.fields.purchase"),
          value: draft.purchase
            ? draft.purchase.invoiceNumber
              ? f.t("assistant.values.purchaseBalance", {
                  invoice: draft.purchase.invoiceNumber,
                  balance: f.money(draft.purchase.balanceMinorUnits),
                })
              : f.t("assistant.values.purchaseBalanceNoInvoice", {
                  balance: f.money(draft.purchase.balanceMinorUnits),
                })
            : f.t("assistant.values.notStated"),
        },
        money(f, "amount", f.t("assistant.fields.amount"), draft.amountMinorUnits),
        account(f, draft.account),
      ];
  }
}

/**
 * Read-only stand-in for a record form that is not composed yet: it shows exactly what the draft
 * holds and cannot save it.
 */
function DraftPreview<K extends AssistantDraftKind>({ draft, onCancel }: DraftFormProps<K>) {
  const f = useFormatters();
  return (
    <View className="gap-3">
      <DescriptionList items={items(f, draft)} />
      <Alert icon={Info} role="note">
        <AlertDescription>{f.t("assistant.review.notConnected")}</AlertDescription>
      </Alert>
      <View className="flex-row flex-wrap items-center justify-end gap-2">
        <Button label={f.t("common.cancel")} onPress={onCancel} variant="outline" />
        <Button disabled label={f.t(`assistant.review.save.${draft.kind}`)} />
      </View>
    </View>
  );
}

export const previewDraftFormSlots: DraftFormSlots = {
  sale: (props) => <DraftPreview {...props} />,
  expense: (props) => <DraftPreview {...props} />,
  purchase: (props) => <DraftPreview {...props} />,
  receivable_payment: (props) => <DraftPreview {...props} />,
  supplier_payment: (props) => <DraftPreview {...props} />,
};
