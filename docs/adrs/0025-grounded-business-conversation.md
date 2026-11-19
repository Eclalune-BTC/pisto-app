# ADR 0025: Coco answers open business questions with DeepSeek

- Status: Accepted for the owner's request on 2026-11-19
- Owners: `@pisto/assistant`, `@pisto/api`, `@pisto/app`
- Amends: [ADR 0023](0023-business-questions-from-exact-reads.md) and [ADR 0024](0024-deepseek-sentence-extraction.md)

## Decision

A signed-in member can type a question or confirm a transcript in Coco, ask a follow-up and read
an answer grounded in the active business. Existing sales, reports, cash, inventory, customer and
supplier screens own the structured path. Registration still ends in its existing review form.

DeepSeek can propose up to four bounded reads, including different periods in one question.
Pisto validates the plan, grounds lookup names in the member's words, resolves calendar periods
against the business date and checks every requested permission before reading. PostgreSQL and the
existing repositories own the figures. DeepSeek composes the reply with references to complete
labelled facts. Pisto substitutes their exact values and rejects unknown references or model-written
figures. The conversation can request clarification and identify records or measures it cannot
establish, including net profit. A failed read or failed completion is a retryable error.

The server sends the question, up to three prior questions, the business-local date, and then only
the selected sources' bounded facts to the configured DeepSeek API. Facts can include display
names, quantities, dates and money. Record identifiers, contacts, notes and credentials are excluded
from the facts. Questions and answers stay in the open dialog. Fresh requests reread the records.
Changing business or signing out clears the conversation. Each provider call is budgeted, bounded
and subject to the assistant switch. The existing exact-question shortcuts remain available when
DeepSeek is unconfigured. The account's data-use and retention review remains a real-customer release gate.

The adapter reuses the project's JSON completion transport. A free-form SQL agent would give the
model authority over filters and money, and a fixed phrase list cannot handle compound questions.
The read tools expose neither a write nor a general query interface.

## Evidence

Acceptance covers wording from a model completion, exact values, local periods, follow-ups,
multi-source permissions, missing data, provider failures and the composer in a browser. The
Spanish provider evaluation is separate from mocked HTTP and browser tests. Recheck after a
provider, prompt, authorized field or account data-policy change.

The JSON-mode integration was reviewed on 2026-11-19. [DeepSeek JSON output](https://api-docs.deepseek.com/guides/json_mode/)
