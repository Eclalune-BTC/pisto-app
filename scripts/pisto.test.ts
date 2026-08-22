import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createFileExclusive,
  generateBetterAuthSecret,
  injectBetterAuthSecret,
  isVersionAtLeast,
  main,
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

    await runInit({ logger: silentLogger, root });
    const serverPath = join(root, ".env");
    const clientPath = join(root, "apps", "app", ".env.local");
    const original = await readFile(serverPath, "utf8");
    const originalClient = await readFile(clientPath, "utf8");
    expect(original).toContain("DATABASE_SSL=disable");
    expect(original).toContain("BETTER_AUTH_SECRETS=");
    expect(original).toContain("POLAR_PRODUCTS_JSON=");
    expect(original).toContain("REVENUECAT_ENTITLEMENT_MAP_JSON=");
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
});
