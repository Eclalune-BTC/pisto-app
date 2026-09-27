import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type AppearanceChoice = "light" | "dark" | "system";

const storageKey = "pisto.appearance";

export function parseAppearanceChoice(value: string | null): AppearanceChoice {
  if (value === null) return "system";
  if (value === "light" || value === "dark" || value === "system") return value;
  throw new Error("Stored appearance preference is invalid");
}

export async function readAppearancePreference(): Promise<AppearanceChoice> {
  const value =
    Platform.OS === "web"
      ? window.localStorage.getItem(storageKey)
      : await SecureStore.getItemAsync(storageKey);
  return parseAppearanceChoice(value);
}

export async function writeAppearancePreference(choice: AppearanceChoice): Promise<void> {
  parseAppearanceChoice(choice);
  if (Platform.OS === "web") {
    window.localStorage.setItem(storageKey, choice);
  } else {
    await SecureStore.setItemAsync(storageKey, choice);
  }
}
