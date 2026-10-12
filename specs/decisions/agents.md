---
status: active
approved-by: mrtolkien
---

# Agents

Uraeda's server runs coding agents by starting the agent's own command-line tool, installed on the
machine and signed in by the user, never through a bundled binary or an SDK. Claude Code is the
first agent: one session per feature, resumed at every run, in the feature's worktree, in `auto`
permission mode, with the server's own copy of the skill. What the server remembers about runs lives
in a local SQLite cache that is never committed.

## Rules

- The server MUST run Claude Code by spawning the `claude` binary found on the machine's `PATH`, in
  print mode, with `--input-format stream-json` and `--output-format stream-json`. It MUST NOT
  depend on the Claude Agent SDK, or bundle a Claude Code binary.
- Every agent MUST be reached through one adapter interface, in
  [`packages/server/src/runner/`](/packages/server/src/runner/): start or resume a session in a
  directory with one message, stream its events, stop it. The tests that `vp run ready` runs MUST
  use a fake adapter, and MUST NOT run a real agent. Validation scripts, run by hand when an agent's
  integration breaks, MAY run the real agent, and MUST be kept in the repository.
- Tools MUST NOT read, store, or pass the agent's credentials: the binary uses the user's own login
  or API key.
- Every run MUST pass `--permission-mode auto` explicitly. Tools MUST NOT pass `bypassPermissions`
  or `--dangerously-skip-permissions`. A permission the human grants from the UI MUST be a narrow
  allow rule, passed with `--allowedTools` to a single run, and never written to a settings file.
- A run MUST work in the feature's worktree, as the core returns it, and MUST NOT switch any
  checkout.
- The skill MUST come from the server's own copy, `skills/uraeda`, loaded as a plugin with
  `--plugin-dir`. The run MUST fail when the plugin does not load.
- A feature MUST have at most one session and at most one run at a time. A run MUST NOT start while
  another one is going on the same feature.
- Runs MUST carry the step, its reference, and the trigger in their message, since a resumed session
  keeps its first system prompt.
- Session IDs, runs, and their parsed events MUST be stored in a SQLite database, `runner.sqlite`,
  through Node's built-in `node:sqlite`, in Uraeda's data folder for the user: `URAEDA_DATA_DIR`
  when it is set, or else the operating system's default, `$XDG_DATA_HOME/uraeda/` on Linux
  (`~/.local/share/uraeda/` when `XDG_DATA_HOME` is unset), `~/Library/Application Support/uraeda/`
  on macOS, and `%APPDATA%\uraeda\` on Windows. Its rows MUST be keyed by the repository's main
  checkout path and the feature's folder. It MUST NOT live in a repository. It is a cache: workflow
  state MUST NOT be stored in it, and losing it MUST cost only a new session and the old logs.
- Stopping a run MUST send SIGINT first, and SIGTERM only when the process is still running 10
  seconds later.
- Tools MUST NOT change the agent's commit attribution, model, effort, or settings, except the
  permission mode above: the user's active Claude Code settings apply.

## Why

The human picked the installed command-line tool over the Agent SDK. It adds no dependency, runs the
user's own binary, settings, and login, and is the case Anthropic's terms allow explicitly: "an end
user signing in to the unmodified Claude Code binary with their own Claude subscription". The terms
ask products built on the SDK to use API keys
([Q1](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q1-how-does-the-server-run-claude-code),
[launching](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q1-how-does-the-server-run-claude-code),
[credentials](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q1-how-does-the-server-run-claude-code)).
An adapter keeps Codex or pi one more adapter, and lets CI run without Claude Code.

`-p` denies anything that would prompt, so the mode decides whether a step finishes. `auto` is the
safest mode that runs unattended, and has worked well while developing Uraeda. The agent runs on the
user's machine, outside a container, and can be started from a phone
([Q2](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q2-what-may-the-agent-do-without-asking),
[permission mode](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q2-what-may-the-agent-do-without-asking)).

The human picked the server's own copy of the skill: one version, whatever the project has
([Q4](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q4-which-copy-of-the-skill-does-the-session-use)).
They asked for the session IDs and parsed transcripts to be kept in a small local database
([Q5](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md#q5-what-does-the-ui-show-of-a-run)),
in an app data folder from the operating system's defaults rather than the repository's git folder,
and for the model and effort to come from the active settings, since the command-line tool cannot
list its models (spec review, C1 and C2). Principle III makes the repository the only durable state,
so the database can only be a cache.

## Alternatives considered

- The Agent SDK in the server, which the stack decision expected: typed messages and a permission
  callback, but four dependencies, a second binary, and terms that ask for an API key.
- `bypassPermissions`, the mode most compared tools use: nothing blocked, but anything allowed on
  the user's machine.
- The project's own skill install, `.claude/skills/uraeda`: each branch would run its own skill.

## Consequences

- No new dependency: `node:sqlite` ships with Node 24, as a release candidate.
- The server parses Claude Code's events itself, and must follow their changes between Claude Code
  versions.
- `claude` must be installed and signed in for the runner to work. Without it, the UI only commits.
- Actions that `auto` mode blocks are skipped, and listed for the human to allow on a next run.
- A branch that changes the skill is not run with its own version: the server's checkout decides.
- Remote Control, interactive approvals, and follow-up messages need a channel these rules do not
  give yet.
- Claude Code is the first agent, not the recommended one: it is hard to interoperate with, so later
  features should prefer agents built to be driven by another program (spec review, C1).

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/), and every feature that starts,
  follows, or stops an agent: the git listener, benchmarks, the chat in the web UI

## Revisit when

An agent that is easier to drive than Claude Code, such as one with a documented protocol for
prompts, approvals, and models, joins the runner.
