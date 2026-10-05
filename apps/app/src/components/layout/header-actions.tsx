import { type Href, Link, useRouter } from "expo-router";
import { Ellipsis, type LucideIcon } from "lucide-react-native";
import { type ComponentRef, Fragment, type RefObject } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type HeaderAction = {
  destructive?: boolean;
  /** Visible but unavailable, for example while the page shows figures it could not refresh. */
  disabled?: boolean;
  /** Why the action is unavailable; shown under it in the menu at full contrast. */
  disabledReason?: string;
  icon?: LucideIcon;
  label: string;
} & ({ href: Href; onPress?: never } | { href?: never; onPress: () => void });

/** The overflow menu trigger, which can take focus back from a dialog the menu opened. */
export type MenuTrigger = ComponentRef<typeof DropdownMenuTrigger>;

type HeaderActionsProps = {
  /** Accessible name of the overflow menu. */
  menuLabel: string;
  /** Receives the overflow trigger so a dialog opened from the menu can return focus to it. */
  menuTriggerRef?: RefObject<MenuTrigger | null>;
  /** Always inside the overflow menu; destructive actions go last. */
  overflow?: readonly HeaderAction[];
  /** The one action that stays a visible button at every width. */
  primary?: HeaderAction;
  /** Buttons on wide screens, folded into the overflow menu on phones. */
  secondary?: readonly HeaderAction[];
};

/** Keeps the menu off the screen edges on phones. */
const MENU_INSETS = { bottom: 12, left: 12, right: 12, top: 12 };

/**
 * Page header actions that keep one row on a phone: the primary button and one overflow menu,
 * which also holds the secondary buttons on narrow screens.
 */
export function HeaderActions({
  menuLabel,
  menuTriggerRef,
  overflow = [],
  primary,
  secondary = [],
}: HeaderActionsProps) {
  const menuItems = [
    ...secondary.map((action) => ({ action, phoneOnly: true })),
    ...overflow.map((action) => ({ action, phoneOnly: false })),
  ];
  return (
    <>
      {secondary.map((action) => (
        <View className="hidden sm:flex" key={action.label}>
          <ActionButton action={action} variant="outline" />
        </View>
      ))}
      {primary ? <ActionButton action={primary} variant="default" /> : null}
      {menuItems.length > 0 ? (
        <View className={overflow.length > 0 ? undefined : "sm:hidden"}>
          <OverflowMenu items={menuItems} label={menuLabel} triggerRef={menuTriggerRef} />
        </View>
      ) : null}
    </>
  );
}

function ActionButton({
  action,
  variant,
}: {
  action: HeaderAction;
  variant: "default" | "outline";
}) {
  const content = (
    <>
      {action.icon ? (
        <Icon
          as={action.icon}
          className={variant === "default" ? "text-primary-foreground" : "text-foreground"}
          size={16}
        />
      ) : null}
      <Text>{action.label}</Text>
    </>
  );
  if (action.disabled || action.disabledReason) {
    return (
      <Button disabled variant={variant}>
        {content}
      </Button>
    );
  }
  if (action.href) {
    return (
      <Link asChild href={action.href}>
        <Button accessibilityRole="link" variant={variant}>
          {content}
        </Button>
      </Link>
    );
  }
  return (
    <Button onPress={action.onPress} variant={variant}>
      {content}
    </Button>
  );
}

type MenuItem = { action: HeaderAction; phoneOnly: boolean };

function OverflowMenu({
  items,
  label,
  triggerRef,
}: {
  items: readonly MenuItem[];
  label: string;
  triggerRef?: RefObject<MenuTrigger | null>;
}) {
  const router = useRouter();
  const regular = items.filter(({ action }) => !action.destructive);
  const destructive = items.filter(({ action }) => action.destructive);
  const press = (action: HeaderAction) => {
    if (action.href) router.push(action.href);
    else action.onPress?.();
  };
  const item = ({ action, phoneOnly }: MenuItem) => (
    <Fragment key={action.label}>
      <DropdownMenuItem
        accessibilityHint={action.disabledReason}
        className={cn(phoneOnly && "sm:hidden")}
        disabled={action.disabled || action.disabledReason !== undefined}
        onPress={() => press(action)}
        variant={action.destructive ? "destructive" : "default"}
      >
        {action.icon ? (
          <Icon
            as={action.icon}
            className={action.destructive ? "text-destructive" : "text-muted-foreground"}
            size={15}
          />
        ) : null}
        <Text>{action.label}</Text>
      </DropdownMenuItem>
      {/* Outside the faded item, so the reason keeps its full contrast. */}
      {action.disabledReason ? (
        <Text
          className={cn(
            "px-2 pb-1.5 text-xs leading-4 text-muted-foreground",
            phoneOnly && "sm:hidden",
          )}
        >
          {action.disabledReason}
        </Text>
      ) : null}
    </Fragment>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild ref={triggerRef}>
        <Button accessibilityLabel={label} size="icon" variant="outline">
          <Icon as={Ellipsis} className="text-foreground" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-44 max-w-72"
        insets={MENU_INSETS}
        sideOffset={4}
      >
        {regular.map(item)}
        {destructive.length > 0 && regular.length > 0 ? (
          <DropdownMenuSeparator
            className={regular.every(({ phoneOnly }) => phoneOnly) ? "sm:hidden" : undefined}
          />
        ) : null}
        {destructive.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
