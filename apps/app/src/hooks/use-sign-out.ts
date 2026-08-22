import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { requireConfirmedSignOut } from "@/lib/sign-out";

const signOutErrorMessage =
  "Pisto could not confirm sign-out. Check your connection and try again.";

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  const signOut = useCallback(async () => {
    if (isPending) return;

    setError(undefined);
    setIsPending(true);

    try {
      await requireConfirmedSignOut(() => authClient.signOut());

      queryClient.clear();
      router.replace("/sign-in");
    } catch {
      setError(signOutErrorMessage);
    } finally {
      setIsPending(false);
    }
  }, [isPending, queryClient, router]);

  return { error, isPending, signOut } as const;
}
