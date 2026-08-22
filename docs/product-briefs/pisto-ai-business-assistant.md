# Pisto AI-native business assistant

- Status: **approved product direction and first vertical slice**
- Owner: **repository owner**
- Approved: **2026-08-22**
- Implementation status: **manual total-only increment implemented locally; approved conversational
  slice remains incomplete**

## Product definition

Pisto is an AI-native business operating assistant for Spanish-speaking entrepreneurs. It turns
plain language or short voice notes into reviewable business operations and answers questions from
verified business data. The long-term product brings sales, inventory, expenses, cash, customers,
reports, and team workflows into one web, iOS, and Android application.

Pisto is AI-first, not AI-only. The conversational assistant accelerates work, while structured
screens let a user inspect, correct, and operate the same underlying records. PostgreSQL and the
deterministic domain rules are authoritative. A model response, transcript, conversation, generated
number, or client-side state is never the ledger.

Pisto is an operational and financial copilot, not a licensed accountant, tax filing service, bank,
or autonomous money manager. It must distinguish revenue, cash, cost, margin, and profit rather than
using those words interchangeably.

Conversational Spanish is approved for the first job. The manual increment uses neutral Latin
American Spanish copy with Salvadoran `es-SV` money/date formatting as the explicit initial product
choice; it still requires validation with Salvadoran users before release. Code, identifiers, tests,
logs, and repository documentation remain English. The client uses one typed `es-SV` catalog and
system-locale adapter per [ADR 0013](../adrs/0013-es-sv-localization-boundary.md). Do not advertise a
bilingual UI, language selector, or persisted override until a second locale has an approved brief.

## Problem and competitive direction

The primary user is an owner-operator who currently tracks the business in memory, paper, chat, or
spreadsheets and needs a faster way to record what happened and understand the result.

Treinta is the current competitive reference named by the owner. Its official product pages describe
sales registration, inventory updates, expenses, reports, customers, suppliers, employee access,
receipts, and synchronized mobile/web use. Pisto should eventually cover the core operating jobs
that matter to the same entrepreneur, but its differentiation is not a copied feature grid. Pisto's
advantage is a trustworthy conversational execution layer:

- "I sold three coffees at two dollars each in cash" becomes a visible sale draft.
- "How did last month go?" becomes a period-specific answer calculated from stored records.
- A short voice note follows the same typed, reviewable flow as text.
- Every write is authorized, confirmed when required, idempotent, and auditable.

Competitive pages are market context, not implementation evidence or permission to copy proprietary
UI, copy, data, or behavior.

## First approved user job

An authenticated business owner can record one sale in conversational Spanish and later ask for the
previous calendar month's sales result.

The first slice begins when the owner submits a text instruction. It ends only when:

1. Pisto has extracted a complete sale draft or asked for the exact missing information;
2. the user has reviewed and explicitly confirmed the draft;
3. the server has authorized and committed the sale exactly once; and
4. a later monthly question is answered from the committed sales data, with the period, currency,
   data freshness, and limits of the calculation made clear.

Voice input is the next delivery slice after the text workflow is proven. Inventory deduction is the
next domain slice after catalog and stock ownership are approved. Neither is implied by completing
the first text-based sale slice.

## Primary actor and tenant boundary

- The first actor is one authenticated owner operating one business workspace.
- A business workspace is backed by a Better Auth organization. Pisto calls the opaque organization
  identifier `businessId`; every product record is scoped to a server-resolved and membership-checked
  value. A client, session selector, or model cannot authorize an arbitrary tenant identifier.
- The first slice includes creation or selection of one workspace and verifies its owner membership.
  Existing organization tables/routes and raw `admin`/`member` values do not constitute an approved
  Pisto role or permission model.
- No paid entitlement is required for the approved first slice. Authentication, business ownership,
  abuse/cost limits, and the server kill switch still apply. Pricing or plan-based feature access
  requires a later approved commercial brief; existing billing seams do not invent that policy.
- Owner, manager, cashier, and accountant are possible future roles, not current authorization
  contracts. A later brief must define every permission and denial case before multi-user work begins.

See [ADR 0010](../adrs/0010-organization-backed-business-tenancy.md) for the identity/domain boundary
and organization-deletion rule.

## First-slice data contract

### Business settings

Before the first sale, the owner must explicitly select:

- an ISO 4217 operating currency;
- an IANA time zone; and
- a business display name, initially owned by the organization workspace.

The product may suggest values from device locale, but it must not persist or use them without clear
confirmation. The first slice supports one operating currency per business and performs no currency
conversion.

### Sale draft

A draft can contain:

- occurrence date and time interpreted in the business time zone;
- currency;
- one or more lines with a description, quantity, and unit price;
- an optional linked catalog product or variant when that capability exists;
- an optional payment method from a controlled vocabulary;
- an optional customer reference and note when their owning modules exist; and
- a deterministic gross total in integer minor units.

Required information for the first slice is occurrence time, currency, and a positive gross amount.
First-slice line quantity is a positive integer and unit price is a non-negative integer number of
minor currency units. The server computes each line with exact integer multiplication and computes
the sale gross as the exact line sum. Fractional measured quantities, discounts, and taxes require a
later money contract; until then, use a confirmed total-only sale when appropriate. The model may
extract a proposed value but never supplies an authoritative total.

A total-only sale is valid, but Pisto must explain that it cannot support product-level or inventory
analysis. A free-text line never changes stock. Inventory changes only when a confirmed sale line is
linked to an approved stock-tracked product variant.

### Canonical record and audit

The confirmed server command creates a canonical sale, its lines, and an audit event in one short
database transaction. The command includes an idempotency key bound to the authenticated subject,
business, and proposed operation. Replays return the original result and do not create a second sale.

Financial history is not silently overwritten or hard-deleted. The first slice supports these exact
correction semantics:

- a confirmed void marks one posted sale voided once and records actor, reason, and timestamp;
- a confirmed replacement command voids the original and creates the newly reviewed sale atomically,
  with bidirectional references and one idempotency boundary;
- a voided sale cannot be voided/replaced again, and neither operation can cross a business;
- the replacement occurrence time is explicit in its draft and is never copied silently; and
- current-period reports exclude the voided original and include a posted replacement according to
  its confirmed occurrence time. Audit history preserves both records and the relationship.

Historical “as-of before correction” reporting is not part of the first slice.

Conversation messages, transcripts, and model outputs are working data. They do not become sales and
can be deleted without deleting canonical business records.

## Conversation behavior

### Write request

For a request such as "Vendí tres cafés a dos dólares cada uno en efectivo hoy":

1. resolve the authenticated user and business on the server;
2. extract a typed draft through a bounded provider-neutral model call;
3. ask one focused question when a required fact is ambiguous or absent;
4. show the exact interpreted date, currency, lines, total, and stock effect;
5. require explicit approval before the mutating tool or command executes;
6. revalidate authorization, inputs, current state, and idempotency on the server; and
7. return a stable sale reference and truthful committed result.

The assistant must not guess a missing price, quantity, currency, date, business, product match, tax,
discount, or payment status. Fuzzy product matches require selection or confirmation.

### Read request

For "¿Cómo me fue el mes pasado?":

1. interpret "last month" as the previous closed calendar month in the business time zone;
2. call a typed read-only sales-summary query;
3. calculate totals in deterministic domain/SQL code;
4. report the exact start/end period, currency, gross sales, sale count, and average ticket;
5. report product rankings only when sufficient line-level data exists; and
6. say explicitly that gross sales are not profit until costs and expenses exist.

The query uses posted sale `occurredAt`, not creation time. It converts the previous local calendar
month's half-open boundaries to UTC, excludes voided sales, and returns gross minor units, posted sale
count, and the query timestamp. Average ticket is the gross numerator divided by posted sale count and
rounded half-up to the nearest minor unit for display; the numerator and count remain available so no
rounded average becomes canonical data. A legitimate empty period returns zero gross and zero count
with an explicit empty state; a query/provider failure does not.

The model must not calculate the answer from chat history, regenerate missing transactions, or
present an empty/provider-error state as zero revenue.

## AI action policy

| Action class | Baseline policy |
| --- | --- |
| Explain product behavior or ask a clarification | May run without approval |
| Read an authorized deterministic report | May run without approval; include scope and freshness |
| Propose a sale or correction draft | May run without approval; draft has no domain effect |
| Create, void, adjust, import, or otherwise mutate business data | Requires explicit user approval and server revalidation |
| Change members, roles, billing, exports, or destructive settings | Not part of the first slice; requires a separate approved policy |
| Transfer money, file taxes, or act in another external financial system | Prohibited unless a later owner-approved brief and security review explicitly add it |

No model receives arbitrary SQL, database credentials, provider credentials, or a generic HTTP tool.
Only narrow Pisto-owned tools with bounded schemas are exposed.

## Voice direction

The first voice slice is push-to-talk, not an always-listening realtime agent:

1. request microphone permission in context;
2. visibly record a short bounded clip;
3. upload it through an authenticated, size- and type-limited endpoint;
4. transcribe it server-side through the same provider boundary;
5. delete raw audio after the bounded retry window by default;
6. show an editable transcript; and
7. submit the edited text through the existing conversation flow.

No background recording, hidden microphone activation, indefinite raw-audio retention, or silent
submission is allowed. Text remains a complete accessible path when permission is denied, the user is
offline, transcription fails, or speech is unsupported.

## Retrieval and graph decision

The first product slices use no RAG, embeddings, vector database, Neo4j, or GraphRAG.

- Sales, inventory, expenses, customers, and reports are structured relational facts. Authorized SQL
  queries and domain code answer them exactly.
- PostgreSQL full-text search is the first option for names, notes, and keyword search.
- Add pgvector only after an approved unstructured corpus and labeled evaluation show that full-text
  search misses a required semantic-retrieval target.
- Add Neo4j only after representative high-value questions require variable-depth multi-hop graph
  traversal and a benchmark shows PostgreSQL joins or recursive CTEs are inadequate.
- Add GraphRAG only when a large unstructured corpus creates cross-document relationship questions
  that evaluated SQL, full-text, and vector retrieval cannot answer well enough to justify a second
  runtime, datastore, ingestion pipeline, and reconciliation model.

Transactional business facts remain relational and authoritative even if retrieval systems are added.

## Product roadmap boundaries

The intended module order is:

1. sales entry, history, correction, and deterministic period summaries;
2. push-to-talk voice input over the proven typed sale/report commands;
3. product catalog and inventory movements linked to confirmed sales and purchases;
4. expenses, cash movement, and cost-of-goods foundations needed to discuss profit truthfully;
5. customers, suppliers, receivables, payables, and reports/export;
6. approved multi-user roles and permissions;
7. document ingestion or semantic retrieval only when a real job requires it.

This order is directional. Each module still needs a small approved feature brief. Do not build all
modules, generic workflow engines, speculative tables, or role systems in advance. The dependency
gates, capability slice contract, product shell, and shared UI/action rules are in
[Product capability architecture](../product-capability-architecture.md).

## Explicit first-slice non-goals

- inventory deduction, purchasing, expenses, cash close, profit, tax, invoices, receipts, or banking;
- multiple currencies or exchange-rate conversion;
- fractional/weight-based line quantities, discounts, tax calculation, or fiscal compliance;
- employee invitations, roles, permissions, impersonation, or admin tools;
- offline writes or conflict synchronization;
- autonomous or background financial actions;
- file upload, OCR, RAG, embeddings, pgvector, Neo4j, GraphRAG, or web search;
- realtime voice, text-to-speech, always-on listening, or background recording;
- automatic provider failover;
- pricing, plan eligibility, metering-based billing, or an AI entitlement gate;
- claiming deployment, production readiness, accountant replacement, or legal/fiscal compliance.

## Acceptance criteria for the first slice

- An authenticated owner can submit representative Spanish sale phrases and receive an editable
  typed draft without a database write.
- Ambiguous or missing required information produces a focused clarification, not a guessed value.
- The confirmation surface states the exact sale and any stock effect before approval.
- Approval commits the sale once; duplicate requests and reconnect/retry paths do not duplicate it.
- Another user or business cannot read, approve, or mutate the sale.
- Invalid, expired, denied, rate-limited, timed-out, and provider-unavailable paths remain truthful and
  offer only valid recovery actions.
- The previous-month summary uses the business time zone and canonical database records.
- Empty data is distinguished from query/provider failure.
- The answer never labels revenue as profit without cost and expense data.
- A confirmed correction/void path preserves audit history.
- Web, compact web, iOS, and Android exercise the same product meaning with appropriate platform UI.
- Deterministic, provider-mocked, database integration, authorization, idempotency, adversarial prompt,
  and representative model-evaluation suites pass.
- The exact AI provider/model, prompt version, latency, token/cost, tool calls, and failure reason are
  observable without logging sensitive prompts, transcripts, or tool payloads by default.

## Current repository truth

As of 2026-08-22, the repository implements and locally validates one narrower manual increment:
owner-only business onboarding, static current-operation permissions for exact
`owner`/`admin`/`member` memberships, a reviewed total-only sale, idempotent canonical persistence,
and a deterministic previous-calendar-month summary. It does not yet implement conversational text
extraction, clarification, correction/void, AI SDK orchestration, voice, inventory, retrieval, or the
other modules described above. The exact implemented boundary and evidence are in
[Sales Increment 1](../sales-increment-1.md). This approved brief remains the acceptance contract for
the larger first slice; a passing manual increment is not evidence that the conversational slice is
complete or deployed.

## Primary market sources

- [Treinta sales reports and statistics](https://treinta.co/app-para-reportes-de-ventas-y-estadisticas-de-tu-negocio)
- [Treinta inventory and sales](https://treinta.co/software-inventario-ventas)
- [Treinta feature overview](https://treinta.co/funcionalidades)
