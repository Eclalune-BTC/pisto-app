import { describe, expect, test } from "bun:test";
import { APIError } from "better-auth/api";

import { createStaffAccountProvisioner } from "../src/staff-accounts.ts";

type SignUp = (input: { body: { email: string; name: string; password: string } }) => Promise<{
  token: string | null;
  user: { id: string };
}>;

function fakeAuth(
  signUp: SignUp,
  options: { deleteSession?: (token: string) => Promise<void>; secret?: string } = {},
) {
  const deleted: string[] = [];
  const auth = {
    $context: Promise.resolve({
      internalAdapter: {
        deleteSession:
          options.deleteSession ??
          (async (token: string) => {
            deleted.push(token);
          }),
      },
      secret: options.secret ?? "test-secret-with-enough-entropy-0123456789",
    }),
    api: { signUpEmail: signUp },
  };
  return {
    deleted,
    provisioner: createStaffAccountProvisioner(
      auth as unknown as Parameters<typeof createStaffAccountProvisioner>[0],
    ),
  };
}

const input = { email: "rosa@example.test", name: "Rosa Mejía", password: "Temporal2026" };
const created: SignUp = async () => ({ token: "session-token", user: { id: "user-new" } });
const refusal = (status: "BAD_REQUEST" | "UNPROCESSABLE_ENTITY", code: string) => async () => {
  throw APIError.from(status, { code, message: code });
};

describe("staff account provisioning through sign-up", () => {
  test("passes the account to sign-up and deletes the session sign-up opened", async () => {
    const calls: unknown[] = [];
    const { deleted, provisioner } = fakeAuth(async (request) => {
      calls.push(request);
      return created(request);
    });
    await provisioner.createPasswordAccount(input);
    expect(calls).toEqual([{ body: input }]);
    expect(deleted).toEqual(["session-token"]);
  });

  test("accepts an email that a concurrent request registered first", async () => {
    for (const code of ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "FAILED_TO_CREATE_USER"]) {
      const { deleted, provisioner } = fakeAuth(refusal("UNPROCESSABLE_ENTITY", code));
      await provisioner.createPasswordAccount(input);
      expect(deleted).toEqual([]);
    }
  });

  test("turns the sign-up policy into a validation error", async () => {
    for (const code of [
      "PASSWORD_TOO_SHORT",
      "PASSWORD_TOO_LONG",
      "INVALID_PASSWORD",
      "INVALID_EMAIL",
    ]) {
      const { provisioner } = fakeAuth(refusal("BAD_REQUEST", code));
      await expect(provisioner.createPasswordAccount(input)).rejects.toMatchObject({
        name: "ProductError",
        code: "VALIDATION_ERROR",
      });
    }
    const { provisioner } = fakeAuth(refusal("BAD_REQUEST", "EMAIL_PASSWORD_SIGN_UP_DISABLED"));
    await expect(provisioner.createPasswordAccount(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  test("keeps unexpected sign-up failures and session cleanup failures loud", async () => {
    const failure = new Error("database unavailable");
    const failing = fakeAuth(async () => {
      throw failure;
    });
    await expect(failing.provisioner.createPasswordAccount(input)).rejects.toBe(failure);
    const unknown = fakeAuth(refusal("BAD_REQUEST", "SOMETHING_ELSE"));
    await expect(unknown.provisioner.createPasswordAccount(input)).rejects.toBeInstanceOf(APIError);

    const cleanup = new Error("session store unavailable");
    const leaking = fakeAuth(created, {
      deleteSession: async () => {
        throw cleanup;
      },
    });
    await expect(leaking.provisioner.createPasswordAccount(input)).rejects.toBe(cleanup);
  });

  test("fingerprints a password with a key that only the server holds", async () => {
    const { provisioner } = fakeAuth(created);
    const digest = await provisioner.fingerprintPassword("Temporal2026");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(await provisioner.fingerprintPassword("Temporal2026")).toBe(digest);
    expect(await provisioner.fingerprintPassword("Temporal2027")).not.toBe(digest);
    const unkeyed = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode("Temporal2026")),
    );
    expect(digest).not.toBe(Buffer.from(unkeyed).toString("hex"));
    const otherServer = fakeAuth(created, { secret: "another-secret-with-enough-entropy-98765" });
    expect(await otherServer.provisioner.fingerprintPassword("Temporal2026")).not.toBe(digest);
  });
});
