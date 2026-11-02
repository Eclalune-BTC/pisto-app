import {
  type MoneyTrend,
  type MoneyTrendQuery,
  moneyTrendQuerySchema,
  moneyTrendSchema,
} from "@pisto/contracts";
import { sql } from "drizzle-orm";

import { authorizeBusinessAction, type ProductActor } from "./business-access.ts";
import type { Database } from "./client.ts";
import { parseInput } from "./errors.ts";
import { REPORT_TRANSACTION_CONFIG } from "./reports.ts";
import { cashMovement } from "./schema/cash.ts";
import { cashAccount } from "./schema/cash-account.ts";

export interface MoneyTrendRepository {
  getMoneyTrend(actor: ProductActor, query: MoneyTrendQuery): Promise<MoneyTrend>;
}

export function createMoneyTrendRepository(db: Database): MoneyTrendRepository {
  return {
    async getMoneyTrend(actor, rawQuery) {
      const query = parseInput(moneyTrendQuerySchema, rawQuery, "The money trend range is invalid");

      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["cash:read"], "none");
        const timeZone = access.timeZone;

        type PeriodRow = {
          end_utc_exclusive: Date | string;
          start_date: string;
          start_utc: Date | string;
          today: string;
        };
        // PostgreSQL clamps "6 months ago" to the last day of a shorter month.
        const [period] = await tx.execute<PeriodRow>(sql`
          with clock as (
            select (transaction_timestamp() at time zone ${timeZone})::date as today
          ),
          bounds as (
            select
              today,
              case ${query.range}
                when '7d' then today - 6
                when '30d' then today - 29
                else (today - interval '6 months')::date + 1
              end as start_date
            from clock
          )
          select
            to_char(today, 'YYYY-MM-DD') as today,
            to_char(start_date, 'YYYY-MM-DD') as start_date,
            (start_date::timestamp at time zone ${timeZone}) as start_utc,
            ((today + 1)::timestamp at time zone ${timeZone}) as end_utc_exclusive
          from bounds
        `);
        if (!period) throw new Error("Money trend period query returned no row");
        // postgres.js binds a JavaScript Date in raw SQL as text, so bounds travel as ISO strings.
        const startUtc = new Date(period.start_utc).toISOString();
        const endUtcExclusive = new Date(period.end_utc_exclusive).toISOString();

        type OpeningRow = { opening_minor_units: string };
        const [opening] = await tx.execute<OpeningRow>(sql`
          select coalesce(sum(${cashMovement.deltaMinorUnits}), 0::numeric)::text as opening_minor_units
          from ${cashMovement}
          join ${cashAccount}
            on ${cashAccount.businessId} = ${cashMovement.businessId}
            and ${cashAccount.id} = ${cashMovement.accountId}
          where ${cashMovement.businessId} = ${access.businessId}
            and ${cashAccount.status} = 'active'
            and ${cashMovement.occurredAt} < ${startUtc}::timestamptz
        `);
        if (!opening) throw new Error("Money trend opening query returned no row");

        type PointRow = { closing_minor_units: string; local_date: string };
        const points = await tx.execute<PointRow>(sql`
          with daily as (
            select
              (${cashMovement.occurredAt} at time zone ${timeZone})::date as local_date,
              sum(${cashMovement.deltaMinorUnits}) as delta
            from ${cashMovement}
            join ${cashAccount}
              on ${cashAccount.businessId} = ${cashMovement.businessId}
              and ${cashAccount.id} = ${cashMovement.accountId}
            where ${cashMovement.businessId} = ${access.businessId}
              and ${cashAccount.status} = 'active'
              and ${cashMovement.occurredAt} >= ${startUtc}::timestamptz
              and ${cashMovement.occurredAt} < ${endUtcExclusive}::timestamptz
            group by 1
          ),
          days as (
            select generate_series(
              ${period.start_date}::date,
              ${period.today}::date,
              interval '1 day'
            )::date as local_date
          )
          select
            to_char(days.local_date, 'YYYY-MM-DD') as local_date,
            (
              ${opening.opening_minor_units}::numeric
              + coalesce(sum(daily.delta) over (order by days.local_date), 0::numeric)
            )::text as closing_minor_units
          from days
          left join daily on daily.local_date = days.local_date
          order by days.local_date
        `);

        type KindRow = { account_count: string; balance_minor_units: string; kind: string };
        const kinds = await tx.execute<KindRow>(sql`
          select
            ${cashAccount.kind} as kind,
            count(distinct ${cashAccount.id})::text as account_count,
            coalesce(sum(${cashMovement.deltaMinorUnits}), 0::numeric)::text as balance_minor_units
          from ${cashAccount}
          left join ${cashMovement}
            on ${cashMovement.businessId} = ${cashAccount.businessId}
            and ${cashMovement.accountId} = ${cashAccount.id}
            and ${cashMovement.occurredAt} < ${endUtcExclusive}::timestamptz
          where ${cashAccount.businessId} = ${access.businessId}
            and ${cashAccount.status} = 'active'
          group by ${cashAccount.kind}
          order by array_position(
            array['cash', 'bank', 'mobile_money', 'other']::text[],
            ${cashAccount.kind}
          )
        `);

        const closing = points.at(-1)?.closing_minor_units;
        if (closing === undefined) throw new Error("Money trend returned no daily point");
        const kindTotal = kinds.reduce((total, row) => total + BigInt(row.balance_minor_units), 0n);
        // Two readings of one snapshot must agree; a mismatch means the day bucketing is wrong.
        if (kindTotal !== BigInt(closing)) {
          throw new Error("Money trend closing balance does not match the account balances");
        }

        return moneyTrendSchema.parse({
          range: query.range,
          startLocalDate: period.start_date,
          endLocalDate: period.today,
          timeZone,
          currency: access.currency,
          currencyMinorUnitDigits: access.currencyMinorUnitDigits,
          activeAccountCount: kinds
            .reduce((total, row) => total + BigInt(row.account_count), 0n)
            .toString(),
          openingMinorUnits: opening.opening_minor_units,
          closingMinorUnits: closing,
          changeMinorUnits: (BigInt(closing) - BigInt(opening.opening_minor_units)).toString(),
          points: points.map((row) => ({
            localDate: row.local_date,
            closingMinorUnits: row.closing_minor_units,
          })),
          kinds: kinds.map((row) => ({
            kind: row.kind,
            accountCount: row.account_count,
            balanceMinorUnits: row.balance_minor_units,
          })),
          queriedAt: access.queriedAt.toISOString(),
        });
      }, REPORT_TRANSACTION_CONFIG);
    },
  };
}
