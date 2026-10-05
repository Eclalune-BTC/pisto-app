import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";

import { ProductError } from "../src/errors.ts";
import { sha256Hex } from "../src/operation-log.ts";
import {
  decodeCursor,
  decodeOccurrenceCursor,
  encodeCursor,
  encodeOccurrenceCursor,
  isCursorTimestamp,
  keysetBefore,
  listFilterFingerprint,
  occurrenceKeysetBefore,
  pageOccurrenceRows,
  pageRows,
} from "../src/pagination.ts";
import { sale } from "../src/schema/sales.ts";

const id = "71402e0c-b17d-4d8c-83ae-8d163d10d51d";
// PostgreSQL `timestamptz` text, whose microseconds a JavaScript Date would truncate.
const createdAt = "2026-08-22 20:30:00.123456+00";

function encode(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

describe("lossless cursor timestamps", () => {
  test("keeps real Gregorian dates and exact microseconds", () => {
    for (const value of [
      "2024-02-29 23:59:59.999999+00",
      "2000-02-29 00:00:00+00",
      "2026-09-10 12:00:00.000001+00",
    ]) {
      expect(isCursorTimestamp(value)).toBe(true);
      expect(decodeCursor(encodeCursor({ createdAt: value, id }, "filter"), "filter")).toEqual({
        createdAt: value,
        id,
      });
    }
  });

  test("rejects impossible dates and times before PostgreSQL casts", () => {
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
      "2026-08-22 20:30:00.123456+05",
      "2026-08-22T20:30:00.123Z",
    ]) {
      expect(isCursorTimestamp(value)).toBe(false);
      expect(() =>
        decodeCursor(encode({ createdAt: value, filterFingerprint: "f", id, version: 1 }), "f"),
      ).toThrow(ProductError);
    }
  });
});

describe("opaque keyset cursor", () => {
  test("round-trips the position it was minted with and stays opaque", () => {
    const cursor = encodeCursor({ createdAt, id }, "filter");
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor).not.toContain(createdAt);
    expect(decodeCursor(cursor, "filter")).toEqual({ createdAt, id });
    expect(decodeCursor(undefined, "filter")).toBeNull();
  });

  test("rejects a tampered cursor instead of returning a plausible page", () => {
    const tampered = [
      "not base64url!!",
      encode("a bare string"),
      Buffer.from("{not json", "utf8").toString("base64url"),
      encode({ createdAt, filterFingerprint: "filter", id, version: 2 }),
      encode({ createdAt, filterFingerprint: "filter", id: "not-a-uuid", version: 1 }),
      encode({ createdAt, id, version: 1 }),
      encode({ createdAt, filterFingerprint: "other", id, version: 1 }),
    ];
    for (const value of tampered) {
      expect(() => decodeCursor(value, "filter")).toThrow(
        "The page cursor is invalid for this query",
      );
    }
  });

  test("binds the cursor to the list kind and every filter value", async () => {
    const posted = await listFilterFingerprint("sales", { status: "posted" });
    const all = await listFilterFingerprint("sales", { status: "all" });
    expect(await listFilterFingerprint("sales", { status: "posted" })).toBe(posted);
    expect(all).not.toBe(posted);
    expect(await listFilterFingerprint("expenses", { status: "posted" })).not.toBe(posted);
    expect(await listFilterFingerprint("sales", { status: null })).not.toBe(posted);
    const cursor = encodeCursor({ createdAt, id }, posted);
    expect(decodeCursor(cursor, posted)?.id).toBe(id);
    expect(() => decodeCursor(cursor, all)).toThrow(ProductError);
  });

  test("keeps the canonical fingerprint of cursors already minted for sales and receivables", async () => {
    expect(await listFilterFingerprint("sales", { status: "all" })).toBe(
      await sha256Hex(JSON.stringify({ kind: "sales", status: "all", version: 1 })),
    );
    expect(await listFilterFingerprint("receivables", { state: "open", customerId: null })).toBe(
      await sha256Hex(
        JSON.stringify({ customerId: null, kind: "receivables", state: "open", version: 1 }),
      ),
    );
  });
});

describe("keyset page", () => {
  const rows = [3, 2, 1].map((n) => ({
    createdAtExact: `2026-08-22 20:30:0${n}+00`,
    id: `71402e0c-b17d-4d8c-83ae-8d163d10d51${n}`,
  }));

  test("returns the next cursor only when the probe row exists", () => {
    const full = pageRows(rows, 2, "f");
    expect(full.rows).toEqual(rows.slice(0, 2));
    const boundary = rows[1];
    if (!boundary) throw new Error("Missing fixture row");
    expect(decodeCursor(full.nextCursor ?? undefined, "f")).toEqual({
      createdAt: boundary.createdAtExact,
      id: boundary.id,
    });
    const last = pageRows(rows, 3, "f");
    expect(last.rows).toEqual(rows);
    expect(last.nextCursor).toBeNull();
  });

  test("compares the row value against the exact timestamp text", () => {
    expect(keysetBefore(sale, null)).toBeUndefined();
    const predicate = keysetBefore(sale, { createdAt, id });
    if (!predicate) throw new Error("Missing keyset predicate");
    const query = new PgDialect().sqlToQuery(predicate);
    expect(query.sql).toBe('("sale"."created_at", "sale"."id") < ($1::timestamptz, $2::uuid)');
    expect(query.params).toEqual([createdAt, id]);
  });
});

describe("occurrence keyset page", () => {
  const occurredAt = "2026-08-21 15:00:00.000001+00";
  const rows = [3, 2, 1].map((n) => ({
    occurredAtExact: `2026-08-2${n} 10:00:00+00`,
    createdAtExact: `2026-08-22 20:30:0${n}+00`,
    id: `71402e0c-b17d-4d8c-83ae-8d163d10d51${n}`,
  }));

  test("round-trips the occurrence position and refuses the other cursor kind", () => {
    const cursor = encodeOccurrenceCursor({ createdAt, id, occurredAt }, "filter");
    expect(decodeOccurrenceCursor(cursor, "filter")).toEqual({ createdAt, id, occurredAt });
    expect(decodeOccurrenceCursor(undefined, "filter")).toBeNull();
    expect(() => decodeCursor(cursor, "filter")).toThrow(ProductError);
    expect(() =>
      decodeOccurrenceCursor(encodeCursor({ createdAt, id }, "filter"), "filter"),
    ).toThrow(ProductError);
    expect(() =>
      decodeOccurrenceCursor(
        encode({
          createdAt,
          filterFingerprint: "filter",
          id,
          occurredAt: "2026-02-30 00:00:00+00",
          version: 2,
        }),
        "filter",
      ),
    ).toThrow(ProductError);
  });

  test("mints the next cursor from the last row's exact occurrence and creation", () => {
    const full = pageOccurrenceRows(rows, 2, "f");
    const boundary = rows[1];
    if (!boundary) throw new Error("Missing fixture row");
    expect(full.rows).toEqual(rows.slice(0, 2));
    expect(decodeOccurrenceCursor(full.nextCursor ?? undefined, "f")).toEqual({
      createdAt: boundary.createdAtExact,
      id: boundary.id,
      occurredAt: boundary.occurredAtExact,
    });
    expect(pageOccurrenceRows(rows, 3, "f").nextCursor).toBeNull();
  });

  test("compares occurrence, creation and id as one row value", () => {
    expect(occurrenceKeysetBefore(sale, null)).toBeUndefined();
    const predicate = occurrenceKeysetBefore(sale, { createdAt, id, occurredAt });
    if (!predicate) throw new Error("Missing keyset predicate");
    const query = new PgDialect().sqlToQuery(predicate);
    expect(query.sql).toBe(
      '("sale"."occurred_at", "sale"."created_at", "sale"."id") < ($1::timestamptz, $2::timestamptz, $3::uuid)',
    );
    expect(query.params).toEqual([occurredAt, createdAt, id]);
  });
});
