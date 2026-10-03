import { type Href, Link } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
      contentContainerClassName="grow gap-4 p-4"
      role="navigation"
    >
      {header}
      <Separator />
      <View className="gap-4">{children}</View>
      <View className="mt-auto gap-4 pt-4">
        <Separator />
        {footer}
      </View>
    </ScrollView>
  );
}

export function SidebarLink({
  active,
  current,
  href,
  icon,
  label,
  nested = false,
  onNavigate,
}: {
  active: boolean;
  current: boolean;
  href: Href;
  icon?: ReactNode;
  label: string;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link asChild href={href}>
      <Button
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        aria-current={current ? "page" : undefined}
        className={cn(
          "h-auto min-h-11 w-full justify-start gap-3 rounded-md border-l-2 px-3 py-2",
          nested && "pl-5",
          active ? "border-foreground bg-accent" : "border-transparent",
        )}
        onPress={onNavigate}
        variant="ghost"
      >
        {icon}
        <Text
          className={cn(
            "min-w-0 shrink font-ui text-left text-sm",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </Text>
      </Button>
    </Link>
  );
}
