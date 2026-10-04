// React Native Reusables / Uniwind. MIT attribution: licenses/react-native-reusables.txt.

import * as TabsPrimitive from "@rn-primitives/tabs";
import { Platform } from "react-native";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/cn";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn("flex flex-col gap-2", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "bg-muted border-border flex min-h-9 flex-row flex-wrap items-center justify-center rounded-md border p-0.5 native:min-h-11",
        Platform.select({ web: "inline-flex w-fit", native: "mr-auto" }),
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { value } = TabsPrimitive.useRootContext();
  return (
    <TextClassContext.Provider
      value={cn(
        "text-muted-foreground text-[13px] font-ui native:text-sm",
        value === props.value && "text-foreground",
      )}
    >
      <TabsPrimitive.Trigger
        className={cn(
          "flex flex-row items-center justify-center gap-1.5 rounded-sm px-2.5 py-1 shadow-none",
          Platform.select({
            web: "inline-flex cursor-default whitespace-nowrap transition-[color,background-color] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
          }),
          props.disabled && "opacity-50",
          props.value === value && "bg-background shadow-sm shadow-black/5",
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("min-w-0", Platform.select({ web: "flex-1" }), className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
