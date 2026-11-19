import type { AssistantInterpretation } from "@pisto/contracts";
import { ApiClientError } from "@/lib/api-error";

export type UnsupportedReason = NonNullable<AssistantInterpretation["unsupported"]>;

export const unsupportedMessageKeys = {
  not_a_record: "assistant.problems.notARecord",
  several_records: "assistant.problems.severalRecords",
  partial_purchase_payment: "assistant.problems.partialPurchasePayment",
} as const satisfies Record<UnsupportedReason, string>;

export type AssistantProblem =
  | "offline"
  | "provider"
  | "recordingTooLong"
  | "rateLimited"
  | "denied"
  | "paused"
  | "unexpected";

/** What went wrong with an assistant request, in terms the user can act on. */
export function assistantProblem(error: unknown): AssistantProblem {
  if (!(error instanceof ApiClientError)) return "unexpected";
  if (error.status === 0) return "offline";
  if (error.status === 413) return "recordingTooLong";
  if (error.code === "RATE_LIMITED") return "rateLimited";
  if (error.code === "FORBIDDEN") return "denied";
  if (error.code === "WRITES_PAUSED") return "paused";
  // A switched-off assistant also answers 503; the status query, refetched on this error, tells
  // the two apart.
  if (error.code === "SERVICE_UNAVAILABLE") return "provider";
  return "unexpected";
}

export const problemMessageKeys = {
  offline: "assistant.problems.offline",
  provider: "assistant.problems.provider",
  recordingTooLong: "assistant.problems.recordingTooLong",
  rateLimited: "assistant.problems.rateLimited",
  denied: "assistant.problems.denied",
  paused: "assistant.problems.paused",
  unexpected: "assistant.problems.unexpected",
} as const satisfies Record<AssistantProblem, string>;
