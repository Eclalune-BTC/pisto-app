import { calendarLocalDateSchema, localTimeSchema } from "@pisto/contracts";

/**
 * A reviewed business-local date and minute. Both parts are read as UTC so that the device time
 * zone cannot shift the minute the user typed.
 */
export function formatLocalOccurrence(localDate: string, localTime: string, locale: string) {
  const date = calendarLocalDateSchema.parse(localDate);
  const time = localTimeSchema.parse(localTime);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T${time}:00.000Z`));
}
