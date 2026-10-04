import { Laptop, Moon, Sun } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import { useUniwind } from "uniwind";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const nextTheme = theme === "dark" ? "light" : "dark";
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const switchControl = (
    <Button
      accessibilityLabel={t(`appearance.switchTo.${nextTheme}`)}
      disabled={appearance.pending}
      onPress={() => void appearance.select(nextTheme)}
      size="icon"
      variant="ghost"
    >
      <Icon as={ThemeIcon} size={19} strokeWidth={1.75} />
    </Button>
  );

  return (
    <View className="min-w-0 max-w-full gap-2">
      {compact ? (
        Platform.OS === "web" ? (
          <Tooltip>
            <TooltipTrigger asChild>{switchControl}</TooltipTrigger>
            <TooltipContent>
              <Text>{t(`appearance.switchTo.${nextTheme}`)}</Text>
            </TooltipContent>
          </Tooltip>
        ) : (
          switchControl
        )
      ) : (
        <View accessibilityLabel={t("settings.appearance")} className="flex-row flex-wrap gap-1">
          {choices.map(({ value, icon: ChoiceIcon }) => (
            <Button
              accessibilityLabel={t(`settings.themes.${value}`)}
              accessibilityRole={Platform.OS === "web" ? "button" : "togglebutton"}
              accessibilityState={
                Platform.OS === "web" ? undefined : { checked: appearance.choice === value }
              }
              aria-pressed={Platform.OS === "web" ? appearance.choice === value : undefined}
              className={cn("px-3", appearance.choice === value && "bg-muted")}
              disabled={appearance.pending}
              key={value}
              onPress={() => void appearance.select(value)}
              size="sm"
              variant="ghost"
            >
              <Icon as={ChoiceIcon} size={16} />
              <ButtonText variant="ghost">{t(`settings.themes.${value}`)}</ButtonText>
            </Button>
          ))}
        </View>
      )}
      {appearance.issue ? (
        <Text accessibilityRole="alert" className="max-w-xs text-sm leading-5 text-destructive">
          {t(`appearance.errors.${appearance.issue}`)}
        </Text>
      ) : null}
    </View>
  );
}
