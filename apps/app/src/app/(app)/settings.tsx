import { useQuery } from "@tanstack/react-query";
import { Laptop, LockKeyhole, LogOut, Moon, ShieldCheck, Sun } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { Uniwind, useUniwind } from "uniwind";

import { ScreenHeader } from "@/components/screen-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useSignOut } from "@/hooks/use-sign-out";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

type ThemeChoice = "light" | "dark" | "system";

const themeChoices = [
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
  { icon: Laptop, label: "System", value: "system" },
] as const;

export default function SettingsScreen() {
  const { data: authSession } = authClient.useSession();
  const profile = useQuery({ queryFn: api.me, queryKey: ["account", "me"] });
  const { hasAdaptiveThemes, theme } = useUniwind();
  const activeTheme: ThemeChoice = hasAdaptiveThemes
    ? "system"
    : theme === "dark"
      ? "dark"
      : "light";
  const user = profile.data?.user ?? authSession?.user;
  const signOutAction = useSignOut();

  const selectTheme = (choice: ThemeChoice) => {
    Uniwind.setTheme(choice);
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="mx-auto w-full max-w-[980px] gap-8 px-5 py-7 sm:px-8 sm:py-10 lg:px-12"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        description="Keep your account, preferences, and security choices in one place."
        eyebrow="Settings"
        title="Make Pisto feel like yours"
      />

      <Card className="gap-6 p-6 sm:flex-row sm:items-center sm:p-7">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Text className="text-2xl font-black text-ink">
            {user?.name?.slice(0, 1).toUpperCase() || "P"}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <CardTitle className="text-2xl">{user?.name || "Pisto member"}</CardTitle>
          <CardDescription>{user?.email || "Your account details are loading."}</CardDescription>
        </View>
        <Badge tone={user?.emailVerified ? "positive" : "warning"}>
          {user?.emailVerified ? "Email verified" : "Email not verified"}
        </Badge>
      </Card>

      <Card className="gap-6 p-6">
        <View className="gap-0.5">
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose what is easiest on your eyes.</CardDescription>
        </View>
        <View className="flex-row rounded-xl bg-[#EFF3EF] p-1.5 dark:bg-[#14241D]">
          {themeChoices.map((choice) => {
            const Icon = choice.icon;
            const selected = activeTheme === choice.value;
            return (
              <Button
                key={choice.value}
                accessibilityState={{ selected }}
                className={cn(
                  "min-h-12 flex-1 gap-1 px-2",
                  selected ? "bg-white dark:bg-[#2A4036]" : "bg-transparent",
                )}
                onPress={() => selectTheme(choice.value)}
                variant="ghost"
              >
                <Icon color={selected ? "#237A55" : "#7B8A82"} size={17} />
                <Text
                  className={cn(
                    "text-xs font-bold",
                    selected ? "text-ink dark:text-white" : "text-[#7B8A82]",
                  )}
                >
                  {choice.label}
                </Text>
              </Button>
            );
          })}
        </View>
      </Card>

      <Card className="gap-6 p-6 sm:p-7">
        <View className="flex-row items-start gap-3">
          <ShieldCheck color="#237A55" size={23} />
          <View className="min-w-0 flex-1 gap-1">
            <CardTitle>Security and sessions</CardTitle>
            <CardDescription>
              Better Auth manages your session. On mobile, session cookies are cached with Expo
              SecureStore.
            </CardDescription>
          </View>
        </View>
        <View className="flex-row items-center gap-3 border-t border-line pt-5 dark:border-[#304239]">
          <LockKeyhole color="#617168" size={20} />
          <View className="min-w-0 flex-1">
            <Text className="font-bold text-ink dark:text-white">Current session</Text>
            <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
              {profile.data?.session.expiresAt
                ? `Expires ${new Date(profile.data.session.expiresAt).toLocaleDateString()}`
                : "Protected session details are available from the API."}
            </Text>
          </View>
          <Badge tone={profile.isError ? "warning" : "positive"}>
            {profile.isPending ? "Checking" : profile.isError ? "Unknown" : "Active"}
          </Badge>
        </View>
      </Card>

      <View className="gap-4 border-t border-[#F0CDCD] pt-6 dark:border-[#603939]">
        <View className="gap-1">
          <CardTitle>Sign out of Pisto</CardTitle>
          <CardDescription>Your local session will be cleared from this device.</CardDescription>
        </View>
        {signOutAction.error ? (
          <Text className="text-sm leading-5 text-danger dark:text-[#FFBABA]">
            {signOutAction.error}
          </Text>
        ) : null}
        <Button
          className="self-start"
          loading={signOutAction.isPending}
          onPress={signOutAction.signOut}
          variant="danger"
        >
          <LogOut color="#FFFFFF" size={17} />
          <Text className="text-[15px] font-bold text-white">Sign out</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
