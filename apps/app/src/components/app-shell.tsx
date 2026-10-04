import { useQuery } from "@tanstack/react-query";
import { type Href, Link, usePathname } from "expo-router";
import { CreditCard, LayoutGrid, LogOut, Menu, UserRound, X } from "lucide-react-native";
import { type ComponentType, type PropsWithChildren, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { AppearanceControl } from "@/components/appearance-control";
import { Brand } from "@/components/brand";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Sidebar, SidebarLink } from "@/components/ui/sidebar";
import { Text } from "@/components/ui/text";
import { operateModuleIcons } from "@/features/operate/module-icons";
import { getVisibleOperateModules, OPERATE_GROUPS } from "@/features/operate/navigation";
import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/cn";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";

type NavItem = {
  href: Href;
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  labelKey: "common.operate" | "common.account";
  matchPrefixes: readonly string[];
};

const navItems: readonly NavItem[] = [
  {
    href: "/operate",
    icon: LayoutGrid,
    labelKey: "common.operate",
    matchPrefixes: ["/operate"],
  },
  {
    href: "/settings",
    icon: UserRound,
    labelKey: "common.account",
    matchPrefixes: ["/settings", "/billing"],
  },
];

function matchesRoute(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isNavigationItemActive(pathname: string, item: NavItem) {
  return item.matchPrefixes.some((prefix) => matchesRoute(pathname, prefix));
}

type AppShellProps = PropsWithChildren<{
  email: string;
  name: string;
}>;

export function AppShell({ children, email, name }: AppShellProps) {
  const { t } = useTranslation();
  const [foreground, mutedForeground] = useCSSVariable([
    "--color-foreground",
    "--color-muted-foreground",
  ]) as [string, string];
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;
  const [navigationOpen, setNavigationOpen] = useState(false);
  const signOutAction = useSignOut();
  const businesses = useQuery(businessesQueryOptions);
  const denied = hasDeniedRead([businesses]);
  const activeBusiness = denied ? undefined : getActiveBusiness(businesses.data);
  const operateModules = getVisibleOperateModules(activeBusiness?.access.permissions);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Route and breakpoint changes must dismiss the navigation overlay.
  useEffect(() => {
    setNavigationOpen(false);
  }, [pathname, isDesktop]);

  const closeNavigation = () => setNavigationOpen(false);
  const navigation = (
    <Sidebar
      label={t("shell.primaryNavigation")}
      header={
        <View className="gap-5">
          {isDesktop ? <Brand /> : null}
          {activeBusiness ? (
            <View className="gap-1 border-l-2 border-primary/40 pl-3">
              <Text className="text-xs text-muted-foreground">{t("shell.businessContext")}</Text>
              <Text className="font-ui text-sm text-sidebar-foreground">{activeBusiness.name}</Text>
            </View>
          ) : null}
          {activeBusiness && queryHasStaleData(businesses) ? (
            <Text accessibilityLiveRegion="polite" className="text-xs text-muted-foreground">
              {t("remote.stale")}
            </Text>
          ) : null}
        </View>
      }
      footer={
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <View className="min-w-0 flex-1 gap-1">
              <Text className="font-ui text-sm text-foreground" numberOfLines={1}>
                {name || t("common.pistoAccount")}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {email}
              </Text>
            </View>
            <AppearanceControl compact />
          </View>
          <Button
            accessibilityLabel={t("common.signOut")}
            className="h-auto min-h-11 justify-start px-3 py-2"
            loading={signOutAction.isPending}
            onPress={signOutAction.signOut}
            variant="ghost"
          >
            <Icon as={LogOut} className="text-muted-foreground" size={18} />
            <ButtonText className="shrink text-sm" variant="ghost">
              {signOutAction.isPending ? t("shell.signingOut") : t("common.signOut")}
            </ButtonText>
          </Button>
          {signOutAction.error ? (
            <Text accessibilityRole="alert" className="text-sm leading-5 text-foreground">
              {signOutAction.error}
            </Text>
          ) : null}
        </View>
      }
    >
      <SidebarLink
        active={pathname === "/operate"}
        current={pathname === "/operate"}
        href="/operate"
        icon={<Icon as={LayoutGrid} className="text-sidebar-foreground" size={19} />}
        label={t("common.operate")}
        onNavigate={closeNavigation}
      />
      {OPERATE_GROUPS.map((group) => {
        const modules = operateModules.filter((module) => module.group === group.id);
        if (!modules.length) return null;
        return (
          <View className="gap-1" key={group.id}>
            <Text className="px-3 pb-1 font-ui text-xs text-muted-foreground">
              {t(group.labelKey)}
            </Text>
            {modules.map((module) => {
              const active = matchesRoute(pathname, String(module.href));
              return (
                <SidebarLink
                  active={active}
                  current={active}
                  href={module.href}
                  key={module.id}
                  icon={
                    <Icon
                      as={operateModuleIcons[module.id]}
                      className="text-sidebar-foreground"
                      size={19}
                    />
                  }
                  label={t(module.labelKey)}
                  onNavigate={closeNavigation}
                />
              );
            })}
          </View>
        );
      })}
      <View className="gap-1">
        <Separator className="mb-3 bg-sidebar-border" />
        <SidebarLink
          active={pathname === "/settings"}
          current={pathname === "/settings"}
          href="/settings"
          icon={<Icon as={UserRound} className="text-sidebar-foreground" size={19} />}
          label={t("common.account")}
          onNavigate={closeNavigation}
        />
        <SidebarLink
          active={matchesRoute(pathname, "/billing")}
          current={matchesRoute(pathname, "/billing")}
          href="/billing"
          icon={<Icon as={CreditCard} className="text-sidebar-foreground" size={19} />}
          label={t("settings.billing")}
          onNavigate={closeNavigation}
        />
      </View>
    </Sidebar>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <View className="min-h-0 flex-1 flex-row">
        {isDesktop ? (
          <View className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar">
            {navigation}
          </View>
        ) : null}
        <View className="min-w-0 flex-1">
          {!isDesktop ? (
            <View
              className="min-h-16 flex-row items-center justify-between gap-2 border-b border-border bg-card px-3 py-2"
              role="banner"
            >
              <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
                <DialogTrigger asChild>
                  <Button
                    accessibilityLabel={t("shell.openNavigation")}
                    className="h-12 w-12"
                    size="icon"
                    variant="ghost"
                  >
                    <Menu color={foreground} size={22} />
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="mx-0 max-w-none gap-0 rounded-none border-0 border-r border-border bg-sidebar p-0 shadow-none sm:max-w-none web:max-w-none"
                  hideClose
                  overlayClassName="items-start justify-start bg-foreground/40 p-0"
                  style={{ height, width: Math.min(320, width - 24) }}
                >
                  <SafeAreaView
                    className="min-h-0 flex-1"
                    edges={["top", "bottom", "left", "right"]}
                  >
                    <DialogHeader className="gap-2 px-4 pb-2 pt-4">
                      <View className="flex-row items-center justify-between gap-2">
                        <DialogTitle className="shrink text-left text-base">
                          {t("shell.primaryNavigation")}
                        </DialogTitle>
                        <DialogClose asChild>
                          <Button
                            accessibilityLabel={t("shell.closeNavigation")}
                            className="h-12 w-12"
                            size="icon"
                            variant="ghost"
                          >
                            <X color={foreground} size={20} />
                          </Button>
                        </DialogClose>
                      </View>
                      <DialogDescription className="text-left text-sm">
                        {t("shell.navigationDescription")}
                      </DialogDescription>
                    </DialogHeader>
                    {navigation}
                  </SafeAreaView>
                </DialogContent>
              </Dialog>
              <Brand />
              <AppearanceControl compact />
            </View>
          ) : null}

          <View className="min-h-0 flex-1" role="main">
            {children}
          </View>

          {!isDesktop ? (
            <SafeAreaView
              accessibilityLabel={t("shell.primaryNavigation")}
              className="flex-row border-t border-border bg-card px-3 pb-2 pt-2"
              edges={["bottom"]}
              role="navigation"
            >
              {navItems.map((item) => {
                const active = isNavigationItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <Link key={item.labelKey} href={item.href} asChild>
                    <Button
                      accessibilityRole="link"
                      accessibilityState={{ selected: active }}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "h-auto min-h-14 flex-1 flex-col gap-1 rounded-lg px-2 py-2",
                        active && "bg-accent",
                      )}
                      variant="ghost"
                    >
                      <Icon color={active ? foreground : mutedForeground} size={21} />
                      <Text
                        className={cn(
                          "font-ui text-xs",
                          active ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {t(item.labelKey)}
                      </Text>
                    </Button>
                  </Link>
                );
              })}
            </SafeAreaView>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
