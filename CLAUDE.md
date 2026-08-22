@AGENTS.md

## Claude Code adapter

- Use `docs/agent-feature-prompt.md` as the reusable task template for material feature delivery.
- Prefer bounded read-only subagents for research, repository exploration, tests, and independent
  review. Put every parallel writer in a separate Git worktree on its own branch with non-overlapping
  ownership; only the integration owner combines assigned commits.
- Do not claim that Codex, Claude Code, a provider, device, deployment, or external service was used
  unless the current run has direct evidence.
