export type HttpUrl = string & { readonly __brand: "HttpUrl" };
export type AppScheme = string & { readonly __brand: "AppScheme" };

const developmentApiUrl = "http://localhost:3001";
const reservedAppSchemes = new Set(["blob", "data", "file", "http", "https", "javascript"]);

export function normalizeHttpUrl(value: string, variableName: string): HttpUrl {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid absolute URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${variableName} must use http or https.`);
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${variableName} must be an exact HTTP(S) origin.`);
  }

  return parsed.origin as HttpUrl;
}

export function joinHttpUrl(baseUrl: HttpUrl, path: `/${string}`): HttpUrl {
  return new URL(path, `${baseUrl}/`).toString().replace(/\/$/, "") as HttpUrl;
}

export function normalizeAppScheme(value: string): AppScheme {
  if (!/^[A-Za-z][A-Za-z0-9+.-]*$/.test(value) || reservedAppSchemes.has(value.toLowerCase())) {
    throw new Error("EXPO_PUBLIC_APP_SCHEME must be a valid private URI scheme.");
  }

  return value as AppScheme;
}

const apiUrl = normalizeHttpUrl(
  process.env.EXPO_PUBLIC_API_URL ?? developmentApiUrl,
  "EXPO_PUBLIC_API_URL",
);

export const env = {
  apiUrl,
  appScheme: normalizeAppScheme(process.env.EXPO_PUBLIC_APP_SCHEME ?? "pisto"),
  authUrl: joinHttpUrl(apiUrl, "/api/auth"),
} as const;
