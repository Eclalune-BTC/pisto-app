import { ApiClientError } from "@/lib/api-error";

export type AssistantProblem =
  | "offline"
  | "provider"
  | "rateLimited"
  | "denied"
  | "paused"
  | "unexpected";

/** What went wrong with an assistant request, in terms the user can act on. */
export function assistantProblem(error: unknown): AssistantProblem {
  if (!(error instanceof ApiClientError)) return "unexpected";
  if (error.status === 0) return "offline";
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
  rateLimited: "assistant.problems.rateLimited",
  denied: "assistant.problems.denied",
  paused: "assistant.problems.paused",
  unexpected: "assistant.problems.unexpected",
} as const satisfies Record<AssistantProblem, string>;
