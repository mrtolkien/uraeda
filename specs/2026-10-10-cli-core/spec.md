---
status: awaiting-human
revision: 2
clarifications: 1
risk-tier: high
---

# Spec: CLI core features

> [!IMPORTANT]
>
> Spec to review again, about 10 minutes for what changed.
>
> - New: `ura start <target>`, in [US8](#us8-start-a-drafted-feature-p2), as you asked. Given a
>   draft file or a postponed folder, it runs the skill's start: the entry moves to Now as a link,
>   one commit on the default branch, the draft moved unchanged to `proposal.md` and committed on
>   the new branch. It refuses a draft still holding the template's placeholders.
> - `ura start specs/bugs/...` is accepted and stops with `unimplemented!`, as you asked. That
>   panics with exit code 101, the one exception to the [CLI](../decisions/cli.md) decision's exit
>   code 1, until the bug flow has its spec.
> - The skill's manual start changes: for an entry without a draft, the agent writes `proposal.md`
>   from your words but does not commit it. You commit it once it is ready, and only then does
>   discovery run: the feature waits on you, at a gate on `proposal.md`, in between.
> - It is the first command that commits on the default branch: it refuses unless every step can
>   run, and an edge case covers a failure between the two commits.
> - `ura start` accepts a draft you have not committed yet, and commits it as the proposal: starting
>   is the signal that it is ready, so you no longer commit it by hand first.
> - The link written at start becomes a skill rule, which the first revision had dropped.
> - Commands name what they act on the same way, a rule added to the [CLI](../decisions/cli.md)
>   decision: an optional target, a path under `specs/` or a unique name. `ura review` loses its
>   `spec`/`plan`/`assessment` argument, since one file at most waits for review in a feature.
> - Smaller fixes for coherence: `--summary` works on approvals too; `ura check --json`;
>   `--no-commit` is for `answer` and `review` only; and a missing proposal is a `human-gate` on
>   `proposal.md`, not a step of its own.
> - The stories after `ura start` are renumbered: the skill story is US9, install US10.

> [!NOTE]
>
> Changes requested on 2026-10-11: add `ura start`, for draft files only, and a manual start that
> leaves the proposal uncommitted.
>
> - Two new decisions: [git](../decisions/git.md), gix for reads and the system `git` for writes, as
>   your new Q6 answer says; and [CLI](../decisions/cli.md), the rules stay in the skill, every TUI
>   action also has flags, and JSON output is versioned.
> - Commits and branch switches also go through `git`, not only pushes: gix runs no hooks and cannot
>   switch branches. gix brings `ura` to about 2 MB, leaving about 1 MB under the CI limit for the
>   TUIs, which measured +0.75 MB.
> - The workflow changes for every project: review feedback moves from the `## Changes requested`
>   section to an optional `spec-review.md`, `plan-review.md`, or `assessment-review.md`,
>   overwritten at each review. Approval comments are carried out by the next step, and
>   clarifications files get your **Notes:** field.
> - `ura check` validates the structure, frontmatter, links, and answers against the skill. It joins
>   `vp run ready`, so this repository's own specs and the skill's example must pass it.
> - Your Q16 answer allowed C if installing stays a binary download. Homebrew installs the release
>   binary, but you create the `homebrew-tap` repository and its token. The Nix package builds from
>   source, which takes about a minute. Say so if you want Nix left out.
> - Risk tier `high`: `ura` commits and switches branches in users' repositories, so the plan waits
>   for your review.

`ura` becomes the fast path through the workflow, for humans and agents. It shows where every
feature stands across branches, tells an agent its next step, validates the `specs/` folder, starts
features, records answers and reviews with their commits, sets a project up with a version-matched
skill, and ships as an installable binary. The skill names each command at the step it serves, and
keeps its manual instructions. The answer, review, and draft TUIs are the next feature, built on
these commands. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## User stories

### US1: See what is waiting, across branches (P1)

From any branch, the human runs `ura status` and sees every started feature and bug, grouped by
their `PRIORITIES.md` section, each with its next step and who it waits on. The waiting file's first
line shows what is asked and for how long. Unstarted entries show as such, and uncommitted edits are
flagged. `--json` gives the same data to scripts.

Why this priority: "what is waiting for me" is the first question of every session, and every other
command builds on the same model.

Acceptance scenarios:

1. **Given** a repository on `main` whose branch `2026-10-10-cli-core` holds `clarifications-01.md`
   with `status: awaiting-human` and the block line "16 questions, about 50 minutes.", **When** the
   human runs `ura status`, **Then** the line for `2026-10-10-cli-core`, under **Now**, says it
   waits on `you`, with `clarifications-01.md: 16 questions, about 50 minutes.`
2. **Given** a feature branch whose spec is `approved` and has no `plan.md`, **When** the human runs
   `ura status`, **Then** its line says it waits on `agent`, with the step `plan`.
3. **Given** a `PRIORITIES.md` entry under **Next** that links `drafts/git-listener.md`, with no
   branch, **When** the human runs `ura status`, **Then** it shows under **Next** as `not started`.
4. **Given** the current branch is `2026-10-10-cli-core`, with an uncommitted edit to
   `clarifications-01.md`, **When** the human runs `ura status`, **Then** the feature is read from
   the working tree and its line ends with `(uncommitted changes)`.
5. **Given** the remote branch `origin/2026-10-10-stack-decision` whose folder is on `main`,
   **When** the human runs `ura status`, **Then** it is not listed.
6. **Given** any repository, **When** the human runs `ura status --json`, **Then** stdout is one
   JSON object with `"version": 1` and a `features` array holding the same entries as the table.

### US2: Tell an agent its next step (P1)

An agent, or a future runner, runs `ura next` and gets the target and its step, from the skill's
tables: the feature or bug, its branch, the step's name, the reference file to follow, and whether
it is a human gate. `ura next <target>` gives the step of one feature or bug.

Why this priority: finding the step is a 12-row table that agents read by hand at every run, and the
runner needs it as an entry point.

Acceptance scenarios:

1. **Given** a feature whose `clarifications-01.md` is `answered`, with no `spec.md`, **When** the
   agent runs `ura next cli-core`, **Then** it prints the step `spec` with the reference
   `skills/uraeda/references/spec.md`.
2. **Given** **Now** lists two features, the first waiting on the human and the second with an
   approved plan with unchecked steps, **When** the agent runs `ura next`, **Then** the target is
   the second feature, with the step `implementation` and its first unchecked task, "Task 3".
3. **Given** an approved spec that links the decision `decisions/git.md` with `status: proposed`,
   **When** the agent runs `ura next` on it, **Then** the step is `approval`.
4. **Given** every step of `plan.md` is checked and `gh` is not installed, **When** the agent runs
   `ura next` on it, **Then** the step is `pull-request`, marked `pull request state unknown`.
5. **Given** nothing in **Now** has work for an agent, **When** the agent runs `ura next --json`,
   **Then** it prints `"step": "none"` and exits 0.

### US3: Validate the specs folder (P1)

`ura check` validates every workflow file against the skill's rules, by itself or in CI and
pre-commit hooks. It reports each problem with its file, line, and rule, and exits 1 when there is
one. `ura check <target>` checks one feature, file, or `specs/` folder; `--json` lists the problems.

Why this priority: agents break templates silently today, and later tools rely on well-formed files.

Acceptance scenarios:

1. **Given** this repository's `specs/` folder, **When** `ura check` runs, **Then** it prints
   `specs/: no problems` and exits 0.
2. **Given** `clarifications-02.md` with `status: done`, **When** `ura check` runs, **Then** it
   prints
   `specs/2026-10-10-x/clarifications-02.md:2: status "done" is not one of awaiting-human, answered`
   and exits 1.
3. **Given** a `clarifications-01.md` with `status: answered` where Q3 has an empty answer, **When**
   `ura check` runs, **Then** it reports `Q3 has no answer` at Q3's `**Answer:**` line.
4. **Given** an answered round where Q2 is answered "C, simpler" and Q2.B is blank, **When**
   `ura check` runs, **Then** Q2.B is not reported.
5. **Given** a spec missing its `## Constitution check` heading, **When** `ura check` runs, **Then**
   it reports `missing section "## Constitution check"`.
6. **Given** a link `[discovery](discovery-01.md#git-backend)` and no such heading, **When**
   `ura check` runs, **Then** it reports `no heading "git-backend" in discovery-01.md`.
7. **Given** the skill's example folder, **When** `ura check skills/uraeda/assets/example/specs`
   runs, **Then** it exits 0.

### US4: Answer questions without editing by hand (P1)

The human, or an agent the human asked, records answers with `ura answer`, one question at a time,
then submits the round. Submitting checks every applicable answer, sets `answered`, turns the
`> [!IMPORTANT]` block into its record, and commits on the feature's branch.

Why this priority: answering is the human's most frequent action, and its record block and commit
are easy to forget by hand. The TUI of the next feature calls the same actions.

Acceptance scenarios:

1. **Given** `clarifications-01.md` with an empty Q3 answer, **When** the human runs
   `ura answer cli-core Q3 "B, we'll do it later"`, **Then** the line after Q3's `**Answer:**` reads
   `**Answer:** B, we'll do it later`, and nothing is committed.
2. **Given** every applicable question is answered, on 2026-10-11, **When** the human runs
   `ura answer cli-core --submit`, **Then** the file has `status: answered`, its block starts with
   `> [!NOTE]` and `> Answered on 2026-10-11.`, its items unchanged, and one commit
   `discovery(cli-core): answer round 01` holds only that file.
3. **Given** Q7 and Q9 are blank, **When** the human runs `--submit`, **Then** nothing changes,
   stderr says `Q7 and Q9 have no answer`, and the exit code is 1.
4. **Given** the human is on `main` with a clean working tree, and the feature's branch is not
   checked out anywhere, **When** they run `ura answer cli-core --submit`, **Then** `ura` switches
   to `2026-10-10-cli-core`, commits there, stays on it, and says `switched to 2026-10-10-cli-core`.
5. **Given** the human is on `main` with an uncommitted change to `README.md`, **When** they run
   `ura answer cli-core --submit`, **Then** nothing changes, and stderr says
   `cannot switch to 2026-10-10-cli-core: uncommitted changes in README.md`.
6. **Given** the feature's branch is checked out in the worktree `../uraeda-cli`, **When** the human
   runs `ura answer cli-core Q1 A` from `main`, **Then** the answer is written in `../uraeda-cli`,
   and `main` is untouched.
7. **Given** a settled point the human disagrees with, **When** they run
   `ura answer cli-core notes "Keep .gitkeep out"`, **Then** the text is written after the file's
   `**Notes:**` line.
8. **Given** the current branch is `2026-10-10-cli-core`, **When** the human runs
   `ura answer Q2 "A"`, **Then** Q2 of its latest round is answered: a first argument shaped like a
   question, `Q2`, `Q2.B`, or `notes`, is never read as a target.

### US5: Review a spec, plan, or assessment (P1)

The human adds comments with `ura review <target> --comment <lines> "<text>"`, then approves or
requests changes. The target is the feature or bug, whose one file waiting for review is the spec,
the plan, or the assessment, or that file's path. A comment quotes the lines it points to, with the
nearest heading, in `spec-review.md` next to the spec. Approving may carry comments, which the next
step carries out; requesting changes needs at least one. Either way, the status, the record block,
and the review file are committed together.

Why this priority: reviewing is the human's other gate, and comments on a line are what the proposal
asks for.

Acceptance scenarios:

1. **Given** `spec.md` at commit `a1b2c3d`, whose lines 50 to 52 sit under
   `### US2: Edit a repeat (P1)`, **When** the human runs
   `ura review cli-core --comment 50-52 "Name the field"`, **Then** `spec-review.md` gets
   `verdict: pending`, `commit: a1b2c3d`, and a comment
   `## C1: Lines 50–52, under "US2: Edit a repeat (P1)"`, followed by the three lines quoted and the
   text.
2. **Given** that pending review, on 2026-10-11, **When** the human runs
   `ura review cli-core --request-changes --summary "Name the field"`, **Then** `spec.md` has
   `status: changes-requested`, its block becomes `> [!NOTE]` with
   `> Changes requested on 2026-10-11: Name the field`, `spec-review.md` has
   `verdict: changes-requested`, and one commit `spec(cli-core): request changes` holds both, with
   the summary as its body.
3. **Given** no comments, **When** the human runs `ura review cli-core --request-changes`, **Then**
   nothing changes, stderr says `a request for changes needs at least one comment`, and the exit
   code is 1.
4. **Given** no pending comments and an old `spec-review.md` from revision 1, **When** the human
   runs `ura review cli-core --approve`, **Then** `spec.md` is `approved`, its block says
   `Approved on 2026-10-11.`, the old `spec-review.md` is deleted in the same commit
   `spec(cli-core): approve`.
5. **Given** one pending comment, **When** the human runs
   `ura review cli-core --approve --risk-tier medium`, **Then** `spec.md` is `approved` with
   `risk-tier: medium` and `plan-review: false`, and `spec-review.md` stays, with
   `verdict: approved`.
6. **Given** a bug branch `fix/2026-10-14-completed-tasks-reappear` with an assessment awaiting the
   human, **When** the human runs `ura review completed-tasks-reappear --approve`, **Then**
   `assessment.md` is `approved`, committed as `assessment(completed-tasks-reappear): approve`.
7. **Given** `plan.md` with `status: auto-approved`, **When** the human runs
   `ura review specs/2026-10-10-cli-core/plan.md --approve`, **Then** nothing changes, and stderr
   says `plan.md is not waiting for a review`.
8. **Given** one pending comment, **When** the human runs `ura review cli-core --request-changes`,
   without `--summary`, **Then** the record line reads
   `> Changes requested on 2026-10-11: 1 comment in spec-review.md.`

### US6: Set a project up (P2)

`ura init`, run anywhere in a git repository, creates the missing parts of `specs/` at its top level
and installs the skill embedded in the binary for Claude Code and every agent that reads
`.agents/skills/`. Running it again fills in what is missing, updates the skill files nobody edited,
and lists the others. `--no-skill` skips the skill.

Why this priority: it is how a new project starts, but it runs once per project.

Acceptance scenarios:

1. **Given** a git repository without `specs/`, **When** the human runs `ura init` in a subfolder,
   **Then** the top level gets `specs/README.md`, `specs/CONSTITUTION.md`, `specs/PRIORITIES.md`,
   `specs/drafts/.gitkeep`, `specs/backlog/.gitkeep`, `specs/decisions/.gitkeep`,
   `specs/bugs/.gitkeep`, the skill in `.agents/skills/uraeda/` with its manifest
   `.agents/skills/uraeda/.ura-manifest`, and a symbolic link `.claude/skills/uraeda` to it. Nothing
   is committed, and the last line suggests asking an agent to write the constitution.
2. **Given** an existing `specs/CONSTITUTION.md`, **When** the human runs `ura init`, **Then** the
   file is unchanged and listed as `kept specs/CONSTITUTION.md`.
3. **Given** a skill installed by an older `ura`, with `SKILL.md` edited by the human, **When** a
   newer `ura init` runs, **Then** every other file of the skill is updated, `SKILL.md` is kept, and
   listed as `kept .agents/skills/uraeda/SKILL.md: edited since installed`.
4. **Given** a repository, **When** the human runs `ura init --no-skill`, **Then** only `specs/` is
   written.
5. **Given** a folder outside any git repository, **When** the human runs `ura init`, **Then** it
   writes nothing, and says `not in a git repository: run git init first`.

### US7: Draft a PRIORITIES line (P2)

`ura draft <text>` finds the one `PRIORITIES.md` line matching the text, writes
`specs/drafts/<slug>.md` from the proposal template with the line as its title, turns the line into
a link to it, and opens the file in the editor. It writes on the default branch and does not commit.
The picker comes with the TUI feature.

Why this priority: it shortens the path from an idea to a proposal, but writing a draft by hand
stays easy.

Acceptance scenarios:

1. **Given** the **Next** line `- Git listener process`, **When** the human runs
   `ura draft listener`, **Then** `specs/drafts/git-listener-process.md` starts with
   `# Git listener process`, the line becomes
   `- [Git listener process](drafts/git-listener-process.md)`, and `$EDITOR` opens the new file.
2. **Given** two lines containing "web UI", **When** the human runs `ura draft "web ui"`, **Then**
   nothing changes, and stderr lists both lines.
3. **Given** a line that already links a file, **When** the human runs `ura draft` on it, **Then**
   nothing changes, and stderr names the linked file.
4. **Given** no terminal, or `--no-edit`, **When** `ura draft listener` runs, **Then** it writes the
   files, prints the draft's path, and opens no editor.

### US8: Start a drafted feature (P2)

`ura start <target>` starts the feature written in a draft: a file in `specs/drafts/` or
`specs/backlog/`, or a postponed folder there, named by its path or its name. The draft may be
uncommitted: starting is the signal that it is ready. On the default branch, it moves the
`PRIORITIES.md` entry linking the draft to the end of **Now**, or adds one there with the draft's
title, turns it into a link to the future `proposal.md`, and commits. Then it creates the feature's
branch, moves the draft or the folder into the dated folder unchanged, the draft becoming
`proposal.md`, commits, and stays on the new branch. A draft still holding the template's
placeholders is refused: a committed proposal is work for an agent, so it must be one the human
wrote. `ura start specs/bugs/...` stops with `unimplemented!`: bugs have no spec'd flow yet.

Why this priority: starting is the skill's most error-prone sequence, two commits on two branches,
and it happens for every feature.

Acceptance scenarios:

1. **Given** the **Next** line `- [Git listener process](drafts/git-listener-process.md)` on `main`,
   on 2026-10-11, with a clean working tree, **When** the human runs
   `ura start specs/drafts/git-listener-process.md`, **Then** `main` gets one commit
   `chore(git-listener-process): start Git listener process`, in which the line is the last of
   **Now** and reads `- [Git listener process](/specs/2026-10-11-git-listener-process/proposal.md)`.
2. **Given** the same start, **Then** the branch `2026-10-11-git-listener-process` exists from that
   commit, is checked out, and has one more commit `chore(git-listener-process): proposal`, which
   moves `specs/drafts/git-listener-process.md` to
   `specs/2026-10-11-git-listener-process/proposal.md` with the same content.
3. **Given** the draft `specs/drafts/slack-integration.md`, titled `# Slack integration`, that no
   `PRIORITIES.md` line links, **When** the human runs
   `ura start specs/drafts/slack-integration.md`, **Then** the start commit adds
   `- [Slack integration](/specs/2026-10-11-slack-integration/proposal.md)` as the last line of
   **Now**.
4. **Given** the postponed folder `specs/backlog/benchmarks/`, holding `proposal.md`,
   `discovery-01.md`, and `clarifications-01.md`, **When** the human runs
   `ura start specs/backlog/benchmarks`, **Then** the three files move to
   `specs/2026-10-11-benchmarks/`, unchanged.
5. **Given** the branch `2026-10-11-git-listener-process` already exists, **When** the human runs
   `ura start git-listener-process`, **Then** nothing changes, and stderr says
   `2026-10-11-git-listener-process exists: choose another slug with --slug`.
6. **Given** an uncommitted change to `README.md`, **When** the human runs
   `ura start specs/drafts/git-listener-process.md`, **Then** nothing changes, and stderr says
   `cannot start: uncommitted changes in README.md`.
7. **Given** a target outside `specs/drafts/`, `specs/backlog/`, and `specs/bugs/`, like
   `specs/2026-10-10-cli-core/proposal.md`, **When** the human runs `ura start` on it, **Then**
   nothing changes, and stderr says
   `not a draft: ura start takes a file or folder in specs/drafts/ or specs/backlog/`.
8. **Given** `specs/drafts/git-listener-process.md` as `ura draft` wrote it, with the template's
   `[What the feature does, from the user's point of view.]` still under `## What`, **When** the
   human runs `ura start specs/drafts/git-listener-process.md`, **Then** nothing changes, and stderr
   says
   `specs/drafts/git-listener-process.md still holds the template's placeholders: write it first`.
9. **Given** `specs/drafts/git-listener-process.md` written by the human but never committed, and
   its `PRIORITIES.md` line uncommitted too, as `ura draft` left them, **When** the human runs
   `ura start git-listener-process`, **Then** the start commit on `main` holds `PRIORITIES.md`, and
   the proposal commit on the new branch adds the draft's content as `proposal.md`: the draft is
   never committed in `specs/drafts/`.
10. **Given** any path under `specs/bugs/`, **When** the human runs `ura start` on it, **Then**
    `ura` stops with `not implemented: starting a bug, until the bug flow has its spec`, through
    `unimplemented!`, and nothing changes.

### US9: Agents follow the skill, with or without `ura` (P2)

The skill names the command of each step it can serve, keeps its manual instructions, and describes
the review files and the **Notes:** field. An agent in a project without `ura` follows the workflow
as before; with `ura`, it uses `ura next`, `ura check`, `ura start`, and the actions.

Why this priority: it is what makes agents less error-prone, the proposal's goal, and it carries the
workflow changes of this feature.

Acceptance scenarios:

1. **Given** the skill, **When** a reader looks for each `ura` command, **Then** each appears in the
   reference of the step it serves, next to the manual instructions it performs.
2. **Given** a spec approved with one comment in `spec-review.md`, **When** the plan step runs,
   **Then** the plan has a `## Review comments` section saying how it addresses C1.
3. **Given** a spec with `status: changes-requested` and a `spec-review.md` with two comments,
   **When** the spec step revises it, **Then** the new `> [!IMPORTANT]` block says how each comment
   was handled, "C1: done", "C2: declined, because ...".
4. **Given** a `PRIORITIES.md` entry without a draft, **When** the human asks an agent to start it
   without `ura`, **Then** the agent commits the entry's move to **Now** on the default branch,
   creates the branch and `proposal.md` from the template with the human's words, does not commit
   `proposal.md`, and tells the human to write and commit it.
5. **Given** a feature branch whose `proposal.md` is not committed, **When** `ura next` or
   `ura status` runs, **Then** the step is a `human-gate` on `proposal.md`, and discovery does not
   run.
6. **Given** the clarifications template, **When** an agent writes a new round, **Then** the file
   ends with `**Notes:**` after the settled points, and the spec step reads it like an answer.

### US10: Install `ura` (P3)

On each version tag, a release workflow builds `ura` for Linux and macOS, on x64 and arm64, and
publishes it with a shell installer and a Homebrew formula. Nix users run it from the flake.

Why this priority: until now, `ura` needs a Rust toolchain, but nothing else in this feature depends
on it.

Acceptance scenarios:

1. **Given** the tag `v0.1.0` is pushed, **When** the release workflow runs, **Then** the GitHub
   release holds archives for `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`,
   `x86_64-apple-darwin`, and `aarch64-apple-darwin`, and a shell installer.
2. **Given** that release, **When** a user runs `brew install mrtolkien/tap/ura`, **Then** the
   release binary is installed.
3. **Given** a machine with Nix, **When** a user runs
   `nix run github:mrtolkien/uraeda -- --version`, **Then** it prints `ura 0.1.0`.

## Edge cases

- **No `specs/` folder**: every command but `init` exits 1 with
  `no specs/ folder at <top level>: run ura init`.
- **Detached HEAD**: `status`, `next`, and `check` work; `answer`, `review`, `draft`, and `start`
  refuse with `detached HEAD: switch to a branch first` when they would write on the current working
  tree.
- **A local branch behind its remote**: `status` reads the local branch and adds
  `(behind origin by 2)`; it never fetches. Its header says when the remote branches were last
  fetched.
- **A branch only on the remote**: `status` reads it; `answer` and `review` switch to it, which
  creates the local branch tracking it, as `git switch` does.
- **A target matching several items**: `ura answer web` with two slugs containing "web" exits 1 and
  lists them. Without a target, the current branch's feature is used, or the only one waiting for
  that action, or the command lists the candidates.
- **A follow-up whose parent's answer is free text without an option letter**: it counts as
  applicable, so `--submit` requires it, and `check` reports it blank, with
  `may not apply: answer "-" if so`.
- **A comment on lines outside the file** (`--comment 900-901` on a 400-line spec): exits 1 with
  `spec.md has 400 lines`.
- **A pending review whose `commit` is older than the reviewed file's last change**: the next
  `--comment` replaces the file, and says `replaced a pending review of an older version`.
- **A hook that fails on a commit made by `ura`**: the files stay written, the hook's output is
  shown, and the command exits 1 with `commit failed: fix the hook's error, then commit`.
- **An answer or comment with several paragraphs**: the text is written as given, newlines kept.
- **`$VISUAL` and `$EDITOR` unset for `draft`**: `vi` is run; if it is missing, the draft is written
  and its path printed.
- **`start` when a step fails after the first commit**, like a hook failing on the proposal commit:
  `ura` stops, lists the steps done and the ones left, which the skill's start section describes,
  and exits 1. The start commit on the default branch stays.
- **`start` with uncommitted changes besides the draft and `PRIORITIES.md`**: it refuses, as in US8.
  Uncommitted edits to other lines of `PRIORITIES.md` go into the start commit, and the output lists
  them.
- **`start` on a draft that several `PRIORITIES.md` lines link**: it refuses, and lists the lines.
- **`init` where `.claude/skills/uraeda` exists as a folder**: it is kept, and listed as `kept`; the
  link is not made.
- **A file that is not UTF-8, or frontmatter that is not YAML**: `check` reports it, and `status`
  shows the feature with `invalid files` in place of a step.
- **A feature folder with an impossible date** (`2026-13-99-x`): `check` reports it; `status` and
  `next` skip it.

## Success criteria

- **SC-001**: `ura status` and `ura next` complete in under 1 second on a repository with 20 feature
  branches, on Linux x64.
- **SC-002**: the release build of `ura` stays under 3 MB, the existing CI limit.
- **SC-003**: `ura check` exits 0 on this repository's `specs/` and on the skill's example, and each
  file of `fixtures/broken/` fails with its expected message.
- **SC-004**: every `ura` subcommand is named in the skill's references.
- **SC-005**: every commit made by `ura` runs the repository's pre-commit hook.
- **SC-006**: every action of `answer` and `review` works without a terminal, through flags.

## Design

### Approach

The core gets a model of the whole `specs/` folder, read from the default branch, each feature
branch, and the working tree, with gix, in process ([git](../decisions/git.md)). On that model it
derives each feature's next step from the skill's tables, validates the files against the rules the
skill and its templates state, and performs the human actions: write an answer, submit a round,
comment, approve, request changes. The CLI is a thin layer of commands over the core, with plain and
JSON output ([CLI](../decisions/cli.md)). The binding can expose the same model to the web UI later.
See [scope](discovery-01.md#scope), [status](discovery-01.md#status), and
[mechanical operations](discovery-01.md#mechanical-operations-in-the-skill).

The workflow change rides along: review comments move to an optional review file, approvals can
carry comments, and the questions get a **Notes:** field
([Q9](clarifications-01.md#q9-what-can-a-review-conclude),
[Q10](clarifications-01.md#q10-where-do-review-comments-live)).

### Data

Nothing new is stored outside the workflow files. The core reads them into these types, which
`--json` serializes, with kebab-case field names:

- **`Workspace`**: `root` (the git top level), `default_branch`, `fetched_at` (the time of the last
  fetch, from `.git/FETCH_HEAD`, or `null`), `priorities: Vec<PriorityEntry>`,
  `features: Vec<Feature>` (features and bugs), `problems: Vec<Problem>`.
- **`PriorityEntry`**: `section` (`now`, `next`, `later`, `blocked`), `position` (from 1), `text`,
  `link` (the linked file, or `null`), `feature` (the matching folder name, or `null`). An entry
  matches the feature whose slug is its linked file's folder name or file name, as the skill says.
- **`Feature`**: `kind` (`feature` or `bug`), `folder` (`2026-10-10-cli-core`), `slug` (`cli-core`),
  `branch` (`null` once merged), `source` (`working-tree`, `local`, `remote`, or `default-branch`),
  `uncommitted` (bool), `behind` (commits behind its remote, or `null`), `files: Vec<WorkflowFile>`,
  `step: Step`, `problems: Vec<Problem>`.
- **`WorkflowFile`**: `name`, `kind` (`proposal`, `discovery`, `clarifications`, `spec`, `plan`,
  `rulings`, `review`, `report`, `assessment`), `round` (for discovery and clarifications),
  `status`, `waiting_line` (the first line of an `[!IMPORTANT]` block, or `null`).
- **`Step`**: `name`, one of `human-gate`, `discovery`, `spec`, `spec-revision`, `approval`, `plan`,
  `plan-revision`, `implementation`, `final-review`, `pull-request-changes`, `pull-request`,
  `assess`, `assess-revision`, `fix`, `none`; `waits_on` (`human` or `agent`); `reference` (the
  skill file to follow, like `skills/uraeda/references/spec.md`); `file` (the file waiting, for a
  gate: `proposal.md` while it is not committed); `task` (the first unchecked task's title, for
  implementation and fix); `pull_request` (`open`, `changes-requested`, `none`, or `unknown`).
- **`Problem`**: `file`, `line`, `rule` (a stable id, like `frontmatter.status`), `message`.

The JSON of `status`, `next`, and `check` is `{ "version": 1, ... }`, with the workspace, the step,
or the problems inside. A feature branch whose folder is not committed yet is a `Feature` with no
files, waiting at a gate on `proposal.md`.

**Targets**: every command that acts on a feature, bug, draft, or file resolves its target the same
way, as the [CLI](../decisions/cli.md) decision says: a path under `specs/`, or a folder name, slug,
or draft file name matching exactly one item, searched in the workspace across branches. For
`answer`, a first argument shaped like a question (`Q2`, `Q2.B`, `notes`) is the question, not a
target.

**Review files**, a new workflow file: `spec-review.md`, `plan-review.md`, or
`assessment-review.md`, next to the file reviewed. It exists only when the latest review has
comments, and the next review replaces it: git keeps the history.

```markdown
---
verdict: pending | approved | changes-requested
commit: a1b2c3d # the commit holding the version reviewed
---

# Review: Spec, CLI core features

[Optional: a summary of the review.]

## C1: Lines 50–52, under "US2: Edit a repeat (P1)"

> [the lines, quoted as they were at that commit]

[The comment.]

## C2: General

[A comment on the whole file.]
```

Rules, written in the skill and checked by `ura check`: `verdict` and `commit` are required;
comments are numbered from C1; a comment's heading is `Lines N–M, under "<heading>"`,
`Line N, under "<heading>"`, or `General`; a line comment quotes its lines; `changes-requested`
needs a comment. The reviewed file keeps its `status`, the source of truth, and the
`## Changes requested` section goes away.

**Clarifications** get a last line, `**Notes:**`, after **Settled without the human**, optional for
the human, read by the spec step like an answer.

**Dates**: the record blocks use the local date, or `URA_TODAY` (`YYYY-MM-DD`) when set, for tests
and scripts.

### Components

- **Git module** ([`crates/core/src/git.rs`](/crates/core/src/git.rs)): the only code that reaches
  git. With gix, built without default features, it finds the top level and the default branch,
  lists branches and worktrees, reads files at a ref, checks the working tree, and counts commits
  behind a remote. With the system `git`, it switches branches and commits given paths, so hooks
  run. Each call returns parsed values or a `GitError` with the underlying message.
- **Workflow files** ([`crates/core/src/files/`](/crates/core/src/files/)): parsers for each kind of
  file, on pulldown-cmark with source offsets: frontmatter, headings with their lines, questions
  with their options and answers, the `[!IMPORTANT]` block, plan tasks and checkboxes, review
  comments, links. They replace `temporary_status`'s frontmatter reading.
- **Workspace reader** ([`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs)): builds a
  `Workspace` from the git module and the parsers: PRIORITIES from the default branch, merged
  features from it, each feature branch from its tip, the current branch from the working tree.
- **Steps** ([`crates/core/src/steps.rs`](/crates/core/src/steps.rs)): the skill's two tables as one
  function from a `Feature` to its `Step`, and the target rule of the skill for `ura next`. Pull
  request states come from `gh` when it is on PATH and logged in, through a small call in this
  module.
- **Checks** ([`crates/core/src/check/`](/crates/core/src/check/)): one rule per function, each with
  its id, over the parsed files. The section rules are read from the templates embedded in the
  binary, so a template change changes the check.
- **Actions** ([`crates/core/src/actions/`](/crates/core/src/actions/)): `answer`, `submit_answers`,
  `comment`, `approve`, `request_changes`, `draft`, `start`, `init`. Each takes the workspace,
  checks every condition before writing anything, finds where to write (the current working tree,
  the branch's worktree, or a switch when clean, as
  [Q7](clarifications-01.md#q7-where-do-answer-and-review-write-when-the-features-branch-is-not-checked-out)
  answered), edits the files, and returns the paths changed and the commit to make. Edits keep every
  other byte of the file.
- **Embedded skill** ([`crates/core/src/embedded.rs`](/crates/core/src/embedded.rs)):
  `skills/uraeda/` included at build time, for the templates, the checks, and `init`.
- **CLI** ([`crates/cli/src/`](/crates/cli/src/)): one module per command, with clap: `init`,
  `status`, `next`, `check`, `draft`, `start`, `answer`, `review`. Each calls the core, renders text
  or JSON, commits with the git module (`answer` and `review` take `--no-commit`), and maps errors
  to exit 1. The temporary `status <folder>` command goes.
- **Temporary server source**
  ([`crates/core/src/temporary_status.rs`](/crates/core/src/temporary_status.rs)): stays for the
  server's temporary page, now built on the workflow file parsers, and marked
  `TEMPORARY: replaced by the web UI feature.`
- **Skill** ([`skills/uraeda/`](/skills/uraeda/)): each step names its command; the review files,
  the approval comment rules, the **Notes:** field, the uncommitted proposal of a manual start and
  its gate on `proposal.md`, and the start's link in `SKILL.md`, the references, the templates (a
  new `spec-review.md` template, used for plans and assessments too), and the example; templates
  mark every optional section with a placeholder starting with `[Optional`, which `check` reads.
- **Release** ([`.github/workflows/release.yml`](/.github/workflows/release.yml),
  `dist-workspace.toml`, [`flake.nix`](/flake.nix)): dist 0.32 with the shell and Homebrew
  installers, publishing to `mrtolkien/homebrew-tap`; a flake package built from source.

### Mockups

- [Command output](mockups/cli-output.md): the text of `status`, `next`, `check`, `answer`,
  `review`, `init`, `draft`, and `start`, in their success and error cases.

### Error handling

- Every error is one line on stderr, `ura: <message>`, then exit 1, except `start` on a bug.
  Validation problems are listed on stdout, one per line, `<file>:<line>: <message>`, then exit 1.
- A git read that fails: `ura: cannot read <what>: <gix's message>`. A `git` command that fails:
  `ura: git <subcommand> failed: <git's first line of error>`. `git` missing from PATH, for a write:
  `ura: git not found: install git to commit`.
- An action that cannot write: nothing is changed. Files are written only once every check passed,
  so a refused action leaves the repository as it was.
- A commit that fails after the files are written: see the hook edge case.
- An interactive need without a terminal, like `draft` without text:
  `ura: name the line: ura draft <text>`, with the candidate lines listed.

### Testing

Integration tests run the built `ura` in temporary git repositories made by a shared helper: it
initializes a repository, writes files from `fixtures/`, commits them on named branches, sets
`URA_TODAY`, and installs a pre-commit hook that records its runs. Each test arranges a repository,
runs one command, and asserts its output, exit code, files, and commits. Parsers with many cases get
table-driven tests.

| What                                             | Test                                                            |
| ------------------------------------------------ | --------------------------------------------------------------- |
| US1 to US8, every scenario                       | One integration test per scenario                               |
| US9: commands named in the skill (SC-004)        | A test listing clap's subcommands and searching the references  |
| US9: review comments, revision record, notes     | `ura check` tests on fixtures of each, and the skill example    |
| US10                                             | `dist plan` in CI on pull requests; `nix build` once by hand    |
| Edge cases                                       | One integration test each                                       |
| Follow-up applicability, comment headings, slugs | Table-driven tests of the parsers                               |
| SC-001                                           | A test creating 20 feature branches, timing `status` and `next` |
| SC-002                                           | The existing CI size check                                      |
| SC-003                                           | `ura check` in `vp run ready`, and one test per broken fixture  |
| SC-005                                           | The recording hook, asserted after every committing test        |
| SC-006                                           | The integration tests, all run without a terminal               |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human), which you approved
in your notes:

- The actions live in the core, for the web UI to reuse through the binding.
- Read commands have `--json` with a top-level `"version": 1`.
- Every TUI action also has flags, and a TUI starts only with a terminal and without `--no-input`.
- `ura` cannot tell who runs it: an agent sets a human status only when the human asks in the
  session. It then passes `--no-commit` and commits with "approved by the human in chat", as the
  skill says.
- Errors exit 1, messages go to stderr, and colour follows the terminal and `NO_COLOR`.
- The workspace root is the git top level, holding `specs/`.
- `init` never overwrites, and creates the four folders with a `.gitkeep`.
- Templates are embedded at build time.
- A follow-up applies when its parent's answer names its letter as an option.
- Answers are written as they are given; `answered` comes only on submit.
- Commit messages: `discovery(<slug>): answer round NN`, `spec(<slug>): approve`,
  `spec(<slug>): request changes`, and the same for `plan` and `assessment`, with the review's
  summary as the body.
- `ura` never fetches or pushes; `next` reads pull requests through `gh` when installed.
- The TUI libraries and keys settled there go to the TUI feature, with your answers to Q4 and Q12 to
  Q14.

Settled while writing this spec:

- `ura start` was added in this revision, at your request, after B in
  [Q3](clarifications-01.md#q3-which-commands-come-beyond-the-proposals-five). The clarifications'
  point on the link stands: at start, the entry becomes a link to the new `proposal.md`, from the
  repository root, as you did for this feature, and the skill's start section says so.
- `start` takes its slug from the draft's file name, or the postponed folder's name; `--slug`
  overrides it. It refuses when the dated folder exists on any branch, or the branch exists locally
  or on the remote.
- A draft "still holds the template's placeholders" when its `## What` or `## Why` section is still
  the template's bracketed text, or empty. `## Notes` may stay empty, as the template allows.
- `ura start` on a bug uses Rust's `unimplemented!`, as you asked: a panic, exit code 101, marked
  for the bug flow's spec to replace, and allowed by the CLI decision for paths not built yet.
- `--summary` is optional with `--approve` and `--request-changes`: it goes in the review file and
  the commit body. Without it, a request for changes records the number of comments in its line.
- The skill's manual start, for an entry without a draft, still commits the entry's move to **Now**
  on the default branch and creates the branch: only `proposal.md` waits for the human. The skill's
  step table gets a first row: a feature whose `proposal.md` is not committed waits on the human, at
  a gate on that file.
- Review files have no round number, as you answered: one file per reviewed file, holding the latest
  review, deleted by a review without comments. `commit` pins the line numbers, for plans and
  assessments too, which have no `revision`.
- A review is drafted with `verdict: pending`, while the reviewed file waits; `--comment` starts or
  extends it.
- Comments on an approved spec are carried out by the plan, in a new optional `## Review comments`
  section; on an approved plan or assessment, by the implementation, which reports them in the pull
  request description. The approved file is never changed for them.
- `.claude/skills/uraeda` is a symbolic link to `.agents/skills/uraeda`, so one copy serves both, as
  `npx skills` does. The manifest lists each file's SHA-256, in `sha256sum` format, so a human can
  check it with `sha256sum -c`.
- `init` requires a git repository, since every other command does.
- `start` does not open the editor: the proposal is written before starting.
- `draft` writes `PRIORITIES.md` on the default branch, with the same rules as `answer` for reaching
  a branch. The slug is the line's text, lowercased, with every run of other characters than letters
  and digits turned into one hyphen, cut at 50 characters on a hyphen.
- `ura check` reads the working tree, the files about to be committed, and joins `vp run ready` on
  `specs/` and the skill's example, as the [toolchain](../decisions/toolchain.md) decision requires
  of a new check. The files that fail today are fixed in this feature.
- The editor is `$VISUAL`, then `$EDITOR`, then `vi`, run through `sh -c`, as git does.
- The workspace version becomes `0.1.0`. You tag `v0.1.0` after the merge, and create the
  `mrtolkien/homebrew-tap` repository and its `HOMEBREW_TAP_TOKEN` secret before.
- The last commit of this feature replaces its `PRIORITIES.md` entry with the TUI feature, in
  **Now**, linking a draft `specs/drafts/cli-tuis.md` that quotes the proposal's TUI parts, and
  links your answers to Q4 and Q12 to Q14.
- The server's temporary page keeps working, on the new parsers.

## Decisions

New, applied when this spec is approved:

- [Git](../decisions/git.md): Rust tools read git with gix and write with the system `git`, never
  bypassing hooks, through one module of the core.
- [CLI](../decisions/cli.md): the skill holds every rule and names each command; every TUI action
  has flags; read commands have versioned JSON; the skill is embedded in the binary.

Relied on:

- [Stack](../decisions/stack.md): the model, steps, checks, and actions live in the core; the CLI is
  Rust only; the server keeps reaching the core through the binding.
- [Toolchain](../decisions/toolchain.md): `ura check` joins `vp run ready`; the release matrix
  builds the platforms CI does not validate; no Windows target.

## Constitution check

| Principle                            | Complies | Notes                                                                                        |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | Only human actions set human statuses; approval comments never change an approved file       |
| II. Git and plain text first         | yes      | Review files and notes are markdown in git; `ura` stores nothing else                        |
| III. Asynchronous by default         | yes      | Every action ends with a commit; state is read from git alone                                |
| IV. Review effort matches impact     | yes      | Approving with comments saves a revision round; `high` tier for the plan                     |
| V. Tools are optional                | yes      | Every rule stays in the skill; every action can be done by hand; `check` reads the templates |
| VI. Code is checked against the spec | yes      | One integration test per scenario                                                            |

## Risk tier

**High**: `ura` switches branches and commits in users' repositories, and the workflow's file format
changes for every project.
