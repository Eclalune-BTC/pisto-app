// React Native Reusables / Uniwind. MIT attribution: licenses/react-native-reusables.txt.
import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Pressable } from "react-native";
import { useCSSVariable } from "uniwind";
import { Text, TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  cn(
    "group max-w-full shrink-0 flex-row items-center justify-center gap-2 rounded-md active:opacity-80",
    Platform.select({
      web: "select-none transition-colors disabled:pointer-events-none",
    }),
  ),
  {
    variants: {
      variant: {
        default: "bg-primary web:hover:bg-primary/85",
        destructive: "bg-destructive-action web:hover:bg-destructive-action/90",
        outline: "border border-border bg-card active:bg-accent web:hover:bg-accent",
        secondary: "bg-secondary active:bg-accent web:hover:bg-accent",
        ghost: "active:bg-accent web:hover:bg-accent",
        link: "px-0",
      },
      // Pointer screens get compact controls; touch platforms keep 44 pt targets.
      size: {
        default: cn("min-h-9 px-3 py-1.5", Platform.select({ native: "min-h-11 px-4 py-2" })),
        sm: cn("min-h-8 gap-1.5 px-2.5 py-1", Platform.select({ native: "min-h-10 px-3 py-1.5" })),
        lg: cn("min-h-10 px-4 py-2", Platform.select({ native: "min-h-12 px-5 py-2.5" })),
        icon: cn("h-9 w-9", Platform.select({ native: "h-11 w-11" })),
        "icon-sm": cn("h-8 w-8", Platform.select({ native: "h-10 w-10" })),
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
const buttonTextVariants = cva("font-ui font-normal shrink text-center text-sm", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive-action-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
      link: "text-link underline web:underline-offset-4",
    },
  },
  defaultVariants: { variant: "default" },
});

type ButtonProps = Omit<ComponentProps<typeof Pressable>, "children"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    children?: ReactNode;
    label?: string;
    loading?: boolean;
  };

function Button({
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  asChild,
  children,
  className,
  disabled,
  label,
  loading,
  size,
  variant = "default",
  ...props
}: ButtonProps) {
  const { t } = useTranslation();
  const [primaryForeground, foreground, destructiveForeground] = useCSSVariable([
    "--color-primary-foreground",
    "--color-foreground",
    "--color-destructive-action-foreground",
  ]) as [string, string, string];
  const Component = asChild ? Slot : Pressable;
  const spinnerColor =
    variant === "destructive"
      ? destructiveForeground
      : variant === "default"
        ? primaryForeground
        : foreground;
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant })}>
      <Component
        {...props}
        accessibilityLabel={
          accessibilityLabel ?? (loading && label ? `${label}, ${t("common.loading")}` : undefined)
        }
        accessibilityRole={accessibilityRole}
        accessibilityState={{
          ...accessibilityState,
          disabled: Boolean(disabled || loading),
          busy: Boolean(loading),
        }}
        aria-busy={Boolean(loading)}
        disabled={disabled || loading}
        className={cn(
          buttonVariants({ size, variant }),
          (disabled || loading) && "opacity-50",
          className,
        )}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <ActivityIndicator color={spinnerColor} /> : null}
            {label ? <Text>{label}</Text> : children}
          </>
        )}
      </Component>
    </TextClassContext.Provider>
  );
}
function ButtonText({
  className,
  variant,
  ...props
}: Omit<ComponentProps<typeof Text>, "variant"> & VariantProps<typeof buttonTextVariants>) {
  return (
    <Text
      {...props}
      className={cn(variant ? buttonTextVariants({ variant }) : undefined, className)}
    />
  );
}

export type { ButtonProps };
export { Button, ButtonText, buttonTextVariants, buttonVariants };
