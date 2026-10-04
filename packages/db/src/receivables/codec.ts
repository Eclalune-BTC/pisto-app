import { receivablePaymentSchema, receivableSchema } from "@pisto/contracts";
import { z } from "zod";

import { fingerprintValue } from "../operation-log.ts";

export const paymentResultSchema = z.object({
  payment: receivablePaymentSchema,
  receivable: receivableSchema,
});

// Receivables hashes its own key order; changing it would invalidate every stored
// receivable fingerprint, so the canonical object stays exactly as written here.
export function receivableCommandFingerprint(action: string, payload: unknown): Promise<string> {
  return fingerprintValue({ action, payload, version: 1 });
}
