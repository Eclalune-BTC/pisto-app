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
  const field = page.getByRole("textbox", { name: "Mensaje para Coco" });
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
  await page.getByRole("textbox", { name: "Mensaje para Coco" }).fill(firstQuestion);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
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
  const composer = page.getByRole("textbox", { name: "Mensaje para Coco" });
  const send = page.getByRole("button", { name: "Enviar", exact: true });
  const dialog = page.getByRole("dialog");
  await composer.fill("¿Va a llover mañana?");
  await send.click();
  await expect(page.getByText("Con el asistente apagado puede", { exact: false })).toBeVisible();
  await expect(dialog).toHaveCount(0);

  await composer.fill("¿Cuánto vendí el mes pasado?");
  const answered = page.waitForResponse((response) =>
    response.url().includes("/v1/assistant/answers?"),
  );
  await send.click();
  const first = await answered;
  expect(first.status()).toBe(200);
  expect(new URL(first.url()).searchParams.get("period")).toBe("last_month");
  await expect(dialog.getByText("¿Cuánto vendí el mes pasado?", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(/^El mes pasado vendió \$[\d,]+\.\d{2} en \d+ ventas\.$/),
  ).toBeVisible();

  // The period control reads the same question again without a model.
  await dialog.getByRole("radio", { name: "Período de la respuesta: Este mes" }).click();
  await expect(
    dialog.getByText(/^(Este mes vendió \$|No hay ventas registradas este mes\.)/),
  ).toBeVisible();

  const follow = dialog.getByRole("textbox", { name: "Pregunta para Coco" });
  await follow.fill("¿Quién me debe?");
  await follow.press("Enter");
  await expect(
    dialog.getByText(/^(Le deben \$|Un cliente le debe \$|Nadie le debe en este momento\.)/),
  ).toBeVisible();
  await dialog.getByRole("link", { name: "Abrir Por cobrar" }).click();
  await expect(page).toHaveURL(/\/operate\/receivables$/);
  await expect(dialog).toHaveCount(0);

  await page.goto("/operate");
  await page.getByRole("button", { name: "Herramientas", exact: true }).click();
  await dialog.getByRole("button", { name: "¿Qué facturas debo?" }).click();
  await expect(
    dialog.getByText(/^(Debe \$[\d,]+\.\d{2} de |No le debe a ningún proveedor\.)/),
  ).toBeVisible();
  await dialog.getByRole("link", { name: "Abrir Por pagar" }).click();
  await expect(page).toHaveURL(/\/operate\/payables\?payable=open$/);
  expect(modelCalls).toBe(0);
});

test("answers a question the model classified and declines one it cannot answer", async ({
  page,
}) => {
  const interpretation = (text: string, extra: object) => ({
    data: {
      interpretation: { text, source: "text", spans: [], notices: [], draft: null, ...extra },
    },
  });
  await page.route("**/v1/assistant/status*", (route) =>
    route.fulfill({ json: { data: { enabled: true, transcription: false } } }),
  );
  await page.route("**/v1/assistant/interpretations", (route) => {
    const { text } = route.request().postDataJSON();
    if (text === "¿Qué tal estuvo el negocio estos días?") {
      return route.fulfill({
        json: interpretation(text, {
          unsupported: null,
          tool: { name: "answer_question", topic: "summary", period: "last_7_days" },
        }),
      });
    }
    return route.fulfill({ json: interpretation(text, { unsupported: "not_a_record" }) });
  });
  await page.goto("/operate");
  await page
    .getByRole("textbox", { name: "Mensaje para Coco" })
    .fill("¿Qué tal estuvo el negocio estos días?");
  const answered = page.waitForResponse((response) =>
    response.url().includes("/v1/assistant/answers?"),
  );
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  const response = await answered;
  expect(response.status()).toBe(200);
  const request = new URL(response.url()).searchParams;
  expect([request.get("topic"), request.get("period")]).toEqual(["summary", "last_7_days"]);
  const { answer } = (await response.json()).data;
  expect(answer.period.key).toBe("last_7_days");

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(/^(En los últimos 7 días vendió \$|No hay ventas ni gastos registrados)/),
  ).toBeVisible();
  if (answer.saleCount !== "0" || answer.expenseCount !== "0") {
    await expect(dialog.getByText("no es la ganancia", { exact: false })).toBeVisible();
  }
  await expect(
    dialog.getByRole("radio", { name: "Período de la respuesta: 7 días" }),
  ).toBeChecked();

  const follow = dialog.getByRole("textbox", { name: "Pregunta para Coco" });
  await follow.fill("¿Me conviene subir los precios?");
  await follow.press("Enter");
  await expect(dialog.getByText("Todavía no sé responder eso.", { exact: false })).toBeVisible();
  await expect(follow).toBeFocused();

  // A failed read is an error with a retry, never an empty answer.
  await page.route("**/v1/assistant/answers*", (route) =>
    route.fulfill({
      status: 500,
      json: { error: { code: "INTERNAL_ERROR", message: "Unexpected", requestId: "e2e-answer" } },
    }),
  );
  await dialog.getByRole("button", { name: "¿Cuánto tengo en caja?" }).click();
  await expect(dialog.getByText("No pudimos leer sus registros.", { exact: false })).toBeVisible({
    timeout: 30_000,
  });
  await expect(dialog.getByText(/^Tiene \$/)).toHaveCount(0);
  await page.unroute("**/v1/assistant/answers*");
  await dialog.getByRole("button", { name: "Volver a intentar" }).click();
  await expect(dialog.getByText(/^(Tiene \$|Todavía no tiene cuentas)/)).toBeVisible();

  // Without a connection the question waits with a way to ask again.
  await page.context().setOffline(true);
  await dialog.getByRole("button", { name: "¿Quién me debe?" }).click();
  await expect(dialog.getByText("Sin conexión.", { exact: false })).toBeVisible();
  // The paused read resumes by itself once the connection returns.
  await page.context().setOffline(false);
  await expect(
    dialog.getByText(/^(Le deben \$|Un cliente le debe \$|Nadie le debe en este momento\.)/),
  ).toBeVisible({ timeout: 20_000 });
});
