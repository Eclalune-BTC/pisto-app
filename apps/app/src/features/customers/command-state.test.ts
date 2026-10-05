import type { ArchiveCustomerRequest } from "@pisto/contracts";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { afterEach, describe, expect, test } from "vitest";

import { ApiClientError } from "@/lib/api-error";
import { provesNotCommitted } from "@/lib/mutation-phase";
import {
  type CommandState,
  commandAction,
  commandAfterClose,
  commandState,
  commandToSend,
} from "./command-state";
import { unresolvedKeyAfter } from "./use-command";

const t = ((key: string) => key) as unknown as TFunction;
const settled = { isPending: false, isSuccess: false };

describe("command phases", () => {
  test("maps every mutation outcome onto one vocabulary", () => {
    expect(commandState(t, { error: null, isPending: true, isSuccess: false })).toEqual({
      phase: "pending",
    });
    expect(commandState(t, { error: null, isPending: false, isSuccess: true })).toEqual({
      phase: "confirmed",
    });
    expect(commandState(t, { error: null, ...settled })).toEqual({ phase: "idle" });
  });

  test("treats lost or unreadable confirmations as uncertain, never as failures", () => {
    for (const status of [0, 500, 502, 200]) {
      expect(commandState(t, { error: new ApiClientError("Lost", status), ...settled }).phase).toBe(
        "uncertain",
      );
    }
  });

  test("explains a domain conflict with the command's own sentence", () => {
    const conflict = new ApiClientError("Conflict", 409, "CONFLICT");
    expect(commandState(t, { error: conflict, ...settled }, "Customer has a balance")).toEqual({
      phase: "failed",
      message: "Customer has a balance",
    });
    expect(commandState(t, { error: conflict, ...settled })).toEqual({
      phase: "failed",
      message: "productErrors.conflict",
    });
    const validation = new ApiClientError("Invalid", 400, "VALIDATION_ERROR");
    expect(commandState(t, { error: validation, ...settled }, "Customer has a balance")).toEqual({
      phase: "failed",
      message: "productErrors.validation",
    });
  });

  test("keeps a once-uncertain command uncertain until a rejection proves it never committed", () => {
    const paused = new ApiClientError("Writes paused", 503, "WRITES_PAUSED");
    const conflict = new ApiClientError("Conflict", 409, "CONFLICT");
    expect(commandState(t, { error: paused, ...settled }).phase).toBe("failed");
    expect(commandState(t, { error: paused, ...settled }, undefined, true).phase).toBe("uncertain");
    expect(commandState(t, { error: conflict, ...settled }, undefined, true).phase).toBe("failed");
    expect(provesNotCommitted(conflict)).toBe(true);
    expect(provesNotCommitted(new ApiClientError("Missing", 404, "NOT_FOUND"))).toBe(true);
    for (const error of [
      paused,
      new ApiClientError("Too many requests", 429, "RATE_LIMITED"),
      new ApiClientError("Session expired", 401, "UNAUTHORIZED"),
      new ApiClientError("Forbidden", 403, "FORBIDDEN"),
      new ApiClientError("Invalid", 400, "VALIDATION_ERROR"),
      // The key already holds a different committed command.
      new ApiClientError("Key reused", 409, "IDEMPOTENCY_CONFLICT"),
    ]) {
      expect(provesNotCommitted(error)).toBe(false);
    }
  });

  test("tracks the key whose outcome is still unknown", () => {
    const lost = { error: new ApiClientError("Gateway timeout", 504) };
    const paused = { error: new ApiClientError("Writes paused", 503, "WRITES_PAUSED") };
    const conflict = { error: new ApiClientError("Conflict", 409, "CONFLICT") };
    expect(unresolvedKeyAfter(null, "a", lost)).toBe("a");
    expect(unresolvedKeyAfter("a", "a", paused)).toBe("a");
    expect(unresolvedKeyAfter("a", "a", conflict)).toBeNull();
    expect(unresolvedKeyAfter("a", "a", "success")).toBeNull();
    expect(unresolvedKeyAfter(null, "a", paused)).toBeNull();
    expect(unresolvedKeyAfter("a", "b", conflict)).toBe("a");
  });

  test("offers only the exact retry while the outcome is uncertain", () => {
    const actions = (["idle", "pending", "confirmed"] as const).map((phase) =>
      commandAction({ phase }),
    );
    expect(actions).toEqual(["confirm", "waiting", "none"]);
    expect(commandAction({ phase: "failed", message: "No" })).toBe("confirm");
    expect(commandAction({ phase: "uncertain", message: "Unknown" })).toBe("retry");
  });
});

describe("confirmation keys", () => {
  let client: QueryClient | undefined;
  afterEach(() => client?.clear());

  test("resends the identical command after an uncertain outcome and rebuilds after a definitive one", () => {
    const previous = { idempotencyKey: "first" };
    const build = () => ({ idempotencyKey: "second" });
    const uncertain: CommandState = { phase: "uncertain", message: "Unknown" };
    const failed: CommandState = { phase: "failed", message: "No" };
    expect(commandToSend(previous, uncertain, build)).toBe(previous);
    expect(commandToSend(previous, failed, build)).toEqual({ idempotencyKey: "second" });
    expect(commandToSend(null, uncertain, build)).toEqual({ idempotencyKey: "second" });
    expect(commandAfterClose(previous, uncertain)).toBe(previous);
    expect(commandAfterClose(previous, failed)).toBeNull();
  });

  test("a confirmation dialog keeps its idempotency key on retry and across closing while uncertain", async () => {
    client = new QueryClient();
    const sent: ArchiveCustomerRequest[] = [];
    const responses: Error[] = [
      new ApiClientError("Gateway timeout", 504),
      new ApiClientError("Connection lost", 0),
      new ApiClientError("Gateway timeout", 504),
      new ApiClientError("Has balance", 409, "CONFLICT"),
    ];
    const observer = new MutationObserver(client, {
      mutationFn: async (command: ArchiveCustomerRequest) => {
        sent.push(command);
        throw responses.shift();
      },
      retry: false,
    });
    let keys = 0;
    let command: ArchiveCustomerRequest | null = null;
    const state = () => commandState(t, observer.getCurrentResult());
    const confirm = async () => {
      command = commandToSend(command, state(), () => ({ idempotencyKey: `key-${++keys}` }));
      if (command) await observer.mutate(command).catch(() => undefined);
    };

    await confirm();
    expect(state().phase).toBe("uncertain");
    await confirm();
    command = commandAfterClose(command, state());
    await confirm();
    expect(sent.map(({ idempotencyKey }) => idempotencyKey)).toEqual(["key-1", "key-1", "key-1"]);

    await confirm();
    expect(state()).toEqual({ phase: "failed", message: "productErrors.conflict" });
    command = commandAfterClose(command, state());
    expect(command).toBeNull();
    responses.push(new ApiClientError("Has balance", 409, "CONFLICT"));
    await confirm();
    expect(sent.at(-1)?.idempotencyKey).toBe("key-2");
  });

  test("a retry refused before the key is checked never frees the uncertain command", async () => {
    client = new QueryClient();
    const sent: string[] = [];
    const responses: Error[] = [
      new ApiClientError("Gateway timeout", 504),
      new ApiClientError("Writes paused", 503, "WRITES_PAUSED"),
      new ApiClientError("Too many requests", 429, "RATE_LIMITED"),
      new ApiClientError("Session expired", 401, "UNAUTHORIZED"),
      new ApiClientError("Customer archived", 409, "CONFLICT"),
    ];
    const observer = new MutationObserver(client, {
      mutationFn: async (command: ArchiveCustomerRequest) => {
        sent.push(command.idempotencyKey);
        throw responses.shift();
      },
      retry: false,
    });
    let unresolved: string | null = null;
    let keys = 0;
    let command: ArchiveCustomerRequest | null = null;
    const state = () =>
      commandState(
        t,
        observer.getCurrentResult(),
        undefined,
        command !== null && unresolved === command.idempotencyKey,
      );
    const confirm = async () => {
      command = commandToSend(command, state(), () => ({ idempotencyKey: `key-${++keys}` }));
      if (!command) return;
      const attempt = command.idempotencyKey;
      await observer.mutate(command).catch((error: unknown) => {
        unresolved = unresolvedKeyAfter(unresolved, attempt, { error });
      });
    };

    await confirm();
    for (let retry = 0; retry < 3; retry += 1) {
      expect(state().phase).toBe("uncertain");
      await confirm();
    }
    expect(state().phase).toBe("uncertain");
    expect(sent).toEqual(["key-1", "key-1", "key-1", "key-1"]);
    // The command is rejected after the server found no receipt for its key: it never committed.
    await confirm();
    expect(state().phase).toBe("failed");
    responses.push(new ApiClientError("Customer archived", 409, "CONFLICT"));
    await confirm();
    expect(sent.at(-1)).toBe("key-2");
  });
});
