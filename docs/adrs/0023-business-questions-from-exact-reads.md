# ADR 0023: Business questions answered from exact reads

- Status: Accepted (owner request on 2026-11-18 for an assistant that answers about the business)
- Date: 2026-11-19
- Owners: `@pisto/assistant`, `@pisto/api`, `@pisto/db` sales queries, `@pisto/app`
- Extends: [ADR 0021](0021-workers-ai-registration-assistant.md) and
  [ADR 0022](0022-contextual-catalog-questions.md)
- Recheck when the extraction model or its JSON mode changes, a topic needs a figure no screen
  owns, or a question needs a period outside the fixed set.

## Context

A member typed "¿Cuánto vendí hoy?" and Coco answered that it found no record. Before this decision
the composer recognized three exact phrases and opened a screen. The product brief approves
answering questions from verified business data without approval, with the period, scope and
freshness stated, and it forbids a model from calculating or guessing a figure.

## Decision

1. **Slice.** A member with `assistant:use` asks a question by text or confirmed dictation and
   reads the answer in Coco's dialog: one sentence, the supporting rows, the dates it covers and a
   link to the screen that owns the figures. The thread keeps up to four exchanges in memory. It
   persists nothing and writes nothing.
2. **Topics and periods are closed sets.** Sales, best-selling products, expenses, a period summary,
   money available, receivables, payables and low stock. Periods are today, yesterday, this or last
   week (Monday first), this or last month, and the last 7 or 30 days, resolved in the business
   time zone from the database clock. A question without a period uses the month in progress and
   the answer says so.
3. **The model only classifies.** The extraction prompt gains the kind `ask` with
   `question: { topic, period }`, both enumerations. The server turns it into the tool call
   `answer_question` and drops a period from a current position. No user text, amount or
   identifier travels from the model to a query. Complete known phrasings are matched in the app
   without a model call, so they also work with the assistant off.
4. **Pisto reads.** `GET /v1/assistant/answers` takes the topic, the optional period and the
   expected business. It authorizes `assistant:use` plus the topic's permission
   (`businessTopicPermissions` in `@pisto/contracts`) and composes the answer from the
   repositories that already serve the screens: the operating report, the money trend, the
   receivables summary and debtors, the payables summary and the stock list. Sales and product
   ranking use the new `SalesRepository.getPeriodSummary` under `sales:summary:read`, so a seller
   can ask what the shop sold without reading reports. The route makes no model call, spends the
   product read budget and stays available when the assistant is switched off.
5. **Truthful wording.** The app words each answer from the exact values. An empty period is a
   sentence, not zero money. A failed read is an error with a retry. A role without the topic's
   permission reads that it cannot see the information. The summary shows sales, expenses and
   money moved and states that their difference is not profit. A product ranking says how many
   sales carried no product lines.
6. **Retired.** The `/operate/assistant/sales-summary` screen and the three phrase-to-screen
   shortcuts, replaced by the thread.

## Consequences

- Extraction prompt `extract-2026-11-19.1` adds one nullable object to the JSON schema of both
  modes; the registration cases must keep passing with it.
- `AssistantDirectoryRepository.authorize` also returns the business-local date, one more clock
  read per assistant request.
- A question about a named month, a year, one customer or one supplier is declined with the list
  of what Coco can answer, and so is a period the model returns outside the set. Adding a topic
  means a contract variant, a reader, wording and a test.
- A sale line keeps the precision it was sold at but not its unit. The ranking is by money; a
  product's quantity is added only when all its lines of the period share one precision, and it is
  labelled with the product's current unit.
- The low-stock read lists at most eight products and says when there are more instead of
  counting them. A current position refuses a period.
- Answers of an open thread refresh on a change notice like every query of the business.

## Alternatives considered

- **Let the model answer from tool results.** It reads better, but a generated sentence can
  misstate a figure, and the project forbids model-computed money. Rejected.
- **Compose the answer in the app from the existing endpoints.** No new route, but the period would
  depend on the device clock and each topic would need its own client query and error handling.
  Rejected for one server-resolved read.
- **A second model call (DeepSeek) to classify questions.** It would double latency for every
  sentence that is not a question, or need a client-side guess before choosing the model. The
  extraction call already reads the sentence. Rejected.
- **Answer sales through the operating report.** It requires `reports:read`, which sellers do not
  have although their role includes `sales:summary:read`. Rejected for a ranged sales summary.

## Validation

Unit tests cover period arithmetic across weeks, months, years and a leap day, every topic's
composition, the empty and failing reads, and the tool proposal with and without tools. HTTP tests
cover the authorized business, the topic permission, validation, anonymous callers, the assistant
switched off and a failed read. `itemized-sales.integration.ts` checks totals, the ranking, range
edges in the business time zone, voided and foreign sales, a total-only sale, a product edited
between two sales and invalid ranges on PostgreSQL 18; `assistant-directory.integration.ts` checks
the topic permission against a seller's role. App tests cover the phrase matcher and every sentence. `e2e/assistant.spec.ts`
asks with the model off and with a classified question, then fails a read and goes offline. Evaluation set `2026-11-19.1` adds
question cases; its result through the Workers AI binding is recorded in
[the AI guide](../ai-assistant.md).
