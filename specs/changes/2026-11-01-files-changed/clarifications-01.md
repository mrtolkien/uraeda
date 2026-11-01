---
status: awaiting-human
---

# Clarifications, round 01: The Changes panel misses files written by shell commands

> [!IMPORTANT]
>
> 1 question, about 5 minutes.
>
> - Verdict: worth building, but not as proposed: Changes already reads the file-write tool calls.
>   Your session made none, and wrote every file through shell commands.
> - Catching shell writes means comparing the checkout's files with git. In the main checkout, a
>   file you save while the agent works would then show as the session's.
> - A session that moves into a change carries over the same list, so that cost reaches its opening
>   message too.

## Context

### Goal

The [proposal](proposal.md) shows a session on the main checkout that changed and committed five
files, while its Changes panel reads "No file changed yet.". The panel should list the files the
session changed.

### Today

The panel's "This session" part lists the targets of the session's completed Edit, MultiEdit,
NotebookEdit, and Write calls: [`editedFiles`](/packages/server/src/runner/cache-work.ts) reads them
from the session cache, and [`ChangesPanel`](/packages/web/src/session/ChangesPanel.tsx) shows them.
So it already looks at file-write tool calls.

The session in your screenshot, `08ba5af9`, made 35 tool calls, all of them Bash. It wrote
`useListKeys.ts`, two tests, and `specs/ui/keyboard.md` with `python3 - <<'EOF'` scripts and
`sed -i`, then committed them. A shell command's files are invisible to the cache: it only stores
the command's text. In the cache, 24 of the 95 sessions with tool calls never used an edit tool.

The "On the branch" part reads commits against the default branch, so it has nothing to show in the
main checkout, where the session committed.

### Scope

How "This session" finds files, and the same list that
[`movedOpening`](/packages/server/src/runner/moves.ts) gives a session moving into a change, as
files to carry over. "On the branch" and the panel's look stay as they are.

### Sources

- [`cache-work.ts`](/packages/server/src/runner/cache-work.ts),
  [`moves.ts`](/packages/server/src/runner/moves.ts), and
  [`turns.ts`](/packages/server/src/runner/turns.ts), where a turn starts and ends.
- [`claude.ts`](/packages/server/src/runner/claude.ts): how the runner starts Claude Code.
- The [agents](../../decisions/agents.md) decision: one adapter per agent, items in one
  agent-neutral shape.
- The [session's record](../../done/2026-10-25-session-new.md), US2, which defined "This session".

## Q1: How should Uraeda find the files a shell command wrote?

Only git sees them: what changed in the checkout, and what was committed. The question is when to
look, which decides whose edits get counted. A change or feature worktree has only the agent in it,
so every option is exact there. The main checkout is shared with you: in your screenshot,
`specs/INBOX.md`, `Core.tsx`, and `ShellPanes.tsx` changed while the agent worked, and they were
yours.

Why it matters: it decides whether the panel can name a file you edited as the session's, against
how much runs on each command.

- **A (recommended). Compare the checkout before and after each turn.** Before sending your message,
  the server notes `HEAD` and the content of each changed file. At the turn's end, a file whose
  content differs, or that a commit made during the turn touched, joins the list. Edit tool calls
  still count as today.
  - [pro] agent-neutral, in the server: any future agent gets it for free.
  - [pro] two quick git reads per turn, nothing per command.
  - [con] in the main checkout, a file you save during a turn is listed as the session's, and a move
    into a change names it as a file to carry over. Your screenshot's turn would have listed your
    three files.
  - Why recommended: most sessions that write files run in a worktree, where it is exact. In the
    main checkout, a wrong file costs a glance, and the carry-over already tells the agent to leave
    files you changed since.
- **B. Compare the checkout around each shell command**, with Claude Code hooks before and after
  every Bash call, set on the runner's processes only.
  - [pro] in the main checkout, only your saves during a command count, not those during the whole
    turn.
  - [con] Claude Code only: each agent needs its own way. A git read before and after every command,
    tens of milliseconds each, and more code in the adapter.
- **C. Keep tool calls only, and say why the panel is empty.** "No file changed yet" becomes "No
  file edited by a tool. Files written by shell commands are not listed."
  - [pro] no new reads, nothing misattributed.
  - [con] the panel stays empty for sessions like yours.

**Answer:**

## Settled without the human

### Behaviour

- **A file written by a shell command** shows in "This session" like an edited one. Its count is one
  edit per turn that changed it, added to its edit calls.
- **A file changed, then restored** within a turn is not listed: its content is the same.
- **A deleted file** is listed, as a change.

### Under the hood

- **Outside git**, or when git fails, the turn records nothing more: tool calls still count.
- **Files git ignores** are not listed: build output and caches would drown the panel.
- **The turn's found files** are stored in the session cache, with its items, so a reload or a
  restart keeps them, with no new table.

**Notes:**
