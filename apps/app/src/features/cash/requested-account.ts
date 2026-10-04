import type { CashAccount } from "@pisto/contracts";
import { ApiClientError } from "@/lib/api-error";

/** A requested account goes first so a deep link works beyond the first page of choices. */
export function withRequestedAccount(
  listed: CashAccount[],
  requested: CashAccount | undefined,
): CashAccount[] {
  return requested ? [requested, ...listed.filter(({ id }) => id !== requested.id)] : listed;
}

/** A deep-linked account that cannot take new operations is never replaced by another one. */
export function isRequestedAccountUnavailable(query: {
  data?: { account: CashAccount };
  error: unknown;
}): boolean {
  return (
    query.data?.account.status === "archived" ||
    (query.error instanceof ApiClientError && query.error.code === "NOT_FOUND")
  );
}
