import { type Environment, readEnvironment } from "@pisto/config";

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
  ipAddressHeader?: string;
}

export class AuthConfigurationError extends Error {
  override readonly name = "AuthConfigurationError";
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

export function parseAuthConfig(env: Environment): AuthConfig {
  const read = readEnvironment(env, AuthConfigurationError);
  const baseUrl = read.httpOrigin(read.required("BETTER_AUTH_URL"), "BETTER_AUTH_URL");

  const secret = read.optional("BETTER_AUTH_SECRET");
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

  const expoScheme = read.optional("EXPO_SCHEME")?.toLowerCase();
  if (expoScheme && !/^[a-z][a-z0-9+.-]*$/.test(expoScheme)) {
    throw new AuthConfigurationError("EXPO_SCHEME is not a valid URL scheme");
  }
  if (expoScheme && ["http", "https", "javascript", "data", "file", "blob"].includes(expoScheme)) {
    throw new AuthConfigurationError("EXPO_SCHEME must be a private application URL scheme");
  }
  const trustedOrigins = read.originList("TRUSTED_ORIGINS", (origin) => {
    const customScheme = origin.match(/^([a-z][a-z0-9+.-]*):\/\/(?:[a-z0-9._~-]+)?$/i)?.[1];
    if (!customScheme || !expoScheme || customScheme.toLowerCase() !== expoScheme) {
      throw new AuthConfigurationError(
        "TRUSTED_ORIGINS custom-scheme entries must use the configured EXPO_SCHEME",
      );
    }
  });
  if (expoScheme) trustedOrigins.push(`${expoScheme}://`, `${expoScheme}://*`);
  const ipAddressHeader = read.optional("AUTH_IP_ADDRESS_HEADER")?.toLowerCase();
  if (ipAddressHeader && !/^[a-z0-9-]+$/.test(ipAddressHeader)) {
    throw new AuthConfigurationError("AUTH_IP_ADDRESS_HEADER must be one HTTP header name");
  }

  return {
    baseUrl,
    ...(secret ? { secret } : {}),
    ...(secrets ? { secrets } : {}),
    trustedOrigins: [...new Set(trustedOrigins)],
    emailAndPasswordEnabled: read.boolean("AUTH_EMAIL_PASSWORD_ENABLED", true),
    production: read.production,
    trustedProxyHeaders: read.boolean("AUTH_TRUSTED_PROXY_HEADERS", false),
    ...(ipAddressHeader ? { ipAddressHeader } : {}),
  };
}
