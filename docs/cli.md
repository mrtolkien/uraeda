# The `ura` CLI

`ura` performs the mechanical parts of the workflow, for you and for agents. It is optional: the
skill says how to do each step by hand, and names the command that does it. The skill's
[CLI reference](../skills/uraeda/references/cli.md) says which step uses which command.
[INSTALL.md](../INSTALL.md#ura) says how to install it.

`ura` never commits, branches, or makes a worktree. It writes files, and the next agent step commits
them. It reads git to tell what changed, without running git or its hooks.

## Commands

```sh
ura init                                   # specs/, and the skill offered for your user
ura install --repo --agents --claude       # the skill, for this repository's agents and Claude Code
ura upgrade                                # the latest release, then your skill
ura status                                 # every feature and change, and who it waits on
ura next                                   # the next step for an agent, and the model it runs on
ura check                                  # every workflow file against the skill's rules
ura check --fix                            # first repair the links to moved files
ura answer recurring Q3 "B, simpler"       # one answer; --submit sends the round
ura review recurring --comment 50-52 "Why?" # a comment; --approve or --request-changes
ura serve                                  # pages to answer and review on, from your phone too
ura vault ls wiki/libraries                # your notes, for agents: ls, read, write, rm, check
ura usage                                  # your Claude Code accounts' and Codex's usage, as JSON
```

Every command works without a terminal, and the read commands print JSON with `--json`.
`ura <command> --help` lists a command's options. A command that acts on a feature or a change takes
its folder's name, its slug, or a path under `specs/`; without one, it takes the feature of the
worktree it runs in.

## `ura status` and `ura next`

A feature or a change is in progress where a worktree holds it: its dated folder under `specs/` or
`specs/changes/`, on a branch of its own. A branch without a worktree is postponed.

`ura status` lists every one, with its step and who it waits on, you or an agent, then the merged
ones whose worktree or branch is left. After `ura init`, it ends with the setup's files the project
still lacks, until they are written:

```text
Setup: 3 files missing
  Constitution: still the template
  Code-quality decision: missing
  Testing decision: missing
```

It also lists the proposal notes in your vault still `started` whose feature is merged, each with
the `ura vault write` that sets it `done`.

`ura next` prints what an agent runs next: the target, its step, the skill's file to follow, its
pick (agent, model, and effort), and whether it runs on in the session of the previous step or
starts a new one. When your answers or review are on disk, uncommitted, it says to commit them
first. The picks are yours, in the settings file, which `ura serve`'s settings page edits.

Both read your pull requests with `gh`. An open pull request, not a draft and with no changes
requested, waits on you only once it holds its branch's latest commit. Until then, the step is
`push`, for an agent. A pull request behind the default branch reads `catch-up`, for an agent to
rebase, validate, and push it. Without `gh`, they say they cannot see pull requests.

## `ura check`

It prints each problem as `<file>:<line>: <message>`, then each warning, and exits with an error
when it found a problem. Warnings measure the skill's writing limits: a block too long, a sentence
too long, a decision that grows.

A link to a missing file says where git saw it go: it moved, it became a finished feature's record,
or a commit deleted it. `ura check --fix` repairs those links, without committing, in every `specs/`
folder under the path it is given, and prints each file it changed before the check's output:

```text
fixed specs/done/2026-10-30-inbox-again.md: 1 link
specs/: no problems
```

A link to a moved file points at its new path, in the same form. A link to a finished feature's file
points at its record, keeping a question's anchor. A link to a deleted file becomes its words.

## `ura answer` and `ura review`

They write what the pages write, for an agent you asked, or for you in a terminal. `ura answer`
writes one answer or a note in the latest round, and `--submit` sets it `answered`. `ura review`
adds a comment on lines of a spec or a plan, and `--approve` or `--request-changes` sets its
verdict. Neither commits: the next agent step does.

They refuse, before writing anything, a file that is not waiting for you, an answer written on a
version of the file that has changed since, and a review file that does not parse.

## `ura serve`

`ura serve` serves small pages to answer a round and review a spec or a plan on, from your phone
too. It prints their address, which holds a token: keep it to yourself, as anyone with it can answer
for you.

- **What waits on you**: every round, spec, and plan waiting for you, across the repositories it
  serves and their worktrees, with each feature's track through the workflow.
- **A round**: one card per question, the recommended option marked. An answer is saved as soon as
  you pick it or type it. "Send answers" records the round answered.
- **A review**: the spec or plan, what changed since your last review, and a comment on any passage
  you tap, or on words you select. Then approve, or request changes.
- **Mockups**: "See it" draws a mockup of the feature in place. "Pick an element" starts a comment
  on the element you tap.
- **Settings**: how each step of the workflow runs, its agent, model, and effort, chosen among the
  models Claude Code and Codex list, and which steps share a session; the build's implementers; the
  reviewers, and whether they review each wave or the branch only. Each change is saved at once in
  the `[runs]` of the settings file, the rest of the file kept as it was.
- **Notes**: where your vault is, and the starter vault for your phone, under "Obsidian setup".

The pages write the workflow's files and never commit: the next agent step commits your work. It
listens on 127.0.0.1, port 4310 or `--port`: to reach it from your phone, put it on your own
network, as `tailscale serve --bg 4310` does, and name that address's host in `hosts`: any other
host name is refused. `--data-dir` names the folder it keeps its token in. Its settings are the
`[serve]` section of the settings file, `~/.config/uraeda/config.toml`:

```toml
[serve]
port = 4310
repositories = ["~/code/todo", "~/code/uraeda"] # without it, the repository it starts in
wake = "t3" # tell the feature's T3 Code session to continue when you send answers or a verdict
hosts = ["laptop.tail1234.ts.net"] # the names it answers at besides 127.0.0.1 and localhost
```

Without `wake`, a page ends with "Tell your session to continue". With `wake = "t3"`, it finds the
open T3 Code thread working in the feature's worktree, with the `t3` command, and sends it a message
to continue.

The settings page writes `[runs]`, which you can also edit by hand:

```toml
[runs]
review_depth = "branch" # or "waves": the reviewers review each wave too

[runs.steps.discovery]
agent = "claude"
model = "opus"
effort = "high"

[runs.steps.plan]
new_session = true # the plan starts in a new session; the other steps join the previous one

[runs.implementers]
agent = "codex"

[[runs.reviewers]]
agent = "claude"
```

The steps are `discovery`, `spec`, `plan`, `build`, `review` (the final review and the finish), and
`comments` (a pull request's comments, its catch-up, and its push). A change runs on `build`'s. A
step with no pick runs on the session's own.

## Your notes on your phone

`ura serve` also syncs your notes with Obsidian on your phone. The vault (see `ura vault` below) is
one folder that Obsidian on this computer opens as it is: your inbox, the wiki, and each
repository's proposals, research, and board of proposals, `projects/<repository>/Board.base`. Its
`projects/<repository>/specs/` links to the repository's constitution, decisions, and every folder
in progress in its worktrees, to read: `ura serve` makes those links again as worktrees come and go.

- **Starting the phone**: open the pages on your phone, through your tailnet's address, and tap
  "Obsidian setup". Download the starter vault, unzip it in Files, move its folder into On My iPhone
  › Obsidian, open it in Obsidian, and trust its plugin. The first sync brings the rest. The starter
  carries the address it was downloaded from, with its token.
- **When it syncs**: as Obsidian opens or comes back, a few seconds after an edit, and every minute
  while it is open; ⟳ syncs at once. iOS does not let it run while Obsidian is closed.
- **What travels**: every file of the vault, both ways, but hidden ones: each device keeps its own
  `.obsidian/` settings, and the plugin itself comes from the computer. The repositories' files are
  read only: an edit of one on the phone comes back as a note in `inbox/`, and the file as git has
  it.
- **Conflicts and deletions**: a note changed on both sides keeps both, the computer's under its
  name and the phone's as `name (conflict phone 2026-11-14 1630).md`. A deletion moves the file to
  the vault's `.trash/` on the other side, unless the other side changed it since: then the change
  wins and the file comes back. A rename travels as a deletion and a new file.
- **Moving the vault**: "Obsidian setup" also sets its place. `ura` moves nothing: move the folder
  first, then save its new place. A phone that last synced with another folder merges both, and
  deletes nothing.

## `ura vault`

`ura vault` reads and writes your notes for an agent, as the skill's
[Notes](../skills/uraeda/references/notes.md) lays them out. They are one vault for every
repository, `Uraeda` in Uraeda's data folder (`~/.local/share/uraeda/Uraeda` on Linux), or the
folder `[vault] path` of the settings file names. Paths are from the vault's folder, and it never
touches git.

```sh
ura vault ls wiki/apps                     # the folders, then the notes with their description
ura vault read wiki/apps/todoist.md        # a note
ura vault write inbox/flaky-sync.md < note.md   # a note from standard input, its folders made
ura vault write projects/todo/proposals/tags.md --set status=started   # one field, the rest kept
ura vault rm inbox/flaky-sync.md           # into the vault's .trash/
ura vault check                            # wikilinks to no note, wiki notes without a description
```

`write` and `rm` refuse `projects/<repository>/specs/`, the repositories' own files, read only in
the vault, and hidden folders such as `.obsidian/`. `ls` and `check` take `--json`.

```toml
[vault]
path = "~/Notes/Uraeda" # without it, Uraeda in Uraeda's data folder
```

## `ura usage`

`ura usage` prints, as JSON, the usage windows of your Claude Code accounts and of Codex: for each
one, the share of its five hours and of its week used, in percent, and when each resets. It asks the
agents themselves, in short processes that spend no usage, all at once: a few seconds. An account
that cannot be read, signed out or not answering, gets a `problem` in place of its windows, and the
others are read anyway.

The Claude Code accounts are the configuration folders you list in `config.toml`, each reached as
`CLAUDE_CONFIG_DIR`, but `~/.claude`, Claude Code's own:

```toml
[usage]
claude = ["~/.claude", "~/.claude-work"]
```

```json
{
  "version": 1,
  "claude": [
    {
      "name": "work",
      "folder": "~/.claude-work",
      "five_hour": { "used": 18.0, "resets_at": "2026-11-14T15:09:59.950077+00:00" },
      "week": { "used": 51.0, "resets_at": "2026-11-18T11:59:59.954772+00:00" }
    },
    {
      "name": "default",
      "folder": "~/.claude",
      "problem": "Claude Code gave no usage: is the account signed in?"
    }
  ],
  "codex": {
    "five_hour": { "used": 0.0, "resets_at": "2026-11-14T16:56:59Z" },
    "week": { "used": 80.0, "resets_at": "2026-11-16T06:36:49Z" }
  }
}
```

A window not open yet has no reset: `"resets_at": null`.

## `ura sandbox`

`ura sandbox` is for working on Uraeda itself, from a checkout of it: `ura serve` over sample
projects, on http://127.0.0.1:4420, each feature's branch in a worktree. It keeps them in
`.sandbox/` of the checkout until `--reset` builds them again, and never reads your projects or your
settings. [CONTRIBUTING.md](../CONTRIBUTING.md#the-sandbox) says how to run it.
