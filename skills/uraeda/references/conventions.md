# Conventions

What every step shares: how workflow files are written and track their state, how the human reviews
them, where each feature's branch lives, and how every step commits.

## Markdown

Workflow files read well as plain text, on GitHub, and in Obsidian. Use GitHub Flavored Markdown,
plus these extensions, which stay readable where they do not render:

- **Callouts**: `> [!IMPORTANT]`, `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!QUESTION]`.
- **Typed bullets**: `- [pro]`, `- [con]`, `- [?]` question, `- [!]` important.
- **List callouts**, to highlight one bullet: `- ! warning`, `- ? question`, `- & note`.
- **Links**: markdown links, with a relative path (`[spec](spec.md)`) or a path from the repository
  root (`[auth](/src/auth.ts)`). Humans may write wikilinks (`[[due-dates]]`): read them, but do not
  write them.
- **Story links**: a link to a stories file, then `#` and the story's export name:
  `[Repeat menu, open](/src/tasks/RepeatMenu.stories.tsx#Open)`. With an active preview decision, a
  story link alone in its paragraph, with a blank line before and after, is a mockup, drawn live by
  a tool that shows the preview. Link each story you wrote or changed this way in your reports too.
- **Diagrams**: a fenced code block whose language is `mermaid`: a `flowchart`, a `sequenceDiagram`,
  or a `stateDiagram-v2`. Never an image of a diagram, or an ASCII drawing.
- **Images**: `![alt](images/name.webp)`, in the `images/` folder next to the file, committed with
  it, re-encoded once as WebP without metadata, at most 2576 pixels on its long edge. An animated
  GIF stays a GIF. A proposal or note file that gets an image becomes a folder, `<slug>/proposal.md`
  or `<slug>/note.md`.

Templates are strict where tools and agents need to find things, and free elsewhere:

- **Frontmatter**: exactly the fields this skill defines.
- **Headings**: the template's text, level, and order. Leave out an optional section entirely, never
  rename it. In the templates, an optional section's placeholder starts with `[Optional`.
- **Structured items** follow fixed patterns:
  - questions `## Q1: ...`, each with its `**Answer:**` line, and follow-ups `### Q1.B: ...`;
  - options `- **A (recommended). ...**` with `[pro]` and `[con]` bullets;
  - settled points starting with a bold subject, under `## Check these` or
    `## Settled without the human`;
  - user stories `### US1: Title (P1)`, their scenarios in a "Key scenarios:" list and an optional
    "More scenarios:" list, each with **Given**, **When**, **Then**;
  - success criteria `- **SC-001** (<measure>): <outcome>.`, the measure optional;
  - edge cases as a table whose importance is `High`, `Normal`, or `Niche`;
  - a spec's answers to its last review, `- **C2** (<the comment>): <done or declined>. <what>.`;
  - a spec's decisions, `- **New: [<title>](../decisions/<name>.md)**. <rule>`, the same with
    `Changed:`, and ``- **Removed: <title>** (`<name>.md`). <why>``;
  - plan tasks `## Task 1: ...`, rulings `## R1: ...`, review comments `## C1: ...`.
- **Everything else**, inside sections, is free text.

With `ura`, run `ura check` before every commit of workflow files: it verifies these rules, the
links, and the limits of [Writing for the human](writing.md), and reports each problem with its file
and line.

## Workflow status

Workflow files track their state in frontmatter fields.

| File                   | Field             | Set by the agent                      | Set by the human                                  |
| ---------------------- | ----------------- | ------------------------------------- | ------------------------------------------------- |
| `proposal.md`          | `discovery`       |                                       | `low`, `medium`, or `high`                        |
| `clarifications-NN.md` | `status`          | `awaiting-human`                      | `answered`                                        |
| `clarifications-NN.md` | `resumes`         |                                       | `implementation`, on a round asked while building |
| `spec.md`              | `status`          | `awaiting-human`                      | `approved` or `changes-requested`                 |
| `spec.md`              | `revision`        | `1`, then `+1` at every change        | `+1` when editing it                              |
| `spec.md`              | `clarifications`  | the last round it includes: `2`       |                                                   |
| `spec.md`              | `risk-tier`       | `low`, `medium`, or `high`            | may change it on approval                         |
| `spec.md`              | `plan-review`     | `false`                               | may change it on approval                         |
| `plan.md`              | `status`          | `awaiting-human` or `auto-approved`   | `approved` or `changes-requested`                 |
| `plan.md`              | `spec-revision`   | the spec `revision` it implements     |                                                   |
| `decisions/*.md`       | `icon`            | a Lucide icon name, like `git-branch` | may change it                                     |
| `INBOX-TRIAGE.md`      | `status`          | `awaiting-human`                      | `answered`                                        |
| `decisions/preview.md` | `preview-folder`  | where the preview runs: `.`, `web`    |                                                   |
| `decisions/preview.md` | `preview-command` | its command, with `{port}`            |                                                   |

A decision has no status: the one on the default branch is in force. A branch that creates or
changes a decision edits it in place, and the default branch keeps its text until the branch merges.
The human approves the difference with the spec, or in a change's round.

**Set a human status only when the human expressly asks you to in the session**, "the spec is
approved". Commit with the message a tool would write, `spec(recurring-tasks): approve`, and say so
in its body: "Approved by the human in the session." A gate the human waived is recorded the same
way, in their words. With `ura`, pass `--no-commit` to `ura answer` or `ura review`, and commit with
that message and body.

## A file in an old format

When a workflow file of the target fails `ura check` because the skill changed its format, rewrite
it from its template first, keeping its content and the human's words exactly. Commit it on its own,
`chore(<slug>): rewrite <file> in the new format`, then run the step.

## Review files

A review of `spec.md` or `plan.md` writes its comments in `spec-review.md` or `plan-review.md`, next
to it, from [the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/spec-review.md). The
file exists only when the latest review has comments: the next review replaces it, and git keeps the
earlier ones. The reviewed file keeps its `status`, the source of truth.

- **Frontmatter**: `verdict`, `pending` while the human writes it, then `approved` or
  `changes-requested`; and `commit`, the short hash of the version reviewed.
- **Comments**: `## C1: ...`, numbered from C1. A comment points to
  `Lines 50–52, under "<heading>"`, `Line 50, under "<heading>"`, or `General`, and quotes its lines
  as a quote block, then says what it has to say.
- **A comment on a decision** the spec lists points into the decision's file:
  `## C4: Decision task-storage, lines 20–21, under "Rules"`. The lines are the decision file's at
  `commit`, on the branch. A comment on a part the branch removed points to the default branch's
  lines, with `removed` after them.
- **A comment on a story** starts with `Story <file name>#<export>`, then the element picked, when
  one was: `Story RepeatMenu.stories.tsx#Open, phone, button “Weekly”: Too small to tap.`
- **Changes requested** need at least one comment.
- **Approved with comments**: the comments do not change the approved file. The next step carries
  them out, and says how: the plan for a spec's, the pull request for a plan's. A comment that
  answers a block item, or adds a case, does not need a request for changes.

With `ura`, `ura review` writes the comments, `--comment 50-52 "<text>"`, then records the verdict,
`--approve` or `--request-changes`.

## Branches

Each feature lives on its own branch, named after its folder (`2026-10-06-recurring-tasks`). The
proposal is committed on the default branch when the feature
[starts](projects.md#starting-postponing-and-dropping-a-feature), and the branch starts from there.
It holds everything after: discovery, questions, spec, decisions, plan, and code, until its folder
is [finished](finish.md) into a record. Its pull request merges all of it at once. A change lives on
`change/YYYY-MM-DD-<slug>`, with its folder in `specs/changes/`. Run every step on the target's
branch: the human answers and approves on it too.

**A branch never writes `PRIORITIES.md` or `INBOX.md`.** The human writes them on the default
branch, so parallel branches never conflict there. An agent's note is a
[note file of its own](inbox.md#agents-notes).

**Never switch the human's checkout to reach a branch.** Write where the branch is checked out, the
checkout itself or a worktree, or else in a new worktree at `.worktrees/<branch>/`, at the root of
the main checkout, created with `git worktree add`. Keep `.worktrees/` out of `git status` through
`.git/info/exclude`, never a tracked file. When `core.hooksPath` is a relative path, commit in a
worktree with it made absolute from the main checkout, so the same hooks run. A new worktree has
none of the project's dependencies: set it up as the project asks before running anything in it.
`ura start` does all of this.

## Commits

One commit per step, holding only its files, and one per task during the implementation, plus one
for a task's structural step. The description is the feature's name for a first version, and what
changed after. Messages follow [Conventional Commits](https://www.conventionalcommits.org/), with
one extra type per workflow step. The scope is the feature's or the change's slug, its folder's name
without the date.

| Type         | Step                                         | Example                                            |
| ------------ | -------------------------------------------- | -------------------------------------------------- |
| `discovery:` | A round of questions, and its research       | `discovery(recurring-tasks): recurring tasks`      |
| `spec:`      | Write or revise a spec and its decisions     | `spec(recurring-tasks): recurring tasks`           |
| `plan:`      | Write or revise a plan                       | `plan(recurring-tasks): split the store migration` |
| `review:`    | Commit a review's findings, `findings-NN.md` | `review(recurring-tasks): findings 02`             |
| `finish:`    | Replace the folder with its record           | `finish(recurring-tasks): recurring tasks`         |

Code commits use the plan's messages, with the standard types and the same scope:
`feat(recurring-tasks): repeat menu`. A change's code commits use `fix(<slug>):` for a bug and
`feat(<slug>):` for a change. A commit that waits for the human has the block's first line as its
body.

A human's status is committed as `discovery(<slug>): answer round 01`, `spec(<slug>): approve`, or
`plan(<slug>): request changes`. The messages a tool writes for the human's other commits, on the
priorities, the inbox, and the proposals, are in
[By hand](by-hand.md#commits-a-human-or-a-tool-makes).

The commit type is only a label: the `status` fields and the checkboxes are the source of truth.
