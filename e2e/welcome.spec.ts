import { expect, type Locator, test } from "@playwright/test";

test("plays both films inside the page, seeks by chapter and pauses", async ({ page }) => {
  await page.goto("/#how");
  const time = (film: Locator) => film.evaluate((element: HTMLVideoElement) => element.currentTime);
  const tour = page.getByLabel("Vídeo del recorrido completo por Pisto");
  await expect(tour).toBeVisible();
  await expect(page.getByRole("tab", { name: /Recorrido completo\s*1:15/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("Toda la tienda en un minuto", { exact: false })).toBeVisible();
  await expect.poll(() => tour.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Reproducir el recorrido completo" }).click();
  await expect.poll(() => time(tour)).toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "Coco, su asistente", exact: true }).click();
  await expect.poll(() => time(tour)).toBeGreaterThanOrEqual(47);
  await expect.poll(() => tour.evaluate((element: HTMLVideoElement) => element.duration)).toBe(75);

  // Choosing the other film replaces the player, so the first one stops.
  await page.getByRole("tab", { name: /Una venta de café\s*0:18/ }).click();
  await expect(tour).toHaveCount(0);
  await expect(
    page.getByText("Tres libras de café, cinco dólares", { exact: false }),
  ).toBeVisible();
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
