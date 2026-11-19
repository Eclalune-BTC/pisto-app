import {
  catalogModelId,
  catalogPromptVersion,
  createDeepSeekCatalogModel,
} from "../src/catalog-turn.ts";

const key = process.env.DEEPSEEK_API_KEY;
if (!key) throw new Error("Set the server-side DEEPSEEK_API_KEY to run the catalog evaluation");
const classify = createDeepSeekCatalogModel(key);
const cases = [
  ["¿En cuánto tengo el café molido en mi tienda?", false, "price", null, false],
  ["¿Y cuánto cuestan tres?", false, "quote", "tres", false],
  ["¿Y dos?", true, "quote", "dos", false],
  ["Sí, agréguelas", true, "prepare_sale", null, true],
  ["¿Cuántas quedan?", true, "stock", null, false],
  ["¿Cuánto sería si vendiera tres?", false, "quote", "tres", false],
  ["No venda tres", true, "clarify", null, false],
  ["¿Y el precio del jabón?", true, "clarify", null, false],
] as const;
let passed = 0;
for (const [text, hasQuote, expectedIntent, expectedQuantity, expectedPrevious] of cases) {
  const actual = await classify({
    text,
    hasQuote,
    productName: "Café molido 1 lb",
    signal: AbortSignal.timeout(20000),
  });
  const matched =
    actual.intent === expectedIntent &&
    actual.quantityText === expectedQuantity &&
    actual.usePrevious === expectedPrevious;
  if (matched) passed++;
  console.log(JSON.stringify({ text, matched, ...actual }));
}
console.log(
  JSON.stringify({
    model: catalogModelId,
    prompt: catalogPromptVersion,
    passed,
    total: cases.length,
  }),
);
if (passed < cases.length) process.exitCode = 1;
