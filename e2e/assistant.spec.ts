import { expect, test } from "@playwright/test";

test.use({
  storageState: "e2e/.auth/owner.json",
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

test("keeps the same draft when the workspace changes width", async ({ page }) => {
  await page.route("**/v1/assistant/status", (route) =>
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
  await page.route("**/v1/assistant/status", (route) =>
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
            ...input,
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
  await expect.poll(() => interpretations).toEqual([{ text: corrected, source: "voice" }]);
});

test("answers financial questions with the business records when model extraction is disabled", async ({
  page,
}) => {
  let modelCalls = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/v1/assistant/interpretations")) modelCalls++;
  });
  await page.route("**/v1/assistant/status", (route) =>
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
  await page.getByRole("link", { name: "¿Quién me debe?" }).click();
  await expect(page).toHaveURL(/\/operate\/receivables$/);
  await page.goto("/operate");
  await page.getByRole("link", { name: "¿Qué facturas debo?" }).click();
  await expect(page).toHaveURL(/\/operate\/payables\?payable=open$/);
  expect(modelCalls).toBe(0);
});
