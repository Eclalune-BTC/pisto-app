export * from "./auth.ts";
export * from "./billing.ts";

import * as auth from "./auth.ts";
import * as billing from "./billing.ts";

export const schema = {
  user: auth.user,
  session: auth.session,
  account: auth.account,
  verification: auth.verification,
  rateLimit: auth.rateLimit,
  organization: auth.organization,
  member: auth.member,
  invitation: auth.invitation,
  billingWebhookEvent: billing.billingWebhookEvent,
  billingCustomer: billing.billingCustomer,
  billingSubscription: billing.billingSubscription,
  entitlement: billing.entitlement,
};
