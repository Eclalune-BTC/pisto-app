import type { BusinessRole } from "@pisto/contracts";
import { Check, Minus } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ROLE_CAPABILITIES } from "@/features/business/role-capabilities";
import { cn } from "@/lib/cn";

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

/**
 * A role's column. On a phone an equal share of the row is narrower than "Propietario", and a
 * name that spills over its share no longer sits above its marks; the column takes the name's
 * width there, in the header and in every row alike.
 */
const ROLE_COLUMN = "w-[62px] sm:w-auto sm:flex-1";
const JOB_COLUMN = "min-w-0 flex-1 sm:flex-[3]";

/** "Qué puede hacer cada rol", with the jobs Configuración lists for a signed-in owner. */
function RoleMatrix() {
  const { t } = useTranslation();
  const title = t("settings.matrix.title");
  return (
    <View>
      {/* The caption has no room beside three role names on a phone, so it sits above them. */}
      <View aria-hidden className="pb-3 sm:hidden">
        <Text className="text-xs text-muted-foreground">{title}</Text>
      </View>
      <View accessibilityLabel={title} role="table">
        <View className="flex-row items-end gap-2 border-b border-border pb-3" role="row">
          <View className={JOB_COLUMN} role="columnheader">
            <View className="hidden sm:flex">
              <Text className="text-xs text-muted-foreground">{title}</Text>
            </View>
          </View>
          {ROLES.map((role) => (
            <Text
              className={cn(ROLE_COLUMN, "text-center font-ui text-xs sm:text-dense")}
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
              "min-h-13 flex-row items-center gap-2 py-3",
              index > 0 && "border-t border-border",
            )}
            key={capability.key}
            role="row"
          >
            <Text className={cn(JOB_COLUMN, "text-sm")} role="rowheader">
              {t(`settings.matrix.${capability.key}`)}
            </Text>
            {ROLES.map((role) => {
              const allowed = PUBLIC_ROLE_ACCESS[role].includes(capability.key);
              return (
                <View
                  accessibilityLabel={
                    allowed ? t("settings.matrix.allowed") : t("settings.matrix.denied")
                  }
                  className={cn(ROLE_COLUMN, "items-center")}
                  key={role}
                  role="cell"
                >
                  <Icon
                    as={allowed ? Check : Minus}
                    className={allowed ? "text-foreground" : "text-muted-foreground"}
                    size={16}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Who may do what in a business, the guarantees every record keeps and what Pisto leaves out. */
export function RolesAndTrust({ heading }: { heading: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 gap-12 lg:flex-row lg:gap-0">
      <View className="min-w-0 gap-10 lg:w-[440px] lg:shrink-0 lg:pr-16">
        {heading}
        <View role="list">
          {TRUST_POINTS.map((point) => (
            <View className="gap-2 border-t border-border py-5" key={point} role="listitem">
              <Heading level={3} size="item">
                {t(`welcome.roles.trust.${point}.title`)}
              </Heading>
              <Text className="text-base text-muted-foreground web:text-pretty">
                {t(`welcome.roles.trust.${point}.description`)}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View className="min-w-0 gap-10 lg:flex-1 lg:border-l lg:border-border lg:pl-16">
        <RoleMatrix />
        <View className="gap-2 border-t border-border pt-5">
          <Heading level={3} size="section">
            {t("welcome.roles.scope.title")}
          </Heading>
          <Text className="text-sm leading-6 text-muted-foreground web:text-pretty">
            {t("welcome.roles.scope.description")}
          </Text>
        </View>
      </View>
    </View>
  );
}
