# Pisto documentation

## Start here

Read `AGENTS.md`, then use this map to load only the guides relevant to the current task. Inspect
Git status and the actual code/contracts before editing. A historical task, missing screenshot or
planned feature is not evidence of the current implementation.

| Question | Current owner |
| --- | --- |
| What is Pisto, and what is the current goal? | [Product goal](product-goal.md) |
| What exists and what still needs implementation? | [Capability matrix](production-capabilities.md) |
| How does the system fit together? | [Architecture](architecture.md), [repository layout](repository-layout.md) |
| How do I start this checkout? | [Getting started](getting-started.md), including the configured Windows workspace |
| What has actually been tested? | [Release evidence](release-evidence.md), [validation gates](testing-release.md) |

The current product is a manual operating application: sales/history/correction, catalog/inventory,
expenses/cash, customers/receivables and exact operating reports. New-sale reviews have server-owned
recovery. AI, voice and native purchases are not implemented. The matrix owns the detailed status.

The runtime is local Expo, Bun/Hono and PostgreSQL 18. GitHub source synchronization is authorized;
cloud provisioning, hosted deployment and store submission require separate approval. See
[ADR 0017](adrs/0017-portable-postgres-and-hosting.md).

## Read by task

| Task | Guides to read |
| --- | --- |
| Styling, components, Expo Go, native/web behavior | [Frontend](frontend-expo-ui.md), [UX requirements](ux-requirements.md), [app README](../apps/app/README.md) |
| Sales, confirmation, history or correction | [Sales](sales.md), [review recovery ADR](adrs/0018-durable-sale-review.md) |
| Catalog or stock | [Catalog/inventory contract](product-slices/catalog-inventory-v1.md) |
| Cash or expenses | [Expenses/cash contract](product-slices/expenses-cash-v1.md) |
| Customers or debts | [Customers/receivables contract](product-slices/customers-receivables-v1.md) |
| Reports or cross-capability effects | [Operating core contracts](product-slices/operating-core-v1.md), [data model](data-model.md) |
| Schema, transactions or migrations | [Data model](data-model.md), [PostgreSQL/Drizzle](database-drizzle.md) |
| HTTP, sessions or permissions | [Hono API](api-hono.md), [authentication](authentication.md), [security](security.md) |
| Billing | [Entitlements](billing-entitlements.md), [billing package](../packages/billing/README.md) |
| Tooling, local runtime or dependencies | [CLI](cli-workflow.md), [local runtime](web-deployment.md), [upgrades](versioning-upgrades.md) |
| New capability or architecture change | [Product requirements](product-requirements.md), [capability composition](product-capability-architecture.md), [engineering workflow](engineering-workflow.md), relevant [ADRs](adrs/README.md) |

For material work, follow [the engineering workflow](engineering-workflow.md). Use
[the feature assignment template](agent-feature-prompt.md) when an assignment needs explicit
acceptance and ownership. These are reusable instructions, not a stale next-session work order.

## Approved future work, not current implementation

[The product brief](product-briefs/pisto-ai-business-assistant.md) defines the conversational target.
Read it and [the full AI guide](ai-assistant.md) for assistant/model/tool work; additionally read
[the voice guide](voice-architecture.md) for recording/transcription work. Do not load these long
future specifications for an unrelated copy, styling or manual-domain fix.

Unimplemented does not mean abandoned. Preserve valid future acceptance criteria, but do not add
providers, packages, routes or data stores before a scoped implementation is approved. Conversely,
do not recreate implemented sales history, reports, request budgets or new-sale recovery.

## Documentation maintenance

Keep one current explanation per concern. Update its owner guide when implementation changes and
link to it instead of copying another status matrix or task transcript. Retire superseded manuals
and completed handoffs from the working tree; Git preserves history. Do not keep an archive folder
that a new agent will mistake for active instructions. Retain active security rules, migration
invariants, acceptance gaps and relevant primary sources.

Generated output, ignored caches/backups and retired worktrees are not sources of current project
instructions. Read the active branch's guides rather than restoring their obsolete copies.

[The source index](source-index.md) identifies external references and recheck triggers, not proof of
installed versions or deployed behavior. Source code, the lockfile and direct validation establish
those facts. Documentation and commit messages are English; approved product UI remains Spanish.
