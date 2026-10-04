import { type Href, Link } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ComponentProps } from "react";
import { Platform, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

function Breadcrumb({ className, ...props }: ComponentProps<typeof View> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View
      accessibilityLabel={label}
      className={cn("min-w-0 shrink", className)}
      role="navigation"
      {...rest}
    />
  );
}

function BreadcrumbList({ className, ...props }: ComponentProps<typeof View>) {
  return (
    <View
      className={cn("min-w-0 flex-row items-center gap-1.5 overflow-hidden", className)}
      role="list"
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: ComponentProps<typeof View>) {
  return (
    <View
      className={cn("min-w-0 shrink flex-row items-center gap-1.5", className)}
      role="listitem"
      {...props}
    />
  );
}

// On native stacks an ancestor is popped back to instead of pushed again.
const dismissToAncestor = Platform.OS !== "web";

function BreadcrumbLink({ children, href }: { children: string; href: Href }) {
  return (
    <Link asChild dismissTo={dismissToAncestor} href={href}>
      <Text
        className="shrink font-ui text-sm text-muted-foreground web:transition-colors web:hover:text-foreground"
        numberOfLines={1}
      >
        {children}
      </Text>
    </Link>
  );
}

function BreadcrumbPage({ children }: { children: string }) {
  return (
    <Text aria-current="page" className="shrink font-ui text-sm text-foreground" numberOfLines={1}>
      {children}
    </Text>
  );
}

function BreadcrumbText({ children }: { children: string }) {
  return (
    <Text className="shrink font-ui text-sm text-muted-foreground" numberOfLines={1}>
      {children}
    </Text>
  );
}

function BreadcrumbSeparator() {
  return (
    <Text aria-hidden className="text-sm text-muted-foreground/50" role="presentation">
      /
    </Text>
  );
}

/** Compact trail: the parent becomes a back link so phones keep one line of orientation. */
function BreadcrumbBack({ children, href }: { children: string; href: Href }) {
  return (
    <Link asChild dismissTo={dismissToAncestor} href={href}>
      <Button
        accessibilityRole="link"
        className="max-w-full justify-start gap-1 self-start px-1.5"
        size="sm"
        variant="ghost"
      >
        <Icon as={ChevronLeft} className="text-muted-foreground" size={16} />
        <Text className="shrink font-ui text-sm text-muted-foreground" numberOfLines={1}>
          {children}
        </Text>
      </Button>
    </Link>
  );
}

export {
  Breadcrumb,
  BreadcrumbBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbText,
};
