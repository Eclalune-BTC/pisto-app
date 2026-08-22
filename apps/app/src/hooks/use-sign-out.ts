import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { authClient } from "@/lib/auth-client";
import { requireConfirmedSignOut } from "@/lib/sign-out";

export function useSignOut() {
  const { t } = useTranslation();
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
      setError(t("session.signOutFailed"));
    } finally {
      setIsPending(false);
    }
  }, [isPending, queryClient, router, t]);

  return { error, isPending, signOut } as const;
}
