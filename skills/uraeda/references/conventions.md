# Conventions

The conventions shared by all steps: how workflow files are written, how they track their state, how
the human reviews them, where each feature's branch lives, and how every step commits.

## Markdown

Workflow files must read well as plain text, on GitHub, and in Obsidian, the reference renderer. Use
GitHub Flavored Markdown, plus these extensions, which stay readable where they do not render:

- **Callouts**: `> [!IMPORTANT]`, `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!QUESTION]`.
- **Typed bullets**, with a word or sign that reads on its own: `- [pro]`, `- [con]`, `- [?]`
  question, `- [!]` important.
- **List callouts**, a marker after the dash, to highlight one bullet: `- ! warning`,
  `- ? question`, `- & note`.
- **Links**: markdown links, with a relative path (`[spec](spec.md)`) or a path from the repository
  root (`[auth](/src/auth.ts)`). Humans may write wikilinks (`[[due-dates]]`): read them, but do not
  write them. Link to what a file relies on: decisions, discovery, code.
- **Story links**: a link to a `*.stories.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, or `.svelte` file,
  from the repository root or relative, then `#` and the story's export name, an ASCII identifier:
  `[Repeat menu, open](/src/tasks/RepeatMenu.stories.tsx#Open)`. With an active preview decision, a
  story link alone in its paragraph shows the story live in Uraeda, and anywhere else opens it in
  Storybook. A variant's story link is a paragraph of its option.
- **Images**: `![alt](images/name.webp)`, saved in the `images/` folder next to the file, and
  committed with it. Each is re-encoded once as WebP, with no metadata and at most 2576 pixels on
  its long edge (JPEG and lossy WebP at quality 80, the rest near-lossless); an animated GIF stays a
  `.gif`, without metadata. A draft or backlog file that gets an image becomes a folder,
  `<slug>/proposal.md`, and links to it follow. When you commit a human's file, delete the images of
  its folder that no file there links to; starting a feature moves them all, unchanged.

Templates are strict where tools and agents need to find things, and free elsewhere:

- **Frontmatter**: exactly the fields this skill defines.
- **Headings**: the template's text, level, and order. Leave out an optional section entirely, never
  rename it.
- **Optional sections**: in the templates, their placeholder starts with `[Optional`.
- **Structured items**: fixed patterns, so they can be found and rendered: questions `## Q1: ...`,
  numbered from Q1, each with its `**Answer:**` line, and follow-ups `### Q1.B: ...`, on an option
  of their parent; options `- **A (recommended). ...**` with `[pro]` and `[con]` bullets; user
  stories `### US1: Title (P1)`; acceptance scenarios with **Given**, **When**, **Then**; success
  criteria `SC-001`; plan tasks `## Task 1: ...`; rulings `## R1: ...`; review comments
  `## C1: ...`.
- **Everything else**, inside sections, is free text.

With `ura`, run `ura check` before every commit of workflow files: it verifies the rules of this
file, and reports each problem with its file and line. In short: folder names `YYYY-MM-DD-<slug>`
with a real date, and rounds with two digits; the frontmatter fields of each file, with the values
of the [status table](#workflow-status), `plan-review` `true` or `false`, a spec's `clarifications`
at most its last round, and a plan's `spec-revision` at most the spec's `revision`; the template's
title, sections, and order, and no level-2 section the template does not have; the structured items
above; an answer for every question that applies once a round is `answered`; the `> [!IMPORTANT]`
block of a file waiting for the human; a record's name, `YYYY-MM-DD-<slug>.md`, its `finished` date,
its numbered rounds and questions, and its opening `> [!NOTE]` block; `PRIORITIES.md`'s `## Now`,
`## Next`, `## Later`, and `## Blocked`; `specs/INBOX.md`'s title, `# Inbox`, and each non-empty
category named once, when the file exists; `specs/INBOX-TRIAGE.md` as a round of questions, with its
template's title and sections, its `status`, its answers, and its block; links and images to
markdown files and into `specs/` that resolve, anchors included, except links from `PRIORITIES.md`
and `INBOX.md` into a started feature's or change's folder, whose files live on its branch; the
[review files](#review-files) rules; and the preview decision's two fields, both or neither, a
`preview-folder` that is `.` or a relative path without `..`, and a `preview-command` holding
`{port}`.

## Workflow status

Workflow files track their state in frontmatter fields.

| File                   | Field             | Set by the agent                      | Set by the human                  |
| ---------------------- | ----------------- | ------------------------------------- | --------------------------------- |
| `proposal.md`          | `discovery`       |                                       | `low`, `medium`, or `high`        |
| `clarifications-NN.md` | `status`          | `awaiting-human`                      | `answered`                        |
| `spec.md`              | `status`          | `awaiting-human`                      | `approved` or `changes-requested` |
| `spec.md`              | `revision`        | `1`, then `+1` at every change        | `+1` when editing it              |
| `spec.md`              | `clarifications`  | the last round it includes: `2`       |                                   |
| `spec.md`              | `risk-tier`       | `low`, `medium`, or `high`            | may change it on approval         |
| `spec.md`              | `plan-review`     | `false`                               | may change it on approval         |
| `plan.md`              | `status`          | `awaiting-human` or `auto-approved`   | `approved` or `changes-requested` |
| `plan.md`              | `spec-revision`   | the spec `revision` it implements     |                                   |
| `decisions/*.md`       | `status`          | `proposed`, then `active` on approval | `active`                          |
| `decisions/*.md`       | `approved-by`     | the approver, on approval, if known   | the approver                      |
| `INBOX-TRIAGE.md`      | `status`          | `awaiting-human`                      | `answered`                        |
| `decisions/preview.md` | `preview-folder`  | where Storybook runs: `.`, `web`      |                                   |
| `decisions/preview.md` | `preview-command` | its command, with `{port}`            |                                   |

A change's folder has no other status: its rounds are `clarifications-NN.md`, as a feature's are.
See [Change](change.md).

Only set a human status when the human expressly asks you to in the session, for example "the spec
is approved". Commit with the message `ura` would write, `spec(recurring-tasks): approve`, and say
so in its body: "Approved by the human in chat." When the human changes a spec's `risk-tier` on
approval without naming `plan-review`, set `plan-review` to `false`. With `ura`, pass `--no-commit`
to `ura answer` or `ura review`, and commit with that message and body. With `changes-requested`,
the human's feedback is in the file's [review file](#review-files).

## Review files

A review of `spec.md` or `plan.md` writes its comments in `spec-review.md` or `plan-review.md`, next
to it, from [the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/spec-review.md). The
file exists only when the latest review has comments: the next review replaces it, and a review
without comments deletes it. Git keeps the earlier ones. The reviewed file keeps its `status`, the
source of truth.

- **Frontmatter**: `verdict`, `pending` while the human writes it, then `approved` or
  `changes-requested`; and `commit`, the short hash of the commit holding the version reviewed.
- **Comments**: `## C1: ...`, numbered from C1. A comment points to
  `Lines 50–52, under "<heading>"`, `Line 50, under "<heading>"`, or `General`: the line numbers are
  those of the version at `commit`, and the heading is the nearest one above them. A line comment
  quotes its lines, as a quote block, then says what it has to say.
- **A comment on a story**, written from Uraeda, starts with `Story <file name>#<export>`. When the
  human picked an element, `, <phone or desktop>, <role> “<name>”` follows: the width only while
  both showed, and the role alone when the element has no name. Then `: ` and the text:
  `Story RepeatMenu.stories.tsx#Open, phone, button “Weekly”: Too small to tap.` On a question's
  variant, the same line is added to its answer, and in a session to the human's message.
- **Changes requested** need at least one comment.
- **Approved with comments**: the comments do not change the approved file. The next step carries
  them out, and says how: the plan, in its `## Review comments` section, for a spec; the
  implementation, in the pull request's description, for a plan.

With `ura`, `ura review` writes the comments, `--comment 50-52 "<text>"` or
`--comment general "<text>"`, then records the verdict, `--approve` or `--request-changes`, with the
status, the block's record, and the commit.

## Branches

Each feature lives on its own branch, named after its folder (`2026-10-06-recurring-tasks`), from
the proposal to the code: discovery, questions, spec, decisions, plan, and implementation, until its
folder is [finished](projects.md#finishing-a-feature) into a record. Its pull request merges all of
it at once. Decisions become active on the branch when its spec is approved, and bind the rest of
the project once the branch is merged. A change lives on `change/YYYY-MM-DD-<slug>`, named after its
folder, `specs/changes/YYYY-MM-DD-<slug>/`. Run every step on the target's branch: the human answers
and approves on it too.

Never switch the human's checkout to reach a branch. Write where the branch is checked out, the
checkout itself or a worktree, or else in a worktree at `.worktrees/<branch>/`, at the root of the
main checkout, created with `git worktree add`; `ura start` creates a started item's at
`.worktrees/<folder>/`. Keep `.worktrees/` out of `git status` through the repository's
`.git/info/exclude`, never a tracked file. When `core.hooksPath` is a relative path, commit in a
worktree with it made absolute from the main checkout, so the same hooks run. Worktrees stay until
removed with `git worktree remove`. `ura` does all of this.

## Commits

One commit per step, and one per task during the implementation, plus one for a task's structural
step, containing only its files. Messages follow
[Conventional Commits](https://www.conventionalcommits.org/), with one extra type per workflow step.
The scope is the feature's or the change's slug, its folder's name without the date. The description
is the feature name for a first version, and what changed for later commits.

| Type         | Step                                     | Example                                            |
| ------------ | ---------------------------------------- | -------------------------------------------------- |
| `discovery:` | A discovery and questions round          | `discovery(recurring-tasks): recurring tasks`      |
| `decision:`  | Apply approved decisions                 | `decision(recurring-tasks): apply due dates`       |
| `spec:`      | Write or revise a spec and its decisions | `spec(recurring-tasks): recurring tasks`           |
| `plan:`      | Write or revise a plan                   | `plan(recurring-tasks): split the store migration` |
| `finish:`    | Replace the folder with its record       | `finish(recurring-tasks): recurring tasks`         |

Code commits use the plan's messages, with the standard types and the same scope:
`feat(recurring-tasks): repeat menu`. A change has no plan: its code commits use `fix(<slug>):` for
a bug and `feat(<slug>):` for a change, `fix(tasks-reappear): save new tasks as they are`; its
rounds use `discovery(<slug>):`, and an approved change to a decision
`decision(<slug>): apply <topic>`.

The human's commits, and the agent's when the human asks, use the step's type for what they answer
and `chore:` for the rest. `ura` and the web UI write the same messages.

| Commit                         | Example                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| Answer a round of questions    | `discovery(recurring-tasks): answer round 01`                                                       |
| Approve, or request changes    | `spec(recurring-tasks): approve`, `plan(recurring-tasks): request changes`                          |
| A draft, then its edits        | `chore: draft Recurring tasks`, `chore: edit the draft Recurring tasks`                             |
| A backlog file, then its edits | `chore: add Benchmarks to the backlog`, `chore: edit Benchmarks in the backlog`                     |
| A proposal, then its edits     | `chore(recurring-tasks): proposal`, `chore(recurring-tasks): edit the proposal`                     |
| Start, postpone                | `chore(recurring-tasks): start Recurring tasks`, `chore(recurring-tasks): postpone Recurring tasks` |
| `PRIORITIES.md` alone          | `chore: move "Recurring tasks" to Next`                                                             |
| A note                         | `chore: add "Sort completed tasks" to the inbox`                                                    |
| `INBOX.md`, and where notes go | `chore: move "Sort completed tasks" from the inbox to Next`                                         |
| The inbox triage               | `chore: propose an inbox triage`, `chore: answer the inbox triage`, `chore: apply the inbox triage` |
| Notes moved into the inbox     | `chore: move the scratchpad to the inbox`                                                           |

A commit of `PRIORITIES.md` alone names its one change: `add "<entry>" to <section>`,
`remove "<entry>"`, `edit "<entry>"`, `move "<entry>" to <section>`, or
`move "<entry>" within <section>`, with the start of the entry's text. With more changes, the
subject names the first one and ends with `, and <count> more`, and the body lists every change, one
per line: `- Add to Now: <entry>`.

A commit of `INBOX.md`, with the `PRIORITIES.md` and drafts its notes went into, names its changes
the same way: `add "<note>" to the inbox`, `edit "<note>" in the inbox`,
`remove "<note>" from the inbox`, `move "<note>" to <Category> in the inbox`,
`move "<note>" from the inbox to <Section>`, or `move "<note>" from the inbox to the draft <title>`.
See [Inbox](inbox.md).

The commit type is only a label: the `status` fields and the checkboxes are the source of truth.
