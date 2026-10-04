import type { Sale } from "@pisto/contracts";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { DescriptionItem } from "@/components/layout/description-list";
import { StatusBadge } from "@/components/ui/status-badge";
import { Text } from "@/components/ui/text";
import { formatLocalMoment } from "@/i18n/format";
import { formatMinorUnits } from "@/lib/money";

type SaleMoney = {
  currency: string;
  currencyMinorUnitDigits: number;
  grossMinorUnits: string;
};

type SaleOccurrence = {
  description?: string | null;
  occurredLocalDate: string;
  occurredLocalTime: string;
};

export function SaleStatusBadge({ status }: { status: Sale["status"] }) {
  const { t } = useTranslation();
  return status === "voided" ? (
    <StatusBadge label={t("sales.voided")} tone="exception" />
  ) : (
    <StatusBadge label={t("sales.posted")} tone="normal" />
  );
}

export function saleAmount(sale: SaleMoney, locale: string): string {
  return formatMinorUnits(
    sale.grossMinorUnits,
    sale.currency,
    sale.currencyMinorUnitDigits,
    locale,
  );
}

export function saleMoment(sale: SaleOccurrence, locale: string): string {
  return formatLocalMoment(sale.occurredLocalDate, sale.occurredLocalTime, locale);
}

/** A sale's optional note; an absent one is stated, never left as an empty value. */
export function saleDescriptionItem(
  description: string | null | undefined,
  t: TFunction,
  label: string = t("common.description"),
): DescriptionItem {
  return {
    label,
    value: description ? (
      description
    ) : (
      <Text className="text-sm leading-5 text-muted-foreground">{t("common.noDescription")}</Text>
    ),
  };
}

/** When the sale happened, in its business-local wall-clock time, and its optional note. */
export function saleOccurrenceItems(
  sale: SaleOccurrence,
  locale: string,
  t: TFunction,
): DescriptionItem[] {
  return [
    { label: t("sales.fields.moment"), numeric: true, value: saleMoment(sale, locale) },
    saleDescriptionItem(sale.description, t),
  ];
}

/** Total, moment and note: the facts a person checks before and after committing a sale. */
export function saleFactItems(
  sale: SaleMoney & SaleOccurrence,
  locale: string,
  t: TFunction,
): DescriptionItem[] {
  return [
    { label: t("sales.fields.total"), numeric: true, value: saleAmount(sale, locale) },
    ...saleOccurrenceItems(sale, locale, t),
  ];
}
