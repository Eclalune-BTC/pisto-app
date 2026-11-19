import { expect, test } from "@playwright/test";

test.use({
  storageState: "e2e/.auth/owner.json",
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

test("keeps the same draft when the workspace changes width", async ({ page }) => {
  await page.route("**/v1/assistant/status*", (route) =>
    route.fulfill({ json: { data: { enabled: true, transcription: true } } }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/operate");
  const field = page.getByRole("textbox", { name: "Qué quiere registrar" });
  await field.fill("Vendí tres libras de café");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(field).toHaveValue("Vendí tres libras de café");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(field).toHaveValue("Vendí tres libras de café");
});

test("reviews the complete recording before using the corrected words", async ({ page }) => {
  const audio: Buffer[] = [];
  const interpretations: unknown[] = [];
  const transcript = `${"Compré café. ".repeat(85)}La factura termina en 050.`;
  await page.route("**/v1/assistant/status*", (route) =>
    route.fulfill({ json: { data: { enabled: true, transcription: true } } }),
  );
  await page.route("**/v1/assistant/transcriptions", (route) => {
    const body = route.request().postDataBuffer();
    if (body && route.request().headers()["content-type"] === "audio/wav") audio.push(body);
    return route.fulfill({ json: { data: { text: transcript } } });
  });
  await page.route("**/v1/assistant/interpretations", (route) => {
    const input = route.request().postDataJSON();
    interpretations.push(input);
    return route.fulfill({
      json: {
        data: {
          interpretation: {
            text: input.text,
            source: input.source,
            spans: [],
            notices: [],
            draft: null,
            unsupported: "not_a_record",
          },
        },
      },
    });
  });
  await page.goto("/operate");
  const dictate = page.getByRole("button", { name: "Dictar con el micrófono" });
  await dictate.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Grabando su voz")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  expect(audio).toHaveLength(0);
  await dictate.click();
  await expect(dialog.getByText("0:01", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Detener grabación" }).click();
  const editor = dialog.getByRole("textbox", { name: "Lo que escuchamos" });
  await expect(editor).toHaveValue(transcript);
  const useText = dialog.getByRole("button", { name: "Usar este texto" });
  await expect(useText).toBeDisabled();
  expect(audio).toHaveLength(1);
  const wav = audio[0];
  expect(wav?.toString("ascii", 0, 4)).toBe("RIFF");
  expect(wav?.toString("ascii", 8, 12)).toBe("WAVE");
  expect(wav?.readUInt16LE(22)).toBe(1);
  expect(wav?.readUInt32LE(24)).toBe(16000);
  expect(wav?.length).toBeGreaterThan(44);
  expect(interpretations).toEqual([]);
  const corrected = "Pagué 64 dólares de luz";
  await editor.fill(corrected);
  await useText.click();
  await expect
    .poll(() => interpretations)
    .toEqual([
      {
        text: corrected,
        source: "voice",
        allowTools: true,
        expectedBusinessId: expect.any(String),
      },
    ]);
});

test("keeps the catalog product and quantity through a quote, acceptance and editable sale", async ({
  page,
}) => {
  const firstQuestion = "¿Cuánto cuestan tres bolsas de café molido?";
  await page.route("**/v1/assistant/interpretations", (route) =>
    route.fulfill({
      json: {
        data: {
          interpretation: {
            text: firstQuestion,
            source: "text",
            spans: [],
            draft: null,
            unsupported: null,
            notices: [],
            tool: { name: "find_product", query: "café molido" },
          },
        },
      },
    }),
  );
  await page.route("**/v1/assistant/status*", (route) =>
    route.fulfill({
      json: { data: { enabled: true, transcription: true, catalogConversation: true } },
    }),
  );
  const turns: Array<{ text: string; previousQuantity: string | null }> = [];
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/v1/sales/itemized")) writes.push(r.url());
  });
  await page.route("**/v1/assistant/catalog-turns", async (route) => {
    const req = route.request().postDataJSON();
    turns.push({ text: req.text, previousQuantity: req.previousQuantity });
    const detail = await page.request.get(
      new URL(`/v1/catalog/products/${req.productId}`, route.request().url()).href,
    );
    const { data } = await detail.json();
    expect(data.businessId).toBe(req.expectedBusinessId);
    const reply =
      req.text === "¿Cuántas quedan?"
        ? { kind: "stock" }
        : {
            kind: req.text === firstQuestion ? "quote" : "prepare_sale",
            quantity: "3",
            quantityMinorUnits: "3",
            totalMinorUnits: "975",
          };
    await route.fulfill({ json: { data: { ...data, reply } } });
  });
  await page.goto("/operate");
  await page.getByRole("textbox", { name: "Qué quiere registrar" }).fill(firstQuestion);
  await page.getByRole("button", { name: "Revisar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Café molido 1 lb" })).toBeVisible();
  const follow = dialog.getByRole("textbox", { name: "Preguntarle a Coco sobre este producto" });
  await expect(dialog.getByText(/3 unidades salen en \$9\.75/)).toBeVisible();
  await follow.fill("¿Cuántas quedan?");
  await follow.press("Enter");
  await expect(dialog.getByText(/En este momento quedan|no lleva el conteo/)).toBeVisible();
  await follow.fill("Sí, agréguelas");
  await follow.press("Enter");
  await expect(dialog.getByText(/La venta de 3 unidades suma \$9\.75/)).toBeVisible();
  await dialog.getByRole("button", { name: "Revisar venta", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "¿Cuánto le pagaron?" })).toHaveValue("9.75");
  expect(turns).toEqual([
    { text: firstQuestion, previousQuantity: null },
    { text: "¿Cuántas quedan?", previousQuantity: "3" },
    { text: "Sí, agréguelas", previousQuantity: "3" },
  ]);
  expect(writes).toEqual([]);
});

test("rereads the selected product before filling a second sale from the catalog", async ({
  page,
}) => {
  await page.goto("/operate");
  const selectRice = async () => {
    await page.getByRole("button", { name: "Ingresar venta", exact: true }).click();
    const guide = page.getByRole("dialog");
    await guide.getByRole("searchbox", { name: "Buscar producto" }).fill("arroz");
    await guide.getByRole("button", { name: /Agregar Arroz San Pedro/ }).click();
  };
  await selectRice();
  const paid = page.getByRole("textbox", { name: "¿Cuánto le pagaron?" });
  await expect(paid).toHaveValue("0.95");
  const productId = new URL(page.url()).searchParams.get("productId");
  expect(productId).toBeTruthy();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible();
  const detail = `**/v1/catalog/products/${productId}`;
  let finish!: () => void;
  const released = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route(detail, async (route) => {
    await released;
    await route.fulfill({
      status: 404,
      json: {
        error: {
          code: "NOT_FOUND",
          message: "Product unavailable",
          requestId: "e2e-selected-product",
        },
      },
    });
  });
  const reading = page.waitForRequest(detail);
  await selectRice();
  await reading;
  try {
    await expect(paid).toHaveCount(0);
  } finally {
    finish();
  }
  await expect(
    page.getByText("El producto elegido ya no está disponible.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Arroz San Pedro 1 lb", { exact: true })).toHaveCount(0);
  await expect(paid).toHaveValue("");
});

test("answers financial questions with the business records when model extraction is disabled", async ({
  page,
}) => {
  let modelCalls = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/v1/assistant/interpretations")) modelCalls++;
  });
  await page.route("**/v1/assistant/status*", (route) =>
    route.fulfill({ json: { data: { enabled: false, transcription: false } } }),
  );
  await page.goto("/operate");
  await page
    .getByRole("textbox", { name: "Pregunta sobre sus cuentas" })
    .fill("¿Cuánto vendí el mes pasado?");
  const answer = page.waitForResponse("**/v1/sales/summary/previous-month");
  await page.getByRole("button", { name: "Consultar", exact: true }).click();
  expect((await answer).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "¿Cuánto vendí el mes pasado?" })).toBeVisible();
  await expect(page.getByText("Promedio por venta", { exact: true })).toBeVisible();
  await page.goto("/operate");
  await page.getByRole("button", { name: "Herramientas", exact: true }).click();
  await page.getByRole("link", { name: "¿Quién me debe?" }).click();
  await expect(page).toHaveURL(/\/operate\/receivables$/);
  await page.goto("/operate");
  await page.getByRole("button", { name: "Herramientas", exact: true }).click();
  await page.getByRole("link", { name: "¿Qué facturas debo?" }).click();
  await expect(page).toHaveURL(/\/operate\/payables\?payable=open$/);
  expect(modelCalls).toBe(0);
});
