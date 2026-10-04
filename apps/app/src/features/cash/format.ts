import { calendarLocalDateSchema, localTimeSchema } from "@pisto/contracts";
import { formatLocalizedDateTime } from "@/i18n/format";

/**
 * A reviewed business-local date and minute, styled like the recorded occurrence in lists. Both
 * parts are read as UTC so that the device time zone cannot shift the minute the user typed.
 */
export function formatLocalOccurrence(localDate: string, localTime: string, locale: string) {
  const date = calendarLocalDateSchema.parse(localDate);
  const time = localTimeSchema.parse(localTime);
  return formatLocalizedDateTime(`${date}T${time}:00.000Z`, locale, "UTC");
}
