/// <reference types="vite/client" />
import { createInstance } from "i18next";
import { describe, expect, test } from "vitest";

import { resolveMissingTranslation } from "@/i18n/missing-key";
import { esSV } from "@/i18n/resources/es-SV";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
/** A quoted key such as "cash.overview.title" written anywhere in the source. */
const LITERAL_KEY = /"([a-z][A-Za-z0-9]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+)"/g;
/** A key built at runtime, such as `billing.returnTitle.${state}`. */
const TEMPLATE_KEY_PREFIX = /`([a-z][A-Za-z0-9]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.\$\{/g;

function catalogKeys(value: unknown, prefix: string[] = []): string[] {
  if (typeof value !== "object" || value === null) {
    const path = [...prefix];
    const last = path.pop();
    return last === undefined ? [] : [[...path, last.replace(PLURAL_SUFFIX, "")].join(".")];
  }
  return Object.entries(value).flatMap(([key, child]) => catalogKeys(child, [...prefix, key]));
}

const sources = import.meta.glob("../**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const declaredKeys = new Set(catalogKeys(esSV));
const referencedKeys = new Set<string>();
const referencedPrefixes = new Set<string>();
const namespaces = new Set([...declaredKeys].map((key) => key.split(".")[0]));

for (const [path, source] of Object.entries(sources)) {
  if (path.includes("/resources/") || path.endsWith(".test.ts")) continue;
  for (const [, key] of source.matchAll(LITERAL_KEY)) {
    if (key && namespaces.has(key.split(".")[0])) referencedKeys.add(key);
  }
  for (const [, prefix] of source.matchAll(TEMPLATE_KEY_PREFIX)) {
    if (prefix && namespaces.has(prefix.split(".")[0])) referencedPrefixes.add(prefix);
  }
}

function isReferenced(key: string): boolean {
  if (referencedKeys.has(key)) return true;
  for (const prefix of referencedPrefixes) {
    if (key.startsWith(`${prefix}.`)) return true;
  }
  return false;
}

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
    expect(translator.t("inventory.movementEditor.precisionHint", { count: 1 })).toBe(
      "Este producto acepta hasta 1 decimal.",
    );
    expect(translator.t("inventory.movementEditor.precisionHint", { count: 2 })).toBe(
      "Este producto acepta hasta 2 decimales.",
    );
  });

  test("declares every key the application reads", () => {
    const missing = [...referencedKeys].filter((key) => !declaredKeys.has(key)).sort();

    expect(missing).toEqual([]);
  });

  test("keeps no orphan key that nothing renders", () => {
    const orphans = [...declaredKeys].filter((key) => !isReferenced(key)).sort();

    expect(orphans).toEqual([]);
  });

  test("scans a realistic amount of application source", () => {
    expect(declaredKeys.size).toBeGreaterThan(500);
    expect(referencedKeys.size).toBeGreaterThan(500);
  });
});

describe("missing translation guard", () => {
  test("fails loudly outside production", () => {
    expect(() => resolveMissingTranslation("cash.overview.unknown")).toThrow(
      "Missing es-SV translation key: cash.overview.unknown",
    );
  });

  test("never renders a raw key path in a release build", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(resolveMissingTranslation("cash.overview.unknown")).toBe("");
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
