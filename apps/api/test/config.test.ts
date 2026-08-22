import { describe, expect, test } from "bun:test";

import { ApiConfigurationError, parseApiConfig } from "../src/config.ts";

describe("API configuration", () => {
  test("uses the documented bind defaults", () => {
    expect(parseApiConfig({})).toMatchObject({
      host: "0.0.0.0",
      port: 3001,
      corsOrigins: [],
    });
  });

  test("prioritizes the Cloud Run PORT contract", () => {
    expect(parseApiConfig({ PORT: "8080", API_PORT: "3001" }).port).toBe(8080);
  });

  test("accepts exact comma-separated CORS origins", () => {
    expect(
      parseApiConfig({
        CORS_ORIGINS: "https://app.example.test,http://localhost:8081",
      }).corsOrigins,
    ).toEqual(["https://app.example.test", "http://localhost:8081"]);
  });

  test("rejects CORS URLs containing paths", () => {
    expect(() => parseApiConfig({ CORS_ORIGINS: "https://app.example.test/path" })).toThrow(
      ApiConfigurationError,
    );
  });

  test("requires HTTPS CORS origins in production", () => {
    expect(() =>
      parseApiConfig({
        NODE_ENV: "production",
        CORS_ORIGINS: "http://app.example.test",
      }),
    ).toThrow("Production CORS_ORIGINS must contain exact HTTPS origins");
  });

  test("rejects reserved CORS hostnames in production", () => {
    expect(() =>
      parseApiConfig({
        NODE_ENV: "production",
        CORS_ORIGINS: "https://app.example.com",
      }),
    ).toThrow("reserved or example hostnames");
  });
});
