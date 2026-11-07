import { expect, type Page, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/owner.json" });

async function remainingRice(page: Page): Promise<number> {
  await page.goto("/operate/sales/new");
  await page.getByRole("searchbox", { name: "Buscar producto" }).fill("Arroz");
  const result = page.getByRole("listitem", { name: /Agregar Arroz San Pedro/ });
  const text = await result.textContent();
  const units = text?.match(/Quedan (\d+) unidades/)?.[1];
  if (!units) throw new Error(`No stock count in the product result: ${text}`);
  return Number(units);
}

test("shows the business at a glance", async ({ page }) => {
  await page.goto("/operate");
  await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible();
  await expect(page.getByText("Dinero disponible").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Movimientos de hoy" })).toBeVisible();
});

test("records a cash sale and takes the product out of stock", async ({ page }) => {
  const before = await remainingRice(page);

  await page.getByRole("listitem", { name: /Agregar Arroz San Pedro/ }).click();
  await page.getByRole("textbox", { name: "¿Cuánto le pagaron?" }).fill("0.95");
  await page.getByRole("button", { name: "Guardar venta" }).click();

  await expect(page.getByRole("heading", { name: /^Venta del/, level: 1 })).toBeVisible();
  await expect(page.getByText("Registrada")).toBeVisible();
  await expect(page.getByRole("row", { name: /Arroz San Pedro 1 lb 1 \$0\.95/ })).toBeVisible();

  expect(await remainingRice(page)).toBe(before - 1);
});
