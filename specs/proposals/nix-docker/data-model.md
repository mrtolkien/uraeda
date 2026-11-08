# Data model: Nix / Docker based execution environments

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## Settings file

`config.toml`, in Uraeda's config folder, gains a `[sandbox]` table, edited by hand or by the
settings page, as the [settings](../decisions/settings.md) decision says.

| Field                  | Type             | Meaning                                                            | Change |
| ---------------------- | ---------------- | ------------------------------------------------------------------ | ------ |
| `sandbox.repositories` | array of strings | The names of the listed repositories whose agents run in sandboxes | New    |

A name not in the repository list is ignored, and kept as written.

## Sessions table

The session cache, in Uraeda's data folder.

| Field       | Type    | Meaning                                                             | Change |
| ----------- | ------- | ------------------------------------------------------------------- | ------ |
| `sandboxed` | integer | 1 when a chat on the main checkout was started in a sandbox, else 0 | New    |

A feature's or a change's session needs no field: it is sandboxed when its repository is, and its
checkout is a clone.

## A sandboxed checkout

A clone made by Uraeda under `.worktrees/<slug>/`, where a worktree goes today, for a feature or a
change of a sandboxed repository. A sandboxed chat's clone is
`.worktrees/chat-<first 8 characters of its session's ID>/`.

| Part                           | Meaning                                                                  | Change |
| ------------------------------ | ------------------------------------------------------------------------ | ------ |
| `.git/`                        | The clone's own git folder: its config, hooks, refs, and index           | New    |
| `.git/objects/info/alternates` | Points at the main repository's objects, read-only in the sandbox        | New    |
| Remote `host`                  | The main repository's path, read-only in the sandbox: the default branch | New    |
| Remote `origin`                | The main repository's `origin` URL, for pushes through Docker Sandboxes  | New    |

The main repository fetches the clone's branch into its own `refs/heads/<branch>`, the clone being
that branch's only writer.

## Sandbox state folder

`<data folder>/sandboxes/<repository>/<slug or chat ID>/`, one per sandboxed checkout, removed with
it.

| Part              | Meaning                                                                  | Change |
| ----------------- | ------------------------------------------------------------------------ | ------ |
| `claude/projects` | Claude Code's transcripts, mounted at the sandbox's `~/.claude/projects` | New    |

## Environments

Docker Sandboxes templates, in its own image store, never in a repository.

| Part | Meaning                                                                                     | Change |
| ---- | ------------------------------------------------------------------------------------------- | ------ |
| Tag  | `uraeda-env-<repository>:<first 12 characters of flake.lock's SHA-256>`: one per flake lock | New    |
