import {
  type BusinessAnswer,
  type BusinessPeriod,
  type BusinessTopic,
  businessAnswerSchema,
  type Debtors,
  type MoneyTrend,
  maximumLowStockProducts,
  type OperatingReport,
  type OperatingReportQuery,
  type PayablesSummaryResponse,
  type ReceivablesSummary,
  type SalesPeriodSummary,
  type StockListResponse,
} from "@pisto/contracts";

import { defaultAnswerPeriod, periodRange } from "./periods.ts";

/**
 * The exact reads a business question is answered from. Each one authorizes the actor in its
 * active business with the permission in `businessTopicPermissions`.
 */
export interface BusinessFacts<Actor> {
  salesSummary(actor: Actor, range: OperatingReportQuery): Promise<SalesPeriodSummary>;
  operatingReport(actor: Actor, range: OperatingReportQuery): Promise<OperatingReport>;
  moneyTrend(actor: Actor): Promise<MoneyTrend>;
  receivablesSummary(actor: Actor): Promise<ReceivablesSummary>;
  debtors(actor: Actor): Promise<Debtors>;
  payablesSummary(actor: Actor): Promise<PayablesSummaryResponse["data"]>;
  lowStock(actor: Actor, limit: number): Promise<StockListResponse["data"]>;
}

/**
 * Answers one question with figures read by Pisto. No model takes part: the topic and the period
 * are the whole input, and every amount comes from the repository that owns it.
 */
export async function answerBusinessQuestion<Actor>(
  facts: BusinessFacts<Actor>,
  actor: Actor,
  question: { topic: BusinessTopic; period?: BusinessPeriod | undefined },
  today: string,
): Promise<BusinessAnswer> {
  return businessAnswerSchema.parse(await read(facts, actor, question, today));
}

async function read<Actor>(
  facts: BusinessFacts<Actor>,
  actor: Actor,
  question: { topic: BusinessTopic; period?: BusinessPeriod | undefined },
  today: string,
): Promise<BusinessAnswer> {
  const { topic } = question;
  const key = question.period ?? defaultAnswerPeriod;
  const range = periodRange(key, today);
  const period = { key, ...range };
  switch (topic) {
    case "sales":
    case "top_products": {
      const summary = await facts.salesSummary(actor, range);
      const scope = {
        businessLocalDate: summary.businessLocalDate,
        currency: summary.currency,
        currencyMinorUnitDigits: summary.currencyMinorUnitDigits,
        queriedAt: summary.queriedAt,
      };
      return topic === "sales"
        ? {
            topic,
            period,
            grossMinorUnits: summary.grossMinorUnits,
            saleCount: summary.saleCount,
            averageMinorUnits: summary.averageMinorUnits,
            ...scope,
          }
        : {
            topic,
            period,
            saleCount: summary.saleCount,
            itemizedSaleCount: summary.itemizedSaleCount,
            products: summary.topProducts,
            ...scope,
          };
    }
    case "expenses": {
      const report = await facts.operatingReport(actor, range);
      return {
        topic,
        period,
        totalMinorUnits: report.expenses.totalMinorUnits,
        expenseCount: report.expenses.expenseCount,
        categories: report.expenses.categories,
        ...reportScope(report),
      };
    }
    case "summary": {
      const report = await facts.operatingReport(actor, range);
      return {
        topic,
        period,
        salesGrossMinorUnits: report.sales.grossMinorUnits,
        saleCount: report.sales.saleCount,
        expensesTotalMinorUnits: report.expenses.totalMinorUnits,
        expenseCount: report.expenses.expenseCount,
        cashInflowMinorUnits: report.cash.inflowMinorUnits,
        cashOutflowMinorUnits: report.cash.outflowMinorUnits,
        ...reportScope(report),
      };
    }
    case "cash": {
      const trend = await facts.moneyTrend(actor);
      return {
        topic,
        totalMinorUnits: trend.closingMinorUnits,
        activeAccountCount: trend.activeAccountCount,
        kinds: trend.kinds,
        businessLocalDate: trend.endLocalDate,
        currency: trend.currency,
        currencyMinorUnitDigits: trend.currencyMinorUnitDigits,
        queriedAt: trend.queriedAt,
      };
    }
    case "receivables": {
      const [summary, debtors] = await Promise.all([
        facts.receivablesSummary(actor),
        facts.debtors(actor),
      ]);
      return {
        topic,
        outstandingMinorUnits: summary.outstandingMinorUnits,
        overdueMinorUnits: summary.overdueMinorUnits,
        customerCount: debtors.customerCount,
        debtors: debtors.items,
        businessLocalDate: summary.businessLocalDate,
        currency: summary.currency,
        currencyMinorUnitDigits: summary.currencyMinorUnitDigits,
        queriedAt: summary.queriedAt,
      };
    }
    case "payables": {
      const summary = await facts.payablesSummary(actor);
      return {
        topic,
        outstandingMinorUnits: summary.outstandingMinorUnits,
        dueSoonMinorUnits: summary.dueSoonMinorUnits,
        overdueMinorUnits: summary.overdueMinorUnits,
        openPurchaseCount: summary.openPurchaseCount,
        nextDue: summary.nextDue,
        businessLocalDate: summary.businessLocalDate,
        currency: summary.currency,
        currencyMinorUnitDigits: summary.currencyMinorUnitDigits,
        queriedAt: summary.queriedAt,
      };
    }
    case "low_stock": {
      const list = await facts.lowStock(actor, maximumLowStockProducts);
      return {
        topic,
        products: list.items.flatMap(({ product, stock }) =>
          !stock.lowStock || stock.lowStockThresholdMinorUnits === null
            ? []
            : [
                {
                  productId: product.id,
                  name: product.name,
                  unitKind: product.unitKind,
                  quantityPrecision: stock.quantityPrecision,
                  onHandMinorUnits: stock.onHandMinorUnits,
                  lowStockThresholdMinorUnits: stock.lowStockThresholdMinorUnits,
                },
              ],
        ),
        more: list.nextCursor !== null,
        businessLocalDate: today,
      };
    }
  }
}

function reportScope(report: OperatingReport) {
  return {
    businessLocalDate: report.positionAsOfLocalDate,
    currency: report.currency,
    currencyMinorUnitDigits: report.currencyMinorUnitDigits,
    queriedAt: report.queriedAt,
  };
}
