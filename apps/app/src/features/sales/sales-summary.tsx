import type { PreviousMonthSummary } from "@pisto/contracts";
import { Lock, TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Section } from "@/components/layout/section";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { OfflineState } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { formatLocalizedDateTime, formatMonthYear } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
import { formatSaleCount } from "./format";
import type { ReadState } from "./state";

const STAT_COUNT = 3;

type SalesSummaryProps = {
  onRetry: () => void;
  read: ReadState;
  summary: PreviousMonthSummary | undefined;
};

/**
 * The previous complete calendar month as the server calculated it. It is a separate read from the
 * history below, so its labels name the month instead of describing the loaded table.
 */
export function SalesSummary({ onRetry, read, summary }: SalesSummaryProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  if (read === "ready" && summary) {
    const money = (minorUnits: string) =>
      formatMinorUnits(minorUnits, summary.currency, summary.currencyMinorUnitDigits, locale);
    return (
      <Section
        description={t("sales.summary.description", {
          date: formatLocalizedDateTime(summary.queriedAt, locale, summary.timeZone),
          timeZone: summary.timeZone,
        })}
        title={t("sales.summary.title", {
          month: formatMonthYear(summary.periodStartLocal, locale),
        })}
      >
        <StatGroup>
          <Stat label={t("sales.summary.gross")} value={money(summary.grossMinorUnits)} />
          <Stat
            label={t("sales.summary.count")}
            value={formatSaleCount(summary.saleCount, locale)}
          />
          <Stat
            detail={summary.averageMinorUnits === null ? t("sales.summary.noAverage") : undefined}
            label={t("sales.summary.average")}
            value={summary.averageMinorUnits === null ? "—" : money(summary.averageMinorUnits)}
          />
        </StatGroup>
      </Section>
    );
  }
  if (read === "denied") {
    return (
      <StatePanel
        description={t("sales.summary.deniedDescription")}
        icon={Lock}
        level={2}
        title={t("sales.summary.deniedTitle")}
      />
    );
  }
  if (read === "offline") return <OfflineState level={2} />;
  if (read === "error") {
    return (
      <StatePanel
        action={<Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />}
        description={t("sales.summary.unavailableDescription")}
        icon={TriangleAlert}
        level={2}
        title={t("sales.summary.unavailableTitle")}
        tone="destructive"
      />
    );
  }
  return (
    <View accessibilityLabel={t("sales.summary.loading")} aria-busy className="gap-3">
      <Text className="sr-only">{t("sales.summary.loading")}</Text>
      <View className="gap-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </View>
      <View className="flex-row flex-wrap gap-px overflow-hidden rounded-lg border border-border bg-border">
        {Array.from({ length: STAT_COUNT }, (_, index) => (
          <View
            className="min-w-[150px] flex-1 basis-[180px] gap-2 bg-card px-4 py-3"
            // biome-ignore lint/suspicious/noArrayIndexKey: Placeholder cells have no identity.
            key={index}
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </View>
        ))}
      </View>
    </View>
  );
}
