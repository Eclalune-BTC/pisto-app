import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import * as Network from "expo-network";
import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { authClient } from "@/lib/auth-client";
import { createSessionQueryClient } from "@/lib/session-query-client";

type Identity = string | null | undefined;

function sessionScope(identity: Identity, refetchSession: () => Promise<unknown>) {
  return { identity, ...createSessionQueryClient(refetchSession) };
}

export function QueryProvider({ children }: PropsWithChildren) {
  const { data: session, isPending, refetch } = authClient.useSession();
  const refetchSession = useRef(refetch);
  useEffect(() => {
    refetchSession.current = refetch;
  }, [refetch]);
  const refetchFresh = () => refetchSession.current({ query: { disableCookieCache: true } });
  // `undefined` means the stored session is still being restored.
  const [scope, setScope] = useState(() => sessionScope(undefined, refetchFresh));
  const settled: Identity = isPending ? undefined : (session?.user.id ?? null);

  // A mounted useQuery keeps the client it was created with, so replacing the client strands
  // every screen already on view. Restoring a session, signing in and signing out keep it: the
  // last two clear it explicitly. Only a direct switch to another account gets a fresh client.
  useEffect(() => {
    if (settled === undefined) return;
    setScope((current) => {
      if (current.identity === settled) return current;
      if (!current.identity || !settled) return { ...current, identity: settled };
      return sessionScope(settled, () =>
        refetchSession.current({ query: { disableCookieCache: true } }),
      );
    });
  }, [settled]);

  const { client, activate, dispose } = scope;
  useEffect(() => {
    activate();
    return dispose;
  }, [activate, dispose]);

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
          .catch(() => {
            if (active)
              console.error(
                "Initial network-state lookup failed; API requests remain authoritative",
              );
          });
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

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
