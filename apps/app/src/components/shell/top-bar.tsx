import { Menu, PanelLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type { ShellUser } from "@/components/app-shell";
import { NavUser } from "@/components/shell/nav-user";
import { ShellBreadcrumbs } from "@/components/shell/shell-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { DictateButton } from "@/features/assistant/dictate-button";

type TopBarProps = {
  collapsed: boolean;
  user: ShellUser | null;
  onOpenNavigation: () => void;
  onToggleSidebar: () => void;
  wide: boolean;
};

/** Overlays the content so pages scroll beneath its translucent surface on the web. */
export function TopBar({ collapsed, user, onOpenNavigation, onToggleSidebar, wide }: TopBarProps) {
  const { t } = useTranslation();
  return (
    <View
      className="absolute inset-x-0 top-0 z-20 h-12 flex-row items-center gap-2 border-b border-border bg-background px-3 web:bg-background/92 web:backdrop-blur-lg"
      role="banner"
    >
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
      <View aria-hidden className="h-4 w-px bg-border" />
      <View className="min-w-0 flex-1 px-1">
        <ShellBreadcrumbs compact={!wide} />
      </View>
      <DictateButton />
      {wide ? null : <NavUser user={user} variant="avatar" />}
    </View>
  );
}
