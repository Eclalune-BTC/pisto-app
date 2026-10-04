import type { ComponentProps } from "react";
import { useWindowDimensions } from "react-native";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

// RNR has no Sheet; the side panel reuses Dialog's focus trap, Escape handling and portal.
const Sheet = Dialog;
const SheetTrigger = DialogTrigger;
const SheetClose = DialogClose;
const SheetTitle = DialogTitle;
const SheetDescription = DialogDescription;

function SheetContent({
  className,
  side = "left",
  style,
  ...props
}: Omit<ComponentProps<typeof DialogContent>, "hideClose" | "overlayClassName"> & {
  side?: "left" | "right";
}) {
  const { height, width } = useWindowDimensions();
  return (
    <DialogContent
      {...props}
      className={cn(
        "mx-0 max-w-none gap-0 rounded-none border-0 p-0 shadow-xl sm:max-w-none web:max-w-none",
        side === "left" ? "border-r web:pisto-enter-left" : "border-l web:pisto-enter-right",
        "border-border bg-background",
        className,
      )}
      hideClose
      overlayClassName={cn(
        "justify-start p-0 web:backdrop-blur-[2px]",
        side === "left" ? "items-start" : "items-end",
      )}
      style={[{ height, width: Math.min(304, width - 40) }, style]}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
