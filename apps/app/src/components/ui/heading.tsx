import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Text } from "./text";

const headingVariants = cva("font-heading font-normal text-foreground", {
  variants: {
    size: {
      page: "text-[26px] leading-8 sm:text-[30px] sm:leading-9",
      section: "text-lg leading-6",
      welcome:
        "font-ui text-[36px] leading-[42px] tracking-[-0.5px] sm:text-[48px] sm:leading-[54px] lg:text-[56px] lg:leading-[62px]",
      marketing: "font-ui text-[28px] leading-9 sm:text-[32px] sm:leading-10",
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
