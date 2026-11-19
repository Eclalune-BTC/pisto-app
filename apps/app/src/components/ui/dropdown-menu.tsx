// React Native Reusables / Uniwind. MIT attribution: licenses/react-native-reusables.txt.

import * as DropdownMenuPrimitive from "@rn-primitives/dropdown-menu";
import * as React from "react";
import { Platform, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { FadeIn, ReduceMotion } from "react-native-reanimated";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import { NativeOnlyAnimatedView } from "@/components/ui/native-only-animated-view";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/cn";

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const FullWindowOverlay = Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

function DropdownMenuContent({
  className,
  overlayClassName,
  overlayStyle,
  portalHost,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  overlayStyle?: StyleProp<ViewStyle>;
  overlayClassName?: string;
  portalHost?: string;
}) {
  return (
    <DropdownMenuPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <DropdownMenuPrimitive.Overlay
          style={Platform.select({
            web: overlayStyle ?? undefined,
            native: overlayStyle
              ? StyleSheet.flatten([
                  StyleSheet.absoluteFill,
                  overlayStyle as typeof StyleSheet.absoluteFill,
                ])
              : StyleSheet.absoluteFill,
          })}
          className={overlayClassName}
          asChild={Platform.OS !== "web"}
        >
          <NativeOnlyAnimatedView
            entering={FadeIn.reduceMotion(ReduceMotion.System)}
            as="Pressable"
          >
            <TextClassContext.Provider value="text-popover-foreground">
              <DropdownMenuPrimitive.Content
                className={cn(
                  "bg-popover border-border min-w-[8rem] overflow-hidden rounded-xl border p-1 shadow-lg shadow-black/10 web:bg-popover/95 web:backdrop-blur-md",
                  Platform.select({
                    web: cn(
                      "pisto-enter-pop max-h-(--radix-context-menu-content-available-height) origin-(--radix-context-menu-content-transform-origin) z-50 cursor-default",
                    ),
                  }),
                  className,
                )}
                {...props}
              />
            </TextClassContext.Provider>
          </NativeOnlyAnimatedView>
        </DropdownMenuPrimitive.Overlay>
      </FullWindowOverlay>
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  className?: string;
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <TextClassContext.Provider
      value={cn(
        "select-none text-sm text-popover-foreground group-active:text-popover-foreground",
        variant === "destructive" && "text-destructive group-active:text-destructive",
      )}
    >
      <DropdownMenuPrimitive.Item
        className={cn(
          "active:bg-accent group relative flex flex-row items-center gap-2 rounded-lg px-2.5 py-2 sm:py-1.5",
          Platform.select({
            web: cn(
              "focus:bg-accent focus:text-accent-foreground cursor-default outline-none data-[disabled]:pointer-events-none",
              variant === "destructive" && "focus:bg-destructive/10 dark:focus:bg-destructive/20",
            ),
          }),
          variant === "destructive" && "active:bg-destructive/10 dark:active:bg-destructive/20",
          props.disabled && "opacity-50",
          inset && "pl-8",
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  children?: React.ReactNode;
}) {
  return (
    <TextClassContext.Provider value="text-sm text-popover-foreground select-none group-active:text-accent-foreground">
      <DropdownMenuPrimitive.RadioItem
        className={cn(
          "active:bg-accent group relative flex flex-row items-center gap-2 rounded-lg py-2 pl-8 pr-2.5 sm:py-1.5",
          Platform.select({
            web: "focus:bg-accent focus:text-accent-foreground cursor-default outline-none data-[disabled]:pointer-events-none",
          }),
          props.disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        <View className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <View className="bg-foreground h-2 w-2 rounded-full" />
          </DropdownMenuPrimitive.ItemIndicator>
        </View>
        {children}
      </DropdownMenuPrimitive.RadioItem>
    </TextClassContext.Provider>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  className?: string;
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("text-foreground px-2 py-1.5 font-ui text-sm", inset && "pl-8", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
