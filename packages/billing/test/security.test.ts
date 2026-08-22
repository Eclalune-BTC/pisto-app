import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import {
  canonicalJson,
  constantTimeEqual,
  eventFingerprint,
  verifyRevenueCatSignature,
} from "../src/security.ts";

describe("webhook security helpers", () => {
  test("canonicalizes equivalent objects to one idempotency fingerprint", () => {
    expect(eventFingerprint({ b: 2, a: 1 })).toBe(eventFingerprint({ a: 1, b: 2 }));
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  test("compares authorization values", () => {
    expect(constantTimeEqual("Bearer expected", "Bearer expected")).toBe(true);
    expect(constantTimeEqual("Bearer wrong", "Bearer expected")).toBe(false);
  });

  test("verifies a current RevenueCat HMAC signature", () => {
    const rawBody = '{"event":{"id":"event-1"}}';
    const timestamp = 1_800_000_000;
    const secret = "configured-signing-secret";
    const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

    expect(
      verifyRevenueCatSignature({
        rawBody,
        signatureHeader: `t=${timestamp},v1=${signature}`,
        secret,
        now: new Date(timestamp * 1_000),
        toleranceSeconds: 300,
      }),
    ).toBe(true);
  });

  test("rejects a stale RevenueCat HMAC signature", () => {
    expect(
      verifyRevenueCatSignature({
        rawBody: "{}",
        signatureHeader: "t=1,v1=deadbeef",
        secret: "configured-signing-secret",
        now: new Date(1_800_000_000_000),
        toleranceSeconds: 300,
      }),
    ).toBe(false);
  });
});
