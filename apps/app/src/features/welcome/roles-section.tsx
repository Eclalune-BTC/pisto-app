import type { BusinessRole } from "@pisto/contracts";
import { Check, ChevronDown, ChevronUp } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { ROLE_CAPABILITIES } from "@/features/business/role-capabilities";
import shopTeam from "../../../assets/welcome/shop-team.jpg";

export const ROLES = ["owner", "admin", "member"] as const satisfies readonly BusinessRole[];

type CapabilityKey = (typeof ROLE_CAPABILITIES)[number]["key"];

/**
 * The server's role policy restated for visitors who cannot read it yet: the API owns the real
 * one, and a test fails when this copy stops matching it.
 */
export const PUBLIC_ROLE_ACCESS: Record<(typeof ROLES)[number], readonly CapabilityKey[]> = {
  owner: ["sales", "receivables", "purchasesAndExpenses", "reports", "configure"],
  admin: ["sales", "receivables", "purchasesAndExpenses", "reports"],
  member: ["sales"],
};

export const TRUST_POINTS = ["confirmed", "business"] as const;

export function RolesAndTrust({ heading }: { heading: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<BusinessRole | null>("owner");
  return (
    <View className="min-w-0 gap-7 sm:gap-10">
      <View className="min-w-0 gap-6 lg:flex-row lg:items-stretch lg:gap-12 xl:gap-16">
        <View className="min-w-0 gap-5 lg:flex-1">
          {heading}
          <View className="border-b border-border">
            {ROLES.map((role) => {
              const expanded = open === role;
              return (
                <View className="border-t border-border" key={role}>
                  <Button
                    accessibilityLabel={t(`settings.roleNames.${role}`)}
                    aria-expanded={expanded}
                    accessibilityState={{ expanded }}
                    className="min-h-13 justify-between rounded-none px-0 py-3"
                    onPress={() => setOpen(expanded ? null : role)}
                    variant="ghost"
                  >
                    <Text className="font-heading text-title-lg text-foreground">
                      {t(`settings.roleNames.${role}`)}
                    </Text>
                    <Icon
                      as={expanded ? ChevronUp : ChevronDown}
                      size={18}
                      className="text-muted-foreground"
                    />
                  </Button>
                  {expanded ? (
                    <View
                      accessibilityLabel={t(`settings.roleNames.${role}`)}
                      className="gap-2 pb-5"
                      role="list"
                    >
                      {PUBLIC_ROLE_ACCESS[role].map((key) => (
                        <View role="listitem" key={key} className="flex-row items-center gap-2">
                          <Icon as={Check} className="text-foreground" size={15} />
                          <Text className="flex-1 text-dense">{t(`settings.matrix.${key}`)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
        <View className="h-[220px] min-w-0 overflow-hidden bg-muted sm:h-[300px] lg:h-auto lg:min-h-[390px] lg:flex-[1.12]">
          <Image
            accessible={false}
            resizeMode="cover"
            source={shopTeam}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        </View>
      </View>
      <View className="min-w-0 gap-5 border-t border-border pt-5 md:flex-row md:gap-8 lg:gap-12">
        {TRUST_POINTS.map((point) => (
          <View className="min-w-0 flex-1 gap-1.5" key={point}>
            <Heading level={3} size="section">
              {t(`welcome.roles.trust.${point}.title`)}
            </Heading>
            <Text className="text-sm leading-5 text-muted-foreground">
              {t(`welcome.roles.trust.${point}.description`)}
            </Text>
          </View>
        ))}
        <View className="min-w-0 flex-1 gap-1.5">
          <Heading level={3} size="section">
            {t("welcome.roles.scope.title")}
          </Heading>
          <Text className="text-sm leading-5 text-muted-foreground">
            {t("welcome.roles.scope.description")}
          </Text>
        </View>
      </View>
    </View>
  );
}
