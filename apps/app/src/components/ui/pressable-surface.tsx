import type { ComponentProps } from "react";
import { Platform, Pressable } from "react-native";
import { cn } from "@/lib/cn";

/** A full-width pressable region such as a list row; Link supplies the destination via `asChild`. */
export function PressableSurface({ className, ...props }: ComponentProps<typeof Pressable>) {
  return (
    <Pressable
      className={cn(
        "min-w-0 active:bg-accent",
        Platform.select({ web: "cursor-pointer transition-colors hover:bg-accent/60" }),
        className as string | undefined,
      )}
      {...props}
    />
  );
}
