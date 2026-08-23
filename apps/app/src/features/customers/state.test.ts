import { describe, expect, test } from "vitest";

import { type CustomersLoadState, customerPrimaryAction } from "./types";

describe("customer UI states", () => {
  test("keeps uncertain confirmation on an exact retry path", () => {
    expect(customerPrimaryAction({ kind: "uncertain", message: "Unknown outcome" })).toBe("retry");
    expect(customerPrimaryAction({ kind: "submitting" })).toBe("waiting");
    expect(customerPrimaryAction({ kind: "succeeded" })).toBe("none");
  });

  test("represents empty, denied, and failed reads as distinct states", () => {
    const states: CustomersLoadState[] = [{ kind: "empty" }, { kind: "denied" }, { kind: "error" }];
    expect(states.map(({ kind }) => kind)).toEqual(["empty", "denied", "error"]);
  });
});
