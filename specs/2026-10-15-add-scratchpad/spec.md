---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Inbox

> [!NOTE]
>
> Approved on 2026-10-15.
>
> - **One changed decision, git**: `INBOX.md` and `INBOX-TRIAGE.md` join the drafts and
>   `PRIORITIES.md` as files every tool writes on the default branch, from any checkout.
> - **Provenance marks, my reading of your Q5 and Q7 answers.** A note can start with `[agent]` and
>   with the slug of the feature it is about, like `[run-ui]`. I chose `[agent]` over `[claude]`
>   because the repository's authorship rule forbids naming an agent in files. I chose a slug over a
>   link because a link from the default branch into a feature's folder breaks until it merges (your
>   own scratchpad's Marksman note). A PR number is not a mark: the slug finds the PR.
> - **Your note "Three bugs: Remove them"**, read as: no fix of their own. They go away with the
>   `## Scratchpad` section, which leaves `PRIORITIES.md`.
> - **Moving today's scratchpad** happens in this feature's last commit, from the default branch's
>   `PRIORITIES.md` as it is then. That is an exception to "feature branches only remove their own
>   entry", which you may refuse.
> - **One commit bar for the inbox and the priorities.** Inbox edits in the web UI stay uncommitted,
>   like priorities edits today, and one Commit holds both files, with any draft a note went into.
>   `ura note` commits at once, since agents use it.
> - **The top bar's ＋ goes away**, as you asked: the sidebar has a ＋ next to Priorities and
>   another next to Inbox. On a phone, adding a note takes one more tap, to open the menu.
> - **Risk tier `medium`**: a new file format, two pages, a CLI command, an editor command, and an
>   agent run. The plan does not wait for your review.

The inbox is where the human, and agents, write down small things noticed about the software (a
misaligned icon, a confusing command, an idea) without stopping what they are doing. Notes live in
`specs/INBOX.md`, apart from the priorities, since they are not priorities yet, grouped under
categories the human names. Organizing comes later: by hand, with an action per note that turns it
into a priority, a draft, part of an existing draft, or deletes it; or with an agent that proposes
what each note becomes, as questions the human answers. Home shows how many notes wait, so the inbox
does not become the unread pile today's `## Scratchpad` is. See the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Write a note down from anywhere (P1)

While using or reviewing the software, the human taps ＋ next to Inbox in the sidebar, types one
line, optionally picks a category, and goes back to what they were doing. The note is in
`specs/INBOX.md` on the default branch, whatever page or feature they were on.

Why this priority: capture is the proposal's focus, and is useful alone: the human can organize
`INBOX.md` by hand from day one.

Acceptance scenarios:

1. **Given** `INBOX.md` holds `# Inbox` and a `## UI` category with one note, **When** the human
   adds "The plan's task list scrolls under the top bar" in the category "UI", **Then** the line
   `- The plan's task list scrolls under the top bar` is the last note of `## UI`, the toast says
   "Added to the inbox, not committed" with Undo, and the inbox page shows the note under "UI".
2. **Given** the add form is open, **When** the human leaves the category at "No category" and adds
   "We'll need a model selector for each step", **Then** the line goes after the last note before
   the first `##` heading, and the page shows it under "No category".
3. **Given** the add form is open, **When** the human picks "New category…", types "Editor", and
   adds a note, **Then** `## Editor` is added at the end of the file, with the note under it.
4. **Given** the human is on the page of the feature `2026-10-14-run-ui`, **When** they add "The x
   is not centered", **Then** the line is `- [run-ui] The x is not centered`.
5. **Given** the human is in the worktree of the feature `2026-10-15-add-scratchpad`, **When** they
   run `ura note "Status hangs on a broken worktree" --category CLI`, **Then** the note is written
   to the default branch's checkout and committed there with
   `chore: add "Status hangs on a broken worktree" to the inbox`, and the worktree has no change.
6. **Given** `specs/INBOX.md` does not exist, **When** the human adds a note, **Then** the file is
   created as `# Inbox`, a blank line, and the note.
7. **Given** the human just added a note, **When** they press Undo on the toast, **Then** the note
   is removed and `INBOX.md` is as before.

### US2: Organize notes by hand (P1)

On the inbox page, the human opens a note and chooses what it becomes: a priority in a section, a
new draft, a line added to an existing draft, or nothing, deleted. They can also fix its text or
move it to another category. They commit the result when they are done.

Why this priority: the human said they will mostly organize by hand; without it, notes only pile up.

Acceptance scenarios:

1. **Given** the note "Draft to proposal on mobile went 404" under `## UI`, **When** the human
   chooses Move to priorities, then Next, **Then** the note leaves `INBOX.md`, the line
   `- Draft to proposal on mobile went 404` is the last entry of Next in `PRIORITIES.md`, and the
   toast says "Moved to Next, not committed" with Undo.
2. **Given** the note "We need a home icon", **When** the human chooses Make a draft, then Later,
   **Then** `specs/drafts/we-need-a-home-icon.md` is created from the proposal template with the
   note as its title and first paragraph of What, Later ends with a line linking to it, the note
   leaves `INBOX.md`, and the draft opens in the editor.
3. **Given** the draft "Look and feel pass" in `specs/drafts/look-and-feel.md`, **When** the human
   chooses Add to a draft on the note "Icons are blurry on retina screens", then "Look and feel
   pass", **Then** `- Icons are blurry on retina screens` is the last line of the draft's `## What`
   section, the note leaves `INBOX.md`, and the toast says "Added to Look and feel pass, not
   committed" with Undo.
4. **Given** a note, **When** the human chooses Delete, **Then** it leaves `INBOX.md` with no
   question asked, and the toast says "Deleted, not committed" with Undo.
5. **Given** a note under "No category", **When** the human chooses Category, then "UI", **Then**
   the note is the last one of `## UI`.
6. **Given** the human edited a note in place to "Specs are too long", **When** they press Enter,
   **Then** the line's text is replaced, its marks kept.
7. **Given** two notes moved to Next and one deleted, **When** the human presses Commit, **Then**
   one commit holds `INBOX.md` and `PRIORITIES.md`, with the subject
   `chore: move "Draft to proposal on mobile went 404" from the inbox to Next, and 2 more` and a
   body listing the three changes.
8. **Given** a note added to a draft, **When** the human presses Commit, **Then** the commit also
   holds the draft, and names the change
   `move "<note>" from the inbox to the draft Look and feel pass`.

### US3: See that notes wait (P2)

Home shows how many notes the inbox holds, with a link to the inbox page.

Why this priority: it keeps the inbox in view, the safeguard the human chose against an unread pile.

Acceptance scenarios:

1. **Given** `INBOX.md` holds 11 notes, **When** the human opens Home, **Then** an "Inbox" group
   shows "11 notes to organize", which opens the inbox page.
2. **Given** `INBOX.md` holds 1 note, **When** the human opens Home, **Then** it shows "1 note to
   organize".
3. **Given** `INBOX.md` holds no note or does not exist, **When** the human opens Home, **Then** no
   "Inbox" group is shown.

### US4: Have an agent propose what each note becomes (P2)

When the inbox is large or messy, the human presses "Organize with an agent". An agent reads every
note against the code, the priorities, and the drafts, and writes `specs/INBOX-TRIAGE.md`: one
question per note or group of notes, with a recommended outcome. The human answers it like a round
of questions, then presses "Apply the answers", and the agent carries them out in one commit.

Why this priority: the human wants it for when they need it; organizing by hand covers the rest.

Acceptance scenarios:

1. **Given** no `INBOX-TRIAGE.md`, **When** the human presses "Organize with an agent", **Then** a
   chat starts in the main checkout with the message
   `/uraeda:uraeda Organize the inbox, specs/INBOX.md: propose a triage in specs/INBOX-TRIAGE.md, following references/inbox.md. Stop when the triage waits for my answers.`
2. **Given** the agent wrote `INBOX-TRIAGE.md` with `status: awaiting-human`, **When** the human
   opens the inbox page, **Then** a banner says "An inbox triage waits for your answers" with a link
   "Answer it", which opens the file in the questions view, and "Organize with an agent" is
   disabled.
3. **Given** the triage is `answered`, **When** the human opens the inbox page, **Then** the banner
   says "Your triage answers are ready to apply" with a button "Apply the answers", which starts a
   chat with
   `/uraeda:uraeda Apply my answers in specs/INBOX-TRIAGE.md, following references/inbox.md.`
4. **Given** an answered triage moving three notes into the draft "Look and feel pass" and deleting
   two, **When** the agent applies it, **Then** one commit, `chore: apply the inbox triage`, changes
   the draft and `INBOX.md`, and deletes `INBOX-TRIAGE.md`.
5. **Given** a question answered "Bug", **When** the agent applies the triage, **Then** it starts a
   bug from the note, as the bug flow, `skills/uraeda/references/bug.md`, says, since the answer is
   the human asking for it.
6. **Given** a note added to `INBOX.md` after the triage was written, **When** the agent applies the
   triage, **Then** that note stays in the inbox, untouched.

### US5: Let agents write down what they find outside their task (P3)

An agent working on a feature finds a problem outside its task, like a slow page or a confusing
message. It adds a note marked `[agent]` and the feature's slug, in the category that fits, or a new
one, and names the note in its step's report.

Why this priority: it keeps findings that are lost today, but the human's own notes come first.

Acceptance scenarios:

1. **Given** an agent implementing `2026-10-14-session-view` finds that a session of 2,000 messages
   opens in 4 seconds, **When** it runs
   `ura note "Opening a session with 2,000 messages takes 4 s" --agent --about session-view --category UI`,
   **Then** the line `- [agent] [session-view] Opening a session with 2,000 messages takes 4 s` is
   committed under `## UI`.
2. **Given** an agent without `ura`, **When** it notes a finding, **Then** it edits `specs/INBOX.md`
   in the default branch's checkout by hand, with the same marks, and commits that file alone with
   the same message.
3. **Given** the inbox page, **When** it shows an agent's note, **Then** the marks show as tags,
   `agent` in its own colour.

### US6: Capture a note with a screenshot (P3)

A note about the UI often needs an image. In the add form, the human attaches one: the note is saved
as a draft that holds the image, linked from the inbox.

Why this priority: images matter for UI feedback, but a text note covers most cases.

Acceptance scenarios:

1. **Given** the add form with the text "The spec page's headings are body-sized" and the category
   "UI", **When** the human attaches `spec-headings.png`, **Then** the button reads "Add as a draft"
   and the form says "With an image, the note is saved as a draft, linked from the inbox."
2. **Given** that form, **When** the human presses "Add as a draft", **Then**
   `specs/drafts/the-spec-pages-headings-are-body-sized/proposal.md` holds the note as its title and
   first paragraph of What, then `![spec-headings](images/spec-headings.webp)`, the image is
   re-encoded in `images/`, and `## UI` ends with
   `- [The spec page's headings are body-sized](drafts/the-spec-pages-headings-are-body-sized/proposal.md)`.
3. **Given** that linked note, **When** the human moves it to Next, **Then** the Next entry keeps
   the link, as an entry linking a draft does today.

### US7: Write notes from Neovim (P3)

In Neovim, the human runs the plugin's "Add a note" action, types the note and an optional category,
and the language server writes it to the inbox on the default branch.

Why this priority: the human still uses the plugin for priorities, but the web UI and the CLI cover
capture first.

Acceptance scenarios:

1. **Given** Neovim in any checkout of the repository, **When** the human runs the action and types
   "Hints flicker on save", then "Editor", **Then** the note is the last one of `## Editor` in the
   default branch's `INBOX.md`, uncommitted, and the plugin says "Added to the inbox, not
   committed".
2. **Given** `INBOX.md` changed, **When** the human runs the plugin's commit command on it, **Then**
   it is committed with the same messages as the web UI's.

## Edge cases

- **Text that is blank** after trimming: Add stays disabled; `ura note ""` exits 1 with "A note
  needs text."
- **A note of several lines**, typed by hand: a bullet with lines indented under it, sub-bullets
  included, is one note. Tools write one line; moving a multi-line note keeps its lines.
- **Two categories with the same name**, written by hand: `ura check` reports it, and tools add to
  the first.
- **A category left empty** after its last note moves: its heading stays in the file, and the inbox
  page hides it. The add form still offers it.
- **Text in `INBOX.md` that is not a note or a heading**: kept as it is, byte for byte, and not
  shown.
- **`INBOX.md` changed on disk** while the page is open: the page updates live. An edit made from a
  stale page is refused with "INBOX.md changed on disk. Your change was not applied.", and the page
  reloads, as priorities edits do.
- **A move across both files** when either changed on disk: refused the same way, and nothing is
  written.
- **`ura note` while `INBOX.md` has uncommitted changes** in the default branch's checkout: the note
  is written, not committed, and stderr says "INBOX.md had uncommitted changes: the note is written
  but not committed." Exit 0.
- **`ura note` outside a repository with `specs/`**: exit 1, "No specs/ folder here."
- **Undo after the note was changed or moved elsewhere**: refused with "Could not undo: \"<note>\"
  is no longer in INBOX.md.", as ＋ does today for priorities.
- **Discard** on the commit bar: restores `INBOX.md`, `PRIORITIES.md`, and the drafts the commit
  would hold, after the existing "Discard them" confirmation.
- **Make a draft** from a note whose slug exists as a draft: the slug gets `-2`, as `ura draft` does
  today.
- **A note that is a link to a draft** (US6): Make a draft is not offered, since it is one; Delete
  removes the line only, and the draft stays.
- **A triage while one exists**: "Organize with an agent" is disabled, and the agent refuses to
  write a second one.
- **A triage question about a note deleted by hand meanwhile**: the agent skips it and says so in
  the apply commit's body.
- **Removing the inbox**: deleting `INBOX.md` removes the inbox page's notes, the Home group, and
  nothing else; the next note recreates it.
- **A project set up before this feature**: has no `INBOX.md`; `ura check` asks for none, and
  `ura init` run again adds it without touching other files.

## Success criteria

- **SC-001**: Writing a note from any page of the web UI takes one tap on ＋ next to Inbox, the
  text, and Enter, on a wide screen.
- **SC-002**: `ura note` writes and commits a note in under 200 ms on this repository.
- **SC-003**: Moving a note to a priorities section takes three taps from the inbox page: the note,
  Move to priorities, the section.
- **SC-004**: Every edit of the inbox from a tool leaves the rest of `INBOX.md` byte for byte as it
  was.
- **SC-005**: After this feature's last commit, the default branch's `PRIORITIES.md` has no
  `## Scratchpad` section, and `INBOX.md` holds its notes.

## Architecture

The inbox is a second file next to the priorities, built the way the priorities are: the core parses
it and edits it by splicing lines, the binding exposes it, and the server, the web UI, the CLI, and
the language server only call the core ([stack decision](../decisions/stack.md),
[where notes live](discovery-01.md#where-notes-live)). It is written on the default branch, like the
priorities, which the [git decision](../decisions/git.md) is changed to say.

The main units:

- **The inbox file, in the core**: parsing `INBOX.md` into categories and notes, with their marks,
  and the line edits: add, edit, remove, move to a category. One home for the format.
- **Line splicing, shared**: the helpers that find and replace a bullet with its lines, extracted
  from [`files/priorities.rs`](/crates/core/src/files/priorities.rs), which is over the 500-line
  limit and must be split before it changes ([code quality](../decisions/code-quality.md)).
  Priorities and inbox both use them.
- **Inbox actions, in the core**: the edits, checked against the file's hash, and the moves that
  cross files: to a priorities section, into a new draft, into an existing draft. A move writes both
  files only after checking both hashes.
- **One change list**: the diff of the inbox and of the priorities against `HEAD`, merged into one
  list. A note removed from the inbox whose text appears in the priorities or in a draft is one
  move, not a removal and an addition. The commit bar's count, its commit message, and Discard all
  come from it, as for the priorities today.
- **The triage file**: `INBOX-TRIAGE.md`, checked and answered like a round of questions, with its
  own title, through the core's existing clarifications parsing.
- **Capture surfaces**: the web UI's add form, `ura note`, and the language server's note command,
  each a thin caller of the core's add action.
- **The inbox reference, in the skill**: `references/inbox.md`, the source of truth for the file's
  format, capture, organizing, the triage, and agents' notes ([CLI decision](../decisions/cli.md):
  every rule a tool enforces is in the skill).
- **The triage run**: a chat in the main checkout, started from the inbox page with a fixed message,
  as the [agents decision](../decisions/agents.md) says for sessions without a feature. The runner
  needs no new kind of session.

Tradeoffs: two files instead of one make cross-file moves need two hash checks, accepted because
notes are not priorities (Q1). Sharing the priorities' commit bar keeps one way to commit both, at
the cost of one change list built from two diffs. Marks are text, not frontmatter, so a note stays
one line anyone can write by hand.

## Mockups

- [Inbox mockups](mockups/inbox.html), at both widths:
  - 1: the inbox page on a wide screen, a note open in the pane beside it, the sections menu, and
    the commit bar; the sidebar with its two ＋.
  - 2 and 3: the add form, with its category menu, and with an image attached.
  - 4: Home with the inbox's count, and the toast after adding a note.
  - 5 to 8: the inbox page, a note's page, the add form as a sheet, and the empty inbox, on a narrow
    screen.
  - 9: a triage question, in the questions view.

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- Today's scratchpad moves into the inbox, all eleven notes as they are, under "No category". Your
  Q1 answer put notes in their own file, so this happens in the feature's last commit (see below).
- Your note on the three bugs of today's scratchpad: they are removed with the section, not fixed on
  their own. Edits of `INBOX.md` on disk reach the UI live, count on the commit bar, and get named
  commit messages, as US2 and the edge cases say.
- Notes are written on the default branch from any checkout, including while you review a feature's
  branch.
- The inbox is optional: `ura check` does not require `INBOX.md`, and tools create it at the first
  note.
- Parking a note uses the Later section or the backlog, with no snooze.
- A processed note leaves the inbox in the same commit as what it became; a duplicate is deleted or
  added to the same draft.

Settled while writing this spec:

- **Notes without a category** sit between `# Inbox` and the first `##` heading, shown as "No
  category". Categories are `##` headings, in the order the file has them; a new one is added at the
  end ([your Q1 answer](clarifications-01.md#q1-where-do-notes-live)).
- **Marks** are `[agent]`, and the slug of a feature's or a bug's folder, like `[run-ui]`, at the
  start of the note, in that order. The web UI adds the slug when the note is added from a feature's
  page; agents add both ([Q5](clarifications-01.md#q5-may-agents-write-notes),
  [Q7](clarifications-01.md#q7-what-does-a-note-hold-besides-its-text)).
- **Web UI edits stay uncommitted** until Commit, like priorities edits; one commit bar, on both the
  inbox and the priorities pages, commits both files, and the drafts a note went into. `ura note`
  commits at once, since agents run it and must not leave changes behind. The editor command does
  not commit, like its draft command.
- **A note with an image** becomes a draft folder in `specs/drafts/`, created when the human presses
  "Add as a draft", and committed by the commit bar with `INBOX.md`, so the image is committed with
  the file that links it ([attachments decision](../decisions/attachments.md),
  [Q9](clarifications-01.md#q9-how-is-a-note-with-a-screenshot-captured)).
- **Add to a draft** appends the note as a bullet at the end of the draft's `## What` section, where
  past notes went
  ([how notes left the scratchpad](discovery-01.md#the-proposals-path-and-existing-actions)).
- **Make a draft** asks for a priorities section, like Move to priorities, since a draft is reached
  from its priorities entry; it then opens the editor, as the task view's Draft does. The editor's
  commit holds `INBOX.md` too, as it holds `PRIORITIES.md` today.
- **A bug** is not an action of the inbox page: it starts a branch, which the human asks for through
  the triage, or through the bug flow. The
  [bugfixing feature](/specs/done/2026-10-15-add-bugfixing.md), whose spec waits for review,
  replaces bugs with changes started from drafts: whichever feature lands second turns the triage's
  "Bug" outcome into "a draft started as a change"
  ([Q4](clarifications-01.md#q4-what-can-a-note-become)).
- **The triage's questions** offer, per note or group: a priorities section, a new draft, an
  existing draft, a bug, deletion, or keeping it in the inbox. Each question names the notes it
  covers by their text.
- **The triage answering view** is the existing questions view, opened at `/inbox/triage`; the
  triage needs no `ura next` step, since it is started from the inbox page or by asking an agent.
- **The last commit of this feature** moves the default branch's `## Scratchpad` notes into
  `INBOX.md` and removes the section from `PRIORITIES.md`, as it is when the feature finishes, after
  catching up with the default branch. Feature branches otherwise only remove their own entry from
  `PRIORITIES.md`.
- **The sidebar's ＋ buttons** show only when the sidebar is unfolded. Their names are "Add to the
  priorities" and "Add a note to the inbox". The priorities' add form is the one ＋ opened from the
  top bar, unchanged.
- **The Neovim action** asks for the text, then for a category, with an empty answer for none; the
  plugin cannot list categories without parsing the file, which the
  [stack decision](../decisions/stack.md) forbids, so it types the name.
- **`ura init`** copies the `INBOX.md` template with the others.
- **Commit messages** of inbox changes follow the priorities': `add "<note>" to the inbox`,
  `edit "<note>" in the inbox`, `remove "<note>" from the inbox`,
  `move "<note>" to <Category> in the inbox`, `move "<note>" from the inbox to <Section>`, and
  `move "<note>" from the inbox to the draft <title>`, with `chore:`, and `, and N more` with a body
  for several. The triage's: `chore: propose an inbox triage`, `chore: answer the inbox triage`,
  `chore: apply the inbox triage`.

## Decisions

Changed, applied when this spec is approved:

- [Git](../decisions/git.md): `INBOX.md` and `INBOX-TRIAGE.md` are written on the default branch,
  from every tool and from any checkout, like drafts, backlog files, and `PRIORITIES.md`.

Relied on:

- [Stack](../decisions/stack.md): the format, edits, diff, and checks live in the core; the web UI
  draws notes from the core's data; the editor plugin reaches the inbox only through `ura lsp`, with
  an explicit command.
- [CLI](../decisions/cli.md): `ura note` is stated in the skill, prints messages to stderr, and
  exits 1 on errors; it adds no dependency.
- [Attachments](../decisions/attachments.md): images of a note live in its draft's folder, committed
  with it.
- [Agents](../decisions/agents.md): the triage runs as a session without a feature, in the main
  checkout, with the skill loaded and its step in the message.
- [Code quality](../decisions/code-quality.md): `files/priorities.rs` is split first; the marked
  `PrioritiesPage`, `TaskView`, and `Home` functions are split before they grow; the language
  server's new command lives in its own file, since `commands.rs` is at 500 lines.
- [UI behaviour](../decisions/ui-behaviour.md): notes are edited in place; the add form is a short
  form in a dialog; toasts carry Undo; Delete needs no confirmation, since Undo and Discard reverse
  it; leaving the form keeps its text.
- [UI layout](../decisions/ui-layout.md): a note opens in a pane beside the list on wide screens and
  as its own page on narrow ones, at a URL; menus are popovers, and sheets on narrow screens.
- [UI components](../decisions/ui-components.md) and [UI checks](../decisions/ui-checks.md): Astryx
  components only, and browser tests at both sizes, with screenshots in the feature's folder.
- [Repositories](../decisions/repositories.md): the new pages live under `/r/<name>/`.

## Constitution check

| Principle                                  | Complies | Notes                                                                                                              |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------ |
| I. Humans stay in control                  | yes      | Agents only add notes; what a note becomes is the human's choice, by hand or by answering the triage.              |
| II. Git and plain text first               | yes      | Notes are markdown lines in `specs/INBOX.md`; the triage is a markdown file.                                       |
| III. Asynchronous by default               | yes      | Capture and triage end with a commit; the web UI's uncommitted edits are the priorities' existing pattern.         |
| IV. Review effort matches impact           | yes      | Organizing is a few taps per note; the triage asks questions with recommended answers.                             |
| V. Tools are optional                      | yes      | The skill describes the format, capture, and triage by hand; `INBOX.md` has a template, and `ura check` checks it. |
| VI. Code is checked and stays maintainable | yes      | Acceptance tests per story; the priorities parser is split before it changes; no new marker.                       |

## Risk tier

**Medium**: a new file format and a changed decision, new pages, and new commands, but no change to
data users already have beyond moving the scratchpad, and no security surface.

## Details

### Data

`specs/INBOX.md`, on the default branch:

```md
# Inbox

- We'll need a model selector for each step

## UI

- [run-ui] In failures the `x` is not centered in the circle
- [agent] [session-view] Opening a session with 2,000 messages takes 4 s
- [The spec page's headings are body-sized](drafts/the-spec-pages-headings-are-body-sized/proposal.md)

## CLI

- Allow no selection in responses (after a warning)
```

- **Note**: a line starting with `- ` or `* ` at column 0, with the lines indented under it. Its
  text is the line after the marker and the marks. A note linking a draft is a markdown link
  covering its whole text.
- **Marks**: leading groups `[agent]`, then `[<slug>]`, each followed by one space. A slug is
  lowercase letters, digits, and `-`. Any other bracket, like `[!]`, is text.
- **Category**: a `## ` heading; its name is the heading's text. Notes before the first `##` have no
  category. Other headings and text are kept and ignored.

The core's types, exposed through the binding:

- `InboxNote { key: string, id: string, text: string, agent: bool, about: Option<string>, draft: Option<string> }`:
  `key` is the URL key, made like priorities keys from the text's slug; `id` addresses the line for
  edits, as priorities entries do; `draft` is the linked draft's path.
- `InboxCategory { name: Option<string>, notes: Vec<InboxNote> }`, in file order, `None` first.
- `Inbox { hash: string, categories: Vec<InboxCategory>, count: u32, triage: Option<TriageState> }`,
  `TriageState` being `AwaitingHuman` or `Answered`.
- `Changes { count: u32, lines: Vec<string> }`, the merged change list of `INBOX.md`,
  `PRIORITIES.md`, and the drafts notes went into, replacing the priorities' own `changes`.

Edits take the hash they were read at; cross-file moves take both hashes. The live-update snapshot
includes the inbox, so a change on disk publishes both views.

`specs/INBOX-TRIAGE.md`: the clarifications template's frontmatter, sections, and question format,
with the title `# Inbox triage`, a `> [!IMPORTANT]` block giving the number of questions and notes
and the time, a Context naming the notes' count, and `**Notes:**` at the end. Its template lives at
`skills/uraeda/assets/templates/specs/INBOX-TRIAGE.md`; the example project gains an `INBOX.md`.

### Components

- **Line splicing** (`crates/core/src/files/lines.rs`, new, split out of `files/priorities.rs`):
  finding a bullet with its lines, inserting at the end of a section, replacing and removing. Used
  by priorities and inbox.
- **Inbox file** (`crates/core/src/files/inbox.rs`, new): `parse`, `read` into `Inbox`, and the
  edits `add(category, marks, text)`, `edit`, `remove`, `move_to(category)`.
- **Inbox actions** (`crates/core/src/actions/inbox.rs`, new): hash checks, the cross-file moves,
  the merged change list and its commit and discard, creating `INBOX.md` from its template when it
  is missing. Writes go through `api::on_default_branch`, extended to `INBOX.md` and
  `INBOX-TRIAGE.md`.
- **Checks** (`crates/core/src/check/`): `INBOX.md` gets its kind: the title `# Inbox`, no repeated
  category, and its links resolved, with the started-feature exemption `PRIORITIES.md` has.
  `INBOX-TRIAGE.md` is checked as a round of questions with its title.
- **CLI** (`crates/cli/src/note.rs`, new):
  `ura note <text> [--category <name>] [--about <target>] [--agent] [--no-commit]`. `--about` takes
  a feature or bug, resolved like other targets, and writes its slug as a mark; inside a feature's
  worktree, it defaults to that feature. On success it prints `added to the inbox` or
  `added to the inbox, not committed` to stderr.
- **Language server** (`crates/lsp/src/commands/note.rs`, new): `uraeda.note { text, category? }`;
  its `commit` command accepts `INBOX.md`. **Neovim**: an "Add a note" action asking with
  `vim.ui.input` for "Note: " and "Category (empty for none): ".
- **Server**: an inbox data view and source, the mutations `inbox.add`, `edit`, `remove`,
  `category`, `toPriorities`, `toNewDraft`, `toDraft`, `addAsDraft`, and the shared `changes.commit`
  and `changes.discard`, all through the binding.
- **Web UI**:
  - `InboxPage` at `/inbox`, and a note at `/inbox/<key>`, in the pane on wide screens: heading
    "Inbox", count "N notes", categories in file order with "No category" first, empty ones hidden.
    Empty: "The inbox is empty. Notes you add with ＋ next to Inbox land here." Button "Organize
    with an agent", and the triage banners of US4.
  - `NoteView`: the text with its marks as tags, "Edit", "Category", and under "Organize": "Move to
    priorities", "Make a draft", "Add to a draft", "Delete". The section menu lists Now, Next,
    Later, Blocked; the drafts list has a filter field "Find a draft".
  - `AddNote`, the add form in a dialog, a sheet on narrow screens: title "Add a note", field
    placeholder "What did you notice?", "Category" menu with "No category", the categories, and "New
    category…", which shows a field "Category name"; "Attach an image", "Cancel", "Add", or "Add as
    a draft" with an image and the line "With an image, the note is saved as a draft, linked from
    the inbox."
  - The sidebar: "Inbox" under "Priorities", each with its ＋; the top bar's ＋ is removed from Home
    and the priorities page.
  - Home: an "Inbox" group with "N notes to organize", or "1 note to organize", above the
    priorities.
  - The commit bar: one component on the inbox and priorities pages, "N changes to commit", with the
    existing Discard and Commit.
  - Toasts: "Added to the inbox, not committed", "Added to the inbox as a draft, not committed",
    "Moved to <Section>, not committed", "Added to <draft title>, not committed", "Moved to
    <Category>, not committed", "Deleted, not committed", each with Undo.
- **Runner** (`packages/server/src/runner/message.ts`): the two triage messages of US4, started as
  chats in the main checkout.
- **Skill**: `references/inbox.md`, new; the layout in `SKILL.md` and the README template; a line in
  `projects.md`'s setup; `conventions.md`'s commit table and status table for `INBOX-TRIAGE.md`;
  and, in `implementation.md` and `discovery.md`, how an agent notes a finding outside its task. The
  [`cli.md`](/skills/uraeda/references/cli.md) reference lists `ura note`.

### Error handling

- A stale hash: "INBOX.md changed on disk. Your change was not applied.", or the same for
  `PRIORITIES.md`, and the page reloads.
- Writing from a checkout whose copy differs from the default branch's: the existing refusal naming
  the default branch's checkout, for `INBOX.md` too.
- A commit refused by a hook: the commit bar shows the hook's message, and the changes stay.
- An image refused by the core: the add form shows the core's message, as image attachments do
  today, and the note keeps its text.
- `ura note` errors: "A note needs text.", "No specs/ folder here.", a target that matches nothing
  or several, as other commands say; exit 1.
- The triage agent finding `INBOX-TRIAGE.md` already there: it stops and says "An inbox triage
  already waits: answer or delete specs/INBOX-TRIAGE.md first."

### Testing

The core's tests run the inbox actions on temporary git repositories from `fixtures/`, with a new
`fixtures/repo/main/specs/INBOX.md`; the CLI's run the `ura` binary on them. The web UI's stories
run in the browser runner through the real app and server, on a copied fixture repository, at both
sizes, with the fake agent adapter for the triage runs. The Neovim action runs in mini.test.

| What                                         | Test                                                               |
| -------------------------------------------- | ------------------------------------------------------------------ |
| US1 1–3, 6, 7, edge cases on blank text      | Browser: add form, on the inbox page and from Home                 |
| US1 4                                        | Browser: adding from a feature's page writes its slug              |
| US1 5, `ura note` edge cases, SC-002         | CLI integration test from a worktree, with timing in the benchmark |
| US2 1–8, Discard, Undo refused               | Browser: note view actions and the commit bar                      |
| Change list and messages                     | Core: table-driven test of merged diffs to messages                |
| Parsing, marks, multi-line notes, other text | Core: table-driven test of `parse`                                 |
| SC-004, duplicate category                   | Core: edits keep every other line; `ura check` problem             |
| Stale hash, cross-file move refused          | Core integration test                                              |
| US3 1–3                                      | Browser: Home                                                      |
| US4 1–3                                      | Browser: inbox page with the fake adapter and triage fixtures      |
| US4 4–6, triage already there                | Skill: `references/inbox.md` states them; reviewed in the plan     |
| US5 1–3                                      | CLI test for marks; browser test for tags                          |
| US6 1–3, refused image                       | Browser: add form with an image                                    |
| US7 1–2                                      | mini.test: the note action and commit                              |
| Removing the inbox, init on an old project   | CLI: `ura init` and `ura check` tests                              |
| SC-001, SC-003                               | Browser: count of interactions in the add and move tests           |
| SC-005                                       | Checked in the finish commit's review                              |
