import type {
  CashAccountKind,
  CashAccountStatus,
  ExpenseCategory,
  OperatingReport,
} from "@pisto/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
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
  className = "font-heading text-2xl text-foreground",
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
  return <Text className="text-sm font-ui text-muted-foreground">{countText(value, locale)}</Text>;
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <View className="max-w-[720px] gap-1">
      <Heading level={2} size="section">
        {title}
      </Heading>
      <Text className="text-sm leading-5 text-muted-foreground">{description}</Text>
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
          <Text className="text-xs font-ui uppercase tracking-[0.5px] text-muted-foreground ">
            {item.label}
          </Text>
          <Text className="font-ui text-foreground">{item.value}</Text>
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
        <View className="gap-1 border-l-4 border-positive bg-positive-surface p-4 ">
          <Text className="font-ui text-foreground">{copy.period.zeroTitle}</Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            {copy.period.zeroDescription}
          </Text>
        </View>
      ) : null}
      <View className="border-y border-border">
        <View className="gap-4 border-b border-border py-5  sm:flex-row sm:items-center sm:justify-between">
          <View className="gap-1">
            <Text className="font-ui text-foreground">{copy.period.salesGross}</Text>
            <View className="flex-row gap-2">
              <Text className="text-sm text-muted-foreground">{copy.period.salesCount}</Text>
              <CountValue locale={locale} value={report.sales.saleCount} />
            </View>
          </View>
          <MoneyValue locale={locale} report={report} value={report.sales.grossMinorUnits} />
        </View>
        <View className="gap-4 border-b border-border py-5  sm:flex-row sm:items-center sm:justify-between">
          <View className="gap-1">
            <Text className="font-ui text-foreground">{copy.period.expensesTotal}</Text>
            <View className="flex-row gap-2">
              <Text className="text-sm text-muted-foreground">{copy.period.expenseCount}</Text>
              <CountValue locale={locale} value={report.expenses.expenseCount} />
            </View>
          </View>
          <MoneyValue locale={locale} report={report} value={report.expenses.totalMinorUnits} />
        </View>
        <View className="gap-5 py-5 lg:flex-row lg:items-end lg:justify-between">
          <View className="gap-1">
            <Text className="font-ui text-foreground">{copy.period.cashNet}</Text>
            <MoneyValue locale={locale} report={report} value={report.cash.netMovementMinorUnits} />
          </View>
          <View className="gap-4 sm:flex-row sm:gap-10">
            <View className="gap-1 sm:items-end">
              <Text className="text-sm text-muted-foreground">{copy.period.cashInflow}</Text>
              <MoneyValue
                className="text-lg font-ui text-positive-foreground "
                locale={locale}
                report={report}
                value={report.cash.inflowMinorUnits}
              />
            </View>
            <View className="gap-1 sm:items-end">
              <Text className="text-sm text-muted-foreground">{copy.period.cashOutflow}</Text>
              <MoneyValue
                className="text-lg font-ui text-destructive "
                locale={locale}
                report={report}
                value={report.cash.outflowMinorUnits}
              />
            </View>
          </View>
        </View>
      </View>
      <Text className="max-w-[760px] text-sm leading-5 text-muted-foreground">
        {copy.period.accountingBoundary}
      </Text>
    </View>
  );
}

function ExpenseBreakdown({ copy, locale, report }: SectionProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<OperatingReport["expenses"]["categories"][number]>[]>(
    () => [
      {
        id: "category",
        header: t("dataTable.columns.category"),
        meta: { primary: true },
        cell: ({ row }) => (
          <Text className="font-ui text-sm text-foreground">
            {copy.categories[row.original.category]}
          </Text>
        ),
      },
      {
        id: "records",
        header: copy.expenses.records,
        meta: { align: "end" },
        cell: ({ row }) => <CountValue locale={locale} value={row.original.expenseCount} />,
      },
      {
        id: "amount",
        header: copy.expenses.amount,
        meta: { align: "end" },
        cell: ({ row }) => (
          <MoneyValue
            className="font-ui text-sm text-foreground"
            locale={locale}
            report={report}
            value={row.original.totalMinorUnits}
          />
        ),
      },
    ],
    [copy, locale, report, t],
  );
  return (
    <View className="gap-4">
      <SectionHeading description={copy.expenses.description} title={copy.expenses.title} />
      <DataTable
        caption={copy.expenses.title}
        columns={columns}
        data={report.expenses.categories}
        empty={
          <Text className="font-sans py-3 text-sm text-muted-foreground">
            {copy.expenses.empty}
          </Text>
        }
        getRowId={(category) => category.category}
      />
    </View>
  );
}

function CashBreakdown({ copy, locale, report }: SectionProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<OperatingReport["cash"]["accounts"][number]>[]>(
    () => [
      {
        id: "account",
        header: t("dataTable.columns.account"),
        meta: { primary: true },
        cell: ({ row }) => (
          <View className="gap-1">
            <Text className="font-ui text-sm text-foreground">{row.original.accountName}</Text>
            <Text className="font-sans text-xs text-muted-foreground">
              {copy.accountKinds[row.original.accountKind]} ·{" "}
              {copy.accountStatuses[row.original.accountStatus]}
            </Text>
          </View>
        ),
      },
      {
        id: "inflow",
        header: copy.cash.inflow,
        meta: { align: "end" },
        cell: ({ row }) => (
          <MoneyValue
            className="font-ui text-sm text-foreground"
            locale={locale}
            report={report}
            value={row.original.inflowMinorUnits}
          />
        ),
      },
      {
        id: "outflow",
        header: copy.cash.outflow,
        meta: { align: "end" },
        cell: ({ row }) => (
          <MoneyValue
            className="font-ui text-sm text-foreground"
            locale={locale}
            report={report}
            value={row.original.outflowMinorUnits}
          />
        ),
      },
      {
        id: "net",
        header: copy.cash.net,
        meta: { align: "end" },
        cell: ({ row }) => (
          <MoneyValue
            className="font-ui text-sm text-foreground"
            locale={locale}
            report={report}
            value={row.original.netMovementMinorUnits}
          />
        ),
      },
    ],
    [copy, locale, report, t],
  );
  return (
    <View className="gap-4">
      <SectionHeading description={copy.cash.description} title={copy.cash.title} />
      <DataTable
        caption={copy.cash.title}
        columns={columns}
        data={report.cash.accounts}
        empty={
          <Text className="font-sans py-3 text-sm text-muted-foreground">{copy.cash.empty}</Text>
        }
        getRowId={(account) => account.accountId}
      />
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
      <View className="border-y border-border">
        <View className="gap-5 border-b border-border py-5  sm:flex-row sm:justify-between">
          <View className="gap-1">
            <Text className="font-ui text-foreground">{copy.position.outstanding}</Text>
            <MoneyValue
              locale={locale}
              report={report}
              value={report.receivables.outstandingMinorUnits}
            />
          </View>
          <View className="gap-1 sm:items-end">
            <Text className="font-ui text-foreground">{copy.position.overdue}</Text>
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
              <Text className="text-2xl font-heading text-foreground">
                {countText(fact.value, locale)}
              </Text>
              <Text className="max-w-[220px] text-sm leading-5 text-muted-foreground">
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
