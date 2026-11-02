import { ProductError, type StaffAccountProvisioner } from "@pisto/db";
import { APIError } from "better-auth/api";

import type { Auth } from "./create-auth.ts";

type SignUpAuth = {
  $context: Promise<{
    internalAdapter: { deleteSession(token: string): Promise<void> };
    secret: string;
  }>;
  api: { signUpEmail: Auth["api"]["signUpEmail"] };
};

const invalidPasswordCodes = new Set([
  "INVALID_PASSWORD",
  "PASSWORD_TOO_LONG",
  "PASSWORD_TOO_SHORT",
]);
// Sign-up reports a concurrent insert of the same email, caught by the unique index, this way.
const concurrentCreationCodes = new Set([
  "FAILED_TO_CREATE_USER",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

/**
 * Creates staff accounts through Better Auth's own sign-up endpoint, so email normalization, the
 * password policy and hashing are the self-service ones. Sign-up also signs the new account in;
 * that session belongs to nobody, so it is deleted before the account is reported.
 */
export function createStaffAccountProvisioner(auth: SignUpAuth): StaffAccountProvisioner {
  return {
    async createPasswordAccount({ email, name, password }) {
      let result: Awaited<ReturnType<Auth["api"]["signUpEmail"]>>;
      try {
        result = await auth.api.signUpEmail({ body: { email, name, password } });
      } catch (error) {
        if (!(error instanceof APIError)) throw error;
        const code = (error.body as { code?: unknown } | undefined)?.code;
        // The caller reads the account back by its email and fails if it does not exist.
        if (typeof code === "string" && concurrentCreationCodes.has(code)) return;
        if (typeof code === "string" && invalidPasswordCodes.has(code)) {
          throw new ProductError(
            "VALIDATION_ERROR",
            "The initial password does not meet the account password policy",
          );
        }
        if (code === "INVALID_EMAIL") {
          throw new ProductError("VALIDATION_ERROR", "Email is not a valid address");
        }
        if (code === "EMAIL_PASSWORD_SIGN_UP_DISABLED") {
          throw new ProductError(
            "CONFLICT",
            "Password sign-up is disabled, so only existing accounts can be added",
          );
        }
        throw error;
      }
      if (result.token) {
        const context = await auth.$context;
        await context.internalAdapter.deleteSession(result.token);
      }
    },

    /** HMAC-SHA256 under the auth secret; rotating the secret turns an old replay into a conflict. */
    async fingerprintPassword(password) {
      const { secret } = await auth.$context;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(`pisto:staff-initial-password:${password}`),
      );
      return Array.from(new Uint8Array(signature), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    },
  };
}
