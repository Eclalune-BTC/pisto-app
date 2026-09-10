import {
  focusManager,
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import { router } from "expo-router";
import { type PropsWithChildren, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import { ApiClientError } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { shouldRetryQuery } from "@/lib/query-policy";

let recoveringUnauthorizedSession = false;

function recoverUnauthorizedSession(error: unknown, queryClient: QueryClient) {
  if (
    recoveringUnauthorizedSession ||
    !(error instanceof ApiClientError) ||
    error.code !== "UNAUTHORIZED"
  ) {
    return;
  }
  recoveringUnauthorizedSession = true;
  void authClient
    .signOut()
    .catch(() => undefined)
    .finally(() => {
      queryClient.clear();
      router.replace("/sign-in");
      recoveringUnauthorizedSession = false;
    });
}

export function QueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => {
    let client: QueryClient;
    const handleError = (error: unknown): void => recoverUnauthorizedSession(error, client);
    client = new QueryClient({
      mutationCache: new MutationCache({
        onError: handleError,
      }),
      queryCache: new QueryCache({
        onError: handleError,
      }),
      defaultOptions: {
        queries: {
          retry: shouldRetryQuery,
          staleTime: 30_000,
        },
        mutations: {
          retry: 0,
        },
      },
    });
    return client;
  });

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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
