import { calendarLocalDateSchema, localTimeSchema } from "@pisto/contracts";

/**
 * A business-local wall-clock moment. It is rendered in UTC on purpose: the values are already
 * local to the sale's time zone, so no device or business offset may shift them.
 */
export function formatSaleMoment(localDate: string, localTime: string, locale: string): string {
  const date = calendarLocalDateSchema.parse(localDate);
  const time = localTimeSchema.parse(localTime);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T${time}:00.000Z`));
}

/** An exact recorded instant, shown in the sale's own time zone. */
export function formatSaleInstant(instant: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(instant));
}

export function formatSaleCount(value: string, locale: string): string {
  // A canonical integer string formats exactly; a number would round above 2^53.
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value as Intl.StringNumericLiteral,
  );
}
