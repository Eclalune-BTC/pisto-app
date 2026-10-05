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

/**
 * The appearance choice. `compact` is a single light/dark switch for headers; the full control is a
 * segmented group of toggle buttons that also offers following the system.
 */
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
        <View
          accessibilityLabel={t("settings.appearance")}
          className="max-w-full flex-row flex-wrap gap-0.5 self-start rounded-md border border-border bg-muted p-0.5"
          role="group"
        >
          {choices.map(({ value, icon: ChoiceIcon }) => {
            const selected = appearance.choice === value;
            return (
              <Button
                accessibilityLabel={t(`settings.themes.${value}`)}
                accessibilityRole={Platform.OS === "web" ? "button" : "togglebutton"}
                accessibilityState={Platform.OS === "web" ? undefined : { checked: selected }}
                aria-pressed={Platform.OS === "web" ? selected : undefined}
                // Same segment as `FilterBar`, which this control cannot reuse: a theme choice is a
                // pressed toggle, not one radio of a filter.
                className={cn(
                  "gap-1.5 rounded-sm border",
                  Platform.select({ web: "h-[30px] min-h-0 px-2.5 py-0" }),
                  selected
                    ? "border-border bg-card shadow-sm shadow-black/5 web:hover:bg-card dark:bg-foreground/15 dark:web:hover:bg-foreground/15"
                    : "border-transparent bg-transparent web:hover:bg-background/60",
                )}
                disabled={appearance.pending}
                key={value}
                onPress={() => void appearance.select(value)}
                size="sm"
                variant="ghost"
              >
                <Icon
                  as={ChoiceIcon}
                  className={selected ? "text-foreground" : "text-muted-foreground"}
                  size={14}
                />
                <ButtonText
                  className={cn(
                    "text-[13px] native:text-sm",
                    selected ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(`settings.themes.${value}`)}
                </ButtonText>
              </Button>
            );
          })}
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
