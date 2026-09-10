import { describe, expect, test } from "bun:test";

import { decodeCashCursor } from "../src/cash/codec.ts";
import { decodeCursor as decodeCatalogCursor } from "../src/catalog/codec.ts";
import { isCursorTimestamp } from "../src/pagination.ts";
import { ProductError } from "../src/product-core.ts";
import { decodeCursor as decodeReceivableCursor } from "../src/receivables/codec.ts";
import { decodeSaleListCursor } from "../src/sales-queries.ts";

const id = "71402e0c-b17d-4d8c-83ae-8d163d10d51d";
function cursor(createdAt: string) {
  return Buffer.from(
    JSON.stringify({ createdAt, id, kind: "category", version: 1, filterFingerprint: "filter" }),
  ).toString("base64url");
}

describe("lossless cursor timestamps", () => {
  test("keeps real Gregorian dates and exact microseconds", () => {
    for (const value of [
      "2024-02-29 23:59:59.999999+00",
      "2000-02-29 00:00:00+00",
      "2026-09-10 12:00:00.000001+00",
    ]) {
      expect(isCursorTimestamp(value)).toBe(true);
      expect(decodeCashCursor(cursor(value)).createdAt).toBe(value);
      expect(decodeCatalogCursor(cursor(value), "category")?.createdAt).toBe(value);
      expect(decodeReceivableCursor(cursor(value), "filter").createdAt).toBe(value);
      expect(decodeSaleListCursor(cursor(value), "filter").createdAt).toBe(value);
    }
  });

  test("every decoder rejects impossible dates and times before PostgreSQL casts", () => {
    for (const value of [
      "2026-02-30 12:00:00.000001+00",
      "1900-02-29 12:00:00+00",
      "0000-01-01 00:00:00+00",
      "2026-13-01 00:00:00+00",
      "2026-01-00 00:00:00+00",
      "2026-09-10 24:00:00+00",
      "2026-09-10 12:60:00+00",
      "2026-09-10 12:00:60+00",
      "2026-09-10 12:00:00.0000001+00",
    ]) {
      expect(isCursorTimestamp(value)).toBe(false);
      expect(() => decodeCashCursor(cursor(value))).toThrow(ProductError);
      expect(() => decodeCatalogCursor(cursor(value), "category")).toThrow(ProductError);
      expect(() => decodeReceivableCursor(cursor(value), "filter")).toThrow(ProductError);
      expect(() => decodeSaleListCursor(cursor(value), "filter")).toThrow(ProductError);
    }
  });
});
