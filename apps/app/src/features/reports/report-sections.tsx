import type {
  CashAccountKind,
  CashAccountStatus,
  ExpenseCategory,
  OperatingReport,
} from "@pisto/contracts";
import { Text, View } from "react-native";

import { formatBusinessLocalDate } from "@/features/receivables/presentation";
import { formatLocalizedDateTime } from "@/i18n/format";
import { formatMinorUnits } from "@/lib/money";

export type ReportSectionsCopy = {
  accountKinds: Record<CashAccountKind, string>;
  accountStatuses: Record<CashAccountStatus, string>;
  categories: Record<ExpenseCategory, string>;
  cash: {
    description: string;
    empty: string;
    inflow: string;
    net: string;
    outflow: string;
    title: string;
  };
  expenses: {
    amount: string;
    description: string;
    empty: string;
    records: string;
    title: string;
  };
  metadata: {
    currency: string;
    period: string;
    queriedAt: string;
    through: string;
    timeZone: string;
  };
  period: {
    accountingBoundary: string;
    cashInflow: string;
    cashNet: string;
    cashOutflow: string;
    description: string;
    expenseCount: string;
    expensesTotal: string;
    salesCount: string;
    salesGross: string;
    title: string;
    zeroDescription: string;
    zeroTitle: string;
  };
  position: {
    description: (localDate: string) => string;
    lowStockProducts: string;
    openReceivables: string;
    outstanding: string;
    overdue: string;
    overdueReceivables: string;
    title: string;
    trackedProducts: string;
  };
};

type SectionProps = {
  copy: ReportSectionsCopy;
  locale: string;
  report: OperatingReport;
};

function countText(value: string, locale: string): string {
  // A canonical integer string formats exactly; a number rounds above 2^53. The
  // DOM lib types that overload as a template-literal type no plain string can satisfy.
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value as Intl.StringNumericLiteral,
  );
}

function MoneyValue({
  className = "text-2xl font-black text-ink dark:text-white",
  locale,
  report,
  value,
}: {
  className?: string;
  locale: string;
  report: OperatingReport;
  value: string;
}) {
  return (
    <Text className={className}>
      {formatMinorUnits(value, report.currency, report.currencyMinorUnitDigits, locale)}
    </Text>
  );
}

function CountValue({ locale, value }: { locale: string; value: string }) {
  return (
    <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
      {countText(value, locale)}
    </Text>
  );
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <View className="max-w-[720px] gap-1">
      <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
        {title}
      </Text>
      <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">{description}</Text>
    </View>
  );
}

function Metadata({ copy, locale, report }: SectionProps) {
  const items = [
    {
      label: copy.metadata.period,
      value: `${formatBusinessLocalDate(report.period.startLocalDate, locale)} ${copy.metadata.through} ${formatBusinessLocalDate(report.period.endLocalDateInclusive, locale)}`,
    },
    { label: copy.metadata.timeZone, value: report.period.timeZone },
    { label: copy.metadata.currency, value: report.currency },
    {
      label: copy.metadata.queriedAt,
      value: formatLocalizedDateTime(report.queriedAt, locale, report.period.timeZone),
    },
  ];
  return (
    <View className="flex-row flex-wrap gap-x-8 gap-y-4">
      {items.map((item) => (
        <View className="min-w-[180px] gap-1" key={item.label}>
          <Text className="text-xs font-bold uppercase tracking-[0.5px] text-ink-muted dark:text-[#91A198]">
            {item.label}
          </Text>
          <Text className="font-semibold text-ink dark:text-white">{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function PeriodFacts({ copy, locale, report }: SectionProps) {
  // Business inflow and outflow exclude internal transfers, which still move the
  // accounts listed below.
  const noPeriodFlows =
    report.sales.saleCount === "0" &&
    report.expenses.expenseCount === "0" &&
    report.cash.accounts.every(
      ({ inflowMinorUnits, outflowMinorUnits }) =>
        inflowMinorUnits === "0" && outflowMinorUnits === "0",
    );
  return (
    <View className="gap-5">
      <SectionHeading description={copy.period.description} title={copy.period.title} />
      {noPeriodFlows ? (
        <View className="gap-1 border-l-4 border-positive bg-[#EFF8F1] p-4 dark:bg-[#183127]">
          <Text className="font-bold text-ink dark:text-white">{copy.period.zeroTitle}</Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {copy.period.zeroDescription}
          </Text>
        </View>
      ) : null}
      <View className="border-y border-line dark:border-[#304239]">
        <View className="gap-4 border-b border-line py-5 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between">
          <View className="gap-1">
            <Text className="font-bold text-ink dark:text-white">{copy.period.salesGross}</Text>
            <View className="flex-row gap-2">
              <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                {copy.period.salesCount}
              </Text>
              <CountValue locale={locale} value={report.sales.saleCount} />
            </View>
          </View>
          <MoneyValue locale={locale} report={report} value={report.sales.grossMinorUnits} />
        </View>
        <View className="gap-4 border-b border-line py-5 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between">
          <View className="gap-1">
            <Text className="font-bold text-ink dark:text-white">{copy.period.expensesTotal}</Text>
            <View className="flex-row gap-2">
              <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                {copy.period.expenseCount}
              </Text>
              <CountValue locale={locale} value={report.expenses.expenseCount} />
            </View>
          </View>
          <MoneyValue locale={locale} report={report} value={report.expenses.totalMinorUnits} />
        </View>
        <View className="gap-5 py-5 lg:flex-row lg:items-end lg:justify-between">
          <View className="gap-1">
            <Text className="font-bold text-ink dark:text-white">{copy.period.cashNet}</Text>
            <MoneyValue locale={locale} report={report} value={report.cash.netMovementMinorUnits} />
          </View>
          <View className="gap-4 sm:flex-row sm:gap-10">
            <View className="gap-1 sm:items-end">
              <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                {copy.period.cashInflow}
              </Text>
              <MoneyValue
                className="text-lg font-bold text-positive dark:text-[#8DDEAF]"
                locale={locale}
                report={report}
                value={report.cash.inflowMinorUnits}
              />
            </View>
            <View className="gap-1 sm:items-end">
              <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                {copy.period.cashOutflow}
              </Text>
              <MoneyValue
                className="text-lg font-bold text-danger dark:text-[#FFBABA]"
                locale={locale}
                report={report}
                value={report.cash.outflowMinorUnits}
              />
            </View>
          </View>
        </View>
      </View>
      <Text className="max-w-[760px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
        {copy.period.accountingBoundary}
      </Text>
    </View>
  );
}

function ExpenseBreakdown({ copy, locale, report }: SectionProps) {
  return (
    <View className="gap-5">
      <SectionHeading description={copy.expenses.description} title={copy.expenses.title} />
      {report.expenses.categories.length === 0 ? (
        <Text className="border-y border-line py-6 text-sm text-ink-muted dark:border-[#304239] dark:text-[#AAB8B0]">
          {copy.expenses.empty}
        </Text>
      ) : (
        <View className="border-t border-line dark:border-[#304239]">
          {report.expenses.categories.map((category) => (
            <View
              className="gap-2 border-b border-line py-4 dark:border-[#304239] sm:flex-row sm:items-center"
              key={category.category}
            >
              <Text className="min-w-0 flex-1 font-semibold text-ink dark:text-white">
                {copy.categories[category.category]}
              </Text>
              <View className="flex-row items-center justify-between gap-5 sm:w-[280px]">
                <View className="gap-1">
                  <Text className="text-xs text-ink-muted dark:text-[#91A198]">
                    {copy.expenses.records}
                  </Text>
                  <CountValue locale={locale} value={category.expenseCount} />
                </View>
                <View className="items-end gap-1">
                  <Text className="text-xs text-ink-muted dark:text-[#91A198]">
                    {copy.expenses.amount}
                  </Text>
                  <MoneyValue
                    className="font-bold text-ink dark:text-white"
                    locale={locale}
                    report={report}
                    value={category.totalMinorUnits}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function CashBreakdown({ copy, locale, report }: SectionProps) {
  return (
    <View className="gap-5">
      <SectionHeading description={copy.cash.description} title={copy.cash.title} />
      {report.cash.accounts.length === 0 ? (
        <Text className="border-y border-line py-6 text-sm text-ink-muted dark:border-[#304239] dark:text-[#AAB8B0]">
          {copy.cash.empty}
        </Text>
      ) : (
        <View className="border-t border-line dark:border-[#304239]">
          {report.cash.accounts.map((account) => (
            <View
              className="gap-4 border-b border-line py-5 dark:border-[#304239] lg:flex-row lg:items-center"
              key={account.accountId}
            >
              <View className="min-w-0 flex-1 gap-1">
                <Text className="font-bold text-ink dark:text-white">{account.accountName}</Text>
                <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                  {copy.accountKinds[account.accountKind]} ·{" "}
                  {copy.accountStatuses[account.accountStatus]}
                </Text>
              </View>
              <View className="gap-4 sm:flex-row sm:gap-9 lg:min-w-[510px] lg:justify-end">
                <View className="min-w-[130px] gap-1 lg:items-end">
                  <Text className="text-xs text-ink-muted dark:text-[#91A198]">
                    {copy.cash.inflow}
                  </Text>
                  <MoneyValue
                    className="font-bold text-positive dark:text-[#8DDEAF]"
                    locale={locale}
                    report={report}
                    value={account.inflowMinorUnits}
                  />
                </View>
                <View className="min-w-[130px] gap-1 lg:items-end">
                  <Text className="text-xs text-ink-muted dark:text-[#91A198]">
                    {copy.cash.outflow}
                  </Text>
                  <MoneyValue
                    className="font-bold text-danger dark:text-[#FFBABA]"
                    locale={locale}
                    report={report}
                    value={account.outflowMinorUnits}
                  />
                </View>
                <View className="min-w-[130px] gap-1 lg:items-end">
                  <Text className="text-xs text-ink-muted dark:text-[#91A198]">
                    {copy.cash.net}
                  </Text>
                  <MoneyValue
                    className="font-black text-ink dark:text-white"
                    locale={locale}
                    report={report}
                    value={account.netMovementMinorUnits}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function PositionFacts({ copy, locale, report }: SectionProps) {
  const countFacts = [
    { label: copy.position.trackedProducts, value: report.inventory.trackedProductCount },
    { label: copy.position.lowStockProducts, value: report.inventory.lowStockProductCount },
    { label: copy.position.openReceivables, value: report.receivables.openReceivableCount },
    { label: copy.position.overdueReceivables, value: report.receivables.overdueReceivableCount },
  ];
  return (
    <View className="gap-5">
      <SectionHeading
        description={copy.position.description(
          formatBusinessLocalDate(report.positionAsOfLocalDate, locale),
        )}
        title={copy.position.title}
      />
      <View className="border-y border-line dark:border-[#304239]">
        <View className="gap-5 border-b border-line py-5 dark:border-[#304239] sm:flex-row sm:justify-between">
          <View className="gap-1">
            <Text className="font-bold text-ink dark:text-white">{copy.position.outstanding}</Text>
            <MoneyValue
              locale={locale}
              report={report}
              value={report.receivables.outstandingMinorUnits}
            />
          </View>
          <View className="gap-1 sm:items-end">
            <Text className="font-bold text-ink dark:text-white">{copy.position.overdue}</Text>
            <MoneyValue
              locale={locale}
              report={report}
              value={report.receivables.overdueMinorUnits}
            />
          </View>
        </View>
        <View className="flex-row flex-wrap py-2">
          {countFacts.map((fact) => (
            <View className="w-full gap-1 py-4 sm:w-1/2 lg:w-1/4" key={fact.label}>
              <Text className="text-2xl font-black text-ink dark:text-white">
                {countText(fact.value, locale)}
              </Text>
              <Text className="max-w-[220px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                {fact.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function ReportSections(props: SectionProps) {
  return (
    <View className="gap-10">
      <Metadata {...props} />
      <PeriodFacts {...props} />
      <ExpenseBreakdown {...props} />
      <CashBreakdown {...props} />
      <PositionFacts {...props} />
    </View>
  );
}
