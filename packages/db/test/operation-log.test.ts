import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  fingerprintCommand,
  fingerprintValue,
  normalizeIdempotencyKey,
  parseReplaySnapshot,
  sha256Hex,
} from "../src/operation-log.ts";

describe("shared operation log primitives", () => {
  test("fingerprints the canonical version, action, and payload", async () => {
    const payload = { amountMinorUnits: "1250", currency: "USD" };
    const canonical = await sha256Hex(
      JSON.stringify({ version: 1, action: "cash.adjust", payload }),
    );

    expect(await fingerprintCommand("cash.adjust", payload)).toBe(canonical);
    expect(canonical).toMatch(/^[a-f0-9]{64}$/);
    expect(await fingerprintCommand("cash.transfer", payload)).not.toBe(canonical);
    expect(await fingerprintCommand("cash.adjust", { ...payload, currency: "EUR" })).not.toBe(
      canonical,
    );
  });

  test("hashes the exact JSON encoding, so key order changes the fingerprint", async () => {
    // Receivables deliberately hashes { action, payload, version }; cash and catalog
    // hash { version, action, payload }. Stored fingerprints depend on that order.
    const receivablesOrder = await fingerprintValue({
      action: "receivable.posted",
      payload: { originalMinorUnits: "500" },
      version: 1,
    });
    const catalogOrder = await fingerprintValue({
      version: 1,
      action: "receivable.posted",
      payload: { originalMinorUnits: "500" },
    });

    expect(receivablesOrder).not.toBe(catalogOrder);
    expect(catalogOrder).toBe(
      await fingerprintCommand("receivable.posted", { originalMinorUnits: "500" }),
    );
  });

  test("reads a stored snapshot back through its contract and fails loudly otherwise", () => {
    const schema = z.object({ id: z.string(), replayed: z.boolean() }).strict();

    expect(parseReplaySnapshot(schema, { id: "a", replayed: false }, "boom")).toEqual({
      id: "a",
      replayed: false,
    });
    expect(() => parseReplaySnapshot(schema, { id: 1 }, "boom")).toThrow("boom");
    expect(() => parseReplaySnapshot(schema, null, "boom")).toThrow("boom");
  });

  test("locks one spelling of a UUID idempotency key", () => {
    expect(normalizeIdempotencyKey("71402E0C-B17D-4D8C-83AE-8D163D10D51D")).toBe(
      "71402e0c-b17d-4d8c-83ae-8d163d10d51d",
    );
  });
});
