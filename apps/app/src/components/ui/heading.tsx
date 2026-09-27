import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { Text } from "react-native";

import { cn } from "@/lib/cn";

const headingVariants = cva("web:font-sans font-semibold text-foreground", {
  variants: {
    size: {
      page: "text-[26px] leading-8 sm:text-[30px] sm:leading-9",
      section: "text-lg leading-6",
      welcome:
        "text-[36px] leading-[42px] tracking-[-0.8px] sm:text-[48px] sm:leading-[54px] lg:text-[56px] lg:leading-[62px]",
    },
  },
  defaultVariants: { size: "page" },
});

type HeadingProps = ComponentProps<typeof Text> &
  VariantProps<typeof headingVariants> & { level?: 1 | 2 | 3 };

export function Heading({ className, level = 1, size, ...props }: HeadingProps) {
  return (
    <Text
      {...props}
      accessibilityRole="header"
      aria-level={level}
      className={cn(headingVariants({ size }), className)}
    />
  );
}
