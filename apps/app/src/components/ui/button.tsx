import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-5 active:opacity-80 disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-ink",
        accent: "bg-accent",
        secondary: "border border-line bg-surface dark:border-[#34453D] dark:bg-[#1A2B24]",
        ghost: "bg-transparent",
        danger: "bg-danger",
      },
      size: {
        sm: "min-h-10 px-4",
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

const textVariants = cva("text-center text-[15px] font-bold", {
  variants: {
    variant: {
      primary: "text-white",
      accent: "text-ink",
      secondary: "text-ink dark:text-white",
      ghost: "text-ink dark:text-white",
      danger: "text-white",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

type ButtonProps = ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    label?: string;
    loading?: boolean;
  };

export function Button({
  accessibilityLabel,
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
  const Component = asChild ? Slot : Pressable;

  return (
    <Component
      {...props}
      accessibilityLabel={
        accessibilityLabel ?? (loading ? (label ? `${label}, loading` : "Loading") : undefined)
      }
      accessibilityRole="button"
      accessibilityState={{
        ...accessibilityState,
        busy: Boolean(loading),
        disabled: Boolean(disabled || loading),
      }}
      className={cn(buttonVariants({ size, variant }), className)}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === "accent" ? "#14241D" : "#FFFFFF"} />
      ) : label ? (
        <Text className={textVariants({ variant })}>{label}</Text>
      ) : (
        children
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
