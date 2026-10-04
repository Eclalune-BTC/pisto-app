// React Native Reusables / Uniwind. MIT attribution: licenses/react-native-reusables.txt.

import { Platform, TextInput } from "react-native";
import { useCSSVariable } from "uniwind";
import { cn } from "@/lib/cn";

function Textarea({
  className,
  multiline = true,
  numberOfLines = Platform.select({ web: 2, native: 8 }), // On web, numberOfLines also determines initial height. On native, it determines the maximum height.
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  const [foreground, muted, selection] = useCSSVariable([
    "--color-foreground",
    "--color-muted-foreground",
    "--color-selection",
  ]) as [string, string, string];
  return (
    <TextInput
      selectionColor={selection}
      selectionHandleColor={foreground}
      cursorColor={foreground}
      placeholderTextColor={muted}
      className={cn(
        "font-sans text-foreground border-input flex min-h-20 w-full flex-row rounded-md border bg-card px-2.5 py-2 text-sm leading-5",
        Platform.select({
          web: "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/25 aria-invalid:border-destructive field-sizing-content resize-y outline-none transition-[color,box-shadow] focus-visible:ring-2 disabled:cursor-not-allowed",
          native: "min-h-24 px-3 text-base leading-6",
        }),
        props.editable === false && "opacity-50",
        className,
      )}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical="top"
      {...props}
    />
  );
}

export { Textarea };
