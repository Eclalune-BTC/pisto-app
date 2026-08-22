import { useQueryClient } from "@tanstack/react-query";
import { type Href, Link, usePathname, useRouter } from "expo-router";
import { CreditCard, LayoutDashboard, LogOut, Settings } from "lucide-react-native";
import type { ComponentType, PropsWithChildren } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

type NavItem = {
  href: Href;
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/billing", icon: CreditCard, label: "Billing" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

type AppShellProps = PropsWithChildren<{
  email?: string;
  name?: string;
}>;

export function AppShell({ children, email, name }: AppShellProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    router.replace("/sign-in");
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-[#0F1D18]" edges={["top", "left", "right"]}>
      <View className="flex-1 flex-row">
        {isWeb ? (
          <View className="hidden w-[256px] justify-between bg-ink px-5 py-7 lg:flex">
            <View className="gap-10">
              <View className="px-2">
                <Brand inverse />
              </View>
              <View className="gap-2">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link key={item.label} href={item.href} asChild>
                      <Pressable
                        className={cn(
                          "min-h-12 flex-row items-center gap-3 rounded-2xl px-4 active:opacity-80",
                          active ? "bg-accent" : "bg-transparent",
                        )}
                      >
                        <Icon color={active ? "#14241D" : "#B9C6BF"} size={20} strokeWidth={2.2} />
                        <Text
                          className={cn(
                            "text-[15px] font-bold",
                            active ? "text-ink" : "text-[#D3DDD7]",
                          )}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    </Link>
                  );
                })}
              </View>
            </View>

            <View className="gap-3 rounded-[22px] border border-[#365046] bg-[#1B332A] p-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EAF0EB]">
                <Text className="font-black text-ink">
                  {name?.slice(0, 1).toUpperCase() || "P"}
                </Text>
              </View>
              <View className="gap-0.5">
                <Text className="font-bold text-white" numberOfLines={1}>
                  {name || "Pisto member"}
                </Text>
                <Text className="text-xs text-[#AFC0B6]" numberOfLines={1}>
                  {email || "Signed in securely"}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Sign out"
                className="min-h-10 flex-row items-center gap-2 rounded-xl active:opacity-70"
                onPress={signOut}
              >
                <LogOut color="#D3DDD7" size={17} />
                <Text className="text-sm font-bold text-[#D3DDD7]">Sign out</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View className="min-w-0 flex-1">
          <View
            className={cn(
              "min-h-16 flex-row items-center justify-between border-b border-line bg-canvas px-5 dark:border-[#2B3C34] dark:bg-[#0F1D18]",
              isWeb && "lg:hidden",
            )}
          >
            <Brand />
            <View className="h-9 w-9 items-center justify-center rounded-full bg-ink dark:bg-accent">
              <Text className="font-black text-white dark:text-ink">
                {name?.slice(0, 1).toUpperCase() || "P"}
              </Text>
            </View>
          </View>

          <View className="min-h-0 flex-1">{children}</View>

          <View
            className={cn(
              "flex-row border-t border-line bg-white px-3 pb-2 pt-2 dark:border-[#2B3C34] dark:bg-[#15251E]",
              isWeb && "lg:hidden",
            )}
          >
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link key={item.label} href={item.href} asChild>
                  <Pressable className="min-h-14 flex-1 items-center justify-center gap-1 rounded-2xl active:bg-[#EFF3EF] dark:active:bg-[#21352C]">
                    <Icon
                      color={active ? "#237A55" : "#7E8D84"}
                      size={21}
                      strokeWidth={active ? 2.6 : 2}
                    />
                    <Text
                      className={cn(
                        "text-[11px] font-bold",
                        active ? "text-positive dark:text-[#8DDEAF]" : "text-[#7E8D84]",
                      )}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
