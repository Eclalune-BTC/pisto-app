import { Ellipsis, type LucideIcon } from "lucide-react-native";
import { Fragment } from "react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Icon } from "./icon";
import { Text } from "./text";

export type RowAction = {
  destructive?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  onPress: () => void;
};

/** Overflow menu for a record. Destructive actions sit last, after a separator. */
export function RowActions({ actions, label }: { actions: readonly RowAction[]; label: string }) {
  const regular = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button accessibilityLabel={label} size="icon-sm" variant="ghost">
          <Icon as={Ellipsis} className="text-muted-foreground" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44" sideOffset={4}>
        {regular.map((action) => (
          <DropdownMenuItem disabled={action.disabled} key={action.label} onPress={action.onPress}>
            {action.icon ? (
              <Icon as={action.icon} className="text-muted-foreground" size={15} />
            ) : null}
            <Text>{action.label}</Text>
          </DropdownMenuItem>
        ))}
        {destructive.map((action, index) => (
          <Fragment key={action.label}>
            {index === 0 && regular.length ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              disabled={action.disabled}
              onPress={action.onPress}
              variant="destructive"
            >
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
