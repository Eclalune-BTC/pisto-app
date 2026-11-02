import { describe, expect, test } from "bun:test";
import { APIError } from "better-auth/api";

import { createStaffAccountProvisioner } from "../src/staff-accounts.ts";

type SignUp = (input: { body: { email: string; name: string; password: string } }) => Promise<{
  token: string | null;
  user: { id: string };
}>;

function fakeAuth(signUp: SignUp) {
  const deleted: string[] = [];
  const auth = {
    $context: Promise.resolve({
      internalAdapter: {
        deleteSession: async (token: string) => {
          deleted.push(token);
        },
      },
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

describe("staff account provisioning through sign-up", () => {
  test("passes the account to sign-up and deletes the session sign-up opened", async () => {
    const calls: unknown[] = [];
    const { deleted, provisioner } = fakeAuth(async (request) => {
      calls.push(request);
      return { token: "session-token", user: { id: "user-new" } };
    });
    expect(await provisioner.createPasswordAccount(input)).toEqual({
      created: true,
      userId: "user-new",
    });
    expect(calls).toEqual([{ body: input }]);
    expect(deleted).toEqual(["session-token"]);
  });

  test("reports an email another request registered first", async () => {
    const { deleted, provisioner } = fakeAuth(async () => {
      throw APIError.from("UNPROCESSABLE_ENTITY", {
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "User already exists. Use another email.",
      });
    });
    expect(await provisioner.createPasswordAccount(input)).toEqual({ created: false });
    expect(deleted).toEqual([]);
  });

  test("turns the sign-up password policy into a validation error", async () => {
    for (const code of ["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG", "INVALID_PASSWORD"]) {
      const { provisioner } = fakeAuth(async () => {
        throw APIError.from("BAD_REQUEST", { code, message: code });
      });
      await expect(provisioner.createPasswordAccount(input)).rejects.toMatchObject({
        name: "ProductError",
        code: "VALIDATION_ERROR",
      });
    }
  });

  test("keeps unexpected sign-up failures and session cleanup failures loud", async () => {
    const failure = new Error("database unavailable");
    const { provisioner } = fakeAuth(async () => {
      throw failure;
    });
    await expect(provisioner.createPasswordAccount(input)).rejects.toBe(failure);

    const cleanup = new Error("session store unavailable");
    const auth = {
      $context: Promise.resolve({
        internalAdapter: {
          deleteSession: async () => {
            throw cleanup;
          },
        },
      }),
      api: { signUpEmail: async () => ({ token: "session-token", user: { id: "user-new" } }) },
    };
    await expect(
      createStaffAccountProvisioner(
        auth as unknown as Parameters<typeof createStaffAccountProvisioner>[0],
      ).createPasswordAccount(input),
    ).rejects.toBe(cleanup);
  });
});
