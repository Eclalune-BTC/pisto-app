import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";
import { keyedCommandPhase, useKeyedCommand } from "@/lib/keyed-command";

const react = vi.hoisted(() => ({ hooks: [] as unknown[], index: 0, mutate: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (initial: unknown) => {
    const index = react.index++;
    react.hooks[index] ??= { current: initial };
    return react.hooks[index];
  },
  useState: (initial: unknown) => [initial, () => undefined],
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    error: null,
    isError: false,
    isPending: false,
    isSuccess: false,
    mutate: react.mutate,
    reset: () => undefined,
    variables: undefined,
  }),
}));

const key = "00000000-0000-4000-8000-000000000001";

function failure(error: ApiClientError, idempotencyKey = key) {
  return { error, isError: true, isPending: false, variables: { idempotencyKey } };
}

describe("keyed command phase", () => {
  test("keeps an unknown outcome uncertain through failures that prove nothing", () => {
    for (const error of [
      new ApiClientError("Too many requests", 429, "RATE_LIMITED"),
      new ApiClientError("Writes paused", 503, "WRITES_PAUSED"),
      new ApiClientError("Session expired", 401, "UNAUTHORIZED"),
      new ApiClientError("Invalid request", 400, "VALIDATION_ERROR"),
    ]) {
      expect(keyedCommandPhase(failure(error), key)).toBe("uncertain");
      // The same failure on a key with a known outcome is an ordinary refusal.
      expect(keyedCommandPhase(failure(error), null)).toBe("failed");
    }
  });

  test("settles an unknown outcome once the server proves the key was never committed", () => {
    for (const error of [
      new ApiClientError("Conflict", 409, "CONFLICT"),
      new ApiClientError("Not found", 404, "NOT_FOUND"),
    ]) {
      expect(keyedCommandPhase(failure(error), key)).toBe("failed");
    }
  });

  test("treats another key as another command", () => {
    const rateLimited = new ApiClientError("Too many requests", 429, "RATE_LIMITED");
    expect(
      keyedCommandPhase(failure(rateLimited, "00000000-0000-4000-8000-000000000002"), key),
    ).toBe("failed");
    expect(
      keyedCommandPhase(
        { error: null, isError: false, isPending: true, variables: { idempotencyKey: key } },
        key,
      ),
    ).toBe("pending");
  });
});

describe("keyed command send", () => {
  const render = () => {
    react.index = 0;
    return useKeyedCommand({
      mutationFn: async (command: { idempotencyKey: string }) => command,
      onConfirmed: () => undefined,
    });
  };

  beforeEach(() => {
    react.hooks = [];
    react.mutate.mockClear();
  });

  test("a second press before the pending state renders sends nothing", () => {
    const command = render();

    command.send({ idempotencyKey: key });
    command.send({ idempotencyKey: "00000000-0000-4000-8000-000000000002" });

    expect(react.mutate.mock.calls).toEqual([[{ idempotencyKey: key }]]);
  });

  test("the next render may send again, as an uncertain retry does", () => {
    render().send({ idempotencyKey: key });
    render().send({ idempotencyKey: key });

    expect(react.mutate).toHaveBeenCalledTimes(2);
  });
});
