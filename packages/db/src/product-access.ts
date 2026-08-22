import type { BusinessAccess, BusinessPermission, BusinessRole } from "@pisto/contracts";

const rolePermissions = {
  owner: [
    "business:configure",
    "business:read",
    "sales:create",
    "sales:read",
    "sales:summary:read",
    "catalog:read",
    "catalog:manage",
    "inventory:read",
    "inventory:manage",
    "expenses:read",
    "expenses:manage",
    "cash:read",
    "cash:manage",
    "customers:read",
    "customers:manage",
    "receivables:read",
    "receivables:manage",
    "reports:read",
    "assistant:use",
  ],
  admin: [
    "business:read",
    "sales:create",
    "sales:read",
    "sales:summary:read",
    "catalog:read",
    "catalog:manage",
    "inventory:read",
    "inventory:manage",
    "expenses:read",
    "expenses:manage",
    "cash:read",
    "cash:manage",
    "customers:read",
    "customers:manage",
    "receivables:read",
    "receivables:manage",
    "reports:read",
    "assistant:use",
  ],
  member: [
    "business:read",
    "sales:create",
    "sales:read",
    "sales:summary:read",
    "catalog:read",
    "inventory:read",
    "assistant:use",
  ],
} as const satisfies Record<BusinessRole, readonly BusinessPermission[]>;

export const businessRoles = Object.freeze(
  Object.keys(rolePermissions) as BusinessRole[],
) as readonly BusinessRole[];

export function resolveBusinessAccess(role: string): BusinessAccess | null {
  if (!isBusinessRole(role)) return null;
  return {
    role,
    permissions: [...rolePermissions[role]],
  };
}

export function hasBusinessPermission(role: string, permission: BusinessPermission): boolean {
  const access = resolveBusinessAccess(role);
  return access?.permissions.includes(permission) ?? false;
}

export function rolesWithBusinessPermission(
  permission: BusinessPermission,
): readonly BusinessRole[] {
  return businessRoles.filter((role) => hasBusinessPermission(role, permission));
}

function isBusinessRole(role: string): role is BusinessRole {
  return Object.hasOwn(rolePermissions, role);
}
