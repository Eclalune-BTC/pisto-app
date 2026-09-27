import { describe, expect, it, vi } from "vitest";

import { joinHttpUrl, normalizeAppScheme, normalizeHttpUrl } from "@/lib/env";

describe("public environment URLs", () => {
  it("does not replace a missing production API origin with localhost", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EXPO_PUBLIC_API_URL", undefined);
    vi.resetModules();
    try {
      await expect(import("../env")).rejects.toThrow(
        "EXPO_PUBLIC_API_URL is required in production",
      );
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
  it("normalizes an API origin and joins the Better Auth path", () => {
    const origin = normalizeHttpUrl("http://localhost:3001/", "EXPO_PUBLIC_API_URL");
    expect(origin).toBe("http://localhost:3001");
    expect(joinHttpUrl(origin, "/api/auth")).toBe("http://localhost:3001/api/auth");
  });

  it("rejects non-HTTP protocols", () => {
    expect(() => normalizeHttpUrl("file:///tmp/api", "EXPO_PUBLIC_API_URL")).toThrow(
      "must use http or https",
    );
  });

  it("rejects API values that are not exact origins", () => {
    expect(() => normalizeHttpUrl("https://api.example.test/v1", "EXPO_PUBLIC_API_URL")).toThrow(
      "exact HTTP(S) origin",
    );
    expect(() =>
      normalizeHttpUrl("https://user:pass@api.example.test", "EXPO_PUBLIC_API_URL"),
    ).toThrow("exact HTTP(S) origin");
  });

  it("validates the deep-link scheme", () => {
    expect(normalizeAppScheme("pisto-dev")).toBe("pisto-dev");
    expect(() => normalizeAppScheme("https://pisto.test")).toThrow("valid private URI scheme");
    expect(() => normalizeAppScheme("https")).toThrow("valid private URI scheme");
  });
});
