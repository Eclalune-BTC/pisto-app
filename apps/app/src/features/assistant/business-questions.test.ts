import { describe, expect, test } from "vitest";
import {
  businessQuestions,
  matchBusinessQuestion,
  matchSaleTool,
  permitsTool,
} from "./business-questions";

test("launches tools only for complete commands and a permitted business member", () => {
  expect(matchSaleTool("¡Quiero ingresar ventas!")).toEqual({ name: "start_sale" });
  expect(matchSaleTool("Buscar un producto")).toEqual({ name: "find_product", query: null });
  expect(matchSaleTool("Buscar producto Café-Arábica 2")).toEqual({
    name: "find_product",
    query: "Café-Arábica 2",
  });
  for (const sentence of [
    "No quiero ingresar ventas",
    "Quiero ingresar una venta de $25",
    "Quiero ingresar ventas y gastos",
    "¿Cuántas ventas hice?",
  ])
    expect(matchSaleTool(sentence)).toBeUndefined();
  expect(permitsTool(["sales:create"], { name: "start_sale" })).toBe(false);
  expect(
    permitsTool(["assistant:use", "catalog:read"], { name: "find_product", query: null }),
  ).toBe(true);
  expect(
    permitsTool(["assistant:use", "sales:create"], { name: "find_product", query: "café" }),
  ).toBe(false);
});

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
