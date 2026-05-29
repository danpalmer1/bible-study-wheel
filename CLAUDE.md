# CLAUDE.md — bible-study-wheel

Project-specific guidance. Merged on top of the parent `Coding/CLAUDE.md`.

## Process lifecycle

When you start a long-running process during a session (dev server, watcher, sandbox, tunnel), **stop it before ending the turn** unless the user explicitly asked you to leave it running.

Applies to:
- `mcp__Claude_Preview__preview_start` → pair every start with `preview_stop` at the end of the work that needed it. `preview_list` to find leftovers.
- `Bash` with `run_in_background: true` → kill the job before wrapping up.
- `npx ampx sandbox`, `npm run dev`, watchers, port-forwards — same rule.

Why: orphaned processes hold ports (4000, 5173, 6006) and file handles, which makes the next session fail to start cleanly or silently bind to a stale binary. Costs more time to debug than the seconds it takes to stop them.

How to apply:
- If a server is still needed for a follow-up question this turn, leave it. Stop at the end of the chain.
- If the user explicitly says "leave it running" or "I'll keep poking at it" — leave it.
- Otherwise, list and stop at end-of-task.
