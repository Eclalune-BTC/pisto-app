import type { Sale } from "@pisto/contracts";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { DescriptionItem } from "@/components/layout/description-list";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { formatMinorUnits } from "@/lib/money";
import { formatSaleMoment } from "./format";

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
  return (
    <Badge variant={status === "voided" ? "outline" : "secondary"}>
      <Text>{status === "voided" ? t("sales.voided") : t("sales.posted")}</Text>
    </Badge>
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

/** When the sale happened, in its business-local wall-clock time, and its optional note. */
export function saleOccurrenceItems(
  sale: SaleOccurrence,
  locale: string,
  t: TFunction,
): DescriptionItem[] {
  return [
    {
      label: t("sales.fields.moment"),
      numeric: true,
      value: formatSaleMoment(sale.occurredLocalDate, sale.occurredLocalTime, locale),
    },
    {
      label: t("common.description"),
      value: sale.description ? (
        sale.description
      ) : (
        <Text className="text-sm leading-5 text-muted-foreground">{t("common.noDescription")}</Text>
      ),
    },
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
