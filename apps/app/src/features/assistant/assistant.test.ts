import type { AssistantInterpretation, AssistantSaleDraft } from "@pisto/contracts";
import { assistantInterpretationSchema } from "@pisto/contracts";
import { createInstance, type TFunction } from "i18next";
import { beforeEach, describe, expect, test } from "vitest";

import { esSV } from "@/i18n/resources/es-SV";
import { ApiClientError } from "@/lib/api-error";
import { noticeMessage } from "./notices";
import { assistantProblem } from "./problems";
import { reviewStore } from "./review-store";
import { downsample, encodeWav, levelOf } from "./wav";

const translator = createInstance();
translator.init({
  initAsync: false,
  lng: "es-SV",
  resources: { "es-SV": { translation: esSV } },
});
const t = translator.t.bind(translator) as TFunction;

const sale: AssistantSaleDraft = {
  kind: "sale",
  occurredLocalDate: "2026-11-02",
  occurredLocalTime: "10:15",
  customer: { heard: "don Carlos", match: null },
  lines: [
    {
      heard: "café",
      product: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Café molido 1 lb",
        exact: false,
      },
      quantityMinorUnits: "3",
      quantityPrecision: 0,
      unitAmountMinorUnits: "325",
      subtotalMinorUnits: "975",
    },
  ],
  totalMinorUnits: "975",
  receivedMinorUnits: "500",
  creditMinorUnits: "475",
  paymentMethod: "cash",
  account: null,
  dueDate: null,
  description: null,
};

describe("notice sentences", () => {
  test("name the record each notice refers to", () => {
    expect(
      noticeMessage(t, { code: "similar_match", field: "customer", lineIndex: null }, sale),
    ).toBe("Hay varios clientes parecidos a «don Carlos»; elija uno.");
    expect(noticeMessage(t, { code: "similar_match", field: "product", lineIndex: 0 }, sale)).toBe(
      "Confirme que «café» es Café molido 1 lb.",
    );
    expect(
      noticeMessage(t, { code: "insufficient_stock", field: "quantity", lineIndex: 0 }, sale),
    ).toBe("No hay suficientes existencias de Café molido 1 lb.");
    expect(noticeMessage(t, { code: "missing", field: "account", lineIndex: null }, sale)).toBe(
      "No hay una cuenta para esa forma de pago; elija una.",
    );
    expect(
      noticeMessage(t, { code: "exceeds_total", field: "received", lineIndex: null }, sale),
    ).toBe("Lo recibido es mayor que el total de la venta.");
  });

  test("never render an untranslated key for any code and field", () => {
    const codes = [
      "missing",
      "not_found",
      "similar_match",
      "exceeds_total",
      "insufficient_stock",
      "not_permitted",
    ] as const;
    const fields = [
      "kind",
      "customer",
      "product",
      "quantity",
      "amount",
      "credit",
      "invoice",
    ] as const;
    for (const code of codes) {
      for (const field of fields) {
        for (const lineIndex of [null, 0]) {
          const message = noticeMessage(t, { code, field, lineIndex }, sale);
          expect(message).not.toMatch(/^assistant\./);
          expect(message.length).toBeGreaterThan(5);
        }
      }
    }
  });
});

describe("assistant problems", () => {
  test("map transport, budget, permission and provider failures", () => {
    expect(assistantProblem(new ApiClientError("x", 0))).toBe("offline");
    expect(assistantProblem(new ApiClientError("x", 429, "RATE_LIMITED"))).toBe("rateLimited");
    expect(assistantProblem(new ApiClientError("x", 403, "FORBIDDEN"))).toBe("denied");
    expect(assistantProblem(new ApiClientError("x", 503, "SERVICE_UNAVAILABLE"))).toBe("provider");
    expect(assistantProblem(new Error("x"))).toBe("unexpected");
  });
});

describe("review store", () => {
  const interpretation: AssistantInterpretation = assistantInterpretationSchema.parse({
    text: "Le vendí a don Carlos tres libras de café",
    source: "voice",
    spans: [],
    draft: sale,
    unsupported: null,
    notices: [],
  });

  beforeEach(() => reviewStore.clear());

  test("keeps one draft per business and counts revisions", () => {
    reviewStore.set({ businessId: "business_a", interpretation });
    const first = reviewStore.get();
    reviewStore.set({ businessId: "business_a", interpretation });
    expect(reviewStore.get()?.revision).toBe((first?.revision ?? 0) + 1);
    reviewStore.clear();
    expect(reviewStore.get()).toBeNull();
  });
});

describe("WAV capture", () => {
  test("downsamples by averaging each window and encodes 16-bit mono PCM", () => {
    const input = new Float32Array([0, 0.3, 0.6, 1, 1, 1]);
    expect([...downsample(input, 48_000, 16_000)].map((value) => value.toFixed(2))).toEqual([
      "0.30",
      "1.00",
    ]);
    const wav = encodeWav(new Float32Array([0, 1, -1, 2]), 16_000);
    const view = new DataView(wav.buffer);
    const ascii = (offset: number) => String.fromCharCode(...wav.subarray(offset, offset + 4));
    expect([ascii(0), ascii(8), ascii(12), ascii(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((index) => view.getInt16(44 + index * 2, true))).toEqual([
      0, 32767, -32768, 32767,
    ]);
  });

  test("reports silence as zero and loud input as a full level", () => {
    expect(levelOf(new Float32Array(128))).toBe(0);
    expect(levelOf(new Float32Array(128).fill(0.9))).toBe(1);
  });
});
