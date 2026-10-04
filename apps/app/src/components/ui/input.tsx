// React Native Reusables / Uniwind. MIT attribution: licenses/react-native-reusables.txt.

import { Platform, TextInput } from "react-native";
import { useCSSVariable } from "uniwind";
import { cn } from "@/lib/cn";

function Input({
  className,
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
        "font-sans border-input bg-card text-foreground flex min-h-12 w-full min-w-0 flex-row items-center rounded-lg border px-3 py-2 text-base leading-6",
        props.editable === false &&
          cn(
            "opacity-50",
            Platform.select({ web: "disabled:pointer-events-none disabled:cursor-not-allowed" }),
          ),
        Platform.select({
          web: cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          ),
          native: "placeholder:text-muted-foreground/50",
        }),
        className,
      )}
      {...props}
    />
  );
}

export { Input };
