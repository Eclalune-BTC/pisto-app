import type { RealtimeStatus } from "@/lib/realtime";

/**
 * Interrupted from the moment an open or opening socket closes until it is live again. The hook
 * starts offline before its first attempt, so only a transition into offline counts; reconnect
 * attempts in between keep the notice.
 */
export function nextInterrupted(
  previous: RealtimeStatus,
  status: RealtimeStatus,
  interrupted: boolean,
): boolean {
  if (status === "live") return false;
  if (status === "offline" && previous !== "offline") return true;
  return interrupted;
}
