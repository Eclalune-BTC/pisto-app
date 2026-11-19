import type { BusinessAnswer } from "@pisto/contracts";
import { createInstance, type TFunction } from "i18next";
import { describe, expect, test } from "vitest";

import { esSV } from "@/i18n/resources/es-SV";
import { answerView } from "./answer-view";

const translator = createInstance();
translator.init({
  initAsync: false,
  lng: "es-SV",
  resources: { "es-SV": { translation: esSV } },
});
const t = translator.t.bind(translator) as TFunction;
const view = (answer: BusinessAnswer) => answerView(t, "es-SV", answer);

const scope = {
  businessLocalDate: "2026-11-04",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  queriedAt: "2026-11-04T15:00:00.000Z",
};
const week = {
  key: "this_week",
  startLocalDate: "2026-11-02",
  endLocalDate: "2026-11-04",
} as const;
const today = { key: "today", startLocalDate: "2026-11-04", endLocalDate: "2026-11-04" } as const;

describe("sales answers", () => {
  test("state the exact gross, the count and the period they cover", () => {
    expect(
      view({
        topic: "sales",
        period: week,
        grossMinorUnits: "9750",
        saleCount: "3",
        averageMinorUnits: "3250",
        ...scope,
      }),
    ).toEqual({
      lead: "Esta semana vendió $97.50 en 3 ventas.",
      details: ["El promedio por venta fue $32.50."],
      rows: [],
      scope: "Del 2 nov 2026 al 4 nov 2026",
      note: "Incluye lo vendido al crédito.",
    });
  });

  test("one sale has no average to report and a single day is named in full", () => {
    expect(
      view({
        topic: "sales",
        period: today,
        grossMinorUnits: "325",
        saleCount: "1",
        averageMinorUnits: "325",
        ...scope,
      }),
    ).toMatchObject({
      lead: "Hoy vendió $3.25 en una venta.",
      details: [],
      scope: "Miércoles 4 de noviembre de 2026",
    });
  });

  test("an empty period says so instead of showing zero money", () => {
    const empty = view({
      topic: "sales",
      period: { key: "last_month", startLocalDate: "2026-10-01", endLocalDate: "2026-10-31" },
      grossMinorUnits: "0",
      saleCount: "0",
      averageMinorUnits: null,
      ...scope,
    });
    expect(empty.lead).toBe("No hay ventas registradas el mes pasado.");
    expect(empty.note).toBeUndefined();
  });
});

describe("period answers", () => {
  test("expenses list their categories from the largest", () => {
    expect(
      view({
        topic: "expenses",
        period: week,
        totalMinorUnits: "7400",
        expenseCount: "2",
        categories: [
          { category: "transport", totalMinorUnits: "1000", expenseCount: "1" },
          { category: "utilities", totalMinorUnits: "6400", expenseCount: "1" },
        ],
        ...scope,
      }),
    ).toMatchObject({
      lead: "Esta semana gastó $74.00 en 2 gastos.",
      rows: [
        { key: "utilities", label: "Servicios", value: "$64.00" },
        { key: "transport", label: "Transporte", value: "$10.00" },
      ],
    });
  });

  test("the summary never calls sales minus expenses a profit", () => {
    const summary = view({
      topic: "summary",
      period: week,
      salesGrossMinorUnits: "9750",
      saleCount: "3",
      expensesTotalMinorUnits: "7400",
      expenseCount: "1",
      cashInflowMinorUnits: "8000",
      cashOutflowMinorUnits: "7400",
      ...scope,
    });
    expect(summary.lead).toBe("Esta semana vendió $97.50 y gastó $74.00.");
    expect(summary.rows.map((row) => [row.label, row.value])).toEqual([
      ["Ventas · 3 ventas", "$97.50"],
      ["Gastos · un gasto", "$74.00"],
      ["Entró a sus cuentas", "$80.00"],
      ["Salió de sus cuentas", "$74.00"],
    ]);
    expect(summary.note).toContain("no es la ganancia");
    expect(JSON.stringify(summary)).not.toContain("$23.50");
  });

  test("ranked products carry what they sold and say which sales had no products", () => {
    const products = [
      {
        productId: "10000000-0000-4000-8000-000000000001",
        name: "Café molido 1 lb",
        unitKind: "unit" as const,
        quantityPrecision: 0,
        quantityMinorUnits: "6",
        grossMinorUnits: "1950",
      },
      {
        productId: "10000000-0000-4000-8000-000000000002",
        name: "Queso fresco",
        unitKind: "kilogram" as const,
        quantityPrecision: 3,
        quantityMinorUnits: "1500",
        grossMinorUnits: "500",
      },
    ];
    const ranked = view({
      topic: "top_products",
      period: week,
      saleCount: "5",
      itemizedSaleCount: "3",
      products,
      ...scope,
    });
    expect(ranked.lead).toBe("Esta semana lo que más vendió fue Café molido 1 lb.");
    expect(ranked.rows).toEqual([
      {
        key: products[0]?.productId,
        label: "Café molido 1 lb",
        value: "$19.50",
        note: "6 unidades",
      },
      { key: products[1]?.productId, label: "Queso fresco", value: "$5.00", note: "1.500 kg" },
    ]);
    expect(ranked.note).toBe(
      "2 de las 5 ventas se registraron solo por su total y no entran en esta lista.",
    );
    expect(
      view({
        topic: "top_products",
        period: week,
        saleCount: "2",
        itemizedSaleCount: "0",
        products: [],
        ...scope,
      }).lead,
    ).toBe(
      "Las ventas de este período se registraron solo por su total, sin productos que comparar.",
    );
  });
});

describe("position answers", () => {
  test("cash names the money available and where it is", () => {
    expect(
      view({
        topic: "cash",
        totalMinorUnits: "233193",
        activeAccountCount: "2",
        kinds: [
          { kind: "cash", accountCount: "1", balanceMinorUnits: "14180" },
          { kind: "bank", accountCount: "1", balanceMinorUnits: "219013" },
        ],
        ...scope,
      }),
    ).toEqual({
      lead: "Tiene $2,331.93 disponibles en 2 cuentas.",
      details: [],
      rows: [
        { key: "cash", label: "Caja", value: "$141.80" },
        { key: "bank", label: "Banco", value: "$2,190.13" },
      ],
      scope: "Al 4 nov 2026",
    });
  });

  test("receivables mark who is overdue and count who is not listed", () => {
    const owed = view({
      topic: "receivables",
      outstandingMinorUnits: "8160",
      overdueMinorUnits: "4195",
      customerCount: "4",
      debtors: [
        {
          customerId: "20000000-0000-4000-8000-000000000001",
          customerName: "Comedor El Pilar",
          outstandingMinorUnits: "4195",
          overdueMinorUnits: "4195",
          openReceivableCount: "1",
          overdueSinceLocalDate: "2026-10-22",
          nextDueLocalDate: null,
        },
        {
          customerId: "20000000-0000-4000-8000-000000000002",
          customerName: "Rosa Ayala",
          outstandingMinorUnits: "475",
          overdueMinorUnits: "0",
          openReceivableCount: "1",
          overdueSinceLocalDate: null,
          nextDueLocalDate: "2026-11-25",
        },
      ],
      ...scope,
    });
    expect(owed.lead).toBe("Le deben $81.60 entre 4 clientes.");
    expect(owed.details).toEqual([
      "De eso, $41.95 ya está vencido.",
      "Hay 2 clientes más con saldo pendiente.",
    ]);
    expect(owed.rows).toEqual([
      {
        key: "20000000-0000-4000-8000-000000000001",
        label: "Comedor El Pilar",
        value: "$41.95",
        note: "Vencido desde el 22 oct",
        overdue: true,
      },
      {
        key: "20000000-0000-4000-8000-000000000002",
        label: "Rosa Ayala",
        value: "$4.75",
        note: "Vence el 25 nov",
      },
    ]);
  });

  test("payables give the balance, what is overdue and the next payment", () => {
    const owed = view({
      topic: "payables",
      outstandingMinorUnits: "70974",
      dueSoonMinorUnits: "10970",
      overdueMinorUnits: "41314",
      openPurchaseCount: "8",
      nextDue: {
        purchaseId: "30000000-0000-4000-8000-000000000001",
        supplierName: "Abarrotes Mayoreo El Sol",
        dueDate: "2026-11-06",
        balanceMinorUnits: "10970",
      },
      ...scope,
    });
    expect(owed.lead).toBe("Debe $709.74 de 8 compras pendientes.");
    expect(owed.details).toEqual([
      "El próximo pago es a Abarrotes Mayoreo El Sol: $109.70 el 6 nov.",
    ]);
    expect(owed.rows).toEqual([
      { key: "overdue", label: "Vencido", value: "$413.14", overdue: true },
      { key: "dueSoon", label: "Vence esta semana", value: "$109.70" },
    ]);
  });

  test("low stock shows what is left against the minimum", () => {
    const low = view({
      topic: "low_stock",
      products: [
        {
          productId: "40000000-0000-4000-8000-000000000001",
          name: "Azúcar 1 lb",
          unitKind: "unit",
          quantityPrecision: 0,
          onHandMinorUnits: "3",
          lowStockThresholdMinorUnits: "5",
        },
        {
          productId: "40000000-0000-4000-8000-000000000002",
          name: "Frijol rojo",
          unitKind: "kilogram",
          quantityPrecision: 3,
          onHandMinorUnits: "0",
          lowStockThresholdMinorUnits: "2000",
        },
      ],
      more: true,
      businessLocalDate: "2026-11-04",
    });
    expect(low.lead).toBe("Más de 2 productos están en su mínimo o por debajo.");
    expect(low.rows).toEqual([
      {
        key: "40000000-0000-4000-8000-000000000001",
        label: "Azúcar 1 lb",
        value: "Quedan 3 unidades",
        note: "Mínimo: 5 unidades",
      },
      {
        key: "40000000-0000-4000-8000-000000000002",
        label: "Frijol rojo",
        value: "Agotado",
        note: "Mínimo: 2.000 kg",
      },
    ]);
    expect(low.note).toBe("El inventario los muestra todos.");
    const complete = view({
      topic: "low_stock",
      products: [
        {
          productId: "40000000-0000-4000-8000-000000000001",
          name: "Azúcar 1 lb",
          unitKind: "unit",
          quantityPrecision: 0,
          onHandMinorUnits: "3",
          lowStockThresholdMinorUnits: "5",
        },
      ],
      more: false,
      businessLocalDate: "2026-11-04",
    });
    expect(complete.lead).toBe("Un producto está en su mínimo o por debajo.");
    expect(complete.note).toBeUndefined();
  });

  test("money that moved on a day without sales or expenses is still reported", () => {
    const moved = view({
      topic: "summary",
      period: today,
      salesGrossMinorUnits: "0",
      saleCount: "0",
      expensesTotalMinorUnits: "0",
      expenseCount: "0",
      cashInflowMinorUnits: "5000",
      cashOutflowMinorUnits: "20000",
      ...scope,
    });
    expect(moved.lead).toBe("No hay ventas ni gastos registrados hoy, pero sí se movió dinero.");
    expect(moved.rows.map((row) => [row.label, row.value])).toEqual([
      ["Entró a sus cuentas", "$50.00"],
      ["Salió de sus cuentas", "$200.00"],
    ]);
    const still = view({
      topic: "summary",
      period: today,
      salesGrossMinorUnits: "0",
      saleCount: "0",
      expensesTotalMinorUnits: "0",
      expenseCount: "0",
      cashInflowMinorUnits: "0",
      cashOutflowMinorUnits: "0",
      ...scope,
    });
    expect(still).toMatchObject({ lead: "No hay ventas ni gastos registrados hoy.", rows: [] });
  });

  test("a product whose quantities cannot be added shows only its money", () => {
    const ranked = view({
      topic: "top_products",
      period: week,
      saleCount: "2",
      itemizedSaleCount: "2",
      products: [
        {
          productId: "10000000-0000-4000-8000-000000000003",
          name: "Lazo",
          unitKind: "kilogram",
          quantityPrecision: 3,
          quantityMinorUnits: null,
          grossMinorUnits: "700",
        },
      ],
      ...scope,
    });
    expect(ranked.rows).toEqual([
      { key: "10000000-0000-4000-8000-000000000003", label: "Lazo", value: "$7.00" },
    ]);
  });

  test.each([
    [
      "cash",
      { topic: "cash", totalMinorUnits: "0", activeAccountCount: "0", kinds: [], ...scope },
      "Todavía no tiene cuentas de caja o banco activas.",
    ],
    [
      "receivables",
      {
        topic: "receivables",
        outstandingMinorUnits: "0",
        overdueMinorUnits: "0",
        customerCount: "0",
        debtors: [],
        ...scope,
      },
      "Nadie le debe en este momento.",
    ],
    [
      "payables",
      {
        topic: "payables",
        outstandingMinorUnits: "0",
        dueSoonMinorUnits: "0",
        overdueMinorUnits: "0",
        openPurchaseCount: "0",
        nextDue: null,
        ...scope,
      },
      "No le debe a ningún proveedor.",
    ],
    [
      "low stock",
      { topic: "low_stock", products: [], more: false, businessLocalDate: "2026-11-04" },
      "Ningún producto está en su mínimo.",
    ],
  ] as const)("an empty %s position is one plain sentence", (_name, answer, lead) => {
    expect(view(answer as BusinessAnswer)).toMatchObject({ lead, details: [], rows: [] });
  });
});
