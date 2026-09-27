import { Laptop, Moon, Sun } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Platform, Text, View } from "react-native";
import { useUniwind } from "uniwind";

import { Button, ButtonText } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useAppearance } from "@/providers/appearance-provider";

const choices = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Laptop },
] as const;

export function AppearanceControl({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { theme } = useUniwind();
  const appearance = useAppearance();

  return (
    <View className="min-w-0 max-w-full gap-2">
      <View
        accessibilityLabel={t("settings.appearance")}
        className="flex-row gap-1 rounded-lg border border-border p-1"
      >
        {choices.map(({ value, icon: Icon }) => (
          <Button
            accessibilityLabel={t(`settings.themes.${value}`)}
            accessibilityRole={Platform.OS === "web" ? "button" : "togglebutton"}
            accessibilityState={
              Platform.OS === "web" ? undefined : { checked: appearance.choice === value }
            }
            aria-pressed={Platform.OS === "web" ? appearance.choice === value : undefined}
            className={cn(!compact && "flex-1 px-3", appearance.choice === value && "bg-muted")}
            disabled={appearance.pending}
            key={value}
            onPress={() => void appearance.select(value)}
            size={compact ? "icon" : "sm"}
            variant="ghost"
          >
            <Icon color={theme === "dark" ? "#e7eee9" : "#303a34"} size={17} />
            {!compact ? (
              <ButtonText variant="ghost">{t(`settings.themes.${value}`)}</ButtonText>
            ) : null}
          </Button>
        ))}
      </View>
      {appearance.issue ? (
        <Text accessibilityRole="alert" className="max-w-xs text-sm leading-5 text-destructive">
          {t(`appearance.errors.${appearance.issue}`)}
        </Text>
      ) : null}
    </View>
  );
}
