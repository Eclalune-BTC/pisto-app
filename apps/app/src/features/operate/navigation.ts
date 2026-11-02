import type { BusinessPermission } from "@pisto/contracts";
import type { Href } from "expo-router";

/** `overview` sits under Inicio without a heading, like the prototype's Movimientos entry. */
export type OperateGroupId = "overview" | "money" | "accounts" | "catalog" | "insight";

export type OperateModuleId =
  | "movements"
  | "sales"
  | "expenses"
  | "cash"
  | "receivables"
  | "catalog"
  | "inventory"
  | "customers"
  | "suppliers"
  | "payables"
  | "reports";

export type OperateModule = {
  descriptionKey: `operate.modules.${OperateModuleId}.description`;
  group: OperateGroupId;
  href: Href;
  id: OperateModuleId;
  labelKey: `operate.modules.${OperateModuleId}.label`;
  permission: BusinessPermission;
};

export const OPERATE_GROUPS: ReadonlyArray<{
  id: OperateGroupId;
  labelKey: `operate.groups.${Exclude<OperateGroupId, "overview">}` | null;
}> = [
  { id: "overview", labelKey: null },
  { id: "money", labelKey: "operate.groups.money" },
  { id: "accounts", labelKey: "operate.groups.accounts" },
  { id: "catalog", labelKey: "operate.groups.catalog" },
  { id: "insight", labelKey: "operate.groups.insight" },
];

export const OPERATE_MODULES: readonly OperateModule[] = [
  {
    id: "movements",
    href: "/operate/movements",
    labelKey: "operate.modules.movements.label",
    descriptionKey: "operate.modules.movements.description",
    group: "overview",
    permission: "cash:read",
  },
  {
    id: "sales",
    href: "/operate/sales",
    labelKey: "operate.modules.sales.label",
    descriptionKey: "operate.modules.sales.description",
    group: "money",
    permission: "sales:read",
  },
  {
    id: "expenses",
    href: "/operate/expenses",
    labelKey: "operate.modules.expenses.label",
    descriptionKey: "operate.modules.expenses.description",
    group: "money",
    permission: "expenses:read",
  },
  {
    id: "cash",
    href: "/operate/cash",
    labelKey: "operate.modules.cash.label",
    descriptionKey: "operate.modules.cash.description",
    group: "money",
    permission: "cash:read",
  },
  {
    id: "receivables",
    href: "/operate/receivables",
    labelKey: "operate.modules.receivables.label",
    descriptionKey: "operate.modules.receivables.description",
    group: "accounts",
    permission: "receivables:read",
  },
  {
    id: "payables",
    href: "/operate/payables",
    labelKey: "operate.modules.payables.label",
    descriptionKey: "operate.modules.payables.description",
    group: "accounts",
    permission: "purchases:read",
  },
  {
    id: "catalog",
    href: "/operate/catalog",
    labelKey: "operate.modules.catalog.label",
    descriptionKey: "operate.modules.catalog.description",
    group: "catalog",
    permission: "catalog:read",
  },
  {
    id: "inventory",
    href: "/operate/inventory",
    labelKey: "operate.modules.inventory.label",
    descriptionKey: "operate.modules.inventory.description",
    group: "catalog",
    permission: "inventory:read",
  },
  {
    id: "customers",
    href: "/operate/customers",
    labelKey: "operate.modules.customers.label",
    descriptionKey: "operate.modules.customers.description",
    group: "catalog",
    permission: "customers:read",
  },
  {
    id: "suppliers",
    href: "/operate/suppliers",
    labelKey: "operate.modules.suppliers.label",
    descriptionKey: "operate.modules.suppliers.description",
    group: "catalog",
    permission: "purchases:read",
  },
  {
    id: "reports",
    href: "/operate/reports",
    labelKey: "operate.modules.reports.label",
    descriptionKey: "operate.modules.reports.description",
    group: "insight",
    permission: "reports:read",
  },
];

export function getVisibleOperateModules(
  permissions: readonly BusinessPermission[] | undefined,
): readonly OperateModule[] {
  if (!permissions) return [];

  const granted = new Set(permissions);
  return OPERATE_MODULES.filter(({ permission }) => granted.has(permission));
}
