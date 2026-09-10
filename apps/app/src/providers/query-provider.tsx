import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import * as Network from "expo-network";
import { type PropsWithChildren, useEffect, useMemo } from "react";
import { AppState, Platform } from "react-native";

import { authClient } from "@/lib/auth-client";
import { createSessionQueryClient } from "@/lib/session-query-client";

export function QueryProvider({ children }: PropsWithChildren) {
  const { data: session, refetch } = authClient.useSession();
  const identity = session?.user.id;
  // Each identity owns a fresh cache; AuthenticatedLayout keys the account
  // subtree too, while the root navigator remains mounted.
  const scope = useMemo(
    () => createSessionQueryClient(() => refetch({ query: { disableCookieCache: true } })),
    [identity, refetch],
  );
  useEffect(() => {
    scope.activate();
    return scope.dispose;
  }, [scope]);

  useEffect(
    () =>
      onlineManager.setEventListener((setOnline) => {
        const subscription = Network.addNetworkStateListener((state) => {
          setOnline(state.isConnected !== false && state.isInternetReachable !== false);
        });
        let active = true;
        void Network.getNetworkStateAsync()
          .then((state) => {
            if (active)
              setOnline(state.isConnected !== false && state.isInternetReachable !== false);
          })
          .catch(() => undefined);
        return () => {
          active = false;
          subscription.remove();
        };
      }),
    [],
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    focusManager.setFocused(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
    });
    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);

  return <QueryClientProvider client={scope.client}>{children}</QueryClientProvider>;
}
