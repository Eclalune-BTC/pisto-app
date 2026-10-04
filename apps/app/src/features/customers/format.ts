import type { Customer } from "@pisto/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatLocalDate, formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";

export type RecordFormat = {
  date: (localDate: string) => string;
  instant: (timestamp: string, timeZone: string) => string;
  locale: string;
  money: (minorUnits: string, currency: string, digits: number) => string;
};

export function useRecordFormat(): RecordFormat {
  const { i18n } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  return useMemo(
    () => ({
      date: (localDate: string) => formatLocalDate(localDate, locale),
      instant: (timestamp: string, timeZone: string) =>
        formatLocalizedDateTime(timestamp, locale, timeZone),
      locale,
      money: (minorUnits: string, currency: string, digits: number) =>
        formatMinorUnits(minorUnits, currency, digits, locale),
    }),
    [locale],
  );
}

/** Server money is a canonical non-negative integer string; only a value above zero earns a tone. */
export function isPositiveAmount(minorUnits: string): boolean {
  return BigInt(minorUnits) > 0n;
}

export function customerContact(customer: Pick<Customer, "email" | "phone">): string | undefined {
  const parts = [customer.phone, customer.email].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
