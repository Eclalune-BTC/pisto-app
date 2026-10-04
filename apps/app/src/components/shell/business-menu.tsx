import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChevronsUpDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/initials";
import { notify } from "@/lib/notify";
import {
  businessesQueryKey,
  businessesQueryOptions,
  getActiveBusiness,
  selectActiveBusiness,
} from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";

function BusinessIdentity({
  collapsed,
  currency,
  name,
}: {
  collapsed: boolean;
  currency: string;
  name: string;
}) {
  return (
    <>
      <Avatar alt={name} className="size-7">
        <AvatarFallback className="bg-foreground">
          <Text className="font-heading text-[11px] text-background">{initialsOf(name)}</Text>
        </AvatarFallback>
      </Avatar>
      {collapsed ? null : (
        <View className="min-w-0 flex-1">
          <Text className="font-heading text-left text-[13px] leading-4" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-left text-xs leading-4 text-muted-foreground" numberOfLines={1}>
            {currency}
          </Text>
        </View>
      )}
    </>
  );
}

export function BusinessMenu({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const businesses = useQuery(businessesQueryOptions);
  const selection = useMutation({
    mutationFn: selectActiveBusiness,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: businessesQueryKey });
      router.replace("/operate");
    },
    onError: () => notify.error(t("shell.businessSwitchFailed")),
  });

  if (hasDeniedRead([businesses])) return null;
  const active = getActiveBusiness(businesses.data);
  if (!active) {
    return businesses.isPending ? (
      <View className="flex-row items-center gap-2.5 px-2 py-1.5">
        <Skeleton className="size-7" />
        {collapsed ? null : <Skeleton className="h-4 flex-1" />}
      </View>
    ) : null;
  }

  const items = businesses.data?.items ?? [];
  const stale = queryHasStaleData(businesses);
  if (items.length < 2) {
    return (
      <View
        accessibilityLabel={t("shell.activeBusiness", { name: active.name })}
        className={cn("flex-row items-center gap-2.5 px-2 py-1.5", collapsed && "justify-center")}
      >
        <BusinessIdentity collapsed={collapsed} currency={active.currency} name={active.name} />
        {stale && !collapsed ? (
          <Text accessibilityLiveRegion="polite" className="text-xs text-muted-foreground">
            {t("remote.stale")}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          accessibilityLabel={t("shell.switchBusiness", { name: active.name })}
          className={cn("h-auto w-full justify-start gap-2.5 px-2 py-1.5", collapsed && "px-0")}
          disabled={selection.isPending}
          variant="ghost"
        >
          <BusinessIdentity collapsed={collapsed} currency={active.currency} name={active.name} />
          {collapsed ? null : (
            <Icon as={ChevronsUpDown} className="text-muted-foreground" size={14} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60" sideOffset={6}>
        <DropdownMenuLabel>
          <Text className="text-xs text-muted-foreground">{t("shell.businesses")}</Text>
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={active.id}
          onValueChange={(id) => {
            if (id !== active.id) selection.mutate(id);
          }}
        >
          {items.map((business) => (
            <DropdownMenuRadioItem key={business.id} value={business.id}>
              <Text numberOfLines={1}>{business.name}</Text>
              <Text className="ml-auto text-xs text-muted-foreground">{business.currency}</Text>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
