# Active product goal

## Goal

Pisto helps Spanish-speaking entrepreneurs record and understand their business through structured
screens and, later, a bounded text assistant and push-to-talk input. PostgreSQL and deterministic
domain code own money, records, authorization and audit. AI is an interface, not a ledger.

Improve the existing manual operating core without replacing working functionality or building
speculative infrastructure. [The capability matrix](production-capabilities.md) owns implementation
status; [product requirements](product-requirements.md) own acceptance and remaining work.

## Current foundation

The universal Expo client uses React Native components, Tailwind and free Uniwind. Hono on Bun owns
HTTP composition; shared contracts, PostgreSQL/Drizzle, Better Auth and billing retain separate owners.
See [architecture](architecture.md) and [the frontend guide](frontend-expo-ui.md).

[Sales](sales.md), catalog/inventory, expenses/cash, customers/receivables and operating reports are
implemented. Sales history and transactional corrections already exist. New-sale reviews are durable
under [ADR 0018](adrs/0018-durable-sale-review.md); other financial editors still need recovery beyond
the mounted screen. A total-only sale does not implicitly affect cash or stock.

## Work selection

The owner's current request selects the task. Do not resume an old agent assignment or branch based
on a dated handoff. For each new capability, settle the user outcome, actor/permission, authoritative
data, confirmation/correction rules, failure states, platform requirements and acceptance before code.
Use [capability composition](product-capability-architecture.md) and
[the engineering workflow](engineering-workflow.md) for material changes.

Native-device and accessibility acceptance, remaining financial recovery, email delivery and team
workflows are distinct from implemented manual features. The text assistant follows the approved
[product brief](product-briefs/pisto-ai-business-assistant.md) and [AI guide](ai-assistant.md). Voice
follows proven text behavior and a separate bounded brief; it does not create another execution path.

## Runtime and delivery boundary

Development uses local Expo, Bun/Hono and PostgreSQL 18. Source may be committed and synchronized
with the authorized GitHub repository; that is not a hosted deployment. Hosting, provider activation
and store submission require separate approval under
[ADR 0017](adrs/0017-portable-postgres-and-hosting.md).

A feature is complete only with its approved end-to-end outcome, truthful UI states, preserved
security/data invariants, relevant failure tests and applicable platform/provider evidence.
[Release evidence](release-evidence.md) distinguishes checks actually performed from remaining gates.
