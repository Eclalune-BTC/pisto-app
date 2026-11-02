import { describe, expect, test } from "vitest";

import type { RealtimeStatus } from "@/lib/realtime";
import { nextInterrupted } from "./realtime-interruption";

function replay(statuses: RealtimeStatus[]): boolean[] {
  let previous: RealtimeStatus = "offline";
  let interrupted = false;
  return statuses.map((status) => {
    interrupted = nextInterrupted(previous, status, interrupted);
    previous = status;
    return interrupted;
  });
}

describe("realtime interruption notice", () => {
  test("stays quiet while the first connection opens and while live", () => {
    expect(replay(["connecting", "live", "live"])).toEqual([false, false, false]);
  });

  test("appears after a real disconnect and stays through reconnect attempts", () => {
    expect(replay(["connecting", "live", "offline", "connecting", "offline", "live"])).toEqual([
      false,
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  test("counts a first connection that fails as an interruption", () => {
    expect(replay(["connecting", "offline"])).toEqual([false, true]);
  });
});
