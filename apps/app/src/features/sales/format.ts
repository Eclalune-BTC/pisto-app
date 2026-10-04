import { calendarLocalDateSchema, localTimeSchema } from "@pisto/contracts";

// Sales are entered with a 24-hour HH:MM time, so every sales date shows the same clock.
const momentFormat = {
  dateStyle: "medium",
  timeStyle: "short",
  hourCycle: "h23",
} as const satisfies Intl.DateTimeFormatOptions;

/**
 * A business-local wall-clock moment. It is rendered in UTC on purpose: the values are already
 * local to the sale's time zone, so no device or business offset may shift them.
 */
export function formatSaleMoment(localDate: string, localTime: string, locale: string): string {
  const date = calendarLocalDateSchema.parse(localDate);
  const time = localTimeSchema.parse(localTime);
  return new Intl.DateTimeFormat(locale, { ...momentFormat, timeZone: "UTC" }).format(
    new Date(`${date}T${time}:00.000Z`),
  );
}

/** An exact recorded instant, shown in the given business time zone. */
export function formatSaleInstant(instant: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { ...momentFormat, timeZone }).format(new Date(instant));
}

export function formatSaleCount(value: string, locale: string): string {
  // A canonical integer string formats exactly; a number would round above 2^53.
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value as Intl.StringNumericLiteral,
  );
}
