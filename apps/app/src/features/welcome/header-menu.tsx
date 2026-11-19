import { useRouter } from "expo-router";
import { Menu } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useUniwind } from "uniwind";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAppearance } from "@/providers/appearance-provider";

/**
 * The header's navigation where its links do not fit: the page's sections, sign-in and the
 * appearance switch behind one button, so a phone header holds only the brand and "Crear cuenta".
 */
export function HeaderMenu({
  sections,
}: {
  sections: readonly { label: string; onPress: () => void }[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme } = useUniwind();
  const appearance = useAppearance();
  const nextTheme = theme === "dark" ? "light" : "dark";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button accessibilityLabel={t("welcome.nav.menu")} size="icon" variant="ghost">
          <Icon as={Menu} size={19} strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" side="bottom" sideOffset={6}>
        {sections.map((section) => (
          <DropdownMenuItem key={section.label} onPress={section.onPress}>
            <Text>{section.label}</Text>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onPress={() => router.push("/sign-in")}>
          <Text>{t("welcome.signIn")}</Text>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={appearance.pending}
          onPress={() => void appearance.select(nextTheme)}
        >
          <Text>{t(`appearance.switchTo.${nextTheme}`)}</Text>
        </DropdownMenuItem>
        {appearance.issue ? (
          <Text
            accessibilityRole="alert"
            className="max-w-52 px-2 py-1.5 text-xs leading-4 text-destructive"
          >
            {t(`appearance.errors.${appearance.issue}`)}
          </Text>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
