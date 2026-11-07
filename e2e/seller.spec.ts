import { expect, test } from "@playwright/test";
import { apiOrigin, webOrigin } from "./environment.ts";

test.use({ storageState: "e2e/.auth/seller.json" });

test("navigation lists only the modules a seller may use", async ({ page }) => {
  await page.goto("/operate");
  const navigation = page.getByRole("navigation").first();
  await expect(navigation.getByRole("link", { name: "Ventas" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Clientes" })).toBeVisible();
  for (const hidden of ["Caja y bancos", "Gastos", "Por pagar", "Reportes"]) {
    await expect(navigation.getByRole("link", { name: hidden })).toHaveCount(0);
  }
});

test("reports are refused on screen and by the server", async ({ page }) => {
  await page.goto("/operate/reports");
  await expect(page.getByRole("heading", { name: "No puede consultar reportes" })).toBeVisible();

  const response = await page.request.get(
    `${apiOrigin}/v1/reports/operating?startLocalDate=2026-11-01&endLocalDate=2026-11-07`,
    {
      headers: { origin: webOrigin },
    },
  );
  expect(response.status()).toBe(403);
});
