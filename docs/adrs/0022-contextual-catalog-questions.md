# ADR 0022: Contextual catalog questions with DeepSeek

- Status: Accepted for the hosted Pisto demo
- Date: 2026-11-18
- Owners: assistant, catalog, sales, API and Expo application
- Recheck when the model alias, JSON protocol, vendor data policy or catalog pricing contract changes.

## Decision

A member can ask about one catalog product, ask what a different quantity would cost and prepare that quantity in the existing sale editor. The active business must grant assistant use and catalog read. Preparing a sale also requires sale creation. A unique match from the user's complete search opens its price. Multiple matches require selection.

The server uses DeepSeek Flash for the intent and the literal quantity phrase in a follow-up. The fixed HTTPS endpoint receives the product display name, the user's follow-up and whether a previous quote exists. Prices, inventory, account identifiers, the ledger and audio stay outside this provider request. Registration and microphone transcription use the Workers AI adapters in ADR 0021. The server checks a strict schema, grounds the quantity against the sentence, rechecks access and reads the product again. It calculates the quote from the catalog price, selling-unit precision and currency snapshot. A missing price, unsupported quantity, archived item or unavailable provider produces an explicit state. Request and business limits are shared with registration.

The Expo dialog keeps up to four exchanges and the quoted quantity in memory. Closing it, changing the product or changing the active member/business ends this context. A quoted quantity can initialize the sale editor. The editor reloads the product and price, accepts corrections and uses the existing authorized, idempotent sale command only after confirmation. Ordinary catalog lookup, product forms and sale entry remain available.

## Alternatives and operations

A keyword-only classifier covers common phrasing but cannot resolve the full range of follow-ups. The owner selected DeepSeek for this slice. The built-in Fetch API and the existing Zod dependency cover the published JSON protocol without an additional application SDK. The provider key is a server secret named `DEEPSEEK_API_KEY`. Enable or withdraw the catalog model independently. A vendor failure is surfaced to the user. The global assistant switch also disables catalog inference.

The API client opts into the extended capability response using `/v1/assistant/status?include=catalog`. `POST /v1/assistant/catalog-turns` only calculates and reads. It accepts the expected business as a precondition and the selected product ID. Authentication selects the tenant. The provider cannot choose either identifier or supply a price.

## Validation and sources

Unit and HTTP tests exercise exact quantities, overflow, nullable prices, server permissions, archived products, rate budgets and malformed vendor responses. Browser acceptance covers the price of one bag, three bags at the catalog price, a follow-up accepting the quote and an editable sale. The demonstration uses seeded data.

Run `bun run --cwd packages/assistant eval:catalog` with the server credential to evaluate eight
Spanish follow-ups against the configured model. The set covers unit price, stock, hypothetical
quotes, quantity changes, acceptance, negation and a request for a different product.

- [DeepSeek JSON output](https://api-docs.deepseek.com/guides/json_mode/)
- [DeepSeek multi-round context](https://api-docs.deepseek.com/guides/multi_round_chat/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Worker request redirect handling](https://developers.cloudflare.com/workers/runtime-apis/request/)
