import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { useUniwind } from "uniwind";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "min-h-12 max-w-full flex-row items-center justify-center gap-2 rounded-lg px-5 py-2 active:opacity-80 disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-primary",
        accent: "bg-accent",
        secondary: "border border-border bg-card",
        ghost: "bg-transparent",
        danger: "bg-danger",
      },
      size: {
        icon: "h-11 min-h-11 w-11 px-0",
        sm: "min-h-11 px-4",
        md: "min-h-12 px-5",
        lg: "min-h-14 px-7",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

const textVariants = cva("web:font-sans shrink text-center text-[15px] font-semibold", {
  variants: {
    variant: {
      primary: "text-primary-foreground",
      accent: "text-ink",
      secondary: "text-foreground",
      ghost: "text-foreground",
      danger: "text-white",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

type ButtonProps = Omit<ComponentProps<typeof Pressable>, "children"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    children?: ReactNode;
    label?: string;
    loading?: boolean;
  };

export function Button({
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
  variant,
  ...props
}: ButtonProps) {
  const { t } = useTranslation();
  const { theme } = useUniwind();
  const Component = asChild ? Slot : Pressable;

  return (
    <Component
      {...props}
      accessibilityLabel={
        accessibilityLabel ?? (loading && label ? `${label}, ${t("common.loading")}` : undefined)
      }
      accessibilityRole={accessibilityRole}
      aria-busy={Boolean(loading)}
      accessibilityState={{
        ...accessibilityState,
        busy: Boolean(loading),
        disabled: Boolean(disabled || loading),
      }}
      className={cn(buttonVariants({ size, variant }), className)}
      disabled={disabled || loading}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? (
            <ActivityIndicator
              color={
                variant === "accent"
                  ? "#14241D"
                  : (variant === "secondary" || variant === "ghost") && theme !== "dark"
                    ? "#237A55"
                    : "#FFFFFF"
              }
            />
          ) : null}
          {label ? <Text className={textVariants({ variant })}>{label}</Text> : children}
        </>
      )}
    </Component>
  );
}

export function ButtonText({
  className,
  variant = "primary",
  ...props
}: ComponentProps<typeof Text> & VariantProps<typeof textVariants>) {
  return <Text className={cn(textVariants({ variant }), className)} {...props} />;
}
