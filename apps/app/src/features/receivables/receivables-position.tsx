import type { ReceivableAging, ReceivablesSummary } from "@pisto/contracts";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Stat } from "@/components/layout/stat-group";
import { Heading } from "@/components/ui/heading";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { isPositiveAmount, useRecordFormat } from "@/features/customers/format";
import { cn } from "@/lib/cn";

type AgingBucket = keyof ReceivableAging;

const AGING_BUCKETS: readonly AgingBucket[] = ["current", "days1To30", "days31To60", "over60"];

/** Chart marks only: a later bucket is a stronger warning, and red is the oldest debt. */
const bucketColors: Record<AgingBucket, string> = {
  current: "bg-chart-2",
  days1To30: "bg-chart-4",
  days31To60: "bg-chart-5",
  over60: "bg-destructive",
};

/** Each bucket's share of the open balance in hundredths of a percent, exact in BigInt. */
export function agingShares(aging: ReceivableAging): Record<AgingBucket, number> {
  const total = AGING_BUCKETS.reduce(
    (sum, bucket) => sum + BigInt(aging[bucket].outstandingMinorUnits),
    0n,
  );
  const shares = {} as Record<AgingBucket, number>;
  for (const bucket of AGING_BUCKETS) {
    shares[bucket] =
      total === 0n ? 0 : Number((BigInt(aging[bucket].outstandingMinorUnits) * 10_000n) / total);
  }
  return shares;
}

function AgingBar({ summary }: { summary: ReceivablesSummary }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const shares = agingShares(summary.aging);
  const visible = AGING_BUCKETS.filter((bucket) => shares[bucket] > 0);
  return (
    <View className="min-w-0 gap-3 px-4 py-3.5 sm:px-5">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <Heading level={2} size="section">
          {t("receivables.aging.title")}
        </Heading>
        <Text className="text-xs leading-4 text-muted-foreground">
          {t("receivables.aging.scope")}
        </Text>
      </View>
      <View aria-hidden className="h-2 flex-row gap-0.5 overflow-hidden rounded-xs bg-muted">
        {visible.map((bucket) => (
          <View
            className={cn("h-full", bucketColors[bucket])}
            key={bucket}
            style={{ width: `${shares[bucket] / 100}%` }}
          />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-3">
        {AGING_BUCKETS.map((bucket) => {
          const facts = summary.aging[bucket];
          return (
            <View className="min-w-[96px] flex-1 gap-0.5" key={bucket}>
              <View className="flex-row items-center gap-1.5">
                <View aria-hidden className={cn("size-2 rounded-xs", bucketColors[bucket])} />
                <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
                  {t(`receivables.aging.buckets.${bucket}`)}
                </Text>
              </View>
              <Text className="font-ui text-[13px] leading-5 tabular-nums">
                {format.money(
                  facts.outstandingMinorUnits,
                  summary.currency,
                  summary.currencyMinorUnitDigits,
                )}
              </Text>
              <Text className="text-xs leading-4 text-muted-foreground">
                {t("receivables.aging.count", { count: Number(facts.receivableCount) })}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** What customers owe today, how much is late and for how long; all from the server summary. */
export function ReceivablesPosition({ summary }: { summary: ReceivablesSummary }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const money = (minorUnits: string) =>
    format.money(minorUnits, summary.currency, summary.currencyMinorUnitDigits);
  return (
    <View className="gap-2">
      <View className="min-w-0 flex-row flex-wrap overflow-hidden rounded-xl border border-border bg-card">
        <View className="min-w-0 grow basis-[320px] flex-row flex-wrap gap-px border-border bg-border lg:max-w-[460px] lg:border-r">
          <Stat
            detail={t("receivables.summary.openCount", {
              count: Number(summary.openReceivableCount),
            })}
            label={t("receivables.summary.outstanding")}
            value={money(summary.outstandingMinorUnits)}
          />
          <Stat
            detail={t("receivables.summary.overdueCount", {
              count: Number(summary.overdueReceivableCount),
            })}
            label={t("receivables.summary.overdue")}
            tone={isPositiveAmount(summary.overdueMinorUnits) ? "destructive" : "default"}
            value={money(summary.overdueMinorUnits)}
          />
        </View>
        <View className="min-w-0 grow basis-[360px] border-t border-border lg:border-t-0">
          <AgingBar summary={summary} />
        </View>
      </View>
      <Text className="text-xs text-muted-foreground">
        {t("receivables.summary.position", { date: format.date(summary.businessLocalDate) })}
      </Text>
    </View>
  );
}

export function ReceivablesPositionSkeleton() {
  return (
    <View className="min-w-0 flex-row flex-wrap gap-6 rounded-xl border border-border bg-card px-5 py-4">
      {[0, 1, 2].map((index) => (
        <View className="min-w-[150px] flex-1 gap-2" key={index}>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-24" />
        </View>
      ))}
    </View>
  );
}
