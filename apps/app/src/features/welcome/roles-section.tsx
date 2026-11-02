import type { BusinessRole } from "@pisto/contracts";
import { Check, Minus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ROLE_CAPABILITIES } from "@/features/business/role-capabilities";
import { cn } from "@/lib/cn";
import { Surface } from "./fragments";

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

/** "Qué puede hacer cada rol", drawn as Configuración draws it for a signed-in owner. */
function RoleMatrix() {
  const { t } = useTranslation();
  return (
    <Surface>
      <View accessibilityLabel={t("settings.matrix.title")} role="table">
        <View
          className="flex-row items-center gap-2 border-b border-border bg-muted/60 px-4 py-2"
          role="row"
        >
          <Text
            className="flex-[2] text-xs leading-4 text-muted-foreground sm:flex-[3]"
            role="columnheader"
          >
            {t("settings.matrix.title")}
          </Text>
          {ROLES.map((role) => (
            <Text
              className="flex-1 text-center text-xs leading-4 text-muted-foreground"
              key={role}
              role="columnheader"
            >
              {t(`settings.roleNames.${role}`)}
            </Text>
          ))}
        </View>
        {ROLE_CAPABILITIES.map((capability, index) => (
          <View
            className={cn(
              "min-h-11 flex-row items-center gap-2 px-4 py-2.5",
              index > 0 && "border-t border-border",
            )}
            key={capability.key}
            role="row"
          >
            <Text className="flex-[2] text-[13px] leading-5 sm:flex-[3]" role="rowheader">
              {t(`settings.matrix.${capability.key}`)}
            </Text>
            {ROLES.map((role) => {
              const allowed = PUBLIC_ROLE_ACCESS[role].includes(capability.key);
              return (
                <View
                  accessibilityLabel={
                    allowed ? t("settings.matrix.allowed") : t("settings.matrix.denied")
                  }
                  className="flex-1 items-center"
                  key={role}
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
    </Surface>
  );
}

/** Who may do what in a business, and the guarantees every record keeps. */
export function RolesAndTrust() {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 gap-10">
      <View className="min-w-0 gap-12 lg:flex-row lg:gap-16">
        <View className="min-w-0 lg:flex-1">
          <RoleMatrix />
        </View>
        <View className="min-w-0 lg:w-[440px]" role="list">
          {TRUST_POINTS.map((point, index) => (
            <View
              className={cn(
                "gap-1.5 py-5",
                index > 0 && "border-t border-border",
                index === 0 && "pt-0",
              )}
              key={point}
              role="listitem"
            >
              <Heading className="text-base leading-6" level={3}>
                {t(`welcome.roles.trust.${point}.title`)}
              </Heading>
              <Text className="text-[15px] leading-6 text-muted-foreground web:text-pretty">
                {t(`welcome.roles.trust.${point}.description`)}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View className="gap-1.5 border-t border-border pt-8">
        <Heading className="text-base leading-6" level={3}>
          {t("welcome.roles.scope.title")}
        </Heading>
        <Text className="max-w-[720px] text-[15px] leading-6 text-muted-foreground web:text-pretty">
          {t("welcome.roles.scope.description")}
        </Text>
      </View>
    </View>
  );
}
