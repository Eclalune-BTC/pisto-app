import type { BusinessPermission } from "@pisto/contracts";
import type { Href } from "expo-router";

export type OperateGroupId = "money" | "stock" | "relationships" | "insight";

export type OperateModuleId =
  | "sales"
  | "expenses"
  | "cash"
  | "catalog"
  | "inventory"
  | "customers"
  | "receivables"
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
  labelKey: `operate.groups.${OperateGroupId}`;
}> = [
  { id: "money", labelKey: "operate.groups.money" },
  { id: "stock", labelKey: "operate.groups.stock" },
  { id: "relationships", labelKey: "operate.groups.relationships" },
  { id: "insight", labelKey: "operate.groups.insight" },
];

export const OPERATE_MODULES: readonly OperateModule[] = [
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
    id: "catalog",
    href: "/operate/catalog",
    labelKey: "operate.modules.catalog.label",
    descriptionKey: "operate.modules.catalog.description",
    group: "stock",
    permission: "catalog:read",
  },
  {
    id: "inventory",
    href: "/operate/inventory",
    labelKey: "operate.modules.inventory.label",
    descriptionKey: "operate.modules.inventory.description",
    group: "stock",
    permission: "inventory:read",
  },
  {
    id: "customers",
    href: "/operate/customers",
    labelKey: "operate.modules.customers.label",
    descriptionKey: "operate.modules.customers.description",
    group: "relationships",
    permission: "customers:read",
  },
  {
    id: "receivables",
    href: "/operate/receivables",
    labelKey: "operate.modules.receivables.label",
    descriptionKey: "operate.modules.receivables.description",
    group: "relationships",
    permission: "receivables:read",
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
