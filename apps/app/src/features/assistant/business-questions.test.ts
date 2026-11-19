import { businessTopicPermissions, businessTopicSchema } from "@pisto/contracts";
import { describe, expect, test } from "vitest";
import {
  isPeriodTopic,
  matchBusinessQuestion,
  matchSaleTool,
  permitsTool,
  permitsTopic,
  suggestedQuestions,
  topicHrefs,
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
    ["  ¿CUÁNTO vendí el mes pasado? ", "sales", "last_month"],
    ["¿Cuántas ventas hice el mes pasado?", "sales", "last_month"],
    ["¿Cuál fue el promedio por venta el mes pasado?", "sales", "last_month"],
    ["Ventas del mes pasado", "sales", "last_month"],
    ["¿Cuánto vendí hoy?", "sales", "today"],
    ["¿Cuánto llevo vendido?", "sales", null],
    ["ventas de esta semana", "sales", "this_week"],
    ["¿Cómo me fue el mes pasado?", "summary", "last_month"],
    ["¿Cómo me fue la semana pasada?", "summary", "last_week"],
    ["¿Cuánto gasté en los últimos 30 días?", "expenses", "last_30_days"],
    ["¿Cuánto gasté ayer?", "expenses", "yesterday"],
    ["¿Qué es lo que más se vende?", "top_products", null],
    ["¿Cuánto tengo en caja?", "cash", null],
    ["¿Quién me debe?", "receivables", null],
    ["cuánto me deben", "receivables", null],
    ["¿Qué facturas debo?", "payables", null],
    ["¿A qué proveedores les debo?", "payables", null],
    ["¿Cuánto les debo a mis proveedores?", "payables", null],
    ["¿Qué se está acabando?", "low_stock", null],
  ] as const)("resolves the complete question %s", (text, topic, period) => {
    expect(matchBusinessQuestion(text)).toEqual({ name: "answer_question", topic, period });
  });

  test.each([
    "¿Cuánto me deben? Pagué luz",
    "¿Qué facturas debo pagar hoy?",
    "¿Cuánto vendí el mes pasado y este?",
    "¿Cuánto vendí en marzo?",
    "¿Cuánto tengo en caja hoy?",
    "¿Cuánto vendí hoy y ayer?",
    "Vendí hoy tres cafés",
    "¿Cuánto me debe don Carlos?",
    "ventas constructor",
    "gastos toString",
  ])("leaves %s to the model", (text) => {
    expect(matchBusinessQuestion(text)).toBeUndefined();
  });

  test("a question opens for any assistant user and its topic states the permission", () => {
    const question = matchBusinessQuestion("¿Cuánto tengo en caja?");
    if (!question) throw new Error("The cash question must be recognized");
    expect(permitsTool(["assistant:use"], question)).toBe(true);
    expect(permitsTool(["cash:read"], question)).toBe(false);
    expect(permitsTopic(["assistant:use"], "cash")).toBe(false);
    expect(permitsTopic(["cash:read"], "cash")).toBe(true);
  });

  test("every topic has a screen, a permission and a suggested question", () => {
    for (const topic of businessTopicSchema.options) {
      expect(topicHrefs[topic]).toBeTruthy();
      expect(businessTopicPermissions[topic]).toBeTruthy();
      expect(suggestedQuestions.some(({ tool }) => tool.topic === topic)).toBe(true);
    }
    expect(topicHrefs.payables.params.payable).toBe("open");
    for (const { tool } of suggestedQuestions) {
      expect(tool.period === null).toBe(!isPeriodTopic(tool.topic));
    }
  });
});
