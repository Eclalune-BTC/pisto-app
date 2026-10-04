import { useQuery } from "@tanstack/react-query";
import { usePathname } from "expo-router";
import { LayoutDashboard } from "lucide-react-native";
import { type PropsWithChildren, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
} from "@/components/ui/sidebar";
import { operateModuleIcons } from "@/features/operate/module-icons";
import { getVisibleOperateModules, OPERATE_GROUPS } from "@/features/operate/navigation";
import { cn } from "@/lib/cn";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";

/** Sidebar layouts start at tablet-landscape widths on every platform. */
const WIDE_LAYOUT_MIN_WIDTH = 1024;

function matchesRoute(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

type AppShellProps = PropsWithChildren<{
  email: string;
  name: string;
}>;

export function AppShell({ children, email, name }: AppShellProps) {
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
  const rail = wide && collapsed;

  // biome-ignore lint/correctness/useExhaustiveDependencies: Route and breakpoint changes must dismiss the navigation sheet.
  useEffect(() => {
    setNavigationOpen(false);
  }, [pathname, wide]);

  const closeNavigation = () => setNavigationOpen(false);
  const navigation = (
    <Sidebar label={t("shell.primaryNavigation")}>
      <SidebarHeader>
        <BusinessMenu collapsed={rail} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarLink
            active={pathname === "/operate"}
            collapsed={rail}
            href="/operate"
            icon={LayoutDashboard}
            label={t("shell.home")}
            onNavigate={closeNavigation}
          />
        </SidebarGroup>
        {OPERATE_GROUPS.map((group) => {
          const groupModules = modules.filter((module) => module.group === group.id);
          if (!groupModules.length) return null;
          return (
            <SidebarGroup collapsed={rail} key={group.id} label={t(group.labelKey)}>
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
      </SidebarContent>
      <SidebarFooter>
        <NavUser collapsed={rail} email={email} name={name} variant="sidebar" />
      </SidebarFooter>
    </Sidebar>
  );

  return (
    <ShellProvider>
      <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
        <View className="min-h-0 flex-1 flex-row">
          {wide ? (
            <View className={cn("shrink-0 border-r border-sidebar-border", rail ? "w-14" : "w-60")}>
              {navigation}
            </View>
          ) : null}
          <View className="min-w-0 flex-1">
            <View className="min-h-0 flex-1" role="main">
              {children}
            </View>
            <TopBar
              collapsed={collapsed}
              email={email}
              name={name}
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
