import type { BusinessAnswer } from "@pisto/contracts";
import type { TFunction } from "i18next";

import { quantityText } from "@/features/catalog/format";
import { formatLocalDate, formatLocalDateFull, formatLocalDayMonth } from "@/i18n/format";
import { formatMinorUnits } from "@/lib/money";

export type AnswerRow = {
  key: string;
  label: string;
  value: string;
  note?: string;
  /** Marks an amount or a date already past due. */
  overdue?: boolean;
};

export type AnswerView = {
  lead: string;
  details: string[];
  rows: AnswerRow[];
  /** The dates the figures cover, or the day a position was read. */
  scope: string;
  /** What the figures do not say. */
  note?: string;
};

type PeriodAnswer = Extract<BusinessAnswer, { period: unknown }>;

function scopeOf(t: TFunction, locale: string, answer: BusinessAnswer): string {
  if (!("period" in answer)) {
    return t("assistant.answers.asOf", { date: formatLocalDate(answer.businessLocalDate, locale) });
  }
  const { startLocalDate, endLocalDate } = answer.period;
  if (startLocalDate === endLocalDate) {
    const day = formatLocalDateFull(startLocalDate, locale);
    return day.charAt(0).toLocaleUpperCase(locale) + day.slice(1);
  }
  return t("assistant.answers.range", {
    start: formatLocalDate(startLocalDate, locale),
    end: formatLocalDate(endLocalDate, locale),
  });
}

/**
 * Words one answer. Every amount and quantity is the server's exact value, formatted; the only
 * arithmetic here counts the sales or customers a list leaves out.
 */
export function answerView(t: TFunction, locale: string, answer: BusinessAnswer): AnswerView {
  const scope = scopeOf(t, locale, answer);
  const view = (lead: string, rest: Partial<Omit<AnswerView, "lead" | "scope">> = {}) => ({
    lead,
    details: rest.details ?? [],
    rows: rest.rows ?? [],
    scope,
    ...(rest.note && { note: rest.note }),
  });
  const starting = (period: PeriodAnswer["period"]) => t(`assistant.answers.period.${period.key}`);
  const during = (period: PeriodAnswer["period"]) => t(`assistant.answers.periodIn.${period.key}`);

  if (answer.topic === "low_stock") {
    if (answer.products.length === 0) return view(t("assistant.answers.lowStock.empty"));
    // The read lists a bounded number of products, so with more of them the total is not known.
    const lead = answer.more
      ? t("assistant.answers.lowStock.leadMore", { count: answer.products.length })
      : t("assistant.answers.lowStock.lead", { count: answer.products.length });
    return view(lead, {
      rows: answer.products.map((product) => {
        const quantity = (minorUnits: string) =>
          quantityText(t, locale, {
            minorUnits,
            precision: product.quantityPrecision,
            unitKind: product.unitKind,
          });
        return {
          key: product.productId,
          label: product.name,
          value:
            product.onHandMinorUnits === "0"
              ? t("assistant.answers.lowStock.out")
              : t("assistant.answers.lowStock.left", {
                  quantity: quantity(product.onHandMinorUnits),
                }),
          note: t("assistant.answers.lowStock.minimum", {
            quantity: quantity(product.lowStockThresholdMinorUnits),
          }),
        };
      }),
      ...(answer.more && { note: t("assistant.answers.lowStock.more") }),
    });
  }

  const money = (minorUnits: string) =>
    formatMinorUnits(minorUnits, answer.currency, answer.currencyMinorUnitDigits, locale);

  switch (answer.topic) {
    case "sales": {
      const count = Number(answer.saleCount);
      if (count === 0) {
        return view(t("assistant.answers.sales.empty", { period: during(answer.period) }));
      }
      return view(
        t("assistant.answers.sales.lead", {
          count,
          period: starting(answer.period),
          total: money(answer.grossMinorUnits),
        }),
        {
          details:
            count > 1 && answer.averageMinorUnits !== null
              ? [
                  t("assistant.answers.sales.average", {
                    average: money(answer.averageMinorUnits),
                  }),
                ]
              : [],
          note: t("assistant.answers.sales.note"),
        },
      );
    }
    case "top_products": {
      const [first] = answer.products;
      if (!first) {
        return view(
          answer.saleCount === "0"
            ? t("assistant.answers.sales.empty", { period: during(answer.period) })
            : t("assistant.answers.topProducts.unitemized"),
        );
      }
      const withoutLines = Number(answer.saleCount) - Number(answer.itemizedSaleCount);
      return view(
        t("assistant.answers.topProducts.lead", {
          period: starting(answer.period),
          name: first.name,
        }),
        {
          rows: answer.products.map((product) => ({
            key: product.productId,
            label: product.name,
            value: money(product.grossMinorUnits),
            ...(product.quantityMinorUnits !== null && {
              note: quantityText(t, locale, {
                minorUnits: product.quantityMinorUnits,
                precision: product.quantityPrecision,
                unitKind: product.unitKind,
              }),
            }),
          })),
          ...(withoutLines > 0 && {
            note: t("assistant.answers.topProducts.partial", {
              count: withoutLines,
              total: Number(answer.saleCount),
            }),
          }),
        },
      );
    }
    case "expenses": {
      const count = Number(answer.expenseCount);
      if (count === 0) {
        return view(t("assistant.answers.expenses.empty", { period: during(answer.period) }));
      }
      return view(
        t("assistant.answers.expenses.lead", {
          count,
          period: starting(answer.period),
          total: money(answer.totalMinorUnits),
        }),
        {
          rows: [...answer.categories]
            .sort((left, right) =>
              BigInt(left.totalMinorUnits) < BigInt(right.totalMinorUnits) ? 1 : -1,
            )
            .map((category) => ({
              key: category.category,
              label: t(`expenses.categories.${category.category}`),
              value: money(category.totalMinorUnits),
            })),
        },
      );
    }
    case "summary": {
      const flows = [
        {
          key: "inflow",
          label: t("assistant.answers.summary.inflow"),
          value: money(answer.cashInflowMinorUnits),
        },
        {
          key: "outflow",
          label: t("assistant.answers.summary.outflow"),
          value: money(answer.cashOutflowMinorUnits),
        },
      ];
      if (answer.saleCount === "0" && answer.expenseCount === "0") {
        // A payment received or made moves money on a day without sales or expenses.
        const still = answer.cashInflowMinorUnits === "0" && answer.cashOutflowMinorUnits === "0";
        return still
          ? view(t("assistant.answers.summary.empty", { period: during(answer.period) }))
          : view(t("assistant.answers.summary.moneyOnly", { period: during(answer.period) }), {
              rows: flows,
            });
      }
      return view(
        t("assistant.answers.summary.lead", {
          period: starting(answer.period),
          sales: money(answer.salesGrossMinorUnits),
          expenses: money(answer.expensesTotalMinorUnits),
        }),
        {
          rows: [
            {
              key: "sales",
              label: t("assistant.answers.summary.sales", { count: Number(answer.saleCount) }),
              value: money(answer.salesGrossMinorUnits),
            },
            {
              key: "expenses",
              label: t("assistant.answers.summary.expenses", {
                count: Number(answer.expenseCount),
              }),
              value: money(answer.expensesTotalMinorUnits),
            },
            ...flows,
          ],
          note: t("assistant.answers.summary.note"),
        },
      );
    }
    case "cash": {
      const count = Number(answer.activeAccountCount);
      if (count === 0) return view(t("assistant.answers.cash.empty"));
      return view(
        t("assistant.answers.cash.lead", { count, total: money(answer.totalMinorUnits) }),
        {
          rows: answer.kinds.map((kind) => ({
            key: kind.kind,
            label: t(`operate.home.money.kinds.${kind.kind}`),
            value: money(kind.balanceMinorUnits),
          })),
        },
      );
    }
    case "receivables": {
      const count = Number(answer.customerCount);
      if (count === 0) return view(t("assistant.answers.receivables.empty"));
      const unlisted = count - answer.debtors.length;
      return view(
        t("assistant.answers.receivables.lead", {
          count,
          total: money(answer.outstandingMinorUnits),
        }),
        {
          details: [
            ...(answer.overdueMinorUnits === "0"
              ? []
              : [
                  t("assistant.answers.receivables.overdue", {
                    amount: money(answer.overdueMinorUnits),
                  }),
                ]),
            ...(unlisted > 0 ? [t("assistant.answers.receivables.more", { count: unlisted })] : []),
          ],
          rows: answer.debtors.map((debtor) => ({
            key: debtor.customerId,
            label: debtor.customerName,
            value: money(debtor.outstandingMinorUnits),
            note: debtor.overdueSinceLocalDate
              ? t("operate.home.debtors.overdueSince", {
                  date: formatLocalDayMonth(debtor.overdueSinceLocalDate, locale),
                })
              : debtor.nextDueLocalDate
                ? t("operate.home.debtors.dueOn", {
                    date: formatLocalDayMonth(debtor.nextDueLocalDate, locale),
                  })
                : t("operate.home.debtors.noDueDate"),
            ...(debtor.overdueSinceLocalDate && { overdue: true }),
          })),
        },
      );
    }
    case "payables": {
      const count = Number(answer.openPurchaseCount);
      if (count === 0) return view(t("assistant.answers.payables.empty"));
      return view(
        t("assistant.answers.payables.lead", {
          count,
          total: money(answer.outstandingMinorUnits),
        }),
        {
          details: answer.nextDue
            ? [
                t("assistant.answers.payables.next", {
                  supplier: answer.nextDue.supplierName,
                  amount: money(answer.nextDue.balanceMinorUnits),
                  date: formatLocalDayMonth(answer.nextDue.dueDate, locale),
                }),
              ]
            : [],
          rows: [
            ...(answer.overdueMinorUnits === "0"
              ? []
              : [
                  {
                    key: "overdue",
                    label: t("assistant.answers.payables.overdue"),
                    value: money(answer.overdueMinorUnits),
                    overdue: true,
                  },
                ]),
            ...(answer.dueSoonMinorUnits === "0"
              ? []
              : [
                  {
                    key: "dueSoon",
                    label: t("assistant.answers.payables.dueSoon"),
                    value: money(answer.dueSoonMinorUnits),
                  },
                ]),
          ],
        },
      );
    }
  }
}
