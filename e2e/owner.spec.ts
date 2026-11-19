import { type AssistantInterpretation, purchaseListResponseSchema } from "@pisto/contracts";
import { expect, type Page, test } from "@playwright/test";
import { apiOrigin } from "./environment.ts";

test.use({ storageState: "e2e/.auth/owner.json" });

async function remainingRice(page: Page): Promise<number> {
  await page.goto("/operate/sales/new");
  await page.getByRole("searchbox", { name: "Buscar producto" }).fill("Arroz");
  const result = page.getByRole("button", { name: /Agregar Arroz San Pedro/ });
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

test("hides the cached balance when refreshing the period loses access", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/operate");
  const balance = page.getByRole("region", { name: "Dinero disponible", exact: true });
  await expect(balance.getByText("Caja y bancos", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /7 días/ }).click();
  await expect(balance.getByText("Caja y bancos", { exact: true })).toBeVisible();
  await page.route("**/v1/reports/money-trend?range=30d", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: { code: "FORBIDDEN", message: "Access denied", requestId: "e2e-financial-refresh" },
      },
    }),
  );
  await page.clock.setFixedTime(new Date(Date.now() + 60_000));
  const denial = page.waitForResponse(
    (response) => response.url().includes("/money-trend?range=30d") && response.status() === 403,
  );
  await page.getByRole("radio", { name: /30 días/ }).click();
  await denial;
  await expect(page.getByRole("heading", { name: "No tiene acceso", exact: true })).toBeVisible();
  await expect(balance).toHaveCount(0);
});

test("records a cash sale and takes the product out of stock", async ({ page }) => {
  const before = await remainingRice(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/v1/sales/itemized"))
      writes.push(request.url());
  });
  await page.route("**/v1/assistant/status", (route) =>
    route.fulfill({ json: { data: { enabled: false, transcription: false } } }),
  );
  await page.goto("/operate");
  await page
    .getByRole("textbox", { name: "Pregunta sobre sus cuentas" })
    .fill("Quiero ingresar ventas");
  await page.getByRole("button", { name: "Consultar", exact: true }).click();
  const guide = page.getByRole("dialog");
  await expect(guide.getByRole("heading", { name: "Ingresar venta" })).toBeVisible();
  await guide.getByRole("searchbox", { name: "Buscar producto" }).fill("Arroz");
  await page.getByRole("button", { name: /Agregar Arroz San Pedro/ }).click();
  await expect(page).toHaveURL(/\/operate\/sales\/new\?productId=/);
  await page.getByRole("textbox", { name: "¿Cuánto le pagaron?" }).fill("0.95");
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Guardar venta" }).click();

  await expect(page.getByRole("heading", { name: /^Venta del/, level: 1 })).toBeVisible();
  await expect(page.getByText("Registrada")).toBeVisible();
  expect(writes).toHaveLength(1);
  await expect(page.getByRole("row", { name: /Arroz San Pedro 1 lb 1 \$0\.95/ })).toBeVisible();

  expect(await remainingRice(page)).toBe(before - 1);
});

test("lets the reviewer change a suggested supplier invoice and keep the payment amount", async ({
  page,
}) => {
  await page.route("**/v1/assistant/status", (route) =>
    route.fulfill({ json: { data: { enabled: true, transcription: false } } }),
  );
  const purchases = await page.request.get(
    `${apiOrigin}/v1/purchases?status=posted&payable=open&limit=50`,
  );
  expect(purchases.ok()).toBe(true);
  const open = purchaseListResponseSchema.parse(await purchases.json()).data.items;
  const [suggested, other] = open.filter(
    (purchase) => purchase.supplierName === "Distribuidora Centro" && purchase.invoiceNumber,
  );
  if (!suggested || !other)
    throw new Error("The demo requires two open invoices for one supplier.");

  const text = `Aboné un dólar a ${suggested.supplierName} por la factura ${suggested.invoiceNumber}`;
  const interpretation: AssistantInterpretation = {
    text,
    source: "text",
    spans: [],
    notices: [],
    unsupported: null,
    draft: {
      kind: "supplier_payment",
      occurredLocalDate: suggested.occurredAt.slice(0, 10),
      occurredLocalTime: "10:00",
      supplier: {
        heard: suggested.supplierName,
        match: { id: suggested.supplierId, name: suggested.supplierName, exact: true },
      },
      purchase: {
        id: suggested.id,
        invoiceNumber: suggested.invoiceNumber,
        balanceMinorUnits: suggested.balanceMinorUnits,
      },
      amountMinorUnits: "100",
      account: null,
    },
  };
  await page.route("**/v1/assistant/interpretations", (route) =>
    route.fulfill({ json: { data: { interpretation } } }),
  );
  await page.goto("/operate");
  await page.getByRole("textbox", { name: "Qué quiere registrar" }).fill(text);
  await page.getByRole("button", { name: "Revisar", exact: true }).click();
  await page
    .getByRole("button", { name: `Compra: ${suggested.supplierName} · ${suggested.invoiceNumber}` })
    .click();
  await page
    .getByRole("dialog")
    .getByText(`${other.supplierName} · ${other.invoiceNumber}`, { exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Compra: ${other.supplierName} · ${other.invoiceNumber}` }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Monto del pago" })).toHaveValue("1.00");
});
