import { describe, expect, test } from "vitest";

import { DEFAULT_LOCALE, resolveSupportedLocale } from "@/i18n/locale";

describe("locale resolution", () => {
  test("uses Salvadoran Spanish for supported and unsupported device locales", () => {
    expect(resolveSupportedLocale([{ languageCode: "es", languageTag: "es-MX" }])).toBe(
      DEFAULT_LOCALE,
    );
    expect(resolveSupportedLocale([{ languageCode: "en", languageTag: "en-US" }])).toBe(
      DEFAULT_LOCALE,
    );
  });
});
