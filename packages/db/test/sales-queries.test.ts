import { describe, expect, test } from "bun:test";

import {
  decodeSaleListCursor,
  encodeSaleListCursor,
  type SaleListCursor,
  saleListFilterFingerprint,
} from "../src/sales-queries.ts";

const saleId = "5312a3e6-7c91-486a-9233-0cf4d9d3dcc7";
// PostgreSQL `timestamptz` text, whose microseconds a JavaScript Date would truncate.
const createdAt = "2026-08-22 20:30:00.123456+00";

function encode(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

describe("sale list cursor", () => {
  test("round-trips the keyset position it was minted with", async () => {
    const filterFingerprint = await saleListFilterFingerprint("all");
    const cursor: SaleListCursor = { createdAt, filterFingerprint, id: saleId, version: 1 };

    const encoded = encodeSaleListCursor(cursor);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSaleListCursor(encoded, filterFingerprint)).toEqual(cursor);
  });

  test("rejects a tampered cursor instead of returning a plausible page", async () => {
    const filterFingerprint = await saleListFilterFingerprint("all");
    const tampered = [
      "not base64url!!",
      encode("a bare string"),
      Buffer.from("{not json", "utf8").toString("base64url"),
      encode({ createdAt, filterFingerprint, id: saleId, version: 2 }),
      encode({ createdAt: "2026-08-22T20:30:00.123Z", filterFingerprint, id: saleId, version: 1 }),
      encode({ createdAt: "not-a-date", filterFingerprint, id: saleId, version: 1 }),
      encode({
        createdAt: "2026-08-22 20:30:00.123456+05",
        filterFingerprint,
        id: saleId,
        version: 1,
      }),
      encode({ createdAt, filterFingerprint, id: "not-a-uuid", version: 1 }),
      encode({ createdAt, id: saleId, version: 1 }),
    ];

    for (const value of tampered) {
      expect(() => decodeSaleListCursor(value, filterFingerprint)).toThrow(
        "The page cursor is invalid for this query",
      );
    }
  });

  test("refuses a cursor minted for a different status filter", async () => {
    const postedFingerprint = await saleListFilterFingerprint("posted");
    const allFingerprint = await saleListFilterFingerprint("all");
    const cursor = encodeSaleListCursor({
      createdAt,
      filterFingerprint: postedFingerprint,
      id: saleId,
      version: 1,
    });

    expect(decodeSaleListCursor(cursor, postedFingerprint).id).toBe(saleId);
    expect(() => decodeSaleListCursor(cursor, allFingerprint)).toThrow(
      "The page cursor is invalid for this query",
    );
  });

  test("keeps one stable fingerprint per status and a distinct one across statuses", async () => {
    const fingerprints = await Promise.all([
      saleListFilterFingerprint("all"),
      saleListFilterFingerprint("all"),
      saleListFilterFingerprint("posted"),
      saleListFilterFingerprint("voided"),
    ]);

    expect(fingerprints[0]).toBe(fingerprints[1] as string);
    expect(new Set(fingerprints).size).toBe(3);
    for (const fingerprint of fingerprints) expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
