# Production capabilities matrix

This matrix prevents architecture diagrams from being mistaken for shipped operations. “Included”
means code/config exists in this repository. “Seam” means boundaries and documentation identify
where a capability belongs, but external configuration or implementation is still required.
“Not chosen” means no provider/product is silently assumed.

| Capability | Included now | Integration seam / release gate | Intentionally not chosen |
| --- | --- | --- | --- |
| Email/password sign-up and sign-in | Better Auth email/password switch, PostgreSQL-backed schema/rate limiting, sign-in/up UI, and session-backed account summary | Run PostgreSQL-backed lifecycle/denial tests and complete the release checks in [Authentication](authentication.md) before claiming production readiness | No social login, passkeys, or MFA is implied by the base account schema |
| Email verification and password recovery | Verification schema and reset-route rate rule only | Select a transactional email provider; implement verification and `sendResetPassword`, templates, enumeration-safe UX, session-revocation policy, bounce/domain/DKIM/DMARC, and delivery tests | No email vendor, verification flow, or working recovery delivery is bundled |
| Organizations, roles, and permissions | Better Auth organization server plugin plus organization/member/invitation schema | Approve the multi-user product job; define Pisto roles/permissions and limits; add the client plugin, invitation delivery/acceptance UX, verification policy, authorization tests, and audit evidence | No complete organization UI, invitation flow, Pisto RBAC model, admin/support role, or impersonation is claimed |
| Billing and entitlement projection | Polar web subscription catalog/checkout/portal, verified subscription lifecycle projection, provider-neutral entitlements, and an optional authenticated RevenueCat subscription webhook | Provision/test provider dashboards and sandbox products; install the RevenueCat native SDK for mobile; add a separate verified order/refund model before offering Polar one-time products | No Polar one-time-order entitlement projection and no local Apple/Google receipt verification |
| Expo push notifications | No push delivery | Add `expo-notifications`, permission UX, device-token ownership/rotation, server send path, receipts, opt-out, and physical-device testing | No push provider/config/credentials or campaign system |
| Jobs and tasks | API remains request-driven; billing webhook receipt is synchronous/durable; the Cloud Build reference configures, executes, and waits for a one-task, zero-retry Cloud Run migration job with a distinct identity/secret | Provision that job/IAM/database role and prove execution; add a Cloud Tasks adapter/private OIDC handler for retryable short HTTP work plus queues/alerts | No background loop inside API instances; no job/queue resource or successful execution is claimed deployed |
| File/object storage | No user file feature | Private Cloud Storage adapter, signed URL issuance, ownership/size/type validation, quarantine/scanning, lifecycle and IAM | No public bucket or local Cloud Run disk as durable storage |
| Observability and error reporting | Request IDs and structured request logs to stdout/stderr; health/readiness | On Cloud Run, connect redacted structured fields to Cloud Logging/Error Reporting, alerts, SLOs, traces, retention, and runbooks; verify in deployed revision | No Sentry/Datadog vendor or production alert coverage claimed |
| Product analytics and privacy | No behavioral analytics SDK | Define event taxonomy, lawful purpose/consent, minimization, retention/deletion, environment separation, identity policy, and platform privacy declarations before selecting a tool | No analytics/advertising tracker and no fabricated consent posture |
| Distributed rate limiting and cache | Better Auth rate limits use the PostgreSQL-backed `rateLimit` table and therefore span API instances; PostgreSQL remains authoritative; unresolved forwarded-IP chains fail safe into one shared per-path bucket | Verify Cloud Run sanitizes the selected client-IP/proxy contract before launch and test spoofed/comma-separated chains; add a separate API limiter/cache only after measured non-auth workload need | No verified deployed client-IP header contract, Redis/Memorystore resource, or entitlement cache |
| Feature flags | Explicit configuration switches such as auth, Polar, and RevenueCat enablement | Add typed server-evaluated flags with owner, default, expiry, audit, fallback, and client exposure policy if experimentation/rollout needs it | No remote flag vendor; env switches are not a full experimentation platform |
| Admin and support tooling | Stable opaque references, organization/auth schema, and a reserved `manual` entitlement source | Build least-privilege audited support actions, session revoke, entitlement reconciliation, and reasoned manual-grant creation/revocation before using that source | No Better Auth admin plugin/UI, impersonation, supported manual-grant command, or unrestricted database console for support |
| Backups and disaster recovery | Migration artifacts and recovery policy are documented | Provision Cloud SQL automated backups/PITR, retention, restore drills, RPO/RTO; define Storage versioning/retention and provider reconciliation; record evidence per environment | No backup/DR is claimed until a successful restore and operational owner exist |

## Promotion rule

A capability moves from seam to included only in the same change/release record that adds:

1. implementation and exact environment schema;
2. threat/privacy review and least-privilege identity;
3. unit/integration/failure tests;
4. provisioning/deployment/runbook/monitoring ownership;
5. production smoke and rollback/recovery evidence;
6. updated docs and ADR when the architecture boundary changes.

## Official sources

- [Better Auth email and password recovery](https://better-auth.com/docs/authentication/email-password)
- [Better Auth email provider seam](https://better-auth.com/docs/concepts/email)
- [Better Auth organization plugin](https://better-auth.com/docs/plugins/organization)
- [Better Auth database-backed rate limits](https://better-auth.com/docs/concepts/rate-limit)
- [Expo push notification overview](https://docs.expo.dev/push-notifications/overview/)
- [Cloud Tasks HTTP targets](https://cloud.google.com/tasks/docs/creating-http-target-tasks)
- [Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs)
- [Cloud Storage signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)
- [Cloud Run logging](https://cloud.google.com/run/docs/logging)
- [Cloud Run Error Reporting](https://cloud.google.com/run/docs/error-reporting)
- [Expo data and privacy protection](https://docs.expo.dev/guides/data-and-privacy-protection/)
- [Memorystore for Redis overview](https://cloud.google.com/memorystore/docs/redis/memorystore-for-redis-overview)
- [Better Auth admin plugin](https://better-auth.com/docs/plugins/admin)
- [Cloud SQL backups](https://cloud.google.com/sql/docs/postgres/backup-recovery/backups)
