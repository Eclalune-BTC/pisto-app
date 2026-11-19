import { describe, expect, test } from "vitest";
import { businessQuestions, matchBusinessQuestion } from "./business-questions";

describe("questions about the business", () => {
  test.each([
    ["  ¿CUÁNTO vendí el mes pasado? ", "sales"],
    ["¿Cómo me fue el mes pasado?", "sales"],
    ["¿Cuántas ventas hice el mes pasado?", "sales"],
    ["¿Cuál fue el promedio por venta el mes pasado?", "sales"],
    ["¿Quién me debe?", "receivables"],
    ["cuánto me deben", "receivables"],
    ["¿Qué facturas debo?", "payables"],
    ["¿A qué proveedores les debo?", "payables"],
    ["¿Cuánto les debo a mis proveedores?", "payables"],
    ["¿Cuánto me deben? Pagué luz", undefined],
    ["¿Qué facturas debo pagar hoy?", undefined],
    ["¿Cuánto vendí el mes pasado y este?", undefined],
  ] as const)("resolves the complete question %s", (text, expected) => {
    expect(matchBusinessQuestion(text)).toBe(expected);
  });
  test("includes overdue receivables and excludes settled payables", () => {
    expect(businessQuestions.receivables.href).toBe("/operate/receivables");
    expect(businessQuestions.payables.href.params.payable).toBe("open");
  });
});
