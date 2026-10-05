import { type Href, Link, useRouter } from "expo-router";
import { Ellipsis, type LucideIcon } from "lucide-react-native";
import { Fragment } from "react";
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

export type HeaderAction = {
  destructive?: boolean;
  /** Visible but unavailable, for example while the page shows figures it could not refresh. */
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
} & ({ href: Href; onPress?: never } | { href?: never; onPress: () => void });

type HeaderActionsProps = {
  /** Accessible name of the overflow menu. */
  menuLabel: string;
  /** Always inside the overflow menu; destructive actions go last. */
  overflow?: readonly HeaderAction[];
  /** The one action that stays a visible button at every width. */
  primary?: HeaderAction;
  /** Buttons on wide screens, folded into the overflow menu on phones. */
  secondary?: readonly HeaderAction[];
};

/** Page header actions that keep one row on a phone: the primary button and an overflow menu. */
export function HeaderActions({
  menuLabel,
  overflow = [],
  primary,
  secondary = [],
}: HeaderActionsProps) {
  return (
    <>
      {secondary.map((action) => (
        <View className="hidden sm:flex" key={action.label}>
          <ActionButton action={action} variant="outline" />
        </View>
      ))}
      {primary ? <ActionButton action={primary} variant="default" /> : null}
      {secondary.length + overflow.length > 0 ? (
        <View className="sm:hidden">
          <OverflowMenu actions={[...secondary, ...overflow]} label={menuLabel} />
        </View>
      ) : null}
      {overflow.length > 0 ? (
        <View className="hidden sm:flex">
          <OverflowMenu actions={overflow} label={menuLabel} />
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
  if (action.disabled) {
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

function OverflowMenu({ actions, label }: { actions: readonly HeaderAction[]; label: string }) {
  const router = useRouter();
  const regular = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);
  const press = (action: HeaderAction) => {
    if (action.href) router.push(action.href);
    else action.onPress?.();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button accessibilityLabel={label} size="icon" variant="outline">
          <Icon as={Ellipsis} className="text-foreground" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44" sideOffset={4}>
        {regular.map((action) => (
          <DropdownMenuItem
            disabled={action.disabled}
            key={action.label}
            onPress={() => press(action)}
          >
            {action.icon ? (
              <Icon as={action.icon} className="text-muted-foreground" size={15} />
            ) : null}
            <Text>{action.label}</Text>
          </DropdownMenuItem>
        ))}
        {destructive.map((action, index) => (
          <Fragment key={action.label}>
            {index === 0 && regular.length ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onPress={() => press(action)} variant="destructive">
              {action.icon ? (
                <Icon as={action.icon} className="text-destructive" size={15} />
              ) : null}
              <Text>{action.label}</Text>
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
