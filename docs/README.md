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
recovery. The registration assistant drafts records from one dictated or typed sentence
([ADR 0021](adrs/0021-workers-ai-registration-assistant.md)); conversational AI and native purchases
are not implemented. The matrix owns the detailed status.

Development runs locally on Expo, Bun/Elysia and PostgreSQL 18. The hosted demo runs on Cloudflare
Workers with Neon ([ADR 0020](adrs/0020-cloudflare-workers-neon-hosting.md),
[runbook](deployment-cloudflare.md)). GitHub source synchronization is authorized; store
submission still requires separate approval.

## Read by task

| Task | Guides to read |
| --- | --- |
| Styling, components, logo and responsive workspaces | [Design system](design-system.md), [frontend](frontend-expo-ui.md), [UX requirements](ux-requirements.md) |
| Expo Go and native/web runtime | [Frontend](frontend-expo-ui.md), [app README](../apps/app/README.md) |
| Sales, confirmation, history or correction | [Sales](sales.md), [review recovery ADR](adrs/0018-durable-sale-review.md) |
| Catalog or stock | [Catalog/inventory contract](product-slices/catalog-inventory-v1.md) |
| Cash or expenses | [Expenses/cash contract](product-slices/expenses-cash-v1.md) |
| Customers or debts | [Customers/receivables contract](product-slices/customers-receivables-v1.md) |
| Reports or cross-capability effects | [Operating core contracts](product-slices/operating-core-v1.md), [data model](data-model.md) |
| Schema, transactions or migrations | [Data model](data-model.md), [PostgreSQL/Drizzle](database-drizzle.md) |
| HTTP, sessions or permissions | [Elysia API](api-elysia.md), [authentication](authentication.md), [security](security.md) |
| Billing | [Entitlements](billing-entitlements.md), [billing package](../packages/billing/README.md) |
| Tooling, local runtime or dependencies | [CLI](cli-workflow.md), [local runtime](local-runtime.md), [upgrades](versioning-upgrades.md) |
| New capability or architecture change | [Product requirements](product-requirements.md), [capability composition](product-capability-architecture.md), [engineering workflow](engineering-workflow.md), relevant [ADRs](adrs/README.md) |

For material work, follow [the engineering workflow](engineering-workflow.md). Use
[the feature assignment template](agent-feature-prompt.md) when an assignment needs explicit
acceptance and ownership.

## Approved future work, not current implementation

[The product brief](product-briefs/pisto-ai-business-assistant.md) defines the conversational target.
Read it and [the full AI guide](ai-assistant.md) for assistant/model/tool work; additionally read
[the voice guide](voice-architecture.md) for recording/transcription work. Do not load these long
future specifications for an unrelated copy, styling or manual-domain fix.

Unimplemented does not mean abandoned. Preserve valid future acceptance criteria, but do not add
providers, packages, routes or data stores before a scoped implementation is approved. Conversely,
do not recreate implemented sales history, reports, request budgets or new-sale recovery.

## Documentation maintenance

Keep one current explanation per concern. Update its guide when implementation changes and link to
it instead of copying another status matrix. Remove superseded manuals rather than archiving them;
Git preserves history. Retain active security rules, migration invariants, acceptance gaps and
relevant primary sources.

[The source index](source-index.md) identifies external references and recheck triggers, not proof of
installed versions or deployed behavior. Source code, the lockfile and direct validation establish
those facts. Documentation and commit messages are English; approved product UI remains Spanish.
