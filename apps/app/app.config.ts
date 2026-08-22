import type { ConfigContext, ExpoConfig } from "expo/config";

const fallbackBundleIdentifier = "com.example.pisto";
const fallbackScheme = "pisto";
const reservedAppSchemes = new Set(["blob", "data", "file", "http", "https", "javascript"]);

function isPrivateAppScheme(value: string) {
  return /^[A-Za-z][A-Za-z0-9+.-]*$/.test(value) && !reservedAppSchemes.has(value.toLowerCase());
}

function isExactApiOrigin(value: string, requireHttps: boolean) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || (!requireHttps && url.protocol === "http:")) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function isPlaceholderIdentifier(value: string) {
  return value === fallbackBundleIdentifier || value.startsWith("com.example.");
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const configuredScheme = process.env.EXPO_PUBLIC_APP_SCHEME?.trim();
  const scheme = configuredScheme || fallbackScheme;
  const iosBundleIdentifier =
    process.env.EXPO_IOS_BUNDLE_IDENTIFIER?.trim() || fallbackBundleIdentifier;
  const androidPackage = process.env.EXPO_ANDROID_PACKAGE?.trim() || fallbackBundleIdentifier;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const isProduction = process.env.APP_VARIANT === "production";

  if (!isPrivateAppScheme(scheme)) {
    throw new Error("EXPO_PUBLIC_APP_SCHEME must be a valid private URI scheme.");
  }

  if (apiUrl && !isExactApiOrigin(apiUrl, isProduction)) {
    throw new Error(
      isProduction
        ? "Production EXPO_PUBLIC_API_URL must be an exact HTTPS origin."
        : "EXPO_PUBLIC_API_URL must be an exact HTTP(S) origin.",
    );
  }

  if (
    isProduction &&
    (!configuredScheme ||
      !apiUrl ||
      isPlaceholderIdentifier(iosBundleIdentifier) ||
      isPlaceholderIdentifier(androidPackage))
  ) {
    throw new Error(
      "Production builds require EXPO_PUBLIC_API_URL, EXPO_PUBLIC_APP_SCHEME, EXPO_IOS_BUNDLE_IDENTIFIER, and EXPO_ANDROID_PACKAGE with release-safe values.",
    );
  }

  return {
    ...config,
    name: "Pisto",
    plugins: [
      ...(config.plugins ?? []),
      [
        "expo-localization",
        {
          supportedLocales: {
            android: ["es-SV"],
            ios: ["es-SV"],
          },
        },
      ],
    ],
    slug: "pisto",
    scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: iosBundleIdentifier,
    },
    android: {
      ...config.android,
      package: androidPackage,
    },
  };
};
