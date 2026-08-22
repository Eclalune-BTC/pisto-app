import { type Href, Link, usePathname } from "expo-router";
import { LogOut, ReceiptText, UserRound } from "lucide-react-native";
import type { ComponentType, PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";
import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/cn";

type NavItem = {
  href: Href;
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  labelKey: "common.operate" | "common.account";
  matchPrefix: string;
};

const navItems: NavItem[] = [
  {
    href: "/operate/sales",
    icon: ReceiptText,
    labelKey: "common.operate",
    matchPrefix: "/operate",
  },
  { href: "/settings", icon: UserRound, labelKey: "common.account", matchPrefix: "/settings" },
];

type AppShellProps = PropsWithChildren<{
  email?: string;
  name?: string;
}>;

export function AppShell({ children, email, name }: AppShellProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isWeb = Platform.OS === "web";
  const signOutAction = useSignOut();

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-[#0F1D18]" edges={["top", "left", "right"]}>
      <View className="flex-1 flex-row">
        {isWeb ? (
          <View
            accessibilityLabel={t("shell.primaryNavigation")}
            className="hidden w-[272px] justify-between bg-ink px-6 py-7 lg:flex"
            role="navigation"
          >
            <View className="gap-10">
              <View className="px-2">
                <Brand inverse />
              </View>
              <View className="gap-2">
                {navItems.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.matchPrefix}/`);
                  const Icon = item.icon;

                  return (
                    <Link key={item.labelKey} href={item.href} asChild>
                      <Pressable
                        accessibilityState={{ selected: active }}
                        className={cn(
                          "min-h-12 flex-row items-center gap-3 border-l-2 px-4 active:opacity-80",
                          active ? "border-accent bg-accent" : "border-transparent bg-transparent",
                        )}
                      >
                        <Icon color={active ? "#14241D" : "#B9C6BF"} size={20} strokeWidth={2.2} />
                        <Text
                          className={cn(
                            "text-[15px] font-bold",
                            active ? "text-ink" : "text-[#D3DDD7]",
                          )}
                        >
                          {t(item.labelKey)}
                        </Text>
                      </Pressable>
                    </Link>
                  );
                })}
              </View>
            </View>

            <View className="gap-3 border-t border-[#365046] px-2 pt-5">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EAF0EB]">
                <Text className="font-black text-ink">
                  {name?.slice(0, 1).toUpperCase() || "P"}
                </Text>
              </View>
              <View className="gap-0.5">
                <Text className="font-bold text-white" numberOfLines={1}>
                  {name || t("common.pistoAccount")}
                </Text>
                <Text className="text-xs text-[#AFC0B6]" numberOfLines={1}>
                  {email || t("common.protectedSession")}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={t("common.signOut")}
                className="min-h-10 flex-row items-center gap-2 rounded-xl active:opacity-70"
                disabled={signOutAction.isPending}
                onPress={signOutAction.signOut}
              >
                <LogOut color="#D3DDD7" size={17} />
                <Text className="text-sm font-bold text-[#D3DDD7]">
                  {signOutAction.isPending ? t("shell.signingOut") : t("common.signOut")}
                </Text>
              </Pressable>
              {signOutAction.error ? (
                <Text className="text-xs leading-4 text-[#F6BB76]">{signOutAction.error}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View className="min-w-0 flex-1">
          <View
            className={cn(
              "min-h-16 flex-row items-center justify-between border-b border-line bg-canvas px-5 dark:border-[#2B3C34] dark:bg-[#0F1D18]",
              isWeb && "lg:hidden",
            )}
            role="banner"
          >
            <Brand />
            <View className="h-9 w-9 items-center justify-center rounded-full bg-ink dark:bg-accent">
              <Text className="font-black text-white dark:text-ink">
                {name?.slice(0, 1).toUpperCase() || "P"}
              </Text>
            </View>
          </View>

          <View className="min-h-0 flex-1" role="main">
            {children}
          </View>

          <SafeAreaView
            accessibilityLabel={t("shell.primaryNavigation")}
            className={cn(
              "flex-row border-t border-line bg-white px-3 pb-2 pt-2 dark:border-[#2B3C34] dark:bg-[#15251E]",
              isWeb && "lg:hidden",
            )}
            edges={["bottom"]}
            role="navigation"
          >
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.matchPrefix}/`);
              const Icon = item.icon;

              return (
                <Link key={item.labelKey} href={item.href} asChild>
                  <Pressable
                    accessibilityState={{ selected: active }}
                    className={cn(
                      "min-h-14 flex-1 items-center justify-center gap-1 border-t-2 active:bg-[#EFF3EF] dark:active:bg-[#21352C]",
                      active ? "border-positive" : "border-transparent",
                    )}
                  >
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
                      {t(item.labelKey)}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
          </SafeAreaView>
        </View>
      </View>
    </SafeAreaView>
  );
}
