import { expect, test } from "@playwright/test";

test("plays the shop film, seeks to the recorded balance and pauses", async ({ page }) => {
  await page.goto("/#how");
  const video = page.getByLabel("Vídeo de ejemplo de una venta de café en Pisto");
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Reproducir la venta de café" }).click();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "Guardar la venta", exact: true }).click();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThanOrEqual(13);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.duration)).toBe(18);
  await video.evaluate((element: HTMLVideoElement) => element.pause());
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
});

test("browses the module photos by touch and keyboard and opens the seller permissions", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.goto("/#modules");
    const panel = page.getByRole("tabpanel", { name: "Movimientos" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Venta a Rosa Ayala", { exact: true })).toBeVisible();
    await panel.getByRole("radio", { name: /Ayer/ }).click();
    await expect(panel.getByText("Venta a Comedor El Pilar", { exact: true })).toBeVisible();
    await panel.getByRole("radio", { name: /Hoy/ }).click();
    const photo = panel.locator("img").first();
    await photo.scrollIntoViewIfNeeded();
    const box = await photo.boundingBox();
    if (!box) throw new Error("The carousel photo must be visible.");
    const x = box.x + box.width * 0.8,
      y = box.y + box.height / 2;
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (const delta of [20, 45, 80, 130]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x - delta, y }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByRole("tab", { name: "Reportes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: "Reportes" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Por cobrar" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("button", { name: "Módulo siguiente" }).click();
    await expect(page.getByRole("tabpanel", { name: "Por pagar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Módulo siguiente" })).toBeDisabled();
    await page.getByRole("button", { name: "Módulo anterior" }).click();
    await expect(page.getByRole("tabpanel", { name: "Por cobrar" })).toBeVisible();
    const seller = page.getByRole("button", { name: "Vendedor", exact: true });
    await seller.click();
    const jobs = page.getByRole("list", { name: "Vendedor", exact: true });
    await expect(jobs.getByText("Registrar ventas", { exact: true })).toBeVisible();
    await expect(jobs.getByRole("listitem")).toHaveCount(1);
  } finally {
    await context.close();
  }
});
