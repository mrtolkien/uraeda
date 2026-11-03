---
status: awaiting-human
revision: 1
clarifications: 2
risk-tier: medium
plan-review: false
---

# Spec: "Master" PR

> [!IMPORTANT]
>
> Spec to review, about 10 minutes.
>
> - You approve branches that never edit `PRIORITIES.md` or `INBOX.md`: agents' notes become note
>   files of their own, and a merged feature's line waits for `ura clean`.
> - The git decision changes: branches never write the priorities or the inbox, and an agent's note
>   is a note file.
> - The pull request flow is out, as you asked: no master pull request, and no feature started on
>   another. A proposal in Next covers agents fixing conflicts on their own.
> - Round 01 promised a web UI button for `ura clean`: there is none today. This spec keeps
>   `ura clean` alone; say so if you want the button here.
> - A merged feature's line stays in Now, shown as merged, until you clean it.
> - Risk tier `medium`: the inbox's readers change, with no data converted.

Several features built in parallel conflict when they merge, half the time only in workflow files
every branch edits: `PRIORITIES.md`, `INBOX.md`, and old records. This spec removes the branches'
edits of the first two, and gives the catch-up a rule for the third, so parallel work merges without
those conflicts. See the [proposal](proposal.md), the discovery rounds
[01](discovery-01.md#the-proposals-path-and-existing-actions) and [02](discovery-02.md), and the
clarifications [01](clarifications-01.md) and [02](clarifications-02.md).

## Decisions

- **Changed: [Git](../decisions/git.md)**. A feature's or a change's branch never writes
  `PRIORITIES.md` or `INBOX.md`, and an agent's inbox note is a note file of its own.

Relied on:

| Decision                                         | What it means for this spec                                       |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| [Compatibility](../decisions/compatibility.md)   | the skill, templates, example, and fixtures change in this branch |
| [Attachments](../decisions/attachments.md)       | a note's images stay in its note file's folder, as today          |
| [Feature status](../decisions/feature-status.md) | a merged feature reads as merged from its record, as today        |

## User stories

### US1: A finishing branch leaves the priorities alone (P1)

The finish writes the record and deletes the folder, but no longer removes the feature's line from
`PRIORITIES.md`. Once merged, the line shows the feature as merged, and `ura clean` removes it on
the default branch, with the worktree and the branch.

Key scenarios:

1. **Given** Reading pass and Feature state are both started in Now, **When** Reading pass finishes
   and its pull request is merged, **Then** `PRIORITIES.md` merges without a conflict, and Reading
   pass's line is still in Now.
2. **Given** Reading pass is merged and its line is in Now, **When** the human opens the Home,
   **Then** the line shows Reading pass as merged, with its pull request.
3. **Given** Reading pass is merged, **When** the human runs `ura clean reading-pass`, **Then** the
   worktree, the branch, and the line leave, the line in a commit
   `chore(reading-pass): remove "Reading pass" from the priorities` on the default branch.

More scenarios:

1. **Given** Reading pass is merged, **When** `ura check` runs on the default branch, **Then** the
   line's link to the deleted folder is no problem, and `ura check --fix` leaves it as it is.
2. **Given** the human removed Reading pass's line by hand, **When** they run `ura clean`, **Then**
   it removes the worktree and the branch, and writes nothing to `PRIORITIES.md`.
3. **Given** `PRIORITIES.md` has uncommitted changes, **When** the human runs `ura clean`, **Then**
   the line is removed but not committed, and `ura clean` says
   `PRIORITIES.md had uncommitted changes: the line is removed but not committed.`

### US2: An agent's note is a note file of its own (P1)

An agent notes a problem outside its work in a new file, `specs/notes/<slug>-<words>.md`, on its
branch, instead of a line of `INBOX.md`. Once merged, the note shows in the inbox like any other, in
the web UI and in a new `ura inbox` listing.

Key scenarios:

1. **Given** Feature state's agent runs
   `ura note "The workspace record's running is read by no view" --agent --category "Deferred fixes"`,
   **When** it runs in Feature state's worktree, **Then** it commits
   `specs/notes/feature-state-the-workspace-records-running.md` alone, with `agent: true`,
   `about: feature-state`, and the category, and `INBOX.md` is unchanged.
2. **Given** Feature state and Reading pass each bring an agent's note under "Deferred fixes",
   **When** both merge, **Then** neither conflicts, and the inbox shows both at the end of "Deferred
   fixes", with the `[agent]` and slug marks.
3. **Given** that note is merged, **When** the human runs `ura inbox`, **Then** it prints
   `Deferred fixes`, then
   `- [agent] [feature-state] The workspace record's running is read by no view`.

More scenarios:

1. **Given** an agent's note under "Testing", a category `INBOX.md` lacks, **When** the inbox is
   read, **Then** "Testing" shows after the file's own categories, with the note in it.
2. **Given** an agent's note in the inbox, **When** the human removes it, **Then** its file is
   deleted, in a commit `chore: remove "The workspace record's running…" from the inbox`.
3. **Given** an agent's note in the inbox, **When** the human moves it within its category or to
   another, **Then** it becomes a line of `INBOX.md` linking the file, at the place it was dropped,
   and its file drops its `category`.
4. **Given** an agent's note in the inbox, **When** the human makes it a proposal, **Then** its file
   moves to `specs/proposals/`, as a linked note file does today.
5. **Given** an agent's note, **When** an inbox triage is proposed, **Then** the triage asks about
   it like any note.
6. **Given** two notes from Feature state with the same first words, **When** the second is written,
   **Then** its file gets `-2`.
7. **Given** `ura inbox --json`, **When** it runs, **Then** it prints each note with its category,
   text, marks, and file.

### US3: The catch-up settles the shared files' conflicts by rule (P2)

When a branch catches up, a conflict in an old record of `specs/done/`, or in a file the build
generates, is settled without thought. The record is taken from the default branch and its links
repaired again; a generated file is regenerated.

Key scenarios:

1. **Given** the default branch repaired a link in `done/2026-10-30-inbox-again.md`, and the branch
   a nearby one, **When** the catch-up rebases and they conflict, **Then** the agent takes the
   default branch's record, and `ura check --fix` repairs the branch's link again.
2. **Given** both sides changed `packages/binding/index.d.ts`, **When** the catch-up conflicts on
   it, **Then** the agent regenerates it with the build, never merging it by hand.

## Replaced behaviour

- **The finishing commit removes the feature's line from `PRIORITIES.md`.** Described in the skill's
  [finish](/skills/uraeda/references/finish.md#the-finishing-commit) only; no test guards it.
- **An agent's note is a line of `INBOX.md` on its branch.** Guarded by
  `an_agents_note_from_a_feature_worktree_stays_on_its_branch`, `an_agents_note_about_a_feature`,
  and `an_about_naming_a_change_writes_its_slug`, in `crates/cli/tests/note.rs`.
- **A note file no note of `INBOX.md` links is a warning, `layout.unlinked-note`.** Guarded by
  `an_unlinked_note_file_is_a_warning`, in `crates/core/tests/check.rs`. It is now a note.
- **The catch-up takes the default branch's `PRIORITIES.md`, with the feature's line kept.** In the
  skill's [catch-up](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch)
  only: with no write on the branch, it has nothing to settle.

## Architecture

Branches add files and never edit the human's shared files, the way changelog tools ended the same
conflicts with one file per entry. See
[one file per entry](discovery-01.md#one-file-per-entry-changesets-towncrier-reno-gitlab). The
change is mostly the skill's, with three readers in the core.

- **The inbox reader**, in the core, reads `INBOX.md`'s notes, then the agents' note files: every
  note file no note links, placed at the end of its category. It owns where a note file shows. Every
  reader, the web UI, `ura inbox`, the triage, and `ura check`, goes through it.
- **The inbox actions** treat an agent's note like a linked note file: removing deletes the file,
  making a proposal moves it, and moving it writes its line. They own turning an agent's note into a
  line.
- **`ura note --agent`** writes the note file instead of a line, named from the slug and the note's
  first words, and commits it alone.
- **`ura inbox`** prints the inbox, by category, from the inbox reader, with `--json`.
  `ura inbox clean` stays as it is.
- **`ura clean`** also removes the merged feature's line from `PRIORITIES.md`, with the drop's
  existing removal of a linked line.
- **The priorities' join** shows a line linking a merged feature as merged, from its record;
  `ura check` and `--fix` leave its link alone.
- **The skill**: the finish, the catch-up, the change's finish, agents' notes, the inbox's format,
  the postpone, and the CLI reference, with the templates and the example, which must agree.

Tradeoffs:

- Notes live in two forms, lines and files: every inbox reader must take both, through one reader.
- A merged feature's line lingers in Now until the human cleans it.
- `INBOX.md` read by hand no longer shows agents' notes: `specs/notes/` holds them.

## Edge cases

| Importance | Situation                                                             | What happens                                                                             |
| ---------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| High       | A linked note is removed, but its file has uncommitted changes        | the file stays, and now shows as an agent's note; the human is told, as today            |
| High       | A branch started before this feature still removes its line at finish | its catch-up meets the old conflict once; the rule of the new skill takes main's file    |
| Normal     | A postponed feature                                                   | its line moves on the default branch, in the commit after the merge, never on the branch |
| Normal     | An agent's note with no `category`                                    | it shows after the notes without a category                                              |
| Normal     | `ura clean` finds no line for the feature                             | it cleans the rest, and writes nothing to `PRIORITIES.md`                                |
| Normal     | A record conflict whose branch side holds more than links             | it is not a link repair: the agent stops, as for any conflict needing a choice           |
| Niche      | Two agents' note files with the same name from one branch             | the second gets `-2`                                                                     |
| Niche      | A note file with `agent: true` that a line links                      | the line wins: its marks and category, as today                                          |

## Success criteria

- **SC-001** (no conflict): Two branches, each with an agent's note in the same category and a
  finished feature, merge into the default branch without a conflict in `specs/`.
- **SC-002** (one reader): The web UI's inbox, `ura inbox`, and the triage list the same notes for
  the same files.
- **SC-003** (no branch write): No step of the skill writes `PRIORITIES.md` or `INBOX.md` on a
  feature's or a change's branch; a core test fails if `ura note --agent` touches `INBOX.md`.

## Assumptions

The points settled in round 01, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, but for
those about the pull request flow. Round 02's are dropped with the master pull request. Settled
while writing this spec:

- **No mockup**: an agent's note looks exactly like a note with a note file in the inbox, and a
  merged feature's line like a merged feature today. See
  [inbox format](/skills/uraeda/references/inbox.md#the-format).
- **A linked line wins over the file's fields**, so a note file's fields matter only while no line
  links it. See [data model](data-model.md#agents-note-file).
- **Agents' note names start with their slug**, so two branches never add the same file. See
  [data model](data-model.md#agents-note-file).
- **Humans keep writing lines** of `INBOX.md`, on the default branch, where nothing conflicts. See
  [git decision](../decisions/git.md).
- **The start keeps moving its line to the top of Now**, as you confirmed in the session.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: a file format gains three fields, and the inbox's readers change, with no data
converted.
