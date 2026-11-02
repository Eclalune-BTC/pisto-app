import type { BusinessAccess, BusinessPermission } from "@pisto/contracts";

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
