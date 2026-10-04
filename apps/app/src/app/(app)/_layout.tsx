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

  // The navigator stays mounted while the session restores: unmounting it resets the router to
  // the group's first route and the deep link bounces.
  return (
    <AppShell user={session ? { email: session.user.email, name: session.user.name } : null}>
      {error ? (
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
