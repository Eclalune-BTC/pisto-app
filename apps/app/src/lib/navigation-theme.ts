import { DarkTheme, DefaultTheme } from "expo-router";
import { useCSSVariable } from "uniwind";

export function useNavigationTheme(isDark: boolean) {
  const [primary, background, card, text, border, notification] = useCSSVariable([
    "--color-primary",
    "--color-background",
    "--color-card",
    "--color-foreground",
    "--color-border",
    "--color-destructive",
  ]) as [string, string, string, string, string, string];

  return {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: { primary, background, card, text, border, notification },
  };
}
