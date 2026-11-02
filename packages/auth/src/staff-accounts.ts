import { ProductError, type StaffAccountProvisioner } from "@pisto/db";
import { APIError } from "better-auth/api";

import type { Auth } from "./create-auth.ts";

type SignUpAuth = {
  $context: Promise<{ internalAdapter: { deleteSession(token: string): Promise<void> } }>;
  api: { signUpEmail: Auth["api"]["signUpEmail"] };
};

const invalidPasswordCodes = new Set([
  "INVALID_PASSWORD",
  "PASSWORD_TOO_LONG",
  "PASSWORD_TOO_SHORT",
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
        if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") return { created: false };
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
      return { created: true, userId: result.user.id };
    },
  };
}
