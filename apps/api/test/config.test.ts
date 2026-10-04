import { describe, expect, test } from "bun:test";

import { ApiConfigurationError, parseApiConfig } from "../src/config.ts";

describe("API configuration", () => {
  test("rejects an unknown environment and an empty write switch instead of enabling writes", () => {
    for (const NODE_ENV of ["prod", "staging", "", "production "]) {
      expect(() => parseApiConfig({ NODE_ENV })).toThrow("NODE_ENV");
    }
    expect(() => parseApiConfig({ PRODUCT_WRITES_ENABLED: "" })).toThrow("PRODUCT_WRITES_ENABLED");
    expect(parseApiConfig({ PRODUCT_WRITES_ENABLED: "false" }).productWritesEnabled).toBe(false);
    expect(parseApiConfig({}).productWritesEnabled).toBe(true);
    for (const value of ["0", "no", "False", " false"]) {
      expect(() => parseApiConfig({ PRODUCT_WRITES_ENABLED: value })).toThrow(
        "PRODUCT_WRITES_ENABLED must be true or false",
      );
    }
  });
  test("uses the documented bind defaults", () => {
    expect(parseApiConfig({})).toMatchObject({
      host: "0.0.0.0",
      port: 3001,
      corsOrigins: [],
    });
  });

  test("prioritizes the Cloud Run PORT contract", () => {
    expect(parseApiConfig({ PORT: "8080", API_PORT: "3001" }).port).toBe(8080);
    expect(parseApiConfig({ API_PORT: "3015" }).port).toBe(3015);
    expect(() => parseApiConfig({ PORT: "80.5" })).toThrow("PORT must be an integer");
    expect(() => parseApiConfig({ API_PORT: "70000" })).toThrow("API_PORT must be an integer");
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
    ).toThrow("CORS_ORIGINS must use HTTPS in production");
  });

  test("rejects reserved CORS hostnames in production", () => {
    expect(() =>
      parseApiConfig({
        NODE_ENV: "production",
        CORS_ORIGINS: "https://app.example.com",
      }),
    ).toThrow("CORS_ORIGINS cannot use a reserved or example hostname");
  });
});
