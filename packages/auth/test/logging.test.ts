import { describe, expect, spyOn, test } from "bun:test";
import type { BillingRuntime } from "@pisto/billing";
import type { Database } from "@pisto/db";
import { APIError } from "better-auth/api";

import { createAuth } from "../src/create-auth.ts";

describe("authentication privacy boundary", () => {
  test("keeps framework, provider, and driver failures out of logs and responses", async () => {
    const auth = createAuth({
      config: {
        baseUrl: "http://localhost:3001",
        secret: "audit-test-secret-123456789012345678901234567890",
        trustedOrigins: ["http://localhost:8081"],
        emailAndPasswordEnabled: true,
        production: false,
        trustedProxyHeaders: false,
      },
      db: {} as Database,
      billing: { polar: { plugin: null } } as unknown as BillingRuntime,
    });
    const context = await auth.$context;
    // Keep the real Better Auth handler and error router, with only persistence
    // substituted. No credentials or external provider are needed for this case.
    context.adapter.findMany = async () => [];
    context.adapter.create = async <T>() => ({}) as T;
    const sentinel = "private-driver-query-and-token-must-not-appear";
    const errorLog = spyOn(console, "error").mockImplementation(() => undefined);
    const warningLog = spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      for (const failure of [
        new Error(sentinel),
        new APIError("INTERNAL_SERVER_ERROR", { message: sentinel }),
      ]) {
        context.internalAdapter.findUserByEmail = async () => {
          throw failure;
        };
        const response = await auth.handler(
          new Request("http://localhost:3001/api/auth/sign-in/email", {
            method: "POST",
            headers: { "content-type": "application/json", origin: "http://localhost:8081" },
            body: JSON.stringify({ email: "audit@example.test", password: "unused-password-123" }),
          }),
        );
        expect(response.status).toBe(500);
        expect(await response.text()).not.toContain(sentinel);
      }
      context.logger.error(sentinel, { privateValue: sentinel });
      context.logger.warn(sentinel);
      const output = [...errorLog.mock.calls, ...warningLog.mock.calls].flat().join(" ");
      expect(output).not.toContain(sentinel);
      expect(output).toContain("Authentication request failed");
      expect(output).toContain("Authentication provider diagnostic");
    } finally {
      errorLog.mockRestore();
      warningLog.mockRestore();
    }
  });
});
