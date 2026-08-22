import type { BusinessAccess, BusinessPermission, BusinessRole } from "@pisto/contracts";

const rolePermissions = {
  owner: [
    "business:configure",
    "business:read",
    "sales:create",
    "sales:read",
    "sales:summary:read",
  ],
  admin: ["business:read", "sales:create", "sales:read", "sales:summary:read"],
  member: ["business:read", "sales:create", "sales:read", "sales:summary:read"],
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
