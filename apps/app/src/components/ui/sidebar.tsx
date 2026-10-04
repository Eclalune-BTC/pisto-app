import { type Href, Link } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

// Application composition of RNR primitives; RNR has no sidebar registry component.
export function Sidebar({
  children,
  footer,
  header,
  label,
}: PropsWithChildren<{ footer: ReactNode; header: ReactNode; label: string }>) {
  return (
    <ScrollView
      accessibilityLabel={label}
      className="min-h-0 flex-1 bg-sidebar"
      contentContainerClassName="flex-grow"
      role="navigation"
    >
      <View className="gap-4 px-5 pb-4 pt-6">{header}</View>
      <View className="gap-3 px-3 pb-5">{children}</View>
      <View className="mt-auto gap-3 border-t border-sidebar-border p-4">{footer}</View>
    </ScrollView>
  );
}

export function SidebarLink({
  active,
  current,
  href,
  icon,
  label,
  onNavigate,
}: {
  active: boolean;
  current: boolean;
  href: Href;
  icon?: ReactNode;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <Link asChild href={href}>
      <Button
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        aria-current={current ? "page" : undefined}
        className={cn(
          "h-auto min-h-11 w-full justify-start gap-3 rounded-lg px-3 py-2.5",
          active
            ? "bg-sidebar-accent web:hover:bg-sidebar-accent"
            : "web:hover:bg-sidebar-accent/50",
        )}
        onPress={onNavigate}
        variant="ghost"
      >
        {icon}
        <Text
          className={cn(
            "min-w-0 shrink font-ui text-left text-sm",
            active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground",
          )}
        >
          {label}
        </Text>
      </Button>
    </Link>
  );
}
