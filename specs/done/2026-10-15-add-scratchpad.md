---
kind: feature
finished: 2026-10-16
pull-request: https://github.com/mrtolkien/uraeda/pull/20
---

# Record: Inbox

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-15, finished on
> 2026-10-16, in [its pull request](https://github.com/mrtolkien/uraeda/pull/20). Its full files are
> in git: `git log -- specs/2026-10-15-add-scratchpad/`.

## What and why

A small, structured place to write down ideas and feedback while using the software: a feature is
mostly good but has small things to fix, not enough to block its pull request, or unrelated to it,
and they should be kept in the repository to treat later. Until now they were lines at the end of
`PRIORITIES.md`, under `## Scratchpad`, which the tools ignored, and which "could become their
priorities, or could go inside drafts, or could be fixed quickly without a full dev flow". The human
wanted capture first, organization as a second step in the same feature, and the name "Inbox". Notes
now live in `specs/INBOX.md`, apart from the priorities, "because they are _not_ priorities, by
definition", grouped under categories the human names; this feature's finishing commit moved the
scratchpad's notes there.

## Behaviour

- **The format.** `specs/INBOX.md`, on the default branch, starts with `# Inbox`. A note is an item
  at column 0 (`- `, `* `, or `1. `) with the lines indented under it; tools write `- ` and one
  line. Notes before the first `##` have no category ("No category"); a category is a `##` heading,
  its name without closing `#`s; `#` and `###` headings, fenced code (only a fence at column 0), and
  other text are kept byte for byte and ignored. Marks lead the note: `[agent]`, then the slug of
  the feature's or change's folder without its date, `[run-ui]`; any other bracket is text, and a
  human typing `[agent]` gets a mark too. Every tool edit keeps every other line's bytes, adds under
  the first of two same-named categories, keeps an empty category's heading, and writes the title
  into a file without one. The note key `triage` is reserved for the triage's page: a note "Triage"
  gets `triage-2`. The inbox is optional, and `ura init` copies its template. `ura check` reports a
  title other than `# Inbox`, a repeated category on its second heading, and unresolved links, with
  the dated-folder exemption `PRIORITIES.md` has, a change's proposal included; it checks `INBOX.md`
  and `INBOX-TRIAGE.md` only directly in a `specs/` folder, anywhere else they are the human's own
  files.
- **US1, capture from anywhere.** The sidebar has a ＋ next to Priorities and another next to Inbox,
  shown only while it is unfolded; the top bar's ＋ is gone. The note's form, "Add a note", is a
  dialog, a sheet on the phone, with a one-line field where Enter adds, and a Category menu with "No
  category", the categories, and "New category…", whose blank name keeps Add disabled, as blank text
  does. The note goes at the end of its category, or after the last uncategorized note; a new
  category at the end of the file; a missing file is created as `# Inbox`, a blank line, and the
  note. From any `/f/<folder>` page the form sends the folder, and the core marks the note with its
  slug when the folder is dated, a feature's or a change's, and adds no mark otherwise. The add
  stays uncommitted, with the toast "Added to the inbox, not committed"; its Undo is one core call
  that finds the note by its lines, and refuses once it changed or left, or when two notes hold
  those lines. The form's text, its new category, and its image wait across closings until Add,
  Remove, or a confirmed Cancel. `ura note <text> [--category] [--about] [--agent] [--no-commit]`
  writes on the default branch from any checkout, creating `.worktrees/main` when it has none, and
  commits `specs/INBOX.md` alone as `chore: add "<note>" to the inbox`; when that file had
  uncommitted changes it writes without committing and says so on stderr, exit 0. `--about` takes a
  feature or a change, defaulting to the worktree's own, and refuses anything else; a blank note ("A
  note needs text.") or a folder without `specs/` ("No specs/ folder here.") exits 1 and writes
  nothing.
- **US2, organize by hand.** `/inbox` lists the categories in file order, "No category" first, empty
  ones hidden, the count hidden while empty; a row draws its note without its links. A note opens at
  `/inbox/<key>`, in a pane on wide screens and a page on narrow ones, with its marks as tags,
  `agent` in its own colour, "Edit" in place (marks kept), "Category", and under "Organize": "Move
  to priorities" and "Make a draft", each a menu of Now, Next, Later, Blocked; "Add to a draft", a
  searchable list by title ("Find a draft"), without the note's own draft; and "Delete", with no
  question. A move to the priorities or a draft drops the marks, carries the nested lines, and
  rebases the note's relative links into a draft's folder. Make a draft writes
  `specs/drafts/<slug>.md` from the proposal template with the note's markdown as title and What,
  numbered `-2`, `-3` when the slug is taken, links it from the section, opens the editor, and shows
  no toast; only a note whose whole text links a draft or a backlog file is refused it. Add to a
  draft appends to its `## What`. A move across files checks both files' hashes, and writes both or
  neither. Each Undo is one core call over the files as they are, never writing a whole draft's
  text, and never taking a line the human wrote. There is no "Start as a change": a change from a
  note goes through Make a draft and a start, or the triage.
- **One commit bar.** The inbox and priorities pages share one bar, "N changes to commit", counted
  from one change list of `INBOX.md`, `PRIORITIES.md`, and the drafts notes went into. A note moves
  only with the same markdown, marks aside: one edited then moved is two changes, a removal and an
  addition; a removal and an addition at the same place is an edit. Messages:
  `add "<note>" to the inbox`, `edit`, `remove`, `move "<note>" to <Category> in the inbox`,
  `move … within <Category>`, `move "<note>" from the inbox to <Section>`, and
  `move "<note>" from the inbox to the draft <title>`, with `chore:`, `, and N more`, and a body
  listing every change, the inbox's first. Commit holds the drafts of the moves, every
  never-committed draft the lists link, their linked images, and a committed draft an image turned
  into a folder, as a rename. A note added since the last commit and then added to a committed draft
  is a draft edit, committed from its editor. A draft's commit from its editor holds the drafts its
  lists need. Discard restores both lists from `HEAD` and never loses typed text: a draft a move or
  an add wrote is deleted only while it holds exactly what the tool wrote, a note added to a draft
  loses only its lines, and every file it touches is left unstaged. A commit refused by a hook
  unstages what it staged, and shows the hook's message in the bar.
- **US3, Home.** An "Inbox" group above the priorities says "N notes to organize", or "1 note to
  organize", and opens the inbox; with no note, or no file, it is not shown.
- **US4, the triage.** "Organize with an agent" starts a chat in the main checkout with
  `/uraeda:uraeda Organize the inbox, specs/INBOX.md: …`; the agent refuses a second triage, writes
  `specs/INBOX-TRIAGE.md` in the clarifications format, `# Inbox triage`, with no settled points and
  `**Notes:**` last, one question per note or group, naming notes by their text, and commits it as
  `chore: propose an inbox triage`. The inbox page then says "An inbox triage waits for your
  answers" with "Answer it", opening `/inbox/triage` in the questions view, with no crumbs, no "Ask
  the agent", and no images; the answers end at `**Notes:**`. Every answer and note saved is based
  on the hash of the whole triage as the page last read or wrote it, refused as a conflict once the
  file holds anything else; "Submit answers" commits it alone as `chore: answer the inbox triage`,
  with "Try again" after a hook's refusal. `ura answer` answers features' rounds only. Once
  answered, "Apply the answers" starts the apply chat; the agent carries out each answer on the
  notes found by their text, leaves notes added since, skips notes gone, and commits once,
  `chore: apply the inbox triage`, deleting the triage. The triage's "Bug" outcome became "a
  change": the note becomes a draft linked from the end of **Now**, which the agent starts with
  `ura start <draft> --slug <slug> --change`, the draft as the proposal. Both buttons show only when
  the agent works on this machine; otherwise each message is shown with "Copy the message".
- **US5, agents' notes.** An agent finding a problem outside its task, or a change's agent outside
  its proposal, adds a note marked `[agent]` and its slug, in the fitting category, with
  `ura note --agent --about <slug> --category <name>` or by hand, and names it in its report and
  pull request.
- **US6, a note with an image.** "Attach an image" turns Add into "Add as a draft", with "With an
  image, the note is saved as a draft, linked from the inbox." It is one core call, which encodes
  the image first and then writes the draft folder `specs/drafts/<slug>/proposal.md`, the slug from
  `slug::from_text` as `ura draft` makes it, the image's link at the end of What, the image in
  `images/`, and the linked note, all or none. An add whose answer was lost reads the inbox again
  and counts as done when the linked note is there. Undo removes the note and its untouched,
  uncommitted draft with its images. A linked note moved to a section keeps its link; Delete removes
  only the line.
- **US7, Neovim.** The plugin's "Add a note" asks "Note: ", then offers a picker of "No category",
  the categories from the language server's `uraeda/inboxCategories` request, and "New category…";
  `uraeda.note` writes the note uncommitted on the default branch, and the plugin opens `INBOX.md`
  at the added line. An empty answer cancels; the commit command accepts `INBOX.md`, with the web
  UI's messages.

## Design

The inbox is a second file beside the priorities, built as they are: the core parses it and edits it
by splicing lines, the binding exposes it, and the server, web UI, CLI, and language server only
call the core. It is written on the default branch from any checkout. Reads take no lock and create
no worktree; writes go through the write lock and the default branch's checkout. The triage reuses
the clarifications' parsing and answering, generalized from a feature's round to a path.

- The line splicing shared with the priorities, split out of `files/priorities.rs`, and the generic
  diff: [`files/lines.rs`](/crates/core/src/files/lines.rs).
- The format, its edits, keys, marks, and checks' helpers:
  [`files/inbox.rs`](/crates/core/src/files/inbox.rs), with its diff, reads, and lookups by lines in
  [`files/inbox/`](/crates/core/src/files/inbox/); link rebasing in
  [`files/retarget.rs`](/crates/core/src/files/retarget.rs).
- The writes with hash checks, the moves across files, `ura note`'s commit, and the image add:
  [`actions/inbox.rs`](/crates/core/src/actions/inbox.rs), with the Undos in
  [`actions/inbox/undo.rs`](/crates/core/src/actions/inbox/undo.rs) and the add with an image in
  [`actions/inbox/image.rs`](/crates/core/src/actions/inbox/image.rs).
- The one change list, its messages, Commit, and Discard:
  [`actions/changes.rs`](/crates/core/src/actions/changes.rs), with the drafts it holds in
  [`actions/changes/drafts.rs`](/crates/core/src/actions/changes/drafts.rs).
- The API: [`api/inbox_edits.rs`](/crates/core/src/api/inbox_edits.rs), and the triage's read,
  answers, submit, and retry in [`api/answers/triage.rs`](/crates/core/src/api/answers/triage.rs);
  the binding's [`inbox_writes.rs`](/crates/binding/src/inbox_writes.rs).
- `ura note`: [`crates/cli/src/note.rs`](/crates/cli/src/note.rs).
- The language server's [`commands/note.rs`](/crates/lsp/src/commands/note.rs) and the categories
  request in [`requests.rs`](/crates/lsp/src/requests.rs); the Neovim action in
  [`editors/nvim`](/editors/nvim/lua/uraeda/actions.lua).
- The server's inbox, changes, and triage mutations in
  [`fate/inbox-mutations.ts`](/packages/server/src/fate/inbox-mutations.ts), the image add's
  endpoint in [`attach.ts`](/packages/server/src/attach.ts), and the two triage messages in
  [`runner/triage-messages.ts`](/packages/server/src/runner/triage-messages.ts).
- The web UI: [`InboxPage.tsx`](/packages/web/src/InboxPage.tsx),
  [`NoteView.tsx`](/packages/web/src/NoteView.tsx) with
  [`useNoteActions.ts`](/packages/web/src/useNoteActions.ts),
  [`AddNote.tsx`](/packages/web/src/AddNote.tsx) and
  [`NoteImage.tsx`](/packages/web/src/NoteImage.tsx), the sidebar's forms in
  [`SidebarAdd.tsx`](/packages/web/src/SidebarAdd.tsx),
  [`CommitBar.tsx`](/packages/web/src/CommitBar.tsx), the banners in
  [`InboxTriage.tsx`](/packages/web/src/InboxTriage.tsx), and
  [`TriagePage.tsx`](/packages/web/src/TriagePage.tsx) on `RoundPage`, whose writes and base hash
  live in [`roundTarget.ts`](/packages/web/src/roundTarget.ts); Home's group in
  [`Home.tsx`](/packages/web/src/Home.tsx).
- The skill: [`references/inbox.md`](/skills/uraeda/references/inbox.md), the source of truth for
  the format, capture, organizing, the triage, and agents' notes, with the templates
  [`INBOX.md`](/skills/uraeda/assets/templates/specs/INBOX.md) and
  [`INBOX-TRIAGE.md`](/skills/uraeda/assets/templates/specs/INBOX-TRIAGE.md), and the example's
  [`INBOX.md`](/skills/uraeda/assets/example/specs/INBOX.md).

## Questions

### Round 01

#### Q1: Where do notes live?

**Answer:** B: their own file, `specs/INBOX.md`, "because they are _not_ priorities, by definition",
with "arbitraries categories with markdown headers" (`## UI`, `## CLI`).

#### Q2: What is the concept called?

**Answer:** A: Inbox.

#### Q3: Who organizes the inbox?

**Answer:** A and C: "I'll mostly re-organize by hand but a small agent-driven workflow for when I
need it is welcome".

#### Q3.A: Where does the agent's proposal live until you answer it?

**Answer:** A: `specs/INBOX-TRIAGE.md` on the default branch, in the clarifications format, deleted
by the commit that applies the answers.

#### Q4: What can a note become?

**Answer:** A: a priority, a new draft, a line of an existing draft, a bug report, or a deletion;
the small-change outcome added by whichever of this feature and the bugfixing one landed second,
which was this one.

#### Q5: May agents write notes?

**Answer:** A: yes, and "they should pick or create the right category, with a clear provenance
mark", like `[claude]` or `[PR#17]`, "Not sure what's best"; the spec chose `[agent]`, since the
authorship rule forbids naming an agent, and a feature's slug rather than a pull request's number.

#### Q6: Where can a note be captured from?

**Answer:** A and C: the web UI, `ura note`, and Neovim, which "is still my entry point for
priorities management"; "We'll remove the `+` from the top, it kinda sucks", for a ＋ next to
Priorities and another next to Inbox in the sidebar.

#### Q7: What does a note hold besides its text?

**Answer:** A: its text, plus the feature it is about, added when captured from a feature's page.

#### Q8: What keeps the inbox from growing unread?

**Answer:** A: Home shows the number of notes, with a link to the inbox.

#### Q9: How is a note with a screenshot captured?

**Answer:** A: adding an image turns the note into a draft holding it, linked from the inbox.

#### Notes

On the settled point that the feature fixes three bugs of the scratchpad, the human wrote "Remove
them": no fix of their own, the scratchpad moved as it is.

## Decisions

- [Git](../decisions/git.md), changed: `INBOX.md` and `INBOX-TRIAGE.md` are written on the default
  branch, by every tool and from any checkout, like drafts, backlog files, and `PRIORITIES.md`.

## Changes after approval

- The approval's general comment, the bugfixing flow merged first: the branch caught up with `main`
  once it was, and the triage's "Bug" outcome became a change, made a draft and started from it
  (R23, R24); notes are about features or changes (R25), and a change's agent notes its findings
  outside the proposal (R26).
- C1, "don't do anything to it. Just move the scratchpad to INBOX.md": the scratchpad's bugs got no
  fix, and its notes moved, as they were, into `INBOX.md` under no category in the finishing commit,
  which removed `## Scratchpad` from `PRIORITIES.md`; `references/inbox.md` keeps a one-commit move
  on the default branch for other projects (R31).
- C2, a category picker after the text, then `INBOX.md` opened at the added line: the language
  server lists the categories and gives the line (R3, R18).
- Make a draft numbers a taken slug `-2`, though `ura draft` refuses one (R1).
- Home reads the count from the inbox view (R2).
- A note with an image is one core call, all or none (R4, R21), its slug from `slug::from_text`
  (R21), and its picked image waits for Add (R21).
- The triage has no settled points (R5); its answers end at `**Notes:**`, and its submit and saves
  are based on the page's hash (R16, R22, R39), with a retry and no images (R22).
- The priorities and the inbox report the same change count (R6).
- Fenced code is skipped, only from a fence at column 0, for the priorities too (R7).
- Adds go under the first of two same-named categories, and keep the file's final newline (R8); only
  a `##` heading changes the category (R9); a file without a title gets `# Inbox` (R11).
- A note moves only with the same markdown, so one edited then moved is two changes (R10).
- Moves drop the marks and carry nested lines, and Commit with nothing changed is refused (R13).
- Discard never loses typed text (R14, R33), and unstages what it touches; a refused commit unstages
  what it staged (R35).
- The inbox is read without a lock or a worktree, and `ura status --json` shows none of it (R12).
- The inbox's files are checked only directly in `specs/`; a repeated category is reported on its
  line; a category drops closing `#`s (R15); a started change's proposal may be linked (R27).
- `ura answer` does not answer the triage, which the web UI submits through its own API (R16).
- `ura note` commits through the core, refuses `--about` outside features and changes, and prints
  where it wrote on stderr (R17, R25).
- The sidebar's forms are drawn beside the shell; the category is a `Selector`; a note is about a
  page's folder only when it is dated; the key `triage` is reserved (R19, R29).
- The note view's menus are Astryx components, Make a draft shows no toast, and each Undo is one
  core call (R20, R29).
- An inbox row drops its links; `retarget` rewrites `INBOX.md`'s links when a draft becomes a folder
  (R21).
- The triage's buttons show only with a local agent, otherwise "Copy the message" (R22).
- The inbox page has no "Start as a change" (R28).
- The commit holds every never-committed draft the lists link; a new note added to a committed draft
  is a draft edit (R33); a draft's commit from its editor holds the drafts its lists need (R34).
- A note's relative links are rebased into its draft (R36).
- A committed draft an image turned into a folder is committed and discarded as a rename (R37).
- Only a note linking a draft or backlog file is a draft already (R38).
- The answered round and the approved spec had their links to the bugfixing feature's removed files
  edited, not their words (R32).

## Follow-ups

- The change list pairs a moved note with a typed bullet by its text alone: a bullet the human typed
  with the same text can read as the move.
- Discard can drop an agent's uncommitted note when `INBOX.md` was already dirty as `ura note` wrote
  it.
- Untested: the guards in `both()`, `write_both`'s rollback, the refusal of duplicate lines, and the
  committed check in `undo_as_draft`.
- Parts of US1–US3 are tested as happy-dom page tests, not in the browser; US1 6 has no web test,
  nor an empty category offered by the add form.
- The Undo of a category move with two `## UI` headings lands under the first.
- `[agent]` or `[<slug>]` typed by a human is read as a mark.
- The literal `"specs/INBOX.md"` is repeated in several files.
- The triage's status is a raw string, not a type.
- On the phone, the Undo toast covers Commit and Discard for 5 seconds.
- The ＋ glyph is missing in the screenshot browser's fonts.
- The commit bar's padding differs from the mockup.
- The narrow note page has no "‹ Inbox".
- The Add form is narrow on desktop, so "Add as a draft" wraps.
- A draft's conversion to a folder by an image reads as "Edit in Next: X -> X" in the change list.
- A stale read after a finished triage write can cause one refused save.
- A new note added to a committed draft (R33) is committed from the draft's editor only.
- SC-002, `ura note` under 200 ms, was timed on the debug build only.
- `ura draft` still refuses a taken slug while Make a draft numbers it (R1).
- `api/answers/triage.rs` moves to `api/triage.rs`, and Home's count into the workspace view, once
  `api.rs` and `view.rs` have room (R2, R16).
- The moved scratchpad notes wait in the inbox for their first organizing.
