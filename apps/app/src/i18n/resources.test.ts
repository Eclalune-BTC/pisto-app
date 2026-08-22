import { createInstance } from "i18next";
import { describe, expect, test } from "vitest";

import { esSV } from "@/i18n/resources/es-SV";

describe("Spanish translation catalog", () => {
  test("interpolates values and selects Spanish plurals", () => {
    const translator = createInstance();
    translator.init({
      initAsync: false,
      lng: "es-SV",
      resources: { "es-SV": { translation: esSV } },
    });
    expect(translator.t("sales.headerDescription", { business: "Tienda Luna" })).toContain(
      "Tienda Luna",
    );
    expect(translator.t("billing.accessCount", { count: 1 })).toBe(
      "Encontramos un acceso activo para tu cuenta.",
    );
    expect(translator.t("billing.accessCount", { count: 2 })).toBe(
      "Encontramos 2 accesos activos para tu cuenta.",
    );
  });
});
