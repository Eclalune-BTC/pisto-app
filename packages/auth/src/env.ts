export interface VersionedAuthSecret {
  version: number;
  value: string;
}

export interface AuthConfig {
  baseUrl: string;
  secret?: string;
  secrets?: VersionedAuthSecret[];
  trustedOrigins: string[];
  emailAndPasswordEnabled: boolean;
  production: boolean;
  trustedProxyHeaders: boolean;
}

export class AuthConfigurationError extends Error {
  override readonly name = "AuthConfigurationError";
}

function isReservedProductionHostname(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized === "::1" || normalized === "0.0.0.0") return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(normalized)) return true;
  return [
    "localhost",
    "test",
    "invalid",
    "example",
    "example.com",
    "example.net",
    "example.org",
  ].some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new AuthConfigurationError(`Invalid boolean value: ${value}`);
}

function parseVersionedSecrets(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const secrets = value.split(",").map((entry) => {
    const separator = entry.indexOf(":");
    if (separator < 1) {
      throw new AuthConfigurationError("BETTER_AUTH_SECRETS must use version:value entries");
    }
    const version = Number(entry.slice(0, separator).trim());
    const secret = entry.slice(separator + 1).trim();
    if (!Number.isSafeInteger(version) || version < 1 || secret.length < 32) {
      throw new AuthConfigurationError(
        "Each BETTER_AUTH_SECRETS entry needs a positive version and a value of at least 32 characters",
      );
    }
    return { version, value: secret };
  });
  if (new Set(secrets.map((secret) => secret.version)).size !== secrets.length) {
    throw new AuthConfigurationError("BETTER_AUTH_SECRETS cannot contain duplicate versions");
  }
  return secrets;
}

function parseOrigins(input: {
  value: string | undefined;
  expoScheme: string | undefined;
  production: boolean;
}): string[] {
  const { value, expoScheme, production } = input;
  if (!value?.trim()) return [];
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of origins) {
    if (/[*?]/.test(origin)) {
      throw new AuthConfigurationError(
        "TRUSTED_ORIGINS must use exact origins; wildcard entries are not allowed",
      );
    }
    if (/^https?:\/\//i.test(origin)) {
      let url: URL;
      try {
        url = new URL(origin);
      } catch {
        throw new AuthConfigurationError("TRUSTED_ORIGINS contains an invalid HTTP(S) origin");
      }
      if (
        url.origin !== origin ||
        url.username ||
        url.password ||
        (production && url.protocol !== "https:")
      ) {
        throw new AuthConfigurationError(
          production
            ? "Production TRUSTED_ORIGINS entries must be exact HTTPS origins"
            : "TRUSTED_ORIGINS HTTP(S) entries must be exact origins without paths",
        );
      }
      if (production && isReservedProductionHostname(url.hostname)) {
        throw new AuthConfigurationError(
          "Production TRUSTED_ORIGINS cannot contain reserved or example hostnames",
        );
      }
      continue;
    }

    const customScheme = origin.match(/^([a-z][a-z0-9+.-]*):\/\/(?:[a-z0-9._~-]+)?$/i)?.[1];
    if (!customScheme || !expoScheme || customScheme.toLowerCase() !== expoScheme.toLowerCase()) {
      throw new AuthConfigurationError(
        "TRUSTED_ORIGINS custom-scheme entries must use the configured EXPO_SCHEME",
      );
    }
  }
  return origins;
}

export function parseAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const production = (env.NODE_ENV ?? "development") === "production";
  const baseUrlValue = env.BETTER_AUTH_URL?.trim();
  let baseUrl: URL;
  try {
    baseUrl = new URL(baseUrlValue ?? "");
  } catch {
    throw new AuthConfigurationError(
      "BETTER_AUTH_URL is required and must be an exact HTTP(S) origin",
    );
  }
  if (
    !["http:", "https:"].includes(baseUrl.protocol) ||
    baseUrl.origin !== baseUrlValue ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw new AuthConfigurationError(
      "BETTER_AUTH_URL is required and must be an exact HTTP(S) origin",
    );
  }
  if (production && baseUrl.protocol !== "https:") {
    throw new AuthConfigurationError("BETTER_AUTH_URL must use HTTPS in production");
  }
  if (production && isReservedProductionHostname(baseUrl.hostname)) {
    throw new AuthConfigurationError(
      "BETTER_AUTH_URL cannot use a reserved or example hostname in production",
    );
  }
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (secret === "__GENERATED_BETTER_AUTH_SECRET__") {
    throw new AuthConfigurationError("BETTER_AUTH_SECRET must be generated before startup");
  }
  if (secret && secret.length < 32) {
    throw new AuthConfigurationError("BETTER_AUTH_SECRET must contain at least 32 characters");
  }
  const secrets = parseVersionedSecrets(env.BETTER_AUTH_SECRETS);
  if (!secret && !secrets) {
    throw new AuthConfigurationError("BETTER_AUTH_SECRET or BETTER_AUTH_SECRETS is required");
  }

  const expoScheme = env.EXPO_SCHEME?.trim().toLowerCase();
  if (expoScheme && !/^[a-z][a-z0-9+.-]*$/i.test(expoScheme)) {
    throw new AuthConfigurationError("EXPO_SCHEME is not a valid URL scheme");
  }
  if (expoScheme && ["http", "https", "javascript", "data", "file", "blob"].includes(expoScheme)) {
    throw new AuthConfigurationError("EXPO_SCHEME must be a private application URL scheme");
  }
  const trustedOrigins = [
    ...parseOrigins({
      value: env.TRUSTED_ORIGINS,
      expoScheme,
      production,
    }),
    ...(expoScheme ? [`${expoScheme}://`, `${expoScheme}://*`] : []),
  ];

  return {
    baseUrl: baseUrl.href.replace(/\/$/, ""),
    ...(secret ? { secret } : {}),
    ...(secrets ? { secrets } : {}),
    trustedOrigins: [...new Set(trustedOrigins)],
    emailAndPasswordEnabled: parseBoolean(env.AUTH_EMAIL_PASSWORD_ENABLED, true),
    production,
    trustedProxyHeaders: parseBoolean(env.AUTH_TRUSTED_PROXY_HEADERS, false),
  };
}
