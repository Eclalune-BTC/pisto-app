import { describe, expect, test } from "bun:test";

import { isReservedProductionHostname, readEnvironment } from "../src/index.ts";

class TestConfigurationError extends Error {}

const read = (env: Record<string, string | undefined>) =>
  readEnvironment(env, TestConfigurationError);

describe("environment reader", () => {
  test("defaults NODE_ENV to development and rejects any other spelling", () => {
    expect(read({}).runtime).toBe("development");
    expect(read({ NODE_ENV: "production" }).production).toBe(true);
    for (const NODE_ENV of ["prod", "", "Production", "production "]) {
      expect(() => read({ NODE_ENV })).toThrow(TestConfigurationError);
    }
  });

  test("parses booleans strictly and defaults only an unset variable", () => {
    expect(read({}).boolean("FLAG", true)).toBe(true);
    expect(read({ FLAG: "false" }).boolean("FLAG", true)).toBe(false);
    expect(read({ FLAG: "true" }).boolean("FLAG", false)).toBe(true);
    for (const FLAG of ["", "1", "0", "yes", "on", "TRUE", " true"]) {
      expect(() => read({ FLAG }).boolean("FLAG", false)).toThrow("FLAG must be true or false");
    }
  });

  test("parses bounded integers and rejects non-integer text", () => {
    expect(read({}).integer("N", 7, { min: 1, max: 10 })).toBe(7);
    expect(read({ N: " " }).integer("N", 7, { min: 1, max: 10 })).toBe(7);
    expect(read({ N: "10" }).integer("N", 7, { min: 1, max: 10 })).toBe(10);
    for (const N of ["11", "0", "1.5", "1e1", "0x5", "abc"]) {
      expect(() => read({ N }).integer("N", 7, { min: 1, max: 10 })).toThrow(
        "N must be an integer from 1 to 10",
      );
    }
  });

  test("requires values and enumerations explicitly", () => {
    expect(() => read({ V: " " }).required("V")).toThrow("V is required");
    expect(read({ V: " x " }).required("V")).toBe("x");
    expect(read({ V: "b" }).enumValue("V", ["a", "b"])).toBe("b");
    expect(() => read({}).enumValue("V", ["a", "b"])).toThrow("V must be one of a, b");
  });

  test("validates URLs and exact origins with production restrictions", () => {
    const development = read({});
    const production = read({ NODE_ENV: "production" });
    expect(development.httpOrigin("http://localhost:3001", "O")).toBe("http://localhost:3001");
    expect(() => development.httpOrigin("http://localhost:3001/", "O")).toThrow("without a path");
    expect(() => development.httpUrl("ftp://files.pisto.dev", "U")).toThrow("absolute HTTP(S) URL");
    expect(() => development.httpUrl("https://user:pass@pisto.dev", "U")).toThrow("credentials");
    expect(() => production.httpUrl("http://pisto.dev/a", "U")).toThrow("HTTPS in production");
    expect(() => production.httpUrl("https://app.example.com/a", "U")).toThrow("reserved");
    expect(production.httpUrl("https://app.pisto.dev/a", "U")).toBe("https://app.pisto.dev/a");
  });

  test("parses exact origin lists and delegates other schemes", () => {
    expect(read({ O: "http://a.test, http://a.test ,https://b.test" }).originList("O")).toEqual([
      "http://a.test",
      "https://b.test",
    ]);
    expect(() => read({ O: "https://*.b.test" }).originList("O")).toThrow("without wildcards");
    expect(() => read({ O: "pisto://" }).originList("O")).toThrow("exact HTTP(S) origin");
    const accepted: string[] = [];
    expect(
      read({ O: "pisto://,http://a.test" }).originList("O", (entry) => accepted.push(entry)),
    ).toEqual(["pisto://", "http://a.test"]);
    expect(accepted).toEqual(["pisto://"]);
  });

  test("recognizes reserved production hostnames", () => {
    for (const host of ["localhost", "api.localhost", "127.0.0.1", "[::1]", "0.0.0.0", "a.test"]) {
      expect(isReservedProductionHostname(host)).toBe(true);
    }
    for (const host of ["example.com.", "x.example.org", "invalid"]) {
      expect(isReservedProductionHostname(host)).toBe(true);
    }
    expect(isReservedProductionHostname("api.pisto.dev")).toBe(false);
  });
});
