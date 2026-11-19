// React Native Reusables / Uniwind. MIT attribution: licenses/react-native-reusables.txt.

import { View } from "react-native";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/cn";

function Card({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View
        className={cn(
          "bg-card border-border flex flex-col gap-4 rounded-xl border py-4",
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Card };
