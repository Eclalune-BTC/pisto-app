import { Ellipsis, type LucideIcon } from "lucide-react-native";
import type { ComponentRef, RefObject } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/** The menu trigger, which also takes focus back from a dialog the menu opened. */
export type MenuTrigger = ComponentRef<typeof DropdownMenuTrigger>;

/** Keeps the menu off the screen edges on phones. */
const MENU_INSETS = { bottom: 12, left: 12, right: 12, top: 12 };

type OverflowActionMenuProps = {
  /** The destructive action the page keeps out of its header; a reason disables it. */
  action: { disabledReason?: string; icon: LucideIcon; label: string; onPress: () => void };
  /** Accessible name of the trigger. */
  label: string;
  /** The trigger, so a dialog opened from the menu can return focus to it. */
  triggerRef: RefObject<MenuTrigger | null>;
};

/** A page header's overflow menu holding one destructive action. */
export function OverflowActionMenu({ action, label, triggerRef }: OverflowActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild ref={triggerRef}>
        <Button accessibilityLabel={label} size="icon" variant="outline">
          <Icon as={Ellipsis} className="text-foreground" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" insets={MENU_INSETS} sideOffset={4}>
        <DropdownMenuItem
          accessibilityHint={action.disabledReason}
          disabled={action.disabledReason !== undefined}
          onPress={action.onPress}
          variant="destructive"
        >
          <Icon as={action.icon} className="text-destructive" size={15} />
          <Text>{action.label}</Text>
        </DropdownMenuItem>
        {/* Outside the faded item, so the reason keeps its full contrast. */}
        {action.disabledReason ? (
          <Text className="px-2 pb-1.5 text-xs leading-4 text-muted-foreground">
            {action.disabledReason}
          </Text>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
