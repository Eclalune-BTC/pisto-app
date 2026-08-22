# Architecture-first engineering workflow

This is the execution contract for humans and coding agents working on Pisto. It protects product
truth, repository boundaries, and delivery evidence without turning small edits into process theater.

## 1. Orient before planning

For a material change:

1. Read [Active product goal](product-goal.md), the approved
   [AI-native product brief](product-briefs/pisto-ai-business-assistant.md),
   [Product capability architecture](product-capability-architecture.md), this workflow, and the
   relevant domain guide/ADRs. Read [AI assistant architecture](ai-assistant.md) completely when the
   change touches AI, voice, retrieval, models, tools, or assistant behavior, and read
   [Voice architecture](voice-architecture.md) for recording, transcription, TTS, or realtime voice.
2. Inspect `git status`, the actual implementation, public contracts, tests, manifests, and nearby
   patterns. Do not plan from filenames or documentation alone.
3. State the requested outcome, acceptance criteria, non-goals, confirmed facts, and unresolved
   assumptions. A missing product decision is a reason to ask, not permission to invent.
4. Trace ownership through `apps/app`, `apps/api`, `packages/contracts`, `packages/db`,
   `packages/auth`, and `packages/billing` before choosing files or abstractions.

Use the [reusable feature-delivery prompt](agent-feature-prompt.md) to turn a material request into one
observable outcome with explicit authorization, acceptance criteria, evidence, and non-goals.

A copy correction, formatting-only edit, or obvious local rename can use a shorter version of this
flow. It still must preserve behavior and pass the relevant check.

## 2. Research proportionally

Research current primary sources before a decision involving:

- authentication, authorization, security, privacy, money, billing, store rules, or user data;
- an external API, webhook, cloud service, provider dashboard, deployment runtime, or mobile platform;
- a new or upgraded dependency, framework feature, native module, schema tool, or unfamiliar API;
- behavior likely to have changed since the repository's source review date;
- a new architecture boundary, public contract, persistence strategy, or operational guarantee whose
  correctness depends on a current external, security, policy, or platform fact.

Start with [Official source index](source-index.md). Reopen the live source when its review trigger
applies. Use the authoritative primary source closest to the claim: a regulator or standard for a
normative rule, vendor/platform documentation for its behavior, official release notes/advisories for
version or security changes, and upstream source when documentation cannot establish implementation
behavior. Secondary articles can help discovery but cannot be the only evidence for a consequential
decision.

Do not browse merely to rename a local symbol, follow an already-tested repository pattern, or make
an internal architecture choice whose facts are fully established by local code, tests, ADRs, and
repository instructions. Research is a risk control, not a performance ritual.

Record durable architecture, policy, provider, or dependency decisions with the URL, research date,
supported decision, and recheck trigger in the affected guide or [source index](source-index.md). Use
an ADR when the decision changes a durable boundary or creates a costly commitment. Keep transient
task-local research in the reviewable change record or handoff instead of creating documentation
churn.

Internet sources establish external behavior and policy; they do not prove this checkout's installed
state or any deployed environment. Use manifests, the lockfile, source, tests, built artifacts, and
live environment evidence for those claims.

## 3. Reuse before adding

Evaluate the first two options before expanding the solution surface:

1. Existing repository capability or domain module.
2. Built-in capability of Bun, Expo/React Native, Hono, PostgreSQL, Drizzle, Better Auth, or another
   already-approved dependency.

Then compare a focused maintained library with a small local implementation. Neither wins by
default. Choose the lower total correctness, security, maintenance, upgrade, operational, and exit
risk for the exact requirement.

Before adding a production package, record:

| Question | Evidence expected |
| --- | --- |
| Does it solve the exact requirement? | Public API mapped to acceptance criteria; no speculative features |
| Does it fit this runtime? | Bun, Expo SDK, React Native, web, TypeScript, and native-build compatibility as applicable |
| Is it maintained and trustworthy? | Recent releases, ownership, advisories/security posture, and upstream activity |
| Is its use permitted? | License and provider/store terms |
| What does it cost? | Bundle/native impact, transitive dependencies, operations, configuration, and failure modes |
| Can it be tested and replaced? | Boundary seam, fixtures/sandbox support, data portability, and exit cost |

Use established security/auth/crypto/payment primitives rather than casually reimplementing them.
Keep small product policy and straightforward transformations local when a package would add more API,
upgrade, supply-chain, or native-build surface than value. Maintenance evidence is broader than a
recent release date: consider ownership, issue/security response, release quality, adoption evidence,
and whether the project is intentionally stable. Never install a package solely because it is popular
or generated code is shorter.

When a package is selected, use the repository's exact-version policy for server/domain dependencies
and Expo's supported install workflow for Expo-managed packages. Review manifest and lockfile changes,
run the dependency audit, and record any intentional exception.

## 4. Design the smallest coherent slice

- Start from the user job and invariants, then define contract and data ownership before UI plumbing.
- Complete the capability slice contract in
  [Product capability architecture](product-capability-architecture.md) before distributing material
  implementation work. Name the structured/manual path even when the feature begins through AI.
- Use the existing boundary that owns the concept. Introduce an adapter, repository, policy object,
  command, or strategy only when there is an actual external capability or variation to isolate.
- Named patterns are tools for ownership and change pressure, not a checklist. Do not add a dependency
  injection container, generic service layer, catch-all manager, premature plugin system, or roles for
  hypothetical actors.
- Keep routes, navigation, tools, jobs, and permissions explicitly composed at the applications. A
  new product module does not earn a package or permanent top-level destination by default.
- Keep composition at application roots, domain meaning provider-neutral, public contracts free of
  persistence/provider payloads, and platform differences behind narrow capability adapters.
- Prefer one complete vertical slice over many disconnected foundations. Delete superseded paths
  instead of keeping silent compatibility branches without a documented consumer.

Consequential changes to boundaries, public contracts, data ownership, billing channels, auth models,
or production topology require an ADR. A local implementation detail does not.

## 5. Fail honestly

Every external read or mutation must define its loading, empty, success, denied, error, timeout, retry,
and recovery behavior where applicable.

- Required configuration and invariants fail early with a specific, actionable error.
- Authentication, authorization, billing, entitlement, and permission uncertainty fail closed.
- Network errors do not become fake empty data, sign-out, offline support, or success.
- Mutations report the real result. Retry only bounded, selective, proven-idempotent operations.
- Optional providers expose a truthful disabled/degraded state and retain useful diagnostics.
- Compatibility fallbacks require feature detection, tests for both paths, and an owner/removal trigger.
- Catch errors only to recover, translate at a boundary, add context/observability, or release resources.

Do not add an environment/default/placeholder guess chain. One required fact has one authoritative
source and one clear failure.

## 6. Commission independent review

Use an independent read-only reviewer or subagent for a **material** change when available. Material
includes auth/authz, billing/entitlements, schema/migrations, public contracts, new production
dependencies, external/provider adapters, platform-specific behavior, deployment/IAM/secrets, user
data/state, or a broad cross-package/UI refactor.

Use two passes. In the first pass, give a fresh reviewer:

- the user goal, acceptance criteria, non-goals, and relevant invariants;
- `AGENTS.md`, the relevant project documents, and the complete base-to-head diff rather than only a
  curated file list;
- the tests/evidence the change claims;
- a request to find counterexamples in correctness, security, state truth, fallbacks, boundaries,
  complexity, accessibility, and missing validation.

Withhold the implementer's desired verdict and self-review conclusions during that first pass. Ask
the reviewer to inspect relevant repository context, falsify the claims, and run safe focused tests
when useful. Require severity, concrete evidence, user or operational impact, and the smallest
credible fix.

In the second pass, the implementing agent reconciles every finding against evidence and either fixes
it or records why it does not apply. Request a fresh re-review when a fix materially changes the
design, contract, security posture, or diff. A self-review is useful when delegation is unavailable,
but it must not be described as independent.

Skip delegation for trivial, isolated edits unless they touch a high-risk invariant. Subagents add
cost and coordination overhead; use them where a second reasoning path can materially improve safety
or quality.

Prefer parallel agents for independent research, repository exploration, test analysis, and review.
If Codex, Claude Code, or their subagents write concurrently, give each writer a separate Git worktree
checked out to its own dedicated branch and disjoint file ownership. Writers may commit only assigned
files in their own worktree when requested; they do not push or merge unless explicitly assigned.
One lead owns requirements and integration. Resolve product/data/permission questions and freeze the
public contract before parallel writers start; do not ask multiple writers to invent competing
contracts for one vertical slice. Repository instructions do not launch another vendor runtime, and
the handoff must not claim that a runtime was used without direct evidence.

## 7. Definition of done

A change is done only when all applicable items are true:

- the approved outcome and acceptance criteria are met without expanding the product scope;
- the implementation is the smallest coherent change and follows repository ownership boundaries;
- no success-shaped fallback, fabricated data, hidden failure, secret exposure, or speculative layer
  remains;
- relevant success and failure behavior is tested, including denial/idempotency/partial failure where
  the risk requires it;
- UI work is rendered and checked for representative responsive, loading, empty, error, disabled,
  keyboard, focus, and platform states;
- documentation, environment examples, source evidence, migrations, and ADRs are updated when their
  contracts changed;
- independent material findings are resolved or explicitly accepted by the owner with evidence;
- `bun run check` passes, plus the applicable build, audit, schema, database, provider sandbox,
  device, or deployment gates in [Testing and release](testing-release.md);
- the task-owned or staged patch contains only intended files and no credentials or generated noise;
  unrelated pre-existing user changes are preserved and disclosed rather than cleaned up;
- the handoff distinguishes implemented, locally validated, built, pushed, deployed, and released.

Passing mocks, typechecks, or local tests never proves an external provider, device, migration,
deployment, or production path.

## Official sources

- [OpenAI: project instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [OpenAI: build skills](https://learn.chatgpt.com/docs/build-skills)
- [OpenAI: subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [OpenAI: harness engineering and repository knowledge](https://openai.com/index/harness-engineering/)
- [Anthropic: Claude Code project memory](https://code.claude.com/docs/en/memory)
- [Anthropic: Claude Code subagents and worktrees](https://code.claude.com/docs/en/sub-agents)
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [GitHub dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review)
- [OpenSSF Scorecard](https://openssf.org/scorecard/)
