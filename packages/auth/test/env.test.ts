import { describe, expect, test } from "bun:test";

import { AuthConfigurationError, parseAuthConfig } from "../src/env.ts";

const baseEnvironment = {
  BETTER_AUTH_URL: "https://api.example.test",
  BETTER_AUTH_SECRET: "a-secure-value-with-at-least-32-characters",
};

describe("auth configuration", () => {
  test("requires an explicit secret and canonical URL", () => {
    expect(() => parseAuthConfig({})).toThrow(AuthConfigurationError);
  });

  test("rejects the public setup placeholder as an auth secret", () => {
    expect(() =>
      parseAuthConfig({
        BETTER_AUTH_URL: baseEnvironment.BETTER_AUTH_URL,
        BETTER_AUTH_SECRET: "__GENERATED_BETTER_AUTH_SECRET__",
      }),
    ).toThrow("BETTER_AUTH_SECRET must be generated before startup");
  });

  test("adds the Expo scheme to trusted origins", () => {
    const config = parseAuthConfig({
      ...baseEnvironment,
      EXPO_SCHEME: "pisto",
    });

    expect(config.trustedOrigins).toContain("pisto://");
    expect(config.trustedOrigins).toContain("pisto://*");
  });

  test("parses versioned secrets in current-to-old order", () => {
    const config = parseAuthConfig({
      BETTER_AUTH_URL: baseEnvironment.BETTER_AUTH_URL,
      BETTER_AUTH_SECRETS:
        "2:new-secret-value-with-more-than-32-characters,1:old-secret-value-with-more-than-32-characters",
    });

    expect(config.secrets?.map(({ version }) => version)).toEqual([2, 1]);
    expect(config.secret).toBeUndefined();
  });

  test("rejects duplicate secret versions", () => {
    expect(() =>
      parseAuthConfig({
        BETTER_AUTH_URL: baseEnvironment.BETTER_AUTH_URL,
        BETTER_AUTH_SECRETS:
          "1:first-secret-value-with-more-than-32-characters,1:second-secret-value-with-more-than-32-characters",
      }),
    ).toThrow(AuthConfigurationError);
  });

  test("requires HTTPS for the production auth origin", () => {
    expect(() =>
      parseAuthConfig({
        ...baseEnvironment,
        BETTER_AUTH_URL: "http://localhost:3001",
        NODE_ENV: "production",
      }),
    ).toThrow("BETTER_AUTH_URL must use HTTPS in production");
  });

  test("rejects reserved auth and trusted-origin hostnames in production", () => {
    expect(() =>
      parseAuthConfig({
        ...baseEnvironment,
        BETTER_AUTH_URL: "https://api.example.com",
        NODE_ENV: "production",
      }),
    ).toThrow("reserved or example hostname");
    expect(() =>
      parseAuthConfig({
        ...baseEnvironment,
        BETTER_AUTH_URL: "https://api.pisto.dev",
        TRUSTED_ORIGINS: "https://app.example.com",
        NODE_ENV: "production",
      }),
    ).toThrow("reserved or example hostnames");
  });

  test("rejects typoed and wildcard trusted origins", () => {
    expect(() =>
      parseAuthConfig({
        ...baseEnvironment,
        TRUSTED_ORIGINS: "htps://app.example.test",
      }),
    ).toThrow(AuthConfigurationError);
    expect(() =>
      parseAuthConfig({
        ...baseEnvironment,
        TRUSTED_ORIGINS: "https://*.example.test",
      }),
    ).toThrow("wildcard entries are not allowed");
  });

  test("accepts an exact configured application scheme", () => {
    const config = parseAuthConfig({
      ...baseEnvironment,
      EXPO_SCHEME: "pisto",
      TRUSTED_ORIGINS: "pisto://callback",
    });

    expect(config.trustedOrigins).toContain("pisto://callback");
  });
});
