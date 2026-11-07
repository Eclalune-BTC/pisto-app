#!/usr/bin/env bun

import { randomBytes } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { parseEnv as parseDotenv } from "node:util";
import { type Environment, readEnvironment } from "@pisto/config";

import { ApiConfigurationError, parseApiConfig } from "../apps/api/src/config.ts";
import { AuthConfigurationError, parseAuthConfig } from "../packages/auth/src/env.ts";
import { BillingConfigurationError, parseBillingConfig } from "../packages/billing/src/config.ts";
import { DatabaseConfigurationError, parseDatabaseConfig } from "../packages/db/src/env.ts";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const MINIMUM_BUN_VERSION = "1.4.0";
const MINIMUM_NODE_VERSION = "24.19.0";
const MAXIMUM_NODE_VERSION = "25.0.0";
const EXPO_MINIMUM_NODE_VERSION = "22.13.0";

type Logger = Pick<Console, "log" | "error">;

type InitOptions = {
  dryRun?: boolean;
  logger?: Logger;
  root?: string;
};

type DiagnosticLevel = "PASS" | "WARN" | "FAIL";

type Diagnostic = {
  detail: string;
  level: DiagnosticLevel;
  name: string;
};

type DoctorOptions = {
  logger?: Logger;
  root?: string;
};

const HELP = `Pisto Stack local CLI

Usage:
  bun run scripts/pisto.ts <command> [options]

Commands:
  init       Create local environment files without overwriting existing files.
  doctor     Check Bun, Docker, repository configuration, and local environment files.
  help       Show this help.

Options:
  --dry-run  With init, report what would be created without writing files.
  -h, --help Show command help.

Safety:
  init only writes .env and apps/app/.env.local when they do not already exist.
  doctor is read-only. This CLI never starts services or changes external systems.
`;

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

function displayPath(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/") || ".";
}

export function generateBetterAuthSecret(): string {
  return randomBytes(32).toString("base64url");
}

function looksLikePlaceholder(value: string): boolean {
  const normalized = value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
  return (
    normalized.length === 0 ||
    normalized.includes("change-me") ||
    normalized.includes("changeme") ||
    normalized.includes("replace-me") ||
    normalized.includes("generated_better_auth_secret") ||
    (normalized.startsWith("<") && normalized.endsWith(">"))
  );
}

export function injectBetterAuthSecret(template: string, secret: string): string {
  const normalized = template.endsWith("\n") ? template : `${template}\n`;
  const pattern = /^BETTER_AUTH_SECRET\s*=.*$/m;

  if (pattern.test(normalized)) {
    return normalized.replace(pattern, `BETTER_AUTH_SECRET=${secret}`);
  }

  return `${normalized}\nBETTER_AUTH_SECRET=${secret}\n`;
}

export async function createFileExclusive(
  path: string,
  contents: string,
): Promise<"created" | "exists"> {
  await mkdir(dirname(path), { recursive: true });

  try {
    const handle = await open(path, "wx", 0o600);
    try {
      await handle.writeFile(contents, "utf8");
    } finally {
      await handle.close();
    }
    return "created";
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      return "exists";
    }
    throw error;
  }
}

export async function runInit(options: InitOptions = {}): Promise<number> {
  const root = resolve(options.root ?? PROJECT_ROOT);
  const logger = options.logger ?? console;
  const dryRun = options.dryRun ?? false;
  const secret = generateBetterAuthSecret();
  const targets = [
    {
      example: join(root, ".env.example"),
      path: join(root, ".env"),
      transform: (template: string) => injectBetterAuthSecret(template, secret),
    },
    {
      example: join(root, "apps", "app", ".env.example"),
      path: join(root, "apps", "app", ".env.local"),
      transform: (template: string) => template,
    },
  ];

  for (const target of targets) {
    if (!(await fileExists(target.path)) && !(await fileExists(target.example))) {
      logger.error(`Missing template: ${displayPath(root, target.example)}. Restore it from Git.`);
      return 1;
    }
  }

  logger.log(dryRun ? "Pisto Stack initialization (dry run)" : "Pisto Stack initialization");

  let created = 0;
  let preserved = 0;

  for (const target of targets) {
    const shownPath = displayPath(root, target.path);
    if (await fileExists(target.path)) {
      logger.log(`PRESERVED  ${shownPath} (already exists)`);
      preserved += 1;
      continue;
    }

    if (dryRun) {
      logger.log(`WOULD CREATE  ${shownPath}`);
      continue;
    }

    const template = await readFile(target.example, "utf8");
    const result = await createFileExclusive(target.path, target.transform(template));
    if (result === "created") {
      logger.log(`CREATED    ${shownPath}`);
      created += 1;
    } else {
      logger.log(`PRESERVED  ${shownPath} (created by another process)`);
      preserved += 1;
    }
  }

  if (dryRun) {
    logger.log("No files were written.");
  } else {
    logger.log(`Finished: ${created} created, ${preserved} preserved.`);
    logger.log("Secret values were generated locally and were not printed.");
  }

  logger.log("Next: review the local env files, then run `bun run doctor`.");
  return 0;
}

export function parseEnv(contents: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const [key, value] of Object.entries(parseDotenv(contents))) {
    if (value !== undefined) {
      values.set(key, value);
    }
  }
  return values;
}

function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isVersionAtLeast(actual: string, minimum: string): boolean {
  const actualParts = parseVersion(actual);
  const minimumParts = parseVersion(minimum);
  if (!actualParts || !minimumParts) {
    return false;
  }

  for (let index = 0; index < actualParts.length; index += 1) {
    if (actualParts[index] > minimumParts[index]) {
      return true;
    }
    if (actualParts[index] < minimumParts[index]) {
      return false;
    }
  }
  return true;
}

function runReadOnlyCommand(command: string[]): { output: string; success: boolean } {
  try {
    const result = Bun.spawnSync({
      cmd: command,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 8_000,
    });
    const stdout = result.stdout.toString().trim();
    const stderr = result.stderr.toString().trim();
    return {
      output: stdout || stderr,
      success: result.exitCode === 0,
    };
  } catch (error) {
    return {
      output: error instanceof Error ? error.message : "Command could not be executed.",
      success: false,
    };
  }
}

function addDiagnostic(
  diagnostics: Diagnostic[],
  level: DiagnosticLevel,
  name: string,
  detail: string,
): void {
  diagnostics.push({ detail, level, name });
}

async function readEnvIfPresent(path: string): Promise<Map<string, string>> {
  if (!(await fileExists(path))) {
    return new Map();
  }
  return parseEnv(await readFile(path, "utf8"));
}

function configuredValue(values: Map<string, string>, key: string): string {
  if (Object.hasOwn(process.env, key)) {
    return process.env[key]?.trim() ?? "";
  }
  return values.get(key)?.trim() ?? "";
}

/** Process variables override file values so CI can inject secrets without writing them to disk. */
export function mergedServerEnvironment(
  file: Map<string, string>,
  processEnv: Environment = process.env,
): Environment {
  return { ...Object.fromEntries(file), ...processEnv };
}

const configurationErrors = [
  ApiConfigurationError,
  AuthConfigurationError,
  BillingConfigurationError,
  DatabaseConfigurationError,
];

/** Runs `parse` and reports its configuration error message; any other error is a defect. */
function parseConfiguration<T>(
  diagnostics: Diagnostic[],
  name: string,
  parse: () => T,
): T | undefined {
  try {
    const parsed = parse();
    addDiagnostic(diagnostics, "PASS", name, "The runtime parser accepts this configuration.");
    return parsed;
  } catch (error) {
    if (!configurationErrors.some((ErrorClass) => error instanceof ErrorClass)) throw error;
    addDiagnostic(diagnostics, "FAIL", name, (error as Error).message);
    return undefined;
  }
}

function inspectPlaceholders(
  diagnostics: Diagnostic[],
  name: string,
  values: Record<string, string | undefined>,
): void {
  const placeholders = Object.entries(values)
    .filter(([, value]) => value !== undefined && looksLikePlaceholder(value))
    .map(([variable]) => variable);
  if (placeholders.length > 0) {
    addDiagnostic(
      diagnostics,
      "FAIL",
      name,
      `Replace placeholder values in: ${placeholders.join(", ")}.`,
    );
  }
}

/**
 * Validates the server environment with the same parsers the API runs at startup, so the doctor
 * cannot drift from what boots. Only parser messages are reported, never configured values.
 */
export function inspectServerConfiguration(env: Environment): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  parseConfiguration(diagnostics, "API configuration", () => parseApiConfig(env));
  parseConfiguration(diagnostics, "Database configuration", () => parseDatabaseConfig(env));

  const auth = parseConfiguration(diagnostics, "Auth configuration", () => parseAuthConfig(env));
  if (auth) {
    inspectPlaceholders(diagnostics, "Auth secrets", {
      BETTER_AUTH_SECRET: auth.secret,
      ...Object.fromEntries(
        (auth.secrets ?? []).map(({ version, value }) => [
          `BETTER_AUTH_SECRETS version ${version}`,
          value,
        ]),
      ),
    });
  }

  const billing = parseConfiguration(diagnostics, "Billing configuration", () =>
    parseBillingConfig(env),
  );
  if (billing?.polar.enabled) {
    inspectPlaceholders(diagnostics, "Polar credentials", {
      POLAR_ACCESS_TOKEN: billing.polar.accessToken,
      POLAR_WEBHOOK_SECRET: billing.polar.webhookSecret,
    });
  }
  if (billing?.revenueCat.enabled) {
    inspectPlaceholders(diagnostics, "RevenueCat credentials", {
      REVENUECAT_WEBHOOK_AUTHORIZATION: billing.revenueCat.authorization,
      REVENUECAT_WEBHOOK_SIGNING_SECRET: billing.revenueCat.signingSecret,
    });
  }
  return diagnostics;
}

class ClientConfigurationError extends Error {
  override readonly name = "ClientConfigurationError";
}

async function inspectRepository(root: string, diagnostics: Diagnostic[]): Promise<void> {
  const requiredFiles = [
    "package.json",
    "bunfig.toml",
    "bun.lock",
    ".node-version",
    ".env.example",
    "compose.yaml",
    "apps/app/package.json",
    "apps/app/.env.example",
    "apps/api/package.json",
    "packages/contracts/package.json",
    "packages/db/package.json",
    "packages/auth/package.json",
    "packages/billing/package.json",
  ];

  const missing: string[] = [];
  for (const path of requiredFiles) {
    if (!(await fileExists(join(root, path)))) {
      missing.push(path);
    }
  }

  if (missing.length === 0) {
    addDiagnostic(
      diagnostics,
      "PASS",
      "Repository",
      "Required workspace configuration is present.",
    );
  } else {
    addDiagnostic(
      diagnostics,
      "FAIL",
      "Repository",
      `Missing required files: ${missing.join(", ")}.`,
    );
  }

  try {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      name?: string;
      packageManager?: string;
    };
    if (packageJson.name === "pisto-stack") {
      addDiagnostic(diagnostics, "PASS", "Workspace name", "package.json identifies pisto-stack.");
    } else {
      addDiagnostic(diagnostics, "FAIL", "Workspace name", "Expected package name pisto-stack.");
    }
    addDiagnostic(
      diagnostics,
      packageJson.packageManager === "bun@1.4.0" ? "PASS" : "FAIL",
      "Package manager pin",
      packageJson.packageManager === "bun@1.4.0"
        ? "package.json pins bun@1.4.0."
        : "Expected packageManager bun@1.4.0.",
    );
  } catch {
    addDiagnostic(
      diagnostics,
      "FAIL",
      "Workspace package",
      "package.json is missing or invalid JSON.",
    );
  }

  try {
    const bunfig = await readFile(join(root, "bunfig.toml"), "utf8");
    const hoistedLinker = /\[install\][\s\S]*?linker\s*=\s*["']hoisted["']/.test(bunfig);
    addDiagnostic(
      diagnostics,
      hoistedLinker ? "PASS" : "FAIL",
      "Bun linker",
      hoistedLinker
        ? "bunfig.toml selects the hoisted linker required by the Expo native dependency layout."
        : 'Expected [install] linker = "hoisted" in bunfig.toml for the Expo workspace.',
    );
  } catch {
    addDiagnostic(diagnostics, "FAIL", "Bun linker", "bunfig.toml could not be read.");
  }

  try {
    const authPackage = JSON.parse(
      await readFile(join(root, "packages", "auth", "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const lockfile = await readFile(join(root, "bun.lock"), "utf8");
    const aligned =
      authPackage.dependencies?.["better-auth"] === "1.7.1" &&
      authPackage.dependencies?.["@better-auth/expo"] === "1.7.1" &&
      authPackage.devDependencies?.auth === "1.7.1" &&
      /"auth":\s*\["auth@1\.7\.1"/.test(lockfile) &&
      !lockfile.includes("@better-auth/cli");
    addDiagnostic(
      diagnostics,
      aligned ? "PASS" : "FAIL",
      "Better Auth toolchain",
      aligned
        ? "better-auth, @better-auth/expo, and the auth CLI are aligned at 1.7.1."
        : "Expected better-auth, @better-auth/expo, and auth at 1.7.1 with no @better-auth/cli lock entry.",
    );
  } catch {
    addDiagnostic(
      diagnostics,
      "FAIL",
      "Better Auth toolchain",
      "The auth manifest or lockfile could not be read.",
    );
  }

  try {
    const compose = await readFile(join(root, "compose.yaml"), "utf8");
    const expectedPostgres =
      /image:\s*postgres:18-alpine/.test(compose) &&
      /pisto_postgres_data:\/var\/lib\/postgresql(?:\s|$)/.test(compose);
    addDiagnostic(
      diagnostics,
      expectedPostgres ? "PASS" : "FAIL",
      "PostgreSQL Compose",
      expectedPostgres
        ? "PostgreSQL 18 uses the official 18+ /var/lib/postgresql volume target."
        : "Expected postgres:18-alpine with the named volume mounted at /var/lib/postgresql.",
    );
  } catch {
    addDiagnostic(diagnostics, "FAIL", "PostgreSQL Compose", "compose.yaml could not be read.");
  }
}

async function inspectEnvironment(root: string, diagnostics: Diagnostic[]): Promise<void> {
  const serverPath = join(root, ".env");
  const clientPath = join(root, "apps", "app", ".env.local");
  const server = await readEnvIfPresent(serverPath);
  const client = await readEnvIfPresent(clientPath);

  if (await fileExists(serverPath)) {
    addDiagnostic(diagnostics, "PASS", "Server environment", ".env exists.");
  } else {
    addDiagnostic(diagnostics, "WARN", "Server environment", "Run `bun run setup` to create .env.");
  }

  if (await fileExists(clientPath)) {
    addDiagnostic(diagnostics, "PASS", "App environment", "apps/app/.env.local exists.");
  } else {
    addDiagnostic(
      diagnostics,
      "WARN",
      "App environment",
      "Run `bun run setup` to create apps/app/.env.local.",
    );
  }

  diagnostics.push(...inspectServerConfiguration(mergedServerEnvironment(server)));

  const apiUrl = configuredValue(client, "EXPO_PUBLIC_API_URL");
  const productionApp = configuredValue(client, "APP_VARIANT") === "production";
  if (!apiUrl) {
    addDiagnostic(diagnostics, "WARN", "EXPO_PUBLIC_API_URL", "Not configured.");
  } else {
    // The shared origin check applies production rules when the app variant is production.
    const appEnvironment = readEnvironment(
      { NODE_ENV: productionApp ? "production" : "development" },
      ClientConfigurationError,
    );
    try {
      appEnvironment.httpOrigin(apiUrl, "EXPO_PUBLIC_API_URL");
      addDiagnostic(
        diagnostics,
        "PASS",
        "EXPO_PUBLIC_API_URL",
        "An exact HTTP(S) origin is configured.",
      );
    } catch (error) {
      if (!(error instanceof ClientConfigurationError)) throw error;
      addDiagnostic(diagnostics, "FAIL", "EXPO_PUBLIC_API_URL", error.message);
    }
  }

  const clientScheme = configuredValue(client, "EXPO_PUBLIC_APP_SCHEME").toLowerCase();
  const serverScheme = configuredValue(server, "EXPO_SCHEME").toLowerCase();
  const validClientScheme =
    /^[a-z][a-z0-9+.-]*$/.test(clientScheme) &&
    !["http", "https", "javascript", "data", "file", "blob"].includes(clientScheme);
  if (!clientScheme) {
    addDiagnostic(diagnostics, "WARN", "EXPO_PUBLIC_APP_SCHEME", "Not configured.");
  } else if (!validClientScheme || (serverScheme && clientScheme !== serverScheme)) {
    addDiagnostic(
      diagnostics,
      "FAIL",
      "App scheme",
      "Use one valid private scheme and keep EXPO_PUBLIC_APP_SCHEME aligned with EXPO_SCHEME.",
    );
  } else {
    addDiagnostic(
      diagnostics,
      "PASS",
      "App scheme",
      "The public app scheme is valid and aligned with the server scheme.",
    );
  }

  const iosIdentifier = configuredValue(client, "EXPO_IOS_BUNDLE_IDENTIFIER");
  const androidPackage = configuredValue(client, "EXPO_ANDROID_PACKAGE");
  const validIdentifiers =
    /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(iosIdentifier) &&
    /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(androidPackage);
  if (!iosIdentifier || !androidPackage) {
    addDiagnostic(
      diagnostics,
      productionApp ? "FAIL" : "WARN",
      "App identifiers",
      "Configure EXPO_IOS_BUNDLE_IDENTIFIER and EXPO_ANDROID_PACKAGE.",
    );
  } else if (
    !validIdentifiers ||
    (productionApp &&
      (iosIdentifier.startsWith("com.example.") || androidPackage.startsWith("com.example.")))
  ) {
    addDiagnostic(
      diagnostics,
      "FAIL",
      "App identifiers",
      productionApp
        ? "Production builds require valid non-example iOS and Android identifiers."
        : "App identifiers are not syntactically valid.",
    );
  } else {
    addDiagnostic(
      diagnostics,
      "PASS",
      "App identifiers",
      productionApp
        ? "Production iOS and Android identifiers are configured."
        : "iOS and Android identifiers are syntactically valid for local development.",
    );
  }

  const forbiddenClientKeys = [
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_SECRETS",
    "DATABASE_URL",
    "POSTGRES_PASSWORD",
    "POLAR_ACCESS_TOKEN",
    "POLAR_WEBHOOK_SECRET",
    "REVENUECAT_WEBHOOK_AUTHORIZATION",
    "REVENUECAT_WEBHOOK_SIGNING_SECRET",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "EXPO_PUBLIC_POLAR_CHECKOUT_URL",
  ];
  const exposed = forbiddenClientKeys.filter((key) => client.has(key));
  const privateLike = [...client.keys()].filter(
    (key) => key.includes("PRIVATE_KEY") || key.includes("WEBHOOK_SECRET"),
  );
  const unsafeClientKeys = [...new Set([...exposed, ...privateLike])];
  if (unsafeClientKeys.length > 0) {
    addDiagnostic(
      diagnostics,
      "FAIL",
      "Client secrets",
      `Remove server-only variables from apps/app/.env.local: ${unsafeClientKeys.join(", ")}.`,
    );
  } else {
    addDiagnostic(diagnostics, "PASS", "Client secrets", "No known server-only keys were found.");
  }
}

export async function runDoctor(options: DoctorOptions = {}): Promise<number> {
  const root = resolve(options.root ?? PROJECT_ROOT);
  const logger = options.logger ?? console;
  const diagnostics: Diagnostic[] = [];

  if (isVersionAtLeast(Bun.version, MINIMUM_BUN_VERSION)) {
    addDiagnostic(diagnostics, "PASS", "Bun", `${Bun.version} satisfies >=${MINIMUM_BUN_VERSION}.`);
  } else {
    addDiagnostic(
      diagnostics,
      "FAIL",
      "Bun",
      `${Bun.version} is too old; install Bun >=${MINIMUM_BUN_VERSION}.`,
    );
  }

  const dockerVersion = runReadOnlyCommand(["docker", "--version"]);
  if (dockerVersion.success) {
    addDiagnostic(diagnostics, "PASS", "Docker CLI", dockerVersion.output);
  } else {
    addDiagnostic(
      diagnostics,
      "FAIL",
      "Docker CLI",
      "Docker is unavailable. Install Docker before local database development.",
    );
  }

  if (dockerVersion.success) {
    const composeConfig = runReadOnlyCommand([
      "docker",
      "compose",
      "--file",
      join(root, "compose.yaml"),
      "config",
      "--quiet",
    ]);
    addDiagnostic(
      diagnostics,
      composeConfig.success ? "PASS" : "FAIL",
      "Compose configuration",
      composeConfig.success
        ? "compose.yaml parses successfully."
        : `compose.yaml is invalid: ${composeConfig.output || "Docker Compose returned an error."}`,
    );

    const composeVersion = runReadOnlyCommand(["docker", "compose", "version"]);
    addDiagnostic(
      diagnostics,
      composeVersion.success ? "PASS" : "FAIL",
      "Docker Compose",
      composeVersion.success ? composeVersion.output : "The Docker Compose plugin is unavailable.",
    );

    const engine = runReadOnlyCommand(["docker", "info", "--format", "{{.ServerVersion}}"]);
    addDiagnostic(
      diagnostics,
      engine.success ? "PASS" : "WARN",
      "Docker engine",
      engine.success
        ? `Docker Engine ${engine.output} is reachable.`
        : "Docker is installed, but its engine is not reachable. Start Docker Desktop when needed.",
    );
  }

  const nodeVersion = runReadOnlyCommand(["node", "--version"]);
  const normalizedNodeVersion = nodeVersion.output.replace(/^v/, "");
  if (!nodeVersion.success) {
    addDiagnostic(
      diagnostics,
      "FAIL",
      "Node.js",
      `Node.js >=${MINIMUM_NODE_VERSION} is required by this repository (Expo SDK 57 requires >=${EXPO_MINIMUM_NODE_VERSION}).`,
    );
  } else if (
    !isVersionAtLeast(normalizedNodeVersion, MINIMUM_NODE_VERSION) ||
    isVersionAtLeast(normalizedNodeVersion, MAXIMUM_NODE_VERSION)
  ) {
    addDiagnostic(
      diagnostics,
      "FAIL",
      "Node.js",
      `${normalizedNodeVersion} is outside the supported >=${MINIMUM_NODE_VERSION} <${MAXIMUM_NODE_VERSION} range; use the repository pin.`,
    );
  } else {
    addDiagnostic(
      diagnostics,
      "PASS",
      "Node.js",
      `${normalizedNodeVersion} satisfies >=${MINIMUM_NODE_VERSION}.`,
    );
  }

  await inspectRepository(root, diagnostics);
  await inspectEnvironment(root, diagnostics);

  logger.log("Pisto Stack doctor");
  for (const item of diagnostics) {
    logger.log(`${item.level.padEnd(4)}  ${item.name}: ${item.detail}`);
  }

  const failures = diagnostics.filter((item) => item.level === "FAIL").length;
  const warnings = diagnostics.filter((item) => item.level === "WARN").length;
  logger.log(`Summary: ${failures} failure(s), ${warnings} warning(s).`);

  if (failures > 0) {
    logger.error("Doctor found blocking local configuration problems.");
    return 1;
  }

  logger.log("Doctor completed without blocking problems. No services were started.");
  return 0;
}

export async function main(
  argv = process.argv.slice(2),
  logger: Logger = console,
): Promise<number> {
  const [command = "help", ...flags] = argv;

  if (command === "help" || command === "--help" || command === "-h") {
    logger.log(HELP);
    return 0;
  }

  if (command === "init") {
    if (flags.includes("--help") || flags.includes("-h")) {
      logger.log(HELP);
      return 0;
    }
    const unknown = flags.filter((flag) => flag !== "--dry-run");
    if (unknown.length > 0) {
      logger.error(`Unknown init option: ${unknown.join(", ")}`);
      logger.log(HELP);
      return 2;
    }
    return runInit({ dryRun: flags.includes("--dry-run"), logger });
  }

  if (command === "doctor") {
    if (flags.includes("--help") || flags.includes("-h")) {
      logger.log(HELP);
      return 0;
    }
    if (flags.length > 0) {
      logger.error(`Unknown doctor option: ${flags.join(", ")}`);
      logger.log(HELP);
      return 2;
    }
    return runDoctor({ logger });
  }

  logger.error(`Unknown command: ${command}`);
  logger.log(HELP);
  return 2;
}

if (import.meta.main) {
  process.exitCode = await main();
}
