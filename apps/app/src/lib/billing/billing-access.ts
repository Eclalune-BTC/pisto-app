export type BillingAccessState = "active" | "checking" | "standard" | "unknown";

type BillingAccessInput = {
  activeCount: number;
  fetchStatus: "fetching" | "idle" | "paused";
  isError: boolean;
  isPending: boolean;
  verifiedAfterReturn?: boolean;
};

export function deriveBillingAccessState({
  activeCount,
  fetchStatus,
  isError,
  isPending,
  verifiedAfterReturn = true,
}: BillingAccessInput): BillingAccessState {
  if (isPending || fetchStatus === "fetching" || !verifiedAfterReturn) return "checking";
  if (isError || fetchStatus === "paused") return "unknown";
  return activeCount > 0 ? "active" : "standard";
}
