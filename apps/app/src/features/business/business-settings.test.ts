import type { BusinessAccess } from "@pisto/contracts";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#18181b") : "#18181b",
  withUniwind: (component: unknown) => component,
}));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));
vi.mock("@/lib/api-client", () => ({ apiRequest: vi.fn() }));
vi.mock("./member-dialogs", () => ({}));
vi.mock("@/components/ui/row-actions", () => ({ RowActions: "row-actions" }));

import { ROLE_CAPABILITIES, roleCan } from "./business-settings";

const capability = (key: (typeof ROLE_CAPABILITIES)[number]["key"]) => {
  const found = ROLE_CAPABILITIES.find((entry) => entry.key === key);
  if (!found) throw new Error(key);
  return found;
};

describe("role capability matrix", () => {
  const seller: BusinessAccess = {
    role: "member",
    permissions: ["business:read", "sales:create", "sales:read", "expenses:manage"],
  };

  test("a job is allowed only when every permission it needs is granted", () => {
    expect(roleCan(seller, capability("sales"))).toBe(true);
    expect(roleCan(seller, capability("receivables"))).toBe(false);
    // Expenses alone do not make the purchases-and-expenses job.
    expect(roleCan(seller, capability("purchasesAndExpenses"))).toBe(false);
    expect(roleCan(seller, capability("configure"))).toBe(false);
  });
});
