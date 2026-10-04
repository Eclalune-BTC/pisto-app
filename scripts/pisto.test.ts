import { afterEach, describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createFileExclusive,
  generateBetterAuthSecret,
  injectBetterAuthSecret,
  inspectServerConfiguration,
  isVersionAtLeast,
  main,
  mergedServerEnvironment,
  parseEnv,
  runInit,
} from "./pisto";

const temporaryDirectories: string[] = [];
const silentLogger = { error() {}, log() {} };

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "pisto-cli-"));
  temporaryDirectories.push(path);
  return path;
}

async function copyTemplates(root: string) {
  await mkdir(join(root, "apps", "app"), { recursive: true });
  for (const file of [".env.example", "apps/app/.env.example"]) {
    await copyFile(join(import.meta.dir, "..", file), join(root, file));
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("Pisto CLI", () => {
  test("generates a high-entropy Better Auth secret", () => {
    const first = generateBetterAuthSecret();
    const second = generateBetterAuthSecret();

    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("injects a fresh secret without preserving an example value", () => {
    const rendered = injectBetterAuthSecret("PORT=3001\nBETTER_AUTH_SECRET=change-me\n", "safe");

    expect(rendered).toContain("BETTER_AUTH_SECRET=safe");
    expect(rendered).not.toContain("change-me");
  });

  test("creates files exclusively and preserves existing contents", async () => {
    const root = await temporaryDirectory();
    const path = join(root, "nested", ".env");

    expect(await createFileExclusive(path, "first\n")).toBe("created");
    expect(await createFileExclusive(path, "second\n")).toBe("exists");
    expect(await readFile(path, "utf8")).toBe("first\n");
  });

  test("init is repeatable and never overwrites local environment files", async () => {
    const root = await temporaryDirectory();
    await copyTemplates(root);

    expect(await runInit({ logger: silentLogger, root })).toBe(0);
    const serverPath = join(root, ".env");
    const clientPath = join(root, "apps", "app", ".env.local");
    const original = await readFile(serverPath, "utf8");
    const originalClient = await readFile(clientPath, "utf8");
    expect(original).toContain("DATABASE_SSL=disable");
    expect(original).toContain("BETTER_AUTH_SECRETS=");
    expect(original).toContain("POLAR_PRODUCTS_JSON=");
    expect(original).toContain("REVENUECAT_ENTITLEMENT_MAP_JSON=");
    expect(original).toContain("REVENUECAT_ALLOWED_ENVIRONMENT=");
    expect(original).toContain("PRODUCT_WRITES_ENABLED=");
    expect(originalClient).toContain("EXPO_PUBLIC_API_URL=http://localhost:3001");
    expect(originalClient).not.toContain("EXPO_PUBLIC_POLAR_CHECKOUT_URL");
    await writeFile(serverPath, `${original}LOCAL_SENTINEL=keep\n`, "utf8");
    await writeFile(clientPath, `${originalClient}CLIENT_SENTINEL=keep\n`, "utf8");

    await runInit({ logger: silentLogger, root });
    expect(await readFile(serverPath, "utf8")).toContain("LOCAL_SENTINEL=keep");
    expect(await readFile(clientPath, "utf8")).toContain("CLIENT_SENTINEL=keep");
  });

  test("init dry run reports targets without creating files", async () => {
    const root = await temporaryDirectory();
    await copyTemplates(root);
    const messages: string[] = [];

    await runInit({
      dryRun: true,
      logger: {
        error: (message) => messages.push(String(message)),
        log: (message) => messages.push(String(message)),
      },
      root,
    });

    expect(await Bun.file(join(root, ".env")).exists()).toBe(false);
    expect(await Bun.file(join(root, "apps", "app", ".env.local")).exists()).toBe(false);
    expect(messages).toContain("No files were written.");
  });

  test.each([".env.example", "apps/app/.env.example"])(
    "init fails before writing when %s is missing",
    async (missing) => {
      const root = await temporaryDirectory();
      await copyTemplates(root);
      await rm(join(root, missing));
      const messages: string[] = [];
      const logger = { log() {}, error: (message: string) => messages.push(message) };

      expect(await runInit({ logger, root })).toBe(1);
      expect(messages).toContain(`Missing template: ${missing}. Restore it from Git.`);
      expect(await Bun.file(join(root, ".env")).exists()).toBe(false);
      expect(await Bun.file(join(root, "apps", "app", ".env.local")).exists()).toBe(false);
    },
  );

  test("init preserves configured files even when templates are absent", async () => {
    const root = await temporaryDirectory();
    await createFileExclusive(join(root, ".env"), "LOCAL_SENTINEL=keep\n");
    await createFileExclusive(join(root, "apps", "app", ".env.local"), "CLIENT_SENTINEL=keep\n");

    expect(await runInit({ logger: silentLogger, root })).toBe(0);
    expect(await readFile(join(root, ".env"), "utf8")).toBe("LOCAL_SENTINEL=keep\n");
    expect(await readFile(join(root, "apps", "app", ".env.local"), "utf8")).toBe(
      "CLIENT_SENTINEL=keep\n",
    );
  });

  test("help succeeds and unknown commands return usage errors", async () => {
    const messages: string[] = [];
    const logger = {
      error: (message: unknown) => messages.push(String(message)),
      log: (message: unknown) => messages.push(String(message)),
    };

    expect(await main(["help"], logger)).toBe(0);
    expect(messages.join("\n")).toContain("Pisto Stack local CLI");
    messages.length = 0;
    expect(await main(["unknown"], logger)).toBe(2);
    expect(messages.join("\n")).toContain("Unknown command: unknown");
  });

  test("parses dotenv assignments without exposing comments", () => {
    const values = parseEnv("# ignored\nA=one\nexport B='two words'\nINVALID LINE\n");

    expect(values.get("A")).toBe("one");
    expect(values.get("B")).toBe("two words");
    expect(values.has("INVALID")).toBe(false);
  });

  test("compares Bun versions numerically", () => {
    expect(isVersionAtLeast("1.4.0", "1.4.0")).toBe(true);
    expect(isVersionAtLeast("1.10.0", "1.4.0")).toBe(true);
    expect(isVersionAtLeast("1.3.9", "1.4.0")).toBe(false);
  });

  test("accepts inline comments while preserving quoted hashes and multiline values", () => {
    const values = parseEnv(
      'API_PORT=3015 # local API\nLABEL="a#b" # comment\nexport MULTILINE="first\nsecond"\n',
    );

    expect(values.get("API_PORT")).toBe("3015");
    expect(values.get("LABEL")).toBe("a#b");
    expect(values.get("MULTILINE")).toBe("first\nsecond");
  });
});

describe("doctor server configuration", () => {
  const secret = "a".repeat(20) + "B".repeat(20);
  const exampleEnvironment = async () =>
    Object.fromEntries(
      parseEnv(
        injectBetterAuthSecret(
          await readFile(join(import.meta.dir, "..", ".env.example"), "utf8"),
          secret,
        ),
      ),
    );
  const polarEnvironment = {
    BILLING_ENABLED: "true",
    POLAR_ACCESS_TOKEN: "polar_oat_local_test_token",
    POLAR_WEBHOOK_SECRET: "polar_whs_local_test_secret",
    POLAR_SERVER: "sandbox",
    POLAR_PRODUCTS_JSON: JSON.stringify([
      { productId: "4a1c40a8-0b0f-4d47-a8a6-1f2c5e0d9b11", slug: "pro", entitlementKey: "pro" },
    ]),
  };
  const failures = (env: Record<string, string | undefined>) =>
    inspectServerConfiguration(env)
      .filter((diagnostic) => diagnostic.level === "FAIL")
      .map(({ name, detail }) => `${name}: ${detail}`);

  test("accepts the documented example once its secret is generated", async () => {
    const env = await exampleEnvironment();
    expect(failures(env)).toEqual([]);
    expect(failures({ ...env, ...polarEnvironment })).toEqual([]);
  });

  test.each([
    "PRODUCT_WRITES_ENABLED",
    "BILLING_ENABLED",
    "REVENUECAT_ENABLED",
    "AUTH_TRUSTED_PROXY_HEADERS",
  ])("requires %s to be exactly true or false", async (variable) => {
    const env = await exampleEnvironment();
    for (const value of [" true", "TRUE", "1", ""]) {
      expect(failures({ ...env, [variable]: value })).toContainEqual(
        expect.stringContaining(`${variable} must be true or false`),
      );
    }
  });

  test("requires an explicit Polar server only while billing is enabled", async () => {
    const env = { ...(await exampleEnvironment()), ...polarEnvironment };
    for (const value of [undefined, "staging", " production "]) {
      const failed = failures({ ...env, POLAR_SERVER: value });
      expect(failed).toEqual(
        value === " production "
          ? []
          : ["Billing configuration: POLAR_SERVER must be one of sandbox, production"],
      );
    }
    expect(failures({ ...env, BILLING_ENABLED: "false", POLAR_SERVER: "staging" })).toEqual([]);
  });

  test.each([
    ["API_PORT", "0x10", "API configuration: API_PORT must be an integer from 1 to 65535"],
    ["API_PORT", "1e3", "API configuration: API_PORT must be an integer from 1 to 65535"],
    [
      "PRODUCT_READ_LIMIT_PER_MINUTE",
      "0",
      "API configuration: PRODUCT_READ_LIMIT_PER_MINUTE must be an integer from 1 to 10000",
    ],
    [
      "PRODUCT_WRITE_LIMIT_PER_MINUTE",
      "1001",
      "API configuration: PRODUCT_WRITE_LIMIT_PER_MINUTE must be an integer from 1 to 1000",
    ],
    [
      "DATABASE_MAX_CONNECTIONS",
      "101",
      "Database configuration: DATABASE_MAX_CONNECTIONS must be an integer from 1 to 100",
    ],
    ["NODE_ENV", "prod", "API configuration: NODE_ENV must be development, test, or production"],
  ])("reports %s=%s through the runtime parser", async (variable, value, expected) => {
    expect(failures({ ...(await exampleEnvironment()), [variable]: value })).toContainEqual(
      expected,
    );
  });

  test("reports RevenueCat environment and credential problems without values", async () => {
    const env = {
      ...(await exampleEnvironment()),
      REVENUECAT_ENABLED: "true",
      REVENUECAT_WEBHOOK_AUTHORIZATION: "Bearer change-me",
      REVENUECAT_ENTITLEMENT_MAP_JSON: JSON.stringify({ pro: "pro" }),
    };
    expect(failures(env)).toEqual([
      "RevenueCat credentials: Replace placeholder values in: REVENUECAT_WEBHOOK_AUTHORIZATION.",
    ]);
    expect(failures({ ...env, REVENUECAT_ALLOWED_ENVIRONMENT: "sandbox" })).toEqual([
      "Billing configuration: REVENUECAT_ALLOWED_ENVIRONMENT must be one of PRODUCTION, SANDBOX",
    ]);
  });

  test("never prints a rejected secret", async () => {
    const shortSecret = "short-but-private-value";
    const output = JSON.stringify(
      inspectServerConfiguration({
        ...(await exampleEnvironment()),
        BETTER_AUTH_SECRET: shortSecret,
        ...polarEnvironment,
        POLAR_ACCESS_TOKEN: "<replace-me-private>",
      }),
    );
    expect(output).toContain("BETTER_AUTH_SECRET must contain at least 32 characters");
    expect(output).not.toContain(shortSecret);
    expect(output).toContain("Replace placeholder values in: POLAR_ACCESS_TOKEN.");
    expect(output).not.toContain("replace-me-private");
  });

  test("lets process variables override file values", () => {
    const file = new Map([
      ["API_PORT", "3001"],
      ["BILLING_ENABLED", "false"],
    ]);
    expect(mergedServerEnvironment(file, { API_PORT: "4000" })).toEqual({
      API_PORT: "4000",
      BILLING_ENABLED: "false",
    });
  });
});
