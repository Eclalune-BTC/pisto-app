import type { BusinessPermission } from "@pisto/contracts";
import { Menu, PanelLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type { ShellUser } from "@/components/app-shell";
import { NavUser } from "@/components/shell/nav-user";
import { NewRecordMenu } from "@/components/shell/new-record-menu";
import { RealtimeNotice } from "@/components/shell/realtime-status";
import { ShellBreadcrumbs } from "@/components/shell/shell-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { AssistantButton } from "@/features/assistant/assistant-button";
import type { RealtimeStatus } from "@/lib/realtime";

type TopBarProps = {
  collapsed: boolean;
  permissions: readonly BusinessPermission[] | undefined;
  realtime: RealtimeStatus | undefined;
  sessionUnverified: boolean;
  user: ShellUser | null;
  onOpenNavigation: () => void;
  onToggleSidebar: () => void;
  wide: boolean;
};

/** Overlays the content so pages scroll beneath its translucent surface on the web. */
export function TopBar({
  collapsed,
  permissions,
  realtime,
  sessionUnverified,
  user,
  onOpenNavigation,
  onToggleSidebar,
  wide,
}: TopBarProps) {
  const { t } = useTranslation();
  return (
    <View
      className="absolute inset-x-0 top-0 z-20 h-12 justify-center border-b border-border bg-background web:bg-background/92 web:backdrop-blur-lg"
      role="banner"
    >
      <View className="mx-auto w-full max-w-[1120px] flex-row items-center gap-1 px-4 sm:gap-2 sm:px-6 lg:px-8">
        {wide ? (
          <Button
            accessibilityLabel={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
            onPress={onToggleSidebar}
            size="icon-sm"
            variant="ghost"
          >
            <Icon as={PanelLeft} className="text-muted-foreground" size={16} />
          </Button>
        ) : (
          <Button
            accessibilityLabel={t("shell.openNavigation")}
            onPress={onOpenNavigation}
            size="icon-sm"
            variant="ghost"
          >
            <Icon as={Menu} className="text-foreground" size={18} />
          </Button>
        )}
        <View className="min-w-0 flex-1 px-1">
          <ShellBreadcrumbs compact={!wide} />
        </View>
        {sessionUnverified ? (
          <Text
            className="min-w-0 shrink text-xs text-muted-foreground"
            numberOfLines={1}
            role="status"
          >
            {wide ? t("session.unverified") : t("session.unverifiedShort")}
          </Text>
        ) : realtime ? (
          <RealtimeNotice compact={!wide} status={realtime} />
        ) : null}
        <View className="flex-row items-center gap-1 sm:gap-2">
          {permissions ? <NewRecordMenu compact={!wide} permissions={permissions} /> : null}
          <AssistantButton compact={!wide} />
        </View>
        <View className="ml-1 border-l border-border pl-1 sm:ml-2 sm:pl-3">
          <NavUser user={user} />
        </View>
      </View>
    </View>
  );
}
