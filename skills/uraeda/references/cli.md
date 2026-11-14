# The `ura` CLI

The `ura` command-line tool does the mechanical parts of the steps: it checks the files, says what
is next and on which pick, draws pages to answer and review on, and reaches the human's notes. It is
optional: each step says what to do by hand, and names the command that does it.

**`ura` never commits, branches, or makes a worktree.** It writes files, and the next agent step
commits them, as
[the human's work is committed first](../SKILL.md#the-humans-work-is-committed-first) says. It reads
git, without running it or its hooks, to tell what changed since a review and whether an answer was
written on a version that has changed since.

Every command works without a terminal, with flags, and the read commands print JSON with `--json`.
A command that acts on a feature or a change takes it as a path under `specs/`, or a name matching
one: its folder name or slug. Without it, the command takes the feature of the worktree it runs in.

| Command                                                                           | What it does                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ura init`                                                                        | [Sets a project up](projects.md#setting-up-a-project)                                                   |
| `ura install`, `--user`, `--repo`, `--agents`, `--claude`, `--update`             | [Installs the skill](projects.md#setting-up-a-project), and Tab completion with `--completions`         |
| `ura upgrade`                                                                     | Installs `ura`'s latest release, then updates the user's skill                                          |
| `ura check [path]`                                                                | The rules of [Markdown](conventions.md#markdown), file by file                                          |
| `ura next [feature]`                                                              | The target, its step from [the table](../SKILL.md#finding-the-next-step), its pick, and its session     |
| `ura status`                                                                      | Every worktree of the repository: its feature or change, its step, and who it waits on                  |
| `ura answer [feature] <Q2> <answer>`, `--submit`, `--resume`                      | Writes an answer of a round, or its notes with `notes` for the question, then sets the round `answered` |
| `ura review [feature] --comment <lines> <text>`, `--approve`, `--request-changes` | [Reviews](conventions.md#review-files) a spec or a plan                                                 |
| `ura serve`, `--port`                                                             | The pages, and the sync of the human's notes                                                            |
| `ura vault ls [path]`, `read <path>`, `write <path>`, `rm <path>`, `check`        | Reads and writes [the human's notes](notes.md)                                                          |

## `ura next` and the picks

`ura next` prints the target, its step, the reference to follow, the step's pick (agent, model, and
effort), and `session`: `join` when the step runs on in the session that ran the previous one, `new`
when it starts a new one, as [Sessions and picks](../SKILL.md#sessions-and-picks) says. For the
implementation, it adds the implementers' pick, the reviewers' picks, and whether reviewers review
each wave or the branch only. When the human's answers or review are on disk, uncommitted, it says
to [commit them first](../SKILL.md#the-humans-work-is-committed-first), then names the step that
follows them.

A feature or a change is in progress where a worktree holds it: every worktree on a branch of its
own, whatever its name, holds its dated folders under `specs/` and `specs/changes/`, and the record
its own finish wrote. A branch without a worktree is postponed.

The picks are the human's, in `ura`'s configuration file, outside every repository, which
`ura serve`'s settings page edits: a pick per step (`discovery`, `spec`, `plan`, `build`, `review`,
`comments`), with a `new-session` switch for each, on for `plan` by default, a pick for
implementers, a list of reviewers, and their depth. `review` covers the final review and the finish;
`comments` covers the comments, the catch-up, and the push; a change runs on `build`'s. Committing
the human's work or the proposal is part of the step that follows it. A step with no pick runs on
the session's own.

`ura next` and `ura status` read the open pull requests with `gh`. An open, ready pull request whose
branch is behind the default branch names the step `catch-up`, whose reference is
[the catch-up](implementation.md#catch-up-an-open-pull-request) for a feature, and
[Change](change.md) for a change. Otherwise, one that is not a draft, with no changes requested, and
lacks the branch's latest commit names the step `push`, whose reference is
[the push](implementation.md#push) for a feature, and [Change](change.md) for a change. It waits on
the human only once it holds it. A head the repository never fetched counts as holding it: it is
likely newer than the branch. Without `gh`, they say so.

`ura status` also lists this repository's proposal notes still `started` whose branch is merged,
each with the command that sets it `done`, as [Notes](notes.md#proposals-and-priorities) says.

## `ura check`

It prints each problem as `<file>:<line>: <message>`, then each warning as
`warning: <file>:<line>: <message>`. Warnings measure the limits of
[Writing for the human](writing.md): `block.count`, `block.items`, `writing.sentence`, and
`spec.length` on files waiting for the human, and [a decision](writing.md#a-decision)'s shape:
`decision.rules`, `decision.why`, and `decision.alternatives` when it grows long, and
`decision.example` on a rule with no case after "_So:_". It exits with an error when it found a
problem, and with success when it found only warnings. A link to a missing file says where git saw
it go, when it can: `no file <path>: it moved to /<new path>`, or
`no file <path>: it became the record /specs/done/<folder>.md`.

## `ura answer` and `ura review`

They write what the pages write, for an agent the human asked, or a human in a terminal. `--submit`
sets the round `answered`, and `--resume` adds `resumes: implementation` to it, refused unless the
implementation is under way. `--approve` and `--request-changes` set the reviewed file's status and
write the review file's verdict. Neither turns the block into a note: the next step does, in its own
commit.

They refuse, before writing anything, what would break these rules by hand too:

- An answer or a note with a line starting with `#`, `**Answer:**`, or `**Notes:**`. A review
  comment with a line starting with `#`. They would read as a new heading or answer.
- A file that is not `awaiting-human`: an agent may be writing it.
- An answer or a comment written on a version of the file that has changed since: the page shows the
  new one first.
- A review file that does not parse: it may hold the human's comments, and is never overwritten.

## `ura serve`

It serves, on this machine, from the `ura` binary alone, pages reachable from the human's phone over
their own network, like Tailscale:

- **What waits on the human**, across the repositories its configuration names and their worktrees,
  which it finds through git: each file with `status: awaiting-human`.
- **A round**: one card per question, the recommended answer marked, a follow-up shown only when its
  condition is met, a note, each answer written into the round's file as soon as it is chosen.
- **A review**: the rendered spec or plan, what changed since the human's last review, a comment on
  a passage, then approve or request changes.
- **Mockups** in both, a file of the feature or an address, drawn in place, with a comment about one
  or about an element picked in it.

The pages write files and never commit. Each address carries a token, and every write checks it and
the request's origin. `ura serve` also syncs the human's notes with their phone.

## `ura vault`

Reads and writes the human's notes for an agent: one vault for every repository, at the path the
configuration file names, with paths relative to it, as [Notes](notes.md#the-layout) lays it out.
`ls` lists a folder's notes, each with its `description`. `read` prints a note. `write` writes a
note from standard input, or sets one frontmatter field with `--set <field>=<value>`, leaving the
rest of the note byte for byte. `rm` moves a note to the vault's `.trash/`, as Obsidian does.
`check` reports wikilinks that resolve to no note, and wiki notes without a `description`. None of
them touches git.
