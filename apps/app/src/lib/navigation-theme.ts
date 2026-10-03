import { DarkTheme, DefaultTheme } from "expo-router";

export const navigationTheme = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: "#171717",
      background: "#FFFFFF",
      card: "#FAFAFA",
      text: "#171717",
      border: "#E5E5E5",
      notification: "#B94242",
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: "#FAFAFA",
      background: "#0A0A0A",
      card: "#171717",
      text: "#FAFAFA",
      border: "#404040",
      notification: "#FFBABA",
    },
  },
};
