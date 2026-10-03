@AGENTS.md

## Claude Code adapter

- Start at `docs/README.md` and load task-specific guides. Use `docs/agent-feature-prompt.md` for
  material assignments; do not resume a historic branch or deleted handoff as current instructions.
- Prefer bounded read-only subagents for research, repository exploration, tests, and independent
  review. The lead writes in the primary `main` checkout by default. Additional worktrees require
  the owner's explicit request; any authorized parallel writers use separate branches/worktrees
  and non-overlapping ownership. Only the integration owner combines assigned commits.
- Do not claim that Codex, Claude Code, a provider, device, deployment, or external service was used
  unless the current run has direct evidence.
