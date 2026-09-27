@AGENTS.md

## Claude Code adapter

- Start at `docs/README.md` and load task-specific guides. Use `docs/agent-feature-prompt.md` for
  material assignments; do not resume a historic branch or deleted handoff as current instructions.
- Prefer bounded read-only subagents for research, repository exploration, tests, and independent
  review. Put every parallel writer in a separate Git worktree on its own branch with non-overlapping
  ownership; only the integration owner combines assigned commits.
- Do not claim that Codex, Claude Code, a provider, device, deployment, or external service was used
  unless the current run has direct evidence.
