import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { env } from "@/lib/env";

export const authClient = createAuthClient({
  baseURL: env.authUrl,
  plugins: [
    expoClient({
      cookiePrefix: "pisto",
      scheme: env.appScheme,
      storagePrefix: env.appScheme,
      storage: SecureStore,
    }),
    organizationClient(),
  ],
});
