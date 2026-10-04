import { type Href, Link } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import type { PropsWithChildren } from "react";
import { Platform, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

// RNR has no Sidebar registry entry; these slots compose its Button, Text, Icon and Tooltip.
export function Sidebar({ children, label }: PropsWithChildren<{ label: string }>) {
  return (
    <View accessibilityLabel={label} className="min-h-0 flex-1 bg-sidebar" role="navigation">
      {children}
    </View>
  );
}

export function SidebarHeader({ children }: PropsWithChildren) {
  return (
    <View className="h-12 justify-center border-b border-sidebar-border px-2">{children}</View>
  );
}

export function SidebarContent({ children }: PropsWithChildren) {
  return (
    <ScrollView
      className="min-h-0 flex-1"
      contentContainerClassName="gap-4 px-2 pb-4 pt-2"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function SidebarFooter({ children }: PropsWithChildren) {
  return <View className="gap-2 border-t border-sidebar-border p-2">{children}</View>;
}

export function SidebarGroup({
  children,
  collapsed,
  label,
}: PropsWithChildren<{ collapsed?: boolean; label?: string }>) {
  return (
    <View className="gap-0.5">
      {label && !collapsed ? (
        <Text className="px-2 pb-1 font-ui text-xs text-muted-foreground">{label}</Text>
      ) : null}
      {children}
    </View>
  );
}

export function SidebarLink({
  active,
  collapsed,
  href,
  icon,
  label,
  onNavigate,
}: {
  active: boolean;
  collapsed?: boolean;
  href: Href;
  icon: LucideIcon;
  label: string;
  onNavigate?: () => void;
}) {
  const link = (
    <Link asChild href={href}>
      <Button
        accessibilityLabel={collapsed ? label : undefined}
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        aria-current={active ? "page" : undefined}
        className={cn(
          "w-full justify-start gap-2.5 px-2 web:pointer-coarse:min-h-10",
          collapsed && "justify-center px-0",
          active
            ? "bg-sidebar-accent web:hover:bg-sidebar-accent"
            : "web:hover:bg-sidebar-accent/60",
        )}
        onPress={onNavigate}
        size="sm"
        variant="ghost"
      >
        <Icon
          as={icon}
          className={active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70"}
          size={16}
          strokeWidth={active ? 2.25 : 1.75}
        />
        {collapsed ? null : (
          <Text
            className={cn(
              "min-w-0 shrink text-left text-sm",
              active
                ? "font-ui text-sidebar-accent-foreground"
                : "font-sans text-sidebar-foreground",
            )}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
      </Button>
    </Link>
  );
  if (!collapsed || Platform.OS !== "web") return link;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <View>{link}</View>
      </TooltipTrigger>
      <TooltipContent side="right">
        <Text>{label}</Text>
      </TooltipContent>
    </Tooltip>
  );
}

/** Navigation rows reserved while permissions load, so the sidebar keeps its shape. */
export function SidebarSkeleton({ collapsed }: { collapsed?: boolean }) {
  return (
    <View aria-hidden className="gap-1.5 px-2 pt-1">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <View className="h-8 flex-row items-center gap-2.5" key={index}>
          <Skeleton className="size-4" />
          {collapsed ? null : <Skeleton className="h-3 flex-1" />}
        </View>
      ))}
    </View>
  );
}
