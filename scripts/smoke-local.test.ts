import { describe, expect, test } from "bun:test";
import {
  hasHttpOnlySessionCookie,
  localSmokeConfig,
  loopbackHttpOrigin,
  rejectSmokeProxy,
  runLocalSmoke,
} from "./smoke-local";

describe("local smoke destination boundary", () => {
  test.each(["http://localhost:3015", "http://127.0.0.1:3001", "http://[::1]:3001"])(
    "accepts loopback origin %s",
    (value) => expect(loopbackHttpOrigin(value)).toBe(value),
  );

  test.each([
    "https://localhost:3015",
    "http://example.com",
    "http://localhost.example.com",
    "http://192.168.1.5:3015",
    "http://0.0.0.0:3015",
    "http://[::]:3015",
    "http://user:password@localhost:3015",
    "http://localhost:3015/api/auth",
    "http://localhost:3015?target=remote",
    "http://localhost:3015#fragment",
    "not-a-url",
  ])("rejects unsafe destination %s", (value) => {
    expect(() => loopbackHttpOrigin(value)).toThrow();
  });

  test("dedicated local override takes precedence over the configured auth origin", () => {
    expect(
      localSmokeConfig({
        SMOKE_API_URL: "http://localhost:3015",
        BETTER_AUTH_URL: "https://example.com",
        SMOKE_WEB_ORIGIN: "http://localhost:8090",
      }),
    ).toEqual({ apiOrigin: "http://localhost:3015", webOrigin: "http://localhost:8090" });
  });

  test("rejects an unsafe configured origin before sending any request", async () => {
    const result = await runLocalSmoke({ BETTER_AUTH_URL: "https://example.com" });
    expect(result.passed).toBe(false);
    expect(result.requests).toBe(0);
  });

  test("rejects an unsafe web origin before sending any request", async () => {
    const result = await runLocalSmoke({
      SMOKE_API_URL: "http://localhost:3015",
      SMOKE_WEB_ORIGIN: "http://example.com",
    });
    expect(result.passed).toBe(false);
    expect(result.requests).toBe(0);
  });

  test.each(["HTTP_PROXY", "https_proxy", "ALL_PROXY"])(
    "rejects %s even when NO_PROXY lists localhost",
    (name) => {
      expect(() =>
        rejectSmokeProxy({ [name]: "http://example.com:8080", NO_PROXY: "localhost" }),
      ).toThrow();
    },
  );

  test("checks actual process proxies when the supplied configuration omits them", async () => {
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: CLI tests run directly under Bun and restore this proxy fixture.
    const previous = process.env.HTTP_PROXY;
    try {
      process.env.HTTP_PROXY = "http://example.com:8080";
      const result = await runLocalSmoke({ SMOKE_API_URL: "http://localhost:3015" });
      expect(result.passed).toBe(false);
      expect(result.requests).toBe(0);
      expect(result.failure).toContain("Clear proxy environment variables");
    } finally {
      if (previous === undefined) {
        // biome-ignore lint/suspicious/noUndeclaredEnvVars: Restore the uncached CLI test environment.
        delete process.env.HTTP_PROXY;
      } else process.env.HTTP_PROXY = previous;
    }
  });

  test("requires HttpOnly on the session token itself", () => {
    expect(hasHttpOnlySessionCookie(["pisto.session_data=fixture; HttpOnly"])).toBe(false);
    expect(hasHttpOnlySessionCookie(["pisto.session_token=fixture; SameSite=Lax"])).toBe(false);
    expect(hasHttpOnlySessionCookie(["pisto.session_token=fixture; HttpOnly; SameSite=Lax"])).toBe(
      true,
    );
  });
});
