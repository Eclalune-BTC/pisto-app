# Pisto feature assignment

Use this template for a material assignment. It adds task-specific scope to `AGENTS.md` and
[the engineering workflow](engineering-workflow.md); it does not duplicate their rules or freeze a
copy of product status. Fill in concrete requirements before distributing implementation work.

```text
Outcome: [one observable user job]
Actor and authorization: [actor, business scope and exact permission]
Entry and completion: [trigger and canonical result]
Owner: [existing capability and files; justify a new boundary]
Data: [authoritative records, derived values, sensitivity and retention]
Confirmation and correction: [approval, idempotency, transaction and audit behavior]
Manual path and navigation: [existing structured route and discovery]
Acceptance: [success, empty, denied, invalid, stale, failed and uncertain outcomes]
Platform evidence: [web widths and native/device behavior required]
Non-goals: [what must not change]
Operational authorization: [local-only, permitted source push, or separately approved actions]

Read AGENTS.md and docs/README.md. Follow the task-specific guide links, inspect Git status,
current code/contracts/tests and installed versions, then identify unresolved product decisions.
Do not infer unfinished work from a historical commit, old handoff or deleted manual.

Implement the smallest coherent change. Preserve existing functionality, tenancy, exact money,
explicit financial confirmation and truthful errors. Use existing owners and maintained primitives.
For AI/voice work, load the full relevant target guide; do not install or enable a provider merely
because an architecture document names it.

One lead owns integration. Parallel writers use separate worktrees with disjoint ownership;
read-only reviewers receive the actual scope and complete diff. Do not claim independent review
when no reviewer ran. Do not stage unrelated user changes or mutate remote resources outside scope.

Run bun run check and the additional applicable gates from docs/testing-release.md. Database tests
need an explicitly verified isolated target. Report the result, named validation, relevant remaining
limits and commit/push state; do not equate a source push with deployment or a bundle with device QA.
```

Keep temporary assignments in the task/PR conversation. Persist a repository guide only when it owns
an ongoing contract, operating procedure or acceptance requirement.
