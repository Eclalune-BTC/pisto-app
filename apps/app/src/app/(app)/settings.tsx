import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Bell, Laptop, LockKeyhole, LogOut, Moon, ShieldCheck, Sun } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { Uniwind, useUniwind } from "uniwind";

import { ScreenHeader } from "@/components/screen-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
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
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: authSession } = authClient.useSession();
  const profile = useQuery({ queryFn: api.me, queryKey: ["account", "me"] });
  const { hasAdaptiveThemes, theme } = useUniwind();
  const [weeklyReview, setWeeklyReview] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);
  const activeTheme: ThemeChoice = hasAdaptiveThemes
    ? "system"
    : theme === "dark"
      ? "dark"
      : "light";
  const user = profile.data?.user ?? authSession?.user;

  const selectTheme = (choice: ThemeChoice) => {
    Uniwind.setTheme(choice);
  };

  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    router.replace("/sign-in");
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
          {user?.emailVerified ? "EMAIL VERIFIED" : "VERIFY EMAIL"}
        </Badge>
      </Card>

      <View className="gap-5 lg:flex-row">
        <Card className="flex-1 gap-6 p-6">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF3EE] dark:bg-[#24372E]">
              <Sun color="#237A55" size={21} />
            </View>
            <View className="gap-0.5">
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose what is easiest on your eyes.</CardDescription>
            </View>
          </View>
          <View className="flex-row rounded-[18px] bg-[#EFF3EF] p-1.5 dark:bg-[#14241D]">
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

        <Card className="flex-1 gap-6 p-6">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF3EE] dark:bg-[#24372E]">
              <Bell color="#237A55" size={21} />
            </View>
            <View className="gap-0.5">
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Only the updates you find useful.</CardDescription>
            </View>
          </View>
          <View className="gap-5">
            <PreferenceToggle
              description="A short prompt to check your plan."
              label="Weekly review"
              onChange={setWeeklyReview}
              value={weeklyReview}
            />
            <PreferenceToggle
              description="Occasional notes about meaningful changes."
              label="Product updates"
              onChange={setProductUpdates}
              value={productUpdates}
            />
          </View>
        </Card>
      </View>

      <Card className="gap-6 p-6 sm:p-7">
        <View className="flex-row items-start gap-4">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#E9F6EE] dark:bg-[#224634]">
            <ShieldCheck color="#237A55" size={23} />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <CardTitle>Security and sessions</CardTitle>
            <CardDescription>
              Better Auth manages your session. On mobile, session cookies are cached with Expo
              SecureStore.
            </CardDescription>
          </View>
        </View>
        <View className="flex-row items-center gap-3 rounded-[20px] bg-[#F2F6F2] p-4 dark:bg-[#14241D]">
          <LockKeyhole color="#617168" size={20} />
          <View className="min-w-0 flex-1">
            <Text className="font-bold text-ink dark:text-white">Current session</Text>
            <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
              {profile.data?.session.expiresAt
                ? `Expires ${new Date(profile.data.session.expiresAt).toLocaleDateString()}`
                : "Protected session details are available from the API."}
            </Text>
          </View>
          <Badge tone="positive">ACTIVE</Badge>
        </View>
      </Card>

      <Card className="gap-4 border-[#F0CDCD] p-6 dark:border-[#603939]">
        <View className="gap-1">
          <CardTitle>Sign out of Pisto</CardTitle>
          <CardDescription>Your local session will be cleared from this device.</CardDescription>
        </View>
        <Button className="self-start" onPress={signOut} variant="danger">
          <LogOut color="#FFFFFF" size={17} />
          <Text className="text-[15px] font-bold text-white">Sign out</Text>
        </Button>
      </Card>
    </ScrollView>
  );
}

function PreferenceToggle({
  description,
  label,
  onChange,
  value,
}: {
  description: string;
  label: string;
  onChange(value: boolean): void;
  value: boolean;
}) {
  return (
    <View className="flex-row items-center gap-4">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-bold text-ink dark:text-white">{label}</Text>
        <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        ios_backgroundColor="#D3DDD7"
        onValueChange={onChange}
        thumbColor={value ? "#14241D" : "#FFFFFF"}
        trackColor={{ false: "#D3DDD7", true: "#D9FB67" }}
        value={value}
      />
    </View>
  );
}
