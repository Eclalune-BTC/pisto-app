import { useRouter } from "expo-router";
import { CreditCard, LogOut, UserRound } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type { ShellUser } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useSignOut } from "@/hooks/use-sign-out";
import { parseAppearanceChoice } from "@/lib/appearance-preference";
import { initialsOf } from "@/lib/initials";
import { useAppearance } from "@/providers/appearance-provider";

const appearanceChoices = ["light", "dark", "system"] as const;

/** Null while the session is restored; the trigger keeps its size as a placeholder. */
type NavUserProps = { user: ShellUser | null };

/** The account menu behind the avatar at the end of the top bar. */
export function NavUser({ user }: NavUserProps) {
  if (!user) {
    return (
      <View aria-hidden className="size-9 items-center justify-center">
        <Skeleton className="size-8 rounded-full" />
      </View>
    );
  }
  return <NavUserMenu user={user} />;
}

function NavUserMenu({ user: { email, name } }: { user: ShellUser }) {
  const { t } = useTranslation();
  const router = useRouter();
  const signOut = useSignOut();
  const appearance = useAppearance();
  const displayName = name || t("common.pistoAccount");
  const initials = initialsOf(displayName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          accessibilityLabel={t("shell.userMenu", { name: displayName })}
          className="rounded-full px-0"
          size="icon"
          variant="ghost"
        >
          <Avatar alt={displayName} className="size-8">
            <AvatarFallback className="bg-brand">
              <Text className="font-ui text-micro text-brand-foreground">{initials}</Text>
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" side="bottom" sideOffset={6}>
        <View className="flex-row items-center gap-2.5 px-2 py-1.5">
          <Avatar alt={displayName} className="size-8">
            <AvatarFallback className="bg-brand">
              <Text className="font-ui text-micro text-brand-foreground">{initials}</Text>
            </AvatarFallback>
          </Avatar>
          <View className="min-w-0 flex-1">
            <Text className="font-ui text-sm leading-5" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onPress={() => router.push("/settings")}>
            <Icon as={UserRound} className="text-muted-foreground" size={15} />
            <Text>{t("common.account")}</Text>
          </DropdownMenuItem>
          <DropdownMenuItem onPress={() => router.push("/billing")}>
            <Icon as={CreditCard} className="text-muted-foreground" size={15} />
            <Text>{t("settings.billing")}</Text>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          <Text className="text-xs text-muted-foreground">{t("settings.appearance")}</Text>
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={appearance.choice}
          onValueChange={(value) => void appearance.select(parseAppearanceChoice(value))}
        >
          {/* The selection dot takes the place of an icon, so the labels align with the items above. */}
          {appearanceChoices.map((value) => (
            <DropdownMenuRadioItem disabled={appearance.pending} key={value} value={value}>
              <Text>{t(`settings.themes.${value}`)}</Text>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {appearance.issue ? (
          <Text
            accessibilityRole="alert"
            className="max-w-56 px-2 py-1.5 text-xs leading-4 text-destructive"
          >
            {t(`appearance.errors.${appearance.issue}`)}
          </Text>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          closeOnPress={false}
          disabled={signOut.isPending}
          onPress={signOut.signOut}
        >
          <Icon as={LogOut} className="text-muted-foreground" size={15} />
          <Text>{signOut.isPending ? t("shell.signingOut") : t("common.signOut")}</Text>
        </DropdownMenuItem>
        {signOut.error ? (
          <Text
            accessibilityRole="alert"
            className="max-w-56 px-2 py-1.5 text-xs leading-4 text-destructive"
          >
            {signOut.error}
          </Text>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
