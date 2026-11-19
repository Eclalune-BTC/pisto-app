import { Redirect, Slot } from "expo-router";
import { ShieldAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/app-shell";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { authClient } from "@/lib/auth-client";

export default function AuthenticatedLayout() {
  const { t } = useTranslation();
  const { data: session, error, isPending, isRefetching, refetch } = authClient.useSession();

  if (!isPending && !error && !session) return <Redirect href="/sign-in" />;

  // A refresh that fails on the network keeps the last known session. The screen stays mounted
  // then: replacing it would discard a typed form and the key of a command whose outcome is still
  // unknown, and the server authorizes every request on its own anyway.
  const unverified = Boolean(error) && Boolean(session);

  // The navigator stays mounted while the session restores: unmounting it resets the router to
  // the group's first route and the deep link bounces.
  return (
    <AppShell
      sessionUnverified={unverified}
      user={session ? { email: session.user.email, name: session.user.name } : null}
    >
      {error && !session ? (
        <Page width="reading">
          <StatePanel
            action={
              <Button
                label={t("session.checkAgain")}
                loading={isRefetching}
                onPress={() => refetch()}
                size="sm"
                variant="outline"
              />
            }
            description={t("session.checkFailedDescription")}
            icon={ShieldAlert}
            level={1}
            title={t("session.checkFailedTitle")}
          />
        </Page>
      ) : (
        <Slot />
      )}
    </AppShell>
  );
}
