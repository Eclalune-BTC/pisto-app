import type { BusinessPermission } from "@pisto/contracts";
import { type Href, useRouter } from "expo-router";
import {
  HandCoins,
  type LucideIcon,
  Package,
  Plus,
  ReceiptText,
  ShoppingBag,
  Truck,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

type NewRecordId = "sale" | "purchase" | "expense" | "receivablePayment" | "supplierPayment";

/** The prototype's "¿Qué quiere registrar?" (figure 11), each behind its write permission. */
export const NEW_RECORD_ENTRIES: readonly {
  href: Href;
  icon: LucideIcon;
  id: NewRecordId;
  permission: BusinessPermission;
}[] = [
  { id: "sale", href: "/operate/sales/new", icon: ShoppingBag, permission: "sales:create" },
  {
    id: "purchase",
    href: "/operate/purchases/new",
    icon: Package,
    permission: "purchases:manage",
  },
  {
    id: "expense",
    href: "/operate/expenses/new",
    icon: ReceiptText,
    permission: "expenses:manage",
  },
  // A payment belongs to one receivable, so the abono starts from the open accounts.
  {
    id: "receivablePayment",
    href: { pathname: "/operate/receivables", params: { state: "open" } },
    icon: HandCoins,
    permission: "receivables:manage",
  },
  // Likewise, a supplier payment settles one purchase, chosen from what is owed.
  {
    id: "supplierPayment",
    href: "/operate/payables",
    icon: Truck,
    permission: "purchases:manage",
  },
];

export function NewRecordMenu({
  compact,
  permissions,
}: {
  compact: boolean;
  permissions: readonly BusinessPermission[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const entries = NEW_RECORD_ENTRIES.filter((entry) => permissions.includes(entry.permission));
  if (entries.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          accessibilityLabel={t("shell.newRecord.label")}
          className={compact ? "px-0" : "gap-1.5 bg-card px-3"}
          size={compact ? "icon-sm" : "sm"}
          variant="outline"
        >
          <Icon as={Plus} className="text-foreground" size={16} />
          {compact ? null : <Text className="text-[13px]">{t("shell.newRecord.trigger")}</Text>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72" sideOffset={6}>
        <DropdownMenuLabel>
          <Text className="font-ui text-[13px] text-foreground">{t("shell.newRecord.title")}</Text>
        </DropdownMenuLabel>
        {entries.map((entry) => (
          <DropdownMenuItem
            className="items-start gap-3 py-2"
            key={entry.id}
            onPress={() => router.push(entry.href)}
          >
            <View className="mt-0.5">
              <Icon as={entry.icon} className="text-muted-foreground" size={16} />
            </View>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-[13px] leading-4">
                {t(`shell.newRecord.${entry.id}.title`)}
              </Text>
              <Text className="text-xs leading-4 text-muted-foreground">
                {t(`shell.newRecord.${entry.id}.description`)}
              </Text>
            </View>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
