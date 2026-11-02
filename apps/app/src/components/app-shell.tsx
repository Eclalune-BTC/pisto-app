import { useQuery } from "@tanstack/react-query";
import { usePathname } from "expo-router";
import { House, Settings } from "lucide-react-native";
import { type PropsWithChildren, type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand } from "@/components/brand";
import { BusinessMenu } from "@/components/shell/business-menu";
import { NavUser } from "@/components/shell/nav-user";
import { ShellProvider } from "@/components/shell/shell-context";
import { TopBar } from "@/components/shell/top-bar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarLink,
  SidebarSkeleton,
} from "@/components/ui/sidebar";
import { operateModuleIcons } from "@/features/operate/module-icons";
import { getVisibleOperateModules, OPERATE_GROUPS } from "@/features/operate/navigation";
import { cn } from "@/lib/cn";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";
import { useBusinessChanges } from "@/lib/realtime";

/** Sidebar layouts start at tablet-landscape widths on every platform. */
const WIDE_LAYOUT_MIN_WIDTH = 1024;

function matchesRoute(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export type ShellUser = { email: string; name: string };

type AppShellProps = PropsWithChildren<{
  /** Null while the session is being restored; the frame renders before it is known. */
  user: ShellUser | null;
  /** The top bar's trailing primary action (dictation), mounted by the layout that owns it. */
  topBarAction?: ReactNode;
}>;

export function AppShell({ children, topBarAction, user }: AppShellProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_LAYOUT_MIN_WIDTH;
  const [collapsed, setCollapsed] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const businesses = useQuery(businessesQueryOptions);
  const activeBusiness = hasDeniedRead([businesses])
    ? undefined
    : getActiveBusiness(businesses.data);
  const modules = getVisibleOperateModules(activeBusiness?.access.permissions);
  const realtime = useBusinessChanges(activeBusiness?.id);
  const rail = wide && collapsed;

  // biome-ignore lint/correctness/useExhaustiveDependencies: Route and breakpoint changes must dismiss the navigation sheet.
  useEffect(() => {
    setNavigationOpen(false);
  }, [pathname, wide]);

  // Business selection and onboarding run before a business exists, so they get a focused frame.
  if (pathname === "/business") {
    return (
      <ShellProvider>
        <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
          <View className="min-h-0 flex-1">
            <View className="min-h-0 flex-1" role="main">
              {children}
            </View>
            <View
              className="absolute inset-x-0 top-0 z-20 h-12 flex-row items-center justify-between border-b border-border bg-background px-4 web:bg-background/85 web:backdrop-blur-md"
              role="banner"
            >
              <Brand />
              <NavUser user={user} variant="avatar" />
            </View>
          </View>
        </SafeAreaView>
      </ShellProvider>
    );
  }

  const closeNavigation = () => setNavigationOpen(false);
  const navigation = (
    <Sidebar label={t("shell.primaryNavigation")}>
      <SidebarHeader>
        <View className={cn("h-8 justify-center px-1", rail && "items-center px-0")}>
          <Brand compact={rail} />
        </View>
        <BusinessMenu collapsed={rail} />
      </SidebarHeader>
      <SidebarContent>
        {OPERATE_GROUPS.map((group) => {
          const groupModules = modules.filter((module) => module.group === group.id);
          if (group.id !== "overview" && !groupModules.length) return null;
          return (
            <SidebarGroup
              collapsed={rail}
              key={group.id}
              label={group.labelKey ? t(group.labelKey) : undefined}
            >
              {group.id === "overview" ? (
                <SidebarLink
                  active={pathname === "/operate"}
                  collapsed={rail}
                  href="/operate"
                  icon={House}
                  label={t("shell.home")}
                  onNavigate={closeNavigation}
                />
              ) : null}
              {groupModules.map((module) => (
                <SidebarLink
                  active={matchesRoute(pathname, String(module.href))}
                  collapsed={rail}
                  href={module.href}
                  icon={operateModuleIcons[module.id]}
                  key={module.id}
                  label={t(module.labelKey)}
                  onNavigate={closeNavigation}
                />
              ))}
            </SidebarGroup>
          );
        })}
        {businesses.isPending ? <SidebarSkeleton collapsed={rail} /> : null}
      </SidebarContent>
      <SidebarFooter>
        <SidebarLink
          active={matchesRoute(pathname, "/settings")}
          collapsed={rail}
          href="/settings"
          icon={Settings}
          label={t("shell.settings")}
          onNavigate={closeNavigation}
        />
        <NavUser collapsed={rail} user={user} variant="sidebar" />
      </SidebarFooter>
    </Sidebar>
  );

  return (
    <ShellProvider>
      <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
        <View className="min-h-0 flex-1 flex-row">
          {wide ? (
            <View className={cn("shrink-0 border-r border-sidebar-border", rail ? "w-16" : "w-60")}>
              {navigation}
            </View>
          ) : null}
          <View className="min-w-0 flex-1">
            <View className="min-h-0 flex-1" role="main">
              {children}
            </View>
            <TopBar
              action={topBarAction}
              collapsed={collapsed}
              permissions={activeBusiness?.access.permissions}
              realtime={activeBusiness ? realtime : undefined}
              user={user}
              onOpenNavigation={() => setNavigationOpen(true)}
              onToggleSidebar={() => setCollapsed((value) => !value)}
              wide={wide}
            />
          </View>
        </View>
        {wide ? null : (
          <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
            <SheetContent className="bg-sidebar" side="left">
              <SafeAreaView className="min-h-0 flex-1" edges={["top", "bottom", "left"]}>
                <SheetTitle className="sr-only">{t("shell.primaryNavigation")}</SheetTitle>
                {navigation}
              </SafeAreaView>
            </SheetContent>
          </Sheet>
        )}
      </SafeAreaView>
    </ShellProvider>
  );
}
