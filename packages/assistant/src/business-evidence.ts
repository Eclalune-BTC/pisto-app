import {
  type Customer,
  type CustomerDetail,
  type MovementList,
  type MovementListQuery,
  movementListSchema,
  type OperatingReportQuery,
  operatingReportSchema,
  type ProductDetail,
  type ProductUnitKind,
  type SupplierListResponse,
  salesPeriodSummarySchema,
  toDecimalString,
} from "@pisto/contracts";
import { answerBusinessQuestion, type BusinessFacts } from "./answers.ts";
import { type BusinessEvidence, type BusinessRead, rangeOf } from "./business-conversation.ts";
import { fold } from "./text.ts";

export interface ConversationFacts<Actor> extends BusinessFacts<Actor> {
  products(
    actor: Actor,
    name: string,
  ): Promise<{ items: ProductDetail[]; nextCursor: string | null }>;
  customers(actor: Actor, name: string): Promise<{ items: Customer[]; nextCursor: string | null }>;
  customer(actor: Actor, id: string): Promise<CustomerDetail>;
  suppliers(actor: Actor, name: string): Promise<SupplierListResponse["data"]>;
  movements(actor: Actor, query: MovementListQuery): Promise<MovementList>;
}

const categories = {
  inventory: "mercadería",
  rent: "alquiler",
  utilities: "servicios",
  payroll: "sueldos",
  transport: "transporte",
  marketing: "publicidad",
  tax: "impuestos",
  other: "otros gastos",
};
const accountKinds = {
  cash: "efectivo",
  bank: "bancos",
  mobile_money: "dinero móvil",
  other: "otras cuentas",
};
const unitNames: Record<ProductUnitKind, string> = {
  unit: "unidades",
  kilogram: "kg",
  gram: "g",
  liter: "L",
  milliliter: "mL",
  meter: "m",
};
const movementNames = {
  all: "todos los tipos",
  sale: "ventas",
  expense: "gastos",
  purchase: "compras",
  receivable_payment: "abonos de clientes",
  supplier_payment: "pagos a proveedores",
};

type Currency = { currency: string; currencyMinorUnitDigits: number };
function amount(scope: Currency, value: string) {
  return `${scope.currency} ${toDecimalString(value, scope.currencyMinorUnitDigits)}`;
}
function quantity(value: string, precision: number, unit: ProductUnitKind) {
  return `${toDecimalString(value, precision)} ${unitNames[unit]}`;
}
function during(range: OperatingReportQuery) {
  return range.startLocalDate === range.endLocalDate
    ? `el ${range.startLocalDate}`
    : `del ${range.startLocalDate} al ${range.endLocalDate}`;
}

// Directory searches also match contacts. Only the requested name (or a product SKU) can identify a fact.
function match<T>(
  page: { items: T[]; nextCursor: string | null },
  term: string,
  names: (row: T) => Array<string | null>,
): { found: T } | { message: string } {
  const query = fold(term);
  const matches = page.items.filter((row) =>
    names(row).some((name) => name && fold(name).includes(query)),
  );
  const exact = matches.filter((row) => names(row).some((name) => name && fold(name) === query));
  if (page.nextCursor || exact.length > 1 || (!exact.length && matches.length > 1)) {
    return {
      message: `hay varias coincidencias posibles para «${term}»; indique el nombre completo o un código más específico`,
    } as const;
  }
  const found = exact[0] ?? matches[0];
  return found
    ? ({ found } as const)
    : ({
        message: `la búsqueda de «${term}» no encontró coincidencias por nombre o código`,
      } as const);
}

async function clauses<Actor>(
  facts: ConversationFacts<Actor>,
  actor: Actor,
  read: BusinessRead,
  today: string,
  evidence: BusinessEvidence,
): Promise<string[]> {
  const source = read.source;
  switch (read.source) {
    case "sales":
    case "top_products": {
      const range = rangeOf(read, today);
      const when = during(range);
      const sales = salesPeriodSummarySchema.parse(await facts.salesSummary(actor, range));
      if (read.source === "sales")
        evidence.total = {
          value: sales.grossMinorUnits,
          currency: sales.currency,
          digits: sales.currencyMinorUnitDigits,
          range,
        };
      if (sales.saleCount === "0")
        return [
          `${when} no hubo ventas registradas (ventas brutas: ${amount(sales, sales.grossMinorUnits)})`,
        ];
      if (read.source === "sales")
        return [
          `${when} las ventas brutas sumaron ${amount(sales, sales.grossMinorUnits)} en ${sales.saleCount} ventas`,
          ...(sales.averageMinorUnits === null
            ? []
            : [`${when} el promedio por venta fue ${amount(sales, sales.averageMinorUnits)}`]),
        ];
      const missing = BigInt(sales.saleCount) - BigInt(sales.itemizedSaleCount);
      const coverage = missing
        ? `; ${missing} ventas sin detalle de productos quedaron fuera de la clasificación`
        : "";
      if (!sales.topProducts.length)
        return [`${when} no hay ventas con líneas de producto para clasificar${coverage}`];
      return sales.topProducts.map(
        (p, i) =>
          `${when}, en el puesto ${i + 1} por ventas brutas con detalle, «${p.name}» sumó ${amount(sales, p.grossMinorUnits)}${p.quantityMinorUnits === null ? "" : ` (${quantity(p.quantityMinorUnits, p.quantityPrecision, p.unitKind)})`}${coverage}`,
      );
    }
    case "summary":
    case "expenses": {
      const range = rangeOf(read, today);
      const when = during(range);
      const report = operatingReportSchema.parse(await facts.operatingReport(actor, range));
      if (read.source === "expenses")
        evidence.total = {
          value: report.expenses.totalMinorUnits,
          currency: report.currency,
          digits: report.currencyMinorUnitDigits,
          range,
        };
      const m = (v: string) => amount(report, v);
      const expenses = `${when} los gastos registrados sumaron ${m(report.expenses.totalMinorUnits)} en ${report.expenses.expenseCount} gastos`;
      if (read.source === "expenses")
        return [
          expenses,
          ...report.expenses.categories.map(
            (c) =>
              `${when} la categoría «${categories[c.category]}» registró ${m(c.totalMinorUnits)} en ${c.expenseCount} gastos`,
          ),
        ];
      return [
        `${when} las ventas brutas sumaron ${m(report.sales.grossMinorUnits)} en ${report.sales.saleCount} ventas`,
        expenses,
        `${when} entraron ${m(report.cash.inflowMinorUnits)} y salieron ${m(report.cash.outflowMinorUnits)} de las cuentas; el movimiento neto fue ${m(report.cash.netMovementMinorUnits)}`,
      ];
    }
    case "customer": {
      const result = match(await facts.customers(actor, read.name), read.name, (r) => [r.name]);
      if ("message" in result) return [result.message];
      const { customer, balance } = await facts.customer(actor, result.found.id);
      return [
        `«${customer.name}» debe ${amount(balance, balance.outstandingMinorUnits)} en ${balance.openReceivableCount} cuentas por cobrar, de los cuales ${amount(balance, balance.overdueMinorUnits)} están vencidos`,
      ];
    }
    case "supplier": {
      const result = match(await facts.suppliers(actor, read.name), read.name, (r) => [r.name]);
      if ("message" in result) return [result.message];
      const { name, balance } = result.found;
      return [
        `el saldo por pagar a «${name}» es ${amount(balance, balance.outstandingMinorUnits)} en ${balance.openPurchaseCount} compras, con ${amount(balance, balance.overdueMinorUnits)} vencidos`,
        balance.lastPurchaseLocalDate
          ? `la última compra a «${name}» fue el ${balance.lastPurchaseLocalDate}`
          : `no hay compras registradas a «${name}»`,
      ];
    }
    case "product_price":
    case "product_stock": {
      const result = match(await facts.products(actor, read.name), read.name, (r) => [
        r.product.name,
        r.product.sku,
      ]);
      if ("message" in result) return [result.message];
      const { product, stock } = result.found;
      if (read.source === "product_stock") {
        if (!product.tracked) return [`«${product.name}» no lleva control de existencias`];
        if (!stock) throw new Error("A tracked catalog product has no stock result");
        return [
          `quedan ${quantity(stock.onHandMinorUnits, stock.quantityPrecision, product.unitKind)} de «${product.name}»`,
        ];
      }
      if (product.sellingPriceMinorUnits === null)
        return [`«${product.name}» no tiene precio de venta registrado`];
      if (!product.sellingPriceCurrency || product.sellingPriceCurrencyMinorUnitDigits === null)
        throw new Error("The catalog price has no currency snapshot");
      return [
        `el precio de venta de «${product.name}» es ${amount({ currency: product.sellingPriceCurrency, currencyMinorUnitDigits: product.sellingPriceCurrencyMinorUnitDigits }, product.sellingPriceMinorUnits)} por ${unitNames[product.unitKind] === "unidades" ? "unidad" : unitNames[product.unitKind]}`,
      ];
    }
    case "movements": {
      const range = rangeOf(read, today);
      const rows = movementListSchema.parse(
        await facts.movements(actor, {
          ...range,
          kind: read.kind,
          ...(read.search && { query: read.search }),
          limit: 5,
        }),
      );
      const scope = `${during(range)}, en los movimientos visibles de ${movementNames[read.kind]}${read.search ? ` que coinciden con «${read.search}»` : ""}`;
      if (!rows.items.length) return [`${scope}, no hay registros`];
      return [
        `${scope}, el dinero que entró suma ${amount(rows, rows.totals.inflowMinorUnits)} y el que salió suma ${amount(rows, rows.totals.outflowMinorUnits)}`,
        ...rows.items.map(
          (r) =>
            `${scope}, hay un movimiento de ${movementNames[r.kind]} el ${r.occurredLocalDate} a las ${r.occurredLocalTime}${r.facts.counterpartyName ? ` con «${r.facts.counterpartyName}»` : ""} por ${amount(rows, r.amountMinorUnits)} de movimiento de dinero${r.facts.totalMinorUnits === null ? "" : ` (importe del registro: ${amount(rows, r.facts.totalMinorUnits)})`}`,
        ),
      ];
    }
    default: {
      const a = await answerBusinessQuestion(facts, actor, { topic: read.source }, today);
      switch (a.topic) {
        case "cash":
          return [
            `hay ${amount(a, a.totalMinorUnits)} en ${a.activeAccountCount} cuentas activas`,
            ...a.kinds.map(
              (k) => `el saldo en ${accountKinds[k.kind]} es ${amount(a, k.balanceMinorUnits)}`,
            ),
          ];
        case "receivables":
          return [
            `el saldo por cobrar suma ${amount(a, a.outstandingMinorUnits)} entre ${a.customerCount} clientes, con ${amount(a, a.overdueMinorUnits)} vencidos`,
            ...a.debtors.map(
              (d) =>
                `«${d.customerName}» debe ${amount(a, d.outstandingMinorUnits)}, de los cuales ${amount(a, d.overdueMinorUnits)} están vencidos`,
            ),
          ];
        case "payables":
          return [
            `el saldo por pagar suma ${amount(a, a.outstandingMinorUnits)} en ${a.openPurchaseCount} compras, con ${amount(a, a.overdueMinorUnits)} vencidos y ${amount(a, a.dueSoonMinorUnits)} por vencer pronto`,
            ...(a.nextDue
              ? [
                  `el próximo vencimiento es el ${a.nextDue.dueDate}: ${amount(a, a.nextDue.balanceMinorUnits)} a «${a.nextDue.supplierName}»`,
                ]
              : []),
          ];
        case "low_stock":
          return a.products.length
            ? a.products.map(
                (p) =>
                  `«${p.name}» está en su mínimo o por debajo: quedan ${quantity(p.onHandMinorUnits, p.quantityPrecision, p.unitKind)}${a.more ? "; hay más productos en esa situación" : ""}`,
              )
            : ["ningún producto con un mínimo configurado está en su mínimo o por debajo"];
        default:
          throw new Error(`Unexpected position for business source ${source}`);
      }
    }
  }
}

export async function readBusinessEvidence<Actor>(
  facts: ConversationFacts<Actor>,
  actor: Actor,
  read: BusinessRead,
  today: string,
): Promise<BusinessEvidence> {
  const evidence: BusinessEvidence = { source: read.source, facts: [] };
  evidence.facts = await clauses(facts, actor, read, today, evidence);
  return evidence;
}
