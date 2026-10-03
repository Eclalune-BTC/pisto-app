import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Text } from "./text";

type WorkspaceTabsProps<T extends string> = {
  items: readonly { content: ReactNode; label: string; value: T }[];
  label: string;
  onChange: (value: T) => void;
  value: T;
};

export function WorkspaceTabs<T extends string>({
  items,
  label,
  onChange,
  value,
}: WorkspaceTabsProps<T>) {
  return (
    <Tabs
      value={value}
      className="min-w-0 gap-4"
      onValueChange={(next) => {
        const item = items.find((candidate) => candidate.value === next);
        if (!item) throw new Error("The selected workspace view is not defined.");
        onChange(item.value);
      }}
    >
      <TabsList accessibilityLabel={label} className="h-auto flex-wrap self-start">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className="min-h-11 px-4">
            <Text>{item.label}</Text>
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="min-w-0 gap-4">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
