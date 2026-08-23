import type { BusinessPermission } from "@pisto/contracts";

import { authorizeBusinessAction, type BusinessLockStrength } from "../business-access.ts";
import type { ProductActor } from "../product.ts";
import type { AuthorizedBusiness, DatabaseExecutor } from "./types.ts";

export function authorizeCatalogAction(
  executor: DatabaseExecutor,
  actor: ProductActor,
  permission: BusinessPermission,
  lock: BusinessLockStrength,
): Promise<AuthorizedBusiness> {
  return authorizeBusinessAction(executor, actor, [permission], lock);
}
