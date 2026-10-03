import * as Primitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react-native";
import type { ComponentProps } from "react";
import { useCSSVariable } from "uniwind";
import { cn } from "@/lib/cn";

export const Accordion = Primitive.Root;

export function AccordionItem({ className, ...props }: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn("border-b border-border last:border-b-0", className)}
      {...props}
    />
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Trigger>) {
  const color = useCSSVariable("--color-muted-foreground") as string;
  return (
    <Primitive.Header>
      <Primitive.Trigger
        className={cn(
          "group flex min-h-14 w-full items-center justify-between gap-5 rounded-md py-5 text-left",
          className,
        )}
        {...props}
      >
        {children}
        <span className="shrink-0 group-data-[state=open]:rotate-180" aria-hidden="true">
          <ChevronDown color={color} size={18} />
        </span>
      </Primitive.Trigger>
    </Primitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content {...props}>
      <div className={cn("pb-6", className)}>{children}</div>
    </Primitive.Content>
  );
}
