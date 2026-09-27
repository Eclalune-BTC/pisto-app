import { readFileSync } from "node:fs";
import { createInstance } from "i18next";
import { describe, expect, test, vi } from "vitest";

vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import { formatBusinessLocalDate } from "@/features/receivables/presentation";
import { i18n } from "./config";
import { formatMonthYear } from "./format";
import { DEFAULT_LOCALE, requireSupportedLocale, resolveSupportedLocale } from "./locale";
import { esSV } from "./resources/es-SV";

describe("strict translation configuration", () => {
  test("configures the actual single-page HTML template in the supported language", () => {
    const { expo } = JSON.parse(readFileSync(new URL("../../app.json", import.meta.url), "utf8"));
    const html = readFileSync(new URL("../../public/index.html", import.meta.url), "utf8");
    expect(expo.web).toMatchObject({ output: "single", lang: DEFAULT_LOCALE });
    expect(html).toContain(`lang="${DEFAULT_LOCALE}"`);
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain("<noscript>Activa JavaScript para usar Pisto.</noscript>");
  });
  function translator() {
    const instance = createInstance();
    instance.init({
      ...i18n.options,
      initAsync: false,
      resources: { "es-SV": { translation: structuredClone(esSV) } },
    });
    return instance;
  }

  test.each(["development", "production"])("rejects missing keys in %s", (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    try {
      expect(() => translator().t("missing.key" as never)).toThrow("Missing es-SV translation key");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("rejects missing interpolation and object keys instead of rendering placeholders", () => {
    const instance = translator();
    expect(() => instance.t("sales.headerDescription")).toThrow("interpolation value is missing");
    expect(() => instance.t("catalog" as never)).toThrow("must resolve to text");
    expect(instance.t("sales.headerDescription", { business: "Tienda Luna" })).toContain(
      "Tienda Luna",
    );
  });

  test.each(["", null])("rejects a missing textual resource: %s", (value) => {
    const instance = translator();
    instance.addResource("es-SV", "translation", "invalidFixture", value as never);
    expect(() => instance.t("invalidFixture" as never)).toThrow("Missing es-SV translation key");
  });

  test("has only nonempty textual leaves and complete Spanish plural pairs", () => {
    const visit = (value: unknown) => {
      if (typeof value === "string") {
        expect(value.trim().length).toBeGreaterThan(0);
        return;
      }
      expect(value).not.toBeNull();
      expect(typeof value).toBe("object");
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key.endsWith("_one")) expect(value).toHaveProperty(`${key.slice(0, -4)}_other`);
        if (key.endsWith("_other")) expect(value).toHaveProperty(`${key.slice(0, -6)}_one`);
        visit(child);
      }
    };
    visit(esSV);
  });

  test("keeps device-language selection separate from missing runtime configuration", () => {
    expect(resolveSupportedLocale([{ languageTag: "en-US" }])).toBe("es-SV");
    expect(requireSupportedLocale("es-SV")).toBe("es-SV");
    for (const value of [undefined, "", "en-US"]) {
      expect(() => requireSupportedLocale(value)).toThrow("locale is not initialized or supported");
    }
  });
});

describe("business calendar formatting", () => {
  test("preserves early years without Date.UTC century coercion", () => {
    expect(formatBusinessLocalDate("0099-01-02", "en-US")).toBe("Jan 2, 99");
    expect(formatMonthYear("0099-01-02", "en-US")).toBe("January 99");
    expect(formatMonthYear("2026-01-01", "es-SV")).toBe("enero de 2026");
  });

  test.each(["invalid", "0000-01-01", "2026-02-30", "2026-1-1", ""])(
    "rejects %s instead of displaying the raw input",
    (value) => {
      expect(() => formatBusinessLocalDate(value, "es-SV")).toThrow();
      expect(() => formatMonthYear(value, "es-SV")).toThrow();
    },
  );
});
