export type Environment = Record<string, string | undefined>;
export type ConfigurationErrorClass = new (message: string) => Error;
export type RuntimeEnvironment = "development" | "test" | "production";

const runtimeEnvironments: readonly string[] = ["development", "test", "production"];
const reservedHostnameSuffixes = [
  "localhost",
  "test",
  "invalid",
  "example",
  "example.com",
  "example.net",
  "example.org",
];

/** Loopback, unspecified, and RFC 2606/6761 names cannot identify a production service. */
export function isReservedProductionHostname(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "0.0.0.0") return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(normalized)) return true;
  return reservedHostnameSuffixes.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
}

export function readEnvironment(env: Environment, ConfigurationError: ConfigurationErrorClass) {
  const fail = (message: string): never => {
    throw new ConfigurationError(message);
  };

  // NODE_ENV is optional and defaults to development; any other value is a typo
  // that would otherwise silently disable production security behavior.
  if (env.NODE_ENV !== undefined && !runtimeEnvironments.includes(env.NODE_ENV)) {
    fail("NODE_ENV must be development, test, or production");
  }
  const runtime = (env.NODE_ENV ?? "development") as RuntimeEnvironment;
  const production = runtime === "production";

  function checkHttpUrl(value: string, variable: string, exactOrigin: boolean): URL {
    const shape = exactOrigin ? "an exact HTTP(S) origin" : "an absolute HTTP(S) URL";
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return fail(`${variable} must be ${shape}`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") fail(`${variable} must be ${shape}`);
    if (url.username || url.password) fail(`${variable} cannot contain URL credentials`);
    if (exactOrigin && url.origin !== value) fail(`${variable} must be ${shape} without a path`);
    if (production && url.protocol !== "https:") fail(`${variable} must use HTTPS in production`);
    if (production && isReservedProductionHostname(url.hostname)) {
      fail(`${variable} cannot use a reserved or example hostname in production`);
    }
    return url;
  }

  return {
    runtime,
    production,
    fail,

    optional(variable: string): string | undefined {
      return env[variable]?.trim() || undefined;
    },

    required(variable: string, requirement = "is required"): string {
      return env[variable]?.trim() || fail(`${variable} ${requirement}`);
    },

    boolean(variable: string, defaultValue: boolean): boolean {
      const value = env[variable];
      if (value === undefined) return defaultValue;
      if (value === "true") return true;
      if (value === "false") return false;
      return fail(`${variable} must be true or false`);
    },

    integer(variable: string, defaultValue: number, range: { min: number; max: number }): number {
      const value = env[variable]?.trim();
      if (!value) return defaultValue;
      const parsed = /^-?\d+$/.test(value) ? Number(value) : Number.NaN;
      if (!Number.isSafeInteger(parsed) || parsed < range.min || parsed > range.max) {
        fail(`${variable} must be an integer from ${range.min} to ${range.max}`);
      }
      return parsed;
    },

    enumValue<const T extends string>(variable: string, allowed: readonly T[]): T {
      const value = env[variable]?.trim();
      if (value === undefined || !allowed.includes(value as T)) {
        fail(`${variable} must be one of ${allowed.join(", ")}`);
      }
      return value as T;
    },

    httpUrl(value: string, variable: string): string {
      return checkHttpUrl(value, variable, false).toString();
    },

    httpOrigin(value: string, variable: string): string {
      return checkHttpUrl(value, variable, true).origin;
    },

    /** `otherEntry` validates non-HTTP(S) entries such as an app scheme and must throw on rejection. */
    originList(variable: string, otherEntry?: (entry: string) => void): string[] {
      const entries = (env[variable] ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      for (const entry of entries) {
        if (/[*?]/.test(entry)) fail(`${variable} must use exact origins without wildcards`);
        if (/^https?:\/\//i.test(entry) || !otherEntry) checkHttpUrl(entry, variable, true);
        else otherEntry(entry);
      }
      return [...new Set(entries)];
    },
  };
}

export type EnvironmentReader = ReturnType<typeof readEnvironment>;
