import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Text } from "./text";

const headingVariants = cva("font-heading font-normal text-foreground", {
  variants: {
    size: {
      page: "text-heading",
      section: "text-title",
      item: "text-title-lg",
      marketing: "text-heading web:text-balance sm:text-headline",
      display: "text-display-sm web:text-balance sm:text-display lg:text-display-lg",
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
