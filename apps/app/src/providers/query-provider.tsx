import {
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import { router } from "expo-router";
import { type PropsWithChildren, useEffect, useState } from "react";

import { ApiClientError } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

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
          retry: 1,
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
        void Network.getNetworkStateAsync().then((state) => {
          setOnline(state.isConnected !== false && state.isInternetReachable !== false);
        });
        return () => subscription.remove();
      }),
    [],
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
