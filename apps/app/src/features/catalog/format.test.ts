import { describe, expect, test, vi } from "vitest";

vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import { i18n } from "@/i18n/config";
import { quantityText, signedQuantityText } from "./format";

const t = i18n.t;

describe("catalog quantities", () => {
  test("names the unit for every Spanish plural category, including exact millions", () => {
    expect(quantityText(t, "es-SV", { minorUnits: "1", precision: 0, unitKind: "unit" })).toBe(
      "1 unidad",
    );
    expect(quantityText(t, "es-SV", { minorUnits: "12", precision: 0, unitKind: "unit" })).toBe(
      "12 unidades",
    );
    expect(
      quantityText(t, "es-SV", { minorUnits: "1000000", precision: 0, unitKind: "unit" }),
    ).toBe("1,000,000 unidades");
    expect(
      quantityText(t, "es-SV", { minorUnits: "2000000000", precision: 3, unitKind: "unit" }),
    ).toBe("2,000,000.000 unidades");
  });

  test("keeps every digit of a signed change and writes a true minus sign", () => {
    expect(
      signedQuantityText(t, "es-SV", {
        deltaMinorUnits: "-1500",
        precision: 3,
        unitKind: "kilogram",
      }),
    ).toBe("−1.500 kg");
    expect(
      signedQuantityText(t, "es-SV", {
        deltaMinorUnits: "9223372036854775807",
        precision: 0,
        unitKind: "liter",
      }),
    ).toBe("+9,223,372,036,854,775,807 L");
  });
});
