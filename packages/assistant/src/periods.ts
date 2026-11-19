import type { BusinessPeriod } from "@pisto/contracts";

const dayMs = 86_400_000;

function fromEpochDay(epochDay: number): string {
  return new Date(epochDay * dayMs).toISOString().slice(0, 10);
}

/** The period a question about a period uses when it names none; the answer states it. */
export const defaultAnswerPeriod: BusinessPeriod = "this_month";

/**
 * The inclusive business-local dates of a period, relative to the business's `today`. A period in
 * progress ends today, and a week starts on Monday.
 */
export function periodRange(
  period: BusinessPeriod,
  today: string,
): { startLocalDate: string; endLocalDate: string } {
  const date = new Date(`${today}T00:00:00.000Z`);
  const day = date.getTime() / dayMs;
  const monday = day - ((date.getUTCDay() + 6) % 7);
  const monthStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / dayMs;
  const [start, end] = (
    {
      today: [day, day],
      yesterday: [day - 1, day - 1],
      this_week: [monday, day],
      last_week: [monday - 7, monday - 1],
      this_month: [monthStart, day],
      last_month: [
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1) / dayMs,
        monthStart - 1,
      ],
      last_7_days: [day - 6, day],
      last_30_days: [day - 29, day],
    } satisfies Record<BusinessPeriod, [number, number]>
  )[period];
  return { startLocalDate: fromEpochDay(start), endLocalDate: fromEpochDay(end) };
}
