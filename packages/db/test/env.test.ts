import { describe, expect, test } from "bun:test";

import { DatabaseConfigurationError, parseDatabaseConfig } from "../src/env.ts";

describe("database configuration", () => {
  test("parses an explicit PostgreSQL configuration", () => {
    expect(
      parseDatabaseConfig({
        DATABASE_URL: "postgres://pisto:local@localhost:5432/pisto",
        DATABASE_SSL: "disable",
        DATABASE_MAX_CONNECTIONS: "5",
      }),
    ).toMatchObject({
      ssl: "disable",
      maxConnections: 5,
    });
  });

  test("rejects boolean-like SSL values", () => {
    expect(() =>
      parseDatabaseConfig({
        DATABASE_URL: "postgres://pisto:local@localhost:5432/pisto",
        DATABASE_SSL: "false",
      }),
    ).toThrow(DatabaseConfigurationError);
  });
});
