// React Native Reusables / Uniwind. MIT attribution: licenses/react-native-reusables.txt.

import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react-native";
import * as React from "react";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text, TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/cn";

const alertVariants = cva("relative w-full flex-row gap-2.5 rounded-lg border px-3 py-2.5", {
  variants: {
    variant: {
      default: "border-border bg-card",
      positive: "border-border bg-positive-surface",
      warning: "border-warning/30 bg-warning-surface",
      destructive: "border-destructive/30 bg-destructive-surface",
    },
  },
  defaultVariants: { variant: "default" },
});

const alertTextVariants = cva("text-sm", {
  variants: {
    variant: {
      default: "text-foreground",
      positive: "text-positive-foreground",
      warning: "text-warning-foreground",
      destructive: "text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

const alertIconVariants = cva("mt-0.5 size-4 shrink-0", {
  variants: {
    variant: {
      default: "text-muted-foreground",
      positive: "text-positive-foreground",
      warning: "text-warning",
      destructive: "text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

const AlertVariantContext = React.createContext<AlertVariant>("default");

function Alert({
  action,
  className,
  variant = "default",
  children,
  icon,
  ...props
}: React.ComponentProps<typeof View> &
  React.RefAttributes<View> & {
    action?: React.ReactNode;
    icon: LucideIcon;
    variant?: AlertVariant;
  }) {
  return (
    <AlertVariantContext.Provider value={variant}>
      <TextClassContext.Provider value={alertTextVariants({ variant })}>
        <View role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
          <Icon as={icon} className={alertIconVariants({ variant })} />
          <View className="min-w-0 flex-1 gap-0.5">{children}</View>
          {action ? <View className="shrink-0 self-center">{action}</View> : null}
        </View>
      </TextClassContext.Provider>
    </AlertVariantContext.Provider>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn("font-ui text-sm leading-5", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  const variant = React.useContext(AlertVariantContext);
  return (
    <Text
      className={cn(
        "text-sm leading-5",
        variant === "default" ? "text-muted-foreground" : "opacity-90",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
