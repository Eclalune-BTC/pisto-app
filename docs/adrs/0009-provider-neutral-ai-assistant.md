# ADR 0009: Provider-neutral AI assistant with deterministic business tools

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/app`, `@pisto/api`, future product and assistant packages
- Supersedes: none
- Research recheck: AI SDK, provider, Expo/Bun, retrieval, privacy, or voice architecture change

## Context

Pisto's approved product direction lets an entrepreneur record and query business activity through
text and later voice. The model must understand natural language without becoming the source of truth
for money, authorization, inventory, or accounting calculations. The product also needs to change
model providers without spreading provider APIs through the client or domain.

Sales and inventory questions are structured relational work. No approved first-slice question needs
semantic document retrieval or variable-depth graph traversal.

## Decision

Use the current stable Vercel AI SDK 7 family as a thin server-side model, structured-output, tool,
approval, streaming, and transcription boundary. Pin the exact patch and one initial provider adapter
only after a compatibility spike proves the pinned versions on Bun/Hono/Cloud Run and Expo web/iOS/
Android. Keep stable task aliases in one validated server registry and keep provider credentials out of
the Expo bundle.

The assistant receives only narrow Pisto-owned tools. Read tools call authorized deterministic
queries. Financial mutation tools require explicit approval and then repeat authorization, schema,
state, money, idempotency, and audit validation before a transactional commit. The model receives no
arbitrary SQL, generic HTTP, database, billing, role, or secret capability.

Keep PostgreSQL authoritative for product and conversation records. Start without RAG, pgvector,
Neo4j, GraphRAG, Redis stream resumption, durable agent workflows, or realtime voice. Follow the
evidence-based escalation gates in [AI assistant architecture](../ai-assistant.md).

Use short push-to-talk recordings and server transcription only after the text assistant is proven.
The transcript is editable and follows the same confirmation path as typed text.

## Consequences

- Product domains remain deterministic and testable without a model provider.
- Switching providers is isolated but not assumed behaviorally equivalent; each change needs the same
  representative evaluation and release gate.
- An AI outage degrades the assistant but does not corrupt or hide canonical structured product data.
- Approval, authorization, idempotency, audit, timeouts, cost limits, privacy, and evaluation become
  first-class delivery requirements.
- The first implementation needs new product and assistant boundaries, contracts, schema, migrations,
  tests, configuration, and UI; this ADR does not claim they exist.
- Avoiding retrieval and a second datastore reduces synchronization, tenant-isolation, backup, and
  operational risk until a measured job earns that cost.

## Alternatives considered

- **Call one provider SDK directly throughout the API:** less initial code, but spreads provider
  messages and model identifiers and makes evaluated replacement harder.
- **Require Vercel AI Gateway immediately:** convenient multi-model routing, but adds an external data
  path and operational dependency before routing or failover is a proven requirement. It remains an
  optional adapter.
- **Let the model generate SQL or write database rows:** rejected because schemas do not prove factual
  correctness, tenant authorization, money precision, or safe mutation behavior.
- **Use RAG or pgvector for transactional questions:** rejected because exact relational queries are
  authoritative and more testable.
- **Use Neo4j or GraphRAG now:** rejected because no approved variable-depth graph or cross-document
  relationship question justifies a second datastore and Python ingestion runtime.
- **Begin with realtime voice:** rejected because text plus short transcription reuses one review and
  approval flow with lower privacy, native, latency, and provider complexity.

## Validation required before implementation promotion

- exact-version Bun/Hono/container streaming and cancellation spike;
- Expo web/iOS/Android stream and authentication spike;
- provider capability, Spanish evaluation, latency, token, and cost comparison;
- approval tamper/replay, authorization, idempotency, and transaction tests;
- conversation retention/deletion and telemetry redaction review;
- physical-device recording/transcription tests before the voice slice; and
- an independent architecture/security review.

## Official sources

- [Vercel AI SDK 7](https://vercel.com/changelog/ai-sdk-7)
- [AI SDK provider management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management)
- [AI SDK tools and approvals](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK Expo quickstart](https://ai-sdk.dev/docs/getting-started/expo)
- [AI SDK Hono example](https://ai-sdk.dev/cookbook/api-servers/hono)
- [Expo SDK 57 fetch and streams](https://docs.expo.dev/versions/v57.0.0/sdk/expo/)
- [PostgreSQL full-text search](https://www.postgresql.org/docs/18/textsearch.html)
- [pgvector](https://github.com/pgvector/pgvector)
- [Neo4j GraphRAG](https://neo4j.com/docs/neo4j-graphrag-python/current/)
