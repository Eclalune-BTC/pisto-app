import { describe, expect, test } from "bun:test";
import type { CatalogTurnRequest, Product } from "@pisto/contracts";
import {
  type CatalogIntent,
  catalogReply,
  createDeepSeekCatalogModel,
} from "../src/catalog-turn.ts";

const product: Product = {
  id: "10000000-0000-4000-8000-000000000001",
  categoryId: null,
  sku: "CAFE",
  name: "Café molido 1 lb",
  unitKind: "unit",
  quantityPrecision: 0,
  tracked: false,
  lowStockThresholdMinorUnits: null,
  sellingPriceMinorUnits: "325",
  sellingPriceCurrency: "USD",
  sellingPriceCurrencyMinorUnitDigits: 2,
  status: "active",
  createdAt: "2026-11-18T00:00:00Z",
  updatedAt: "2026-11-18T00:00:00Z",
};
const input = (text: string, previousQuantity: string | null = null): CatalogTurnRequest => ({
  text,
  previousQuantity,
  expectedBusinessId: "demo",
  productId: product.id,
});
const intent = (quantityText: string | null, usePrevious = false): CatalogIntent => ({
  intent: "quote",
  quantityText,
  usePrevious,
});
describe("quoting the selected product", () => {
  test("grounds the spoken quantity and calculates the exact quote from the catalog", () => {
    expect(catalogReply(input("¿Y cuánto cuestan tres?"), product, intent("tres"))).toEqual({
      kind: "quote",
      quantity: "3",
      quantityMinorUnits: "3",
      totalMinorUnits: "975",
    });
    expect(
      catalogReply(
        input("¿Y 1,5?"),
        { ...product, quantityPrecision: 2, sellingPriceMinorUnits: "233" },
        intent("1,5"),
      ),
    ).toMatchObject({ totalMinorUnits: "350", quantity: "1.5" });
    expect(
      catalogReply(input("Sí, agréguelas", "3"), product, {
        intent: "prepare_sale",
        quantityText: null,
        usePrevious: true,
      }),
    ).toMatchObject({ kind: "prepare_sale", quantity: "3", totalMinorUnits: "975" });
  });
  test.each([
    ["Y dos", "3"],
    ["-3", "3"],
    ["¿y 3.5?", "3"],
    ["Y 1,500", "1,500"],
    ["Y 2,5", "2,5"],
    ["cero", "cero"],
    ["a cuánto", ""],
  ])("asks for a usable quantity for %s", (text, evidence) => {
    expect(catalogReply(input(text), product, intent(evidence))).toEqual({
      kind: "quantity_needed",
    });
  });
  test("distinguishes an absent price, a genuine zero, and a subtotal above the ledger range", () => {
    expect(
      catalogReply(input("tres"), { ...product, sellingPriceMinorUnits: null }, intent("tres")),
    ).toEqual({ kind: "missing_price" });
    expect(
      catalogReply(input("tres"), { ...product, sellingPriceMinorUnits: "0" }, intent("tres")),
    ).toMatchObject({ totalMinorUnits: "0" });
    expect(
      catalogReply(
        input("tres"),
        { ...product, sellingPriceMinorUnits: "9223372036854775807" },
        intent("tres"),
      ),
    ).toEqual({ kind: "quantity_needed" });
  });
  test.each([
    ["2/3 de kilo", "2"],
    ["2-3 bolsas", "2"],
    ["uno y medio", "uno"],
    ["treinta y dos", "dos"],
  ])("rejects partial evidence in %s", (text, evidence) => {
    expect(
      catalogReply(input(text), { ...product, quantityPrecision: 3 }, intent(evidence)),
    ).toEqual({ kind: "quantity_needed" });
  });
  test("requires explicit acceptance before reusing the last quantity", () => {
    expect(
      catalogReply(input("Mejor cinco", "3"), product, {
        intent: "prepare_sale",
        quantityText: null,
        usePrevious: true,
      }),
    ).toEqual({ kind: "quantity_needed" });
    expect(
      catalogReply(input("No venda tres", "3"), product, {
        intent: "prepare_sale",
        quantityText: "tres",
        usePrevious: false,
      }),
    ).toEqual({ kind: "clarify" });
  });
});
describe("DeepSeek catalog protocol", () => {
  const run = (status: number, content: string, finish_reason = "stop") =>
    createDeepSeekCatalogModel("fixture", (async (url, init) => {
      expect(url).toBe("https://api.deepseek.com/chat/completions");
      expect(init?.redirect).toBe("manual");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("deepseek-flash");
      expect(JSON.parse(body.messages[1].content)).toEqual({
        selectedProduct: product.name,
        hasQuote: false,
        followUp: "¿Y tres?",
      });
      return Response.json({ choices: [{ finish_reason, message: { content } }] }, { status });
    }) as typeof fetch)({
      text: "¿Y tres?",
      productName: product.name,
      hasQuote: false,
      signal: new AbortController().signal,
    });
  test("accepts only a completed, bounded intent", async () => {
    await expect(run(200, JSON.stringify(intent("tres")))).resolves.toEqual(intent("tres"));
    for (const invalid of ["   ", "not JSON", JSON.stringify({ ...intent("tres"), total: "1" })])
      await expect(run(200, invalid)).rejects.toMatchObject({ reason: "invalid_output" });
    await expect(run(200, JSON.stringify(intent("tres")), "length")).rejects.toMatchObject({
      reason: "invalid_output",
    });
    await expect(run(429, "")).rejects.toMatchObject({ reason: "unavailable" });
    await expect(run(307, "")).rejects.toMatchObject({ reason: "unavailable" });
  });
});
