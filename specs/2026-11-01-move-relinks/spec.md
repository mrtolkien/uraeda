---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Moving a file never breaks a link to it

> [!NOTE]
>
> Approved on 2026-11-01.
>
> - You approve every core move rewriting the links to the moved file across `specs/`, and
>   `ura check --fix` repairing links a merge broke, from git's history, with a Fix button in the
>   web UI.
> - The Fix button writes the files and never commits: the repair waits on the commit page, as one
>   "Repair links" line per file.
> - A link to a deleted file loses its link and keeps its words, in records too.
> - On the default branch, nothing repairs a broken link by itself: you, an agent, or the next
>   branch to merge does.
> - Risk tier medium: the rewrite edits files you wrote, frozen records included, from many moves.

Workflow files move: a proposal starts, a note becomes a proposal, a change becomes a feature, a
folder becomes its record. Each move left the old path in every file but `PRIORITIES.md` and
`INBOX.md`, and `ura check` failed on the default branch until someone fixed the link by hand: six
times in two days. This feature makes every move rewrite the links to it, and makes a link broken by
a move on another branch a one-command repair, in the terminal or the web UI. See the
[proposal](proposal.md), the [discovery](discovery-01.md), and the
[clarifications](clarifications-01.md).

## Decisions

No new, changed, or removed decision.

Relied on:

| Decision                                       | What it means for this spec                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Git](../decisions/git.md)                     | History is read through `git` from the core's git module; no tool commits a repair. |
| [Problems](../decisions/problems.md)           | A broken link stays an error in `ura check` and a note on the item's page.          |
| [CLI](../decisions/cli.md)                     | Every repair rule is written in the skill, and `--fix` prints stable JSON.          |
| [Testing](../decisions/testing.md)             | The core's moves and the history lookup are git and stored text: they get tests.    |
| [Preview](../decisions/preview.md)             | The Fix button's mockup is a story of the real `Notes` component.                   |
| [Documentation](../decisions/documentation.md) | `docs/`'s CLI page gains `--fix`.                                                   |

## User stories

### US1: A move rewrites every link to the moved file (P1)

You start a proposal, give a note's file to a proposal, attach an image, or make a change a feature.
Every file of `specs/` that linked the moved file now links where it went, in the same commit as the
move, or waiting on the commit page when the move does not commit.

Key scenarios:

1. **Given** `specs/done/2026-10-10-cli-core.md` links `[the draft](../proposals/cli-tuis.md)`,
   **When** you start `cli-tuis.md` as the feature `2026-11-10-cli-tuis`, **Then** the start commit
   holds the record with `[the draft](../2026-11-10-cli-tuis/proposal.md)`.
2. **Given** the same start, **When** a hook refuses its commit, **Then** the record is back as it
   was, with the proposal file.
3. **Given** you have uncommitted edits in `specs/done/2026-10-10-cli-core.md`, **When** you start
   `cli-tuis.md`, **Then** its link is rewritten in place, and the record stays out of the start
   commit, with your edits.

More scenarios:

1. **Given** `specs/ui/flows.md` links `/specs/proposals/inbox-screenshots.md#why`, **When** you
   attach an image to it, **Then** the link reads
   `/specs/proposals/inbox-screenshots/proposal.md#why`, and the commit page holds
   `- Repair links: flows.md`.
2. **Given** a record links `/specs/notes/dark/note.md`, **When** you add that note to the proposal
   file `look.md`, **Then** the link points at `/specs/proposals/look.md#dark`, its subsection in
   `## Notes`.
3. **Given** a note's move rewrote a record's link, **When** you undo the move, **Then** the
   record's link is back, unless you edited the record since.
4. **Given** a record links `/specs/changes/2026-11-02-login/proposal.md`, **When** the change
   becomes a feature, **Then** the link reads `/specs/2026-11-02-login/proposal.md`, on the default
   branch and on the branch.

### US2: `ura check` says where a file went, and `--fix` repairs the link (P1)

A merge on the forge breaks a link that no move could reach. `ura check` names where the file went,
from git's history, and `ura check --fix` rewrites every such link, without committing.

Key scenarios:

1. **Given** `specs/done/2026-10-30-inbox-again.md` links
   `/specs/2026-10-30-proposal-start/proposal.md`, and that folder merged as its record, **When**
   you run `ura check specs`, **Then** it prints
   `specs/done/2026-10-30-inbox-again.md:88: no file /specs/2026-10-30-proposal-start/proposal.md: it became the record /specs/done/2026-10-30-proposal-start.md`.
2. **When** you run `ura check specs --fix`, **Then** the link reads
   `/specs/done/2026-10-30-proposal-start.md`, it prints
   `fixed specs/done/2026-10-30-inbox-again.md: 1 link`, nothing is committed, and the check passes.
3. **Given** a record links `[Dark mode](/specs/2026-11-05-dark-mode/proposal.md)`, and Dark mode
   was dropped in `a1b2c3d`, **When** you run `ura check specs`, **Then** it says
   `no file /specs/2026-11-05-dark-mode/proposal.md: deleted in a1b2c3d (chore(dark-mode): drop Dark mode)`,
   and `--fix` leaves the words `Dark mode` without their link.

More scenarios:

1. **Given** a link to `../2026-10-10-cli-core/clarifications-01.md#q6-how-does-ura-run-git`, and
   the folder merged as its record, **When** you run `--fix`, **Then** it reads
   `../done/2026-10-10-cli-core.md#q6-how-does-ura-run-git`.
2. **Given** a link to `/specs/proposals/proposal-start-flow.md`, edited before its start so that
   only 36% of it matched, **When** you run `--fix`, **Then** it reads
   `/specs/done/2026-10-30-proposal-start.md`, through the start and the finish.
3. **Given** a link to `/specs/proposals/gone.md`, a file that never existed in the history,
   **When** you run `--fix`, **Then** the link stays, and `ura check` keeps reporting `no file …`.

### US3: The workflow runs the repair at the catch-up and the finish (P2)

An agent's catch-up rebases its branch on the default branch, then runs `ura check --fix`, and
commits the repairs with the catch-up. The finish step rewrites the links into its own folder, then
runs the fix for the rest. Without `ura`, the skill gives the same rules to follow by hand.

Key scenarios:

1. **Given** the branch `2026-11-12-themes` links `/specs/proposals/cli-tuis.md` in its spec, and
   `cli-tuis.md` started on the default branch, **When** the agent catches up, **Then** its catch-up
   commit holds the spec linking `/specs/2026-11-10-cli-tuis/proposal.md`.
2. **Given** the finish of `2026-11-12-themes`, **When** the agent writes its finishing commit,
   **Then** it holds no link that `ura check --fix` would change.

### US4: Fix moved links from the web UI (P3)

A done feature's page lists its record's broken links in its format notes, each saying where its
file went. "Fix moved links" rewrites them in the default branch's files, and the commit waits on
the commit page, like the inbox's edits.

[Format notes, with moved links](/packages/web/src/feature/Notes.stories.tsx#MovedLinks)

[Format notes, on a branch](/packages/web/src/feature/Notes.stories.tsx#OnABranch)

Key scenarios:

1. **Given** the page of Inbox again, whose record has 2 fixable notes and 1 sentence note, **When**
   you open its format notes, **Then** "Fix moved links" shows above them.
2. **When** you press "Fix moved links", **Then** the record is rewritten, nothing is committed, the
   2 notes leave, and the commit page holds `- Repair links: 2026-10-30-inbox-again.md`.
3. **Given** a feature still on its branch, with a moved link in its spec, **When** you open its
   format notes, **Then** the note says where the file went, without the button.

## Replaced behaviour

- **A core move leaves every file but `PRIORITIES.md`, `INBOX.md`, and the moved files as they
  were.** Guarded by no test: the plan lists any it meets.
- **The commit page holds only the inbox, the priorities, and proposal and note files.** Guarded by
  no test found: the plan lists any it meets in `crates/core/tests/inbox_moves.rs`.

## Architecture

One rewrite, already in [`retarget.rs`](/crates/core/src/files/retarget.rs), applied to every file
of `specs/` with a list of moves. Each core move knows its own moves; `--fix` and the Fix button
find theirs in git's history. See
[discovery](discovery-01.md#the-proposals-path-and-existing-actions).

- **The link rewrite** points each link of a file to a moved file at its new path, and turns a link
  to a deleted file into its words. It owns the link's form: rooted or relative, its anchor, title,
  and `<…>` kept.
- **The move finder** reads where each missing path went, from the history of the commit the check
  reads: git's renames, a start commit's single deleted proposal paired with its added
  `proposal.md`, a finished folder's record, a change made a feature, chained to the end, or the
  commit that deleted it. It owns "where a file went", and reads history only for a broken link.
- **The relinker** runs the rewrite over every file of `specs/` in a checkout, for a list of moves.
  It returns each file's text before, for a hook's refusal or an Undo to put back while unchanged. A
  file with uncommitted edits is rewritten, and left out of the move's commit.
- **The core's moves** (start, single file to folder, note to proposal, note merged into a proposal
  file, change to feature) call the relinker with their moves, and add the files it changed to their
  commit or their deferred write.
- **The check** names the destination in `links.file`'s message, and marks the result fixable.
- **The fix** runs the move finder and the relinker over a folder, and writes without committing.
  `ura check --fix` and the server's Fix mutation call it.
- **The commit page's list** holds each file of `specs/` whose only change since the last commit is
  link destinations, as `- Repair links: <file>`.
- **The Notes pane** shows "Fix moved links" for the default branch's files when a note is fixable.
- **The skill** gives the rules by hand: [finish](/skills/uraeda/references/finish.md),
  [projects](/skills/uraeda/references/projects.md) for postpone and drop,
  [implementation](/skills/uraeda/references/implementation.md)'s catch-up, and
  [cli](/skills/uraeda/references/cli.md).

Tradeoffs:

- The default branch stays red between a forge merge and the next repair.
- A link to a deleted file loses its target for good: `git log -- <path>` still finds the file.
- A file with your edits is repaired in place, but its repair commits with your edits, not the move.

## Edge cases

| Importance | Situation                                                            | What happens                                                            |
| ---------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| High       | A hook refuses a move's commit                                       | every rewritten file is put back, unless edited since                   |
| High       | A file linking the moved file has uncommitted edits                  | rewritten in place, left out of the move's commit                       |
| High       | Undo of a note's move or of a single file made a folder              | the rewritten links go back, unless the file was edited since           |
| Normal     | A link to a deleted file                                             | `--fix` keeps its words, without the link; the message names the commit |
| Normal     | A link to a finished folder's question                               | the record, the question's anchor kept                                  |
| Normal     | A link to a finished folder's other section, like a discovery topic  | the record, without an anchor                                           |
| Normal     | A proposal edited below git's rename threshold before its start      | found through the start commit's pairing                                |
| Normal     | A path that never existed in the history                             | left as is, still reported                                              |
| Normal     | Two branches repair the same link                                    | identical bytes on both, which merge without conflict                   |
| Niche      | A link from `PRIORITIES.md` or `INBOX.md` to a feature on its branch | still excused, as today                                                 |
| Niche      | An image link to a deleted file                                      | its alt text stays                                                      |
| Niche      | A wikilink to a moved file                                           | reported, never rewritten                                               |

## Success criteria

- **SC-001** (the six incidents): replayed on a fixture repository, `ura check specs --fix` leaves
  no `links.file` result.
- **SC-002** (every move): each core move, with a record linking the moved file, leaves no
  `links.file` result in `specs/`.
- **SC-003** (no history when clean): `ura check specs` with no broken link starts no extra `git`
  process.
- **SC-004** (one history read): with broken links, `ura check specs` adds one history read, under 1
  second on this repository.
- **SC-005** (deterministic): two runs of `--fix` from the same tree write identical bytes.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there. Settled
while writing this spec:

- **The Fix button** repairs every fixable link of the item's files at once: a pane-wide button, as
  [surfaces](/specs/ui/surfaces.md) keeps per-row actions for selectable rows.
- **The button shows for the default branch's files only**: the commit page commits the default
  branch, and a branch's links are its agent's catch-up.
- **The commit page finds repairs by their content**, a file whose only change is link destinations,
  so nothing is held in memory between the Fix and the commit.
- **`--fix` exits as the check after it**: zero when nothing is left, and its JSON adds a `fixed`
  list of files and link counts.
- **The finish step keeps its own anchor rule** for links into its folder, which it still holds,
  then runs `--fix` for the rest. See
  [finish](/skills/uraeda/references/finish.md#rewrite-the-links).
- **Postpone and drop stay by hand**, with `ura check --fix` named in their steps.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: no new data format, but the rewrite edits human-written files, frozen records included,
from six moves and a new UI action.
