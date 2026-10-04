import { useRouter } from "expo-router";
import {
  ChevronsUpDown,
  CreditCard,
  Laptop,
  LogOut,
  Moon,
  Sun,
  UserRound,
} from "lucide-react-native";
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
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/initials";
import { useAppearance } from "@/providers/appearance-provider";

const appearanceChoices = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Laptop },
] as const;

type NavUserProps = {
  collapsed?: boolean;
  /** Null while the session is restored; the trigger keeps its size as a placeholder. */
  user: ShellUser | null;
  /** `sidebar` renders the full identity row; `avatar` is the compact top-bar trigger. */
  variant: "sidebar" | "avatar";
};

export function NavUser({ collapsed = false, user, variant }: NavUserProps) {
  if (!user) {
    return (
      <View aria-hidden className="h-11 flex-row items-center gap-2.5 px-2">
        <Skeleton className="size-7" />
        {variant === "sidebar" && !collapsed ? (
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </View>
        ) : null}
      </View>
    );
  }
  return <NavUserMenu collapsed={collapsed} user={user} variant={variant} />;
}

function NavUserMenu({
  collapsed = false,
  user: { email, name },
  variant,
}: NavUserProps & { user: ShellUser }) {
  const { t } = useTranslation();
  const router = useRouter();
  const signOut = useSignOut();
  const appearance = useAppearance();
  const displayName = name || t("common.pistoAccount");
  const initials = initialsOf(displayName);
  const compactTrigger = variant === "avatar" || collapsed;

  return (
    <View className="gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            accessibilityLabel={t("shell.userMenu", { name: displayName })}
            className={cn(
              compactTrigger ? "px-0" : "h-auto w-full justify-start gap-2.5 px-2 py-1.5",
              collapsed && "self-center",
            )}
            size={compactTrigger ? "icon" : "default"}
            variant="ghost"
          >
            <Avatar alt={displayName} className="size-7">
              <AvatarFallback className="bg-primary">
                <Text className="font-ui text-[11px] text-primary-foreground">{initials}</Text>
              </AvatarFallback>
            </Avatar>
            {compactTrigger ? null : (
              <>
                <View className="min-w-0 flex-1">
                  <Text className="font-ui text-left text-[13px] leading-4" numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text
                    className="text-left text-xs leading-4 text-muted-foreground"
                    numberOfLines={1}
                  >
                    {email}
                  </Text>
                </View>
                <Icon as={ChevronsUpDown} className="text-muted-foreground" size={14} />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={variant === "avatar" ? "end" : "start"}
          className="w-60"
          side={variant === "avatar" ? "bottom" : "top"}
          sideOffset={6}
        >
          <View className="flex-row items-center gap-2.5 px-2 py-1.5">
            <Avatar alt={displayName} className="size-8">
              <AvatarFallback className="bg-primary">
                <Text className="font-ui text-xs text-primary-foreground">{initials}</Text>
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
            {appearanceChoices.map(({ icon, value }) => (
              <DropdownMenuRadioItem disabled={appearance.pending} key={value} value={value}>
                <Icon as={icon} className="text-muted-foreground" size={15} />
                <Text>{t(`settings.themes.${value}`)}</Text>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            closeOnPress={false}
            disabled={signOut.isPending}
            onPress={signOut.signOut}
            variant="destructive"
          >
            <Icon as={LogOut} className="text-destructive" size={15} />
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
      {appearance.issue && !compactTrigger ? (
        <Text accessibilityRole="alert" className="px-2 text-xs leading-4 text-destructive">
          {t(`appearance.errors.${appearance.issue}`)}
        </Text>
      ) : null}
    </View>
  );
}
