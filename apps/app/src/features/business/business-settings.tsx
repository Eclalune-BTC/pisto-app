import type { Business, BusinessAccess, BusinessPermission, BusinessRole } from "@pisto/contracts";
import { businessRolePoliciesResponseSchema } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Check, Minus, TriangleAlert } from "lucide-react-native";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { DescriptionList } from "@/components/layout/description-list";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { apiRequest } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/initials";

const ROLES: readonly BusinessRole[] = ["owner", "admin", "member"];

/** Everyday jobs and the permissions the server requires for each of them. */
export const ROLE_CAPABILITIES = [
  { key: "sales", permissions: ["sales:create"] },
  { key: "receivables", permissions: ["receivables:manage"] },
  { key: "purchasesAndExpenses", permissions: ["purchases:manage", "expenses:manage"] },
  { key: "reports", permissions: ["reports:read"] },
  { key: "configure", permissions: ["business:configure"] },
] as const satisfies readonly { key: string; permissions: readonly BusinessPermission[] }[];

/** A role can do a job only when the policy grants every permission the job needs. */
export function roleCan(
  policy: BusinessAccess,
  capability: (typeof ROLE_CAPABILITIES)[number],
): boolean {
  return capability.permissions.every((permission) => policy.permissions.includes(permission));
}

type Member = { id: string; name: string; email: string; role: string };

function rolePoliciesQueryOptions() {
  return {
    queryKey: ["business-roles"] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiRequest<{ data: { roles: BusinessAccess[] } }, { roles: BusinessAccess[] }>(
        "/v1/businesses/roles",
        { authenticated: true, signal },
        businessRolePoliciesResponseSchema,
      ),
    staleTime: Number.POSITIVE_INFINITY,
  };
}

function membersQueryOptions(businessId: string) {
  return {
    queryKey: ["business-members", businessId] as const,
    queryFn: async (): Promise<Member[]> => {
      const result = await authClient.organization.listMembers({
        query: { organizationId: businessId },
      });
      if (result.error) throw new Error(result.error.message ?? "Members could not be listed");
      return result.data.members.map((member) => ({
        email: member.user.email,
        id: member.id,
        name: member.user.name || member.user.email,
        role: member.role,
      }));
    },
  };
}

function Card({
  children,
  description,
  title,
}: PropsWithChildren<{ description: string; title: string }>) {
  return (
    <View
      accessibilityLabel={title}
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
      role="region"
    >
      <View className="gap-0.5 border-b border-border px-4 py-3.5 sm:px-5">
        <Heading level={2} size="section">
          {title}
        </Heading>
        <Text className="text-xs leading-4 text-muted-foreground">{description}</Text>
      </View>
      {children}
    </View>
  );
}

function roleLabel(t: TFunction, role: string): string {
  switch (role) {
    case "owner":
      return t("settings.roleNames.owner");
    case "admin":
      return t("settings.roleNames.admin");
    case "member":
      return t("settings.roleNames.member");
    default:
      return t("settings.roleNames.unknown");
  }
}

/** The business facts every member sees; there is no edit command for them yet. */
export function BusinessFactsCard({
  business,
  currency,
  timeZone,
}: {
  business: Business;
  currency: string;
  timeZone: string;
}) {
  const { t } = useTranslation();
  return (
    <Card description={t("settings.businessCardDescription")} title={t("settings.businessCard")}>
      <View className="p-4 sm:p-5">
        <DescriptionList
          items={[
            { label: t("settings.businessName"), value: business.name },
            { label: t("common.currency"), value: currency },
            { label: t("common.timeZone"), value: timeZone },
            { label: t("settings.role"), value: roleLabel(t, business.access.role) },
          ]}
        />
      </View>
    </Card>
  );
}

function MemberRows({ businessId }: { businessId: string }) {
  const { t } = useTranslation();
  const members = useQuery(membersQueryOptions(businessId));
  if (members.data) {
    return (
      <View>
        {members.data.map((member, index) => (
          <View
            className={cn(
              "flex-row items-center gap-3 px-4 py-2.5 sm:px-5",
              index > 0 && "border-t border-border",
            )}
            key={member.id}
          >
            <Avatar alt={member.name} className="size-8">
              <AvatarFallback className="bg-muted">
                <Text className="font-ui text-[11px] text-muted-foreground">
                  {initialsOf(member.name)}
                </Text>
              </AvatarFallback>
            </Avatar>
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] leading-5" numberOfLines={1}>
                {member.name}
              </Text>
              <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
                {member.email}
              </Text>
            </View>
            <Text className="font-ui text-[13px] text-muted-foreground">
              {roleLabel(t, member.role)}
            </Text>
          </View>
        ))}
      </View>
    );
  }
  if (members.isError) {
    return (
      <View className="p-4">
        <StatePanel
          action={
            <Button
              label={t("common.retry")}
              loading={members.isFetching}
              onPress={() => void members.refetch()}
              size="sm"
              variant="outline"
            />
          }
          description={t("settings.membersUnavailable")}
          icon={TriangleAlert}
          level={3}
          title={t("settings.members")}
          tone="destructive"
        />
      </View>
    );
  }
  return (
    <View accessibilityLabel={t("settings.loadingMembers")} aria-busy className="gap-3 p-4 sm:p-5">
      {[0, 1, 2].map((index) => (
        <View className="flex-row items-center gap-3" key={index}>
          <Skeleton className="size-8" />
          <Skeleton className="h-3 w-40" />
        </View>
      ))}
    </View>
  );
}

function PermissionMatrix() {
  const { t } = useTranslation();
  const policies = useQuery(rolePoliciesQueryOptions());
  if (!policies.data) {
    return policies.isError ? (
      <View className="p-4">
        <Button
          label={t("common.retry")}
          onPress={() => void policies.refetch()}
          size="sm"
          variant="outline"
        />
      </View>
    ) : (
      <View className="p-4 sm:p-5">
        <Skeleton className="h-24 w-full" />
      </View>
    );
  }
  const byRole = ROLES.map((role) => {
    const policy = policies.data.roles.find((candidate) => candidate.role === role);
    if (!policy) throw new Error(`The role policy for ${role} is missing`);
    return policy;
  });
  return (
    <View accessibilityLabel={t("settings.matrix.title")} role="table">
      <View
        className="flex-row items-center gap-2 border-y border-border bg-muted/60 px-4 py-2 sm:px-5"
        role="row"
      >
        <Text className="flex-[2] text-xs leading-4 text-muted-foreground" role="columnheader">
          {t("settings.matrix.title")}
        </Text>
        {ROLES.map((role) => (
          <Text
            className="flex-1 text-center text-xs leading-4 text-muted-foreground"
            key={role}
            role="columnheader"
          >
            {roleLabel(t, role)}
          </Text>
        ))}
      </View>
      {ROLE_CAPABILITIES.map((capability, index) => (
        <View
          className={cn(
            "flex-row items-center gap-2 px-4 py-2.5 sm:px-5",
            index > 0 && "border-t border-border",
          )}
          key={capability.key}
          role="row"
        >
          <Text className="flex-[2] text-[13px] leading-5" role="rowheader">
            {t(`settings.matrix.${capability.key}`)}
          </Text>
          {byRole.map((policy) => {
            const allowed = roleCan(policy, capability);
            return (
              <View
                accessibilityLabel={
                  allowed ? t("settings.matrix.allowed") : t("settings.matrix.denied")
                }
                className="flex-1 items-center"
                key={policy.role}
                role="cell"
              >
                <Icon
                  as={allowed ? Check : Minus}
                  className={allowed ? "text-positive" : "text-muted-foreground"}
                  size={15}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Who uses Pisto in this business and what each role may do, as the server's policy says. */
export function UsersCard({ businessId }: { businessId: string }) {
  const { t } = useTranslation();
  return (
    <Card description={t("settings.membersDescription")} title={t("settings.members")}>
      <MemberRows businessId={businessId} />
      <PermissionMatrix />
    </Card>
  );
}
