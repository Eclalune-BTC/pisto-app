// React Native Reusables / Uniwind. MIT attribution: licenses/react-native-reusables.txt.

import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Platform, View } from "react-native";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  cn(
    "group shrink-0 flex-row items-center justify-center gap-1 self-start overflow-hidden rounded-sm border px-1.5 py-0.5",
    Platform.select({ web: "w-fit whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3" }),
  ),
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary",
        secondary: "border-transparent bg-secondary",
        outline: "border-border bg-transparent",
        positive: "border-border bg-positive-surface",
        warning: "border-warning/25 bg-warning-surface",
        destructive: "border-destructive/25 bg-destructive-surface",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

const badgeTextVariants = cva("font-ui text-xs leading-4", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      positive: "text-positive-foreground",
      warning: "text-warning-foreground",
      destructive: "text-destructive",
    },
  },
  defaultVariants: { variant: "secondary" },
});

type BadgeProps = React.ComponentProps<typeof View> &
  React.RefAttributes<View> & {
    asChild?: boolean;
  } & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, asChild, ...props }: BadgeProps) {
  const Component = asChild ? Slot : View;
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <Component className={cn(badgeVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  );
}

export type { BadgeProps };
export { Badge, badgeTextVariants, badgeVariants };
