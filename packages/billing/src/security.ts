import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function constantTimeEqual(actual: string, expected: string): boolean {
  return timingSafeEqual(digest(actual), digest(expected));
}

export function canonicalJson(value: unknown): string {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return "null";
  }
  if (value === null || typeof value !== "object") {
    if (typeof value === "bigint") return JSON.stringify(value.toString());
    return JSON.stringify(value);
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function eventFingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function verifyRevenueCatSignature(input: {
  rawBody: string;
  signatureHeader: string;
  secret: string;
  now?: Date;
  toleranceSeconds: number;
}): boolean {
  const parts = Object.fromEntries(
    input.signatureHeader.split(",").map((part) => {
      const separator = part.indexOf("=");
      return separator === -1
        ? [part.trim(), ""]
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isSafeInteger(timestamp) || !signature) return false;

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000);
  if (Math.abs(nowSeconds - timestamp) > input.toleranceSeconds) return false;

  const expected = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest("hex");
  return constantTimeEqual(signature.toLowerCase(), expected);
}
