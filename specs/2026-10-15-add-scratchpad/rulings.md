# Rulings: Inbox

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Drafts made from a note get `-2`, though `ura draft` refuses

- **Decision**: Make a draft, from a note whose slug already names a draft, writes `<slug>-2.md`,
  then `-3`, and so on.
- **Rationale**: The spec's edge case says "the slug gets `-2`, as `ura draft` does today". In fact
  `draft_entry` refuses an existing file ([`actions/draft.rs`](/crates/core/src/actions/draft.rs)),
  and only `attach::into_folder` numbers folders. The behaviour the spec states is `-2`, and the
  inbox follows it. `ura draft` is left unchanged, since it is outside this feature.
- **Alternatives considered**: Refusing, like `ura draft`, which would contradict the spec's stated
  behaviour. Changing `ura draft` too, which is outside the scope.
- **If wrong**: A refusal message replaces the numbering in `to_new_draft`, a few lines.
- **Where**: task 4

## R2: Home reads the inbox's count from the inbox view, not the workspace view

- **Decision**: Home's Inbox group uses `useInbox().count`. `WorkspaceView` gets no inbox field.
- **Rationale**: [`view.rs`](/crates/core/src/view.rs) is at 499 lines. The inbox view is already
  live-updated, and Home loads only one more small view.
- **Alternatives considered**: Splitting `view.rs` to add a field, which is a structural change for
  one number.
- **If wrong**: Move the count into `WorkspaceView` after splitting `view.rs`.
- **Where**: task 9

## R3: Neovim's categories come from a request, and the category is picked, not typed

- **Decision**: `uraeda/inboxCategories` is a language server request, like `uraeda/waiting`, not a
  command. The plugin shows a `vim.ui.select` picker with "No category", the categories, and "New
  category…". It then opens `INBOX.md` at the added line, from `Outcome.line`.
- **Rationale**: C2 of the [spec review](spec-review.md) asks for a picker and the opened line. A
  read needs no buffer and writes nothing, which is the request pattern of
  [`requests.rs`](/crates/lsp/src/requests.rs). The spec's typed category came from the plugin not
  being allowed to parse the file: the language server lists the categories instead.
- **Alternatives considered**: A command returning the list, which would show a progress
  notification for a read.
- **If wrong**: Rename the request to a command, a few lines on both sides.
- **Where**: task 8

## R4: A note with an image is a single-file draft first, then a folder through the attach endpoint

- **Decision**: "Add as a draft" calls `inbox.addAsDraft`, which writes `specs/drafts/<slug>.md` and
  its linked note. Then the existing `/attach` upload turns the draft into `<slug>/proposal.md`.
  `retarget` is extended to rewrite `INBOX.md`'s link.
- **Rationale**: It reuses the one image path the
  [attachments decision](../decisions/attachments.md) allows, with its encoding in the core, rather
  than a second mutation that takes bytes.
- **Alternatives considered**: One mutation that takes the note and the image bytes, a second upload
  path to maintain.
- **If wrong**: A failed upload leaves a text-only draft linked from the inbox, which the human can
  still attach an image to from the editor.
- **Where**: tasks 4 and 11

## R5: The triage template has no "Settled without the human"

- **Decision**: `INBOX-TRIAGE.md` keeps the clarifications template's frontmatter, block, Context,
  and questions, and ends with `**Notes:**`. It has no settled points.
- **Rationale**: In a triage, every outcome is the human's choice: an agent that deletes a note it
  judges fixed still asks. The spec lists the outcomes as options.
- **Alternatives considered**: Keeping the section, which agents would fill with outcomes the human
  never chose.
- **If wrong**: Add the section to the template, and the check follows it.
- **Where**: task 2

## R6: The priorities and the inbox report the same change count

- **Decision**: `Priorities.changes` and `Inbox.changes` both carry the count of the merged change
  list, so the one commit bar shows the same number on both pages.
- **Rationale**: The spec's one commit bar covers both files: a page showing only its own file's
  changes would commit more than it counts.
- **Alternatives considered**: Separate counts with one Commit, which would show a count that
  disagrees with what Commit does.
- **If wrong**: Split the counts in `actions::changes::list`.
- **Where**: task 4

## R7: `lines::items` skips fenced code from task 2, not task 1

- **Decision**: Task 1's `lines::items` scans exactly as the priorities' parser did, fenced code
  included. Task 2 adds the fenced-code skip, with its inbox test, and the priorities share it from
  then on. Only a fence at column 0 opens or closes code, in `items` and `headings` alike: a fence
  indented under an item is part of the item, and a blank line inside it would otherwise leave its
  closing fence to open code that hides every later item.
- **Rationale**: Task 1 only restructures: its tests pass unchanged before and after. The
  priorities' parser never skipped fenced code, so skipping it in task 1 would change what
  `PRIORITIES.md` entries are, inside a structural commit.
- **Alternatives considered**: Skipping fenced code in task 1, a behaviour change in a refactor. A
  flag on `items` to skip or not, two rules for one scan.
- **If wrong**: Gate the skip behind a parameter, so the priorities keep reading fenced bullets.
- **Where**: tasks 1 and 2

## R8: `append_to_section` takes the section's last item and heading from its caller

- **Decision**: `lines::append_to_section(text, last, heading, new_heading, item)` adds after
  `last`, the section's last item, or else after the heading at line `heading`, or else under a new
  heading at the end. `lines::items` gives its closure each heading's line number, and
  `lines::headings` lists the headings outside fenced code. Adding under a heading at the end of the
  file keeps the file's last line ending, and adds one when the file had none.
- **Rationale**: Task 1's helper took a predicate and the last item under any heading it accepted,
  so it could not tell two `## UI` headings apart, and review focus 6 requires the inbox to add to
  the first. The priorities pass the last entry of their section and the first matching heading,
  which is what the predicate found, so their behaviour is unchanged. `"# Inbox\n\n## UI\n"` lost
  its final newline when a note was added.
- **Alternatives considered**: A second helper for the inbox, a copy of the splicing rule. Keeping
  the predicate and filtering in `inbox.rs`, which still needs the heading's line.
- **If wrong**: Only the two callers of `append_to_section` change.
- **Where**: task 2, in `files/lines.rs`, `files/priorities.rs`, and `files/inbox.rs`

## R9: Only a `##` heading changes a note's category

- **Decision**: A `#` or `###` heading inside the inbox is kept and ignored: notes under a
  `### aside` of `## UI` are UI notes. Bullets before the first heading, above `# Inbox`, are not
  notes.
- **Rationale**: The spec says "Other headings and text are kept and ignored": a heading that ended
  its category would file the notes after it nowhere. Task 1's scan reset the section at every
  heading, so the inbox's closure keeps the current category instead.
- **Alternatives considered**: Ending the category at any heading, which hides the notes under a
  sub-heading from every tool.
- **If wrong**: The closure in `inbox::scan` returns `None` for other headings.
- **Where**: task 2, `files/inbox.rs`

## R10: A note moves only with the same markdown; an edited then moved note is two changes

- **Decision**: `inbox::diff` is the priorities' diff, moved into `lines::diff` as a generic over
  the section type. A removed note and an added one are a `Moved` only when their markdown, marks
  included, is exactly equal. A removal and an addition at the same place of the same category are
  an `Edited`. A note edited, then moved to another category or place, is two changes, a removal and
  an addition, each named with its own text.
- **Rationale**: No rule can tell an edit followed by a move from a deletion and an unrelated
  addition: both remove one text and add another elsewhere. Exact markdown keeps the change list
  honest, names the deleted text in the commit, and lets task 4 pair notes across files by text.
- **Alternatives considered**: Pairing a removed and an added note sharing half their words (Dice
  pairing), rejected: deleting "Icons are blurry on retina screens" and adding "Icons are blurry on
  the sidebar" became a move, hiding the deleted text, and the pairing crossed categories and was
  greedy, which task 4's cross-file matching could not follow.
- **If wrong**: The commit lists two changes for an edited move. The same-place rule, inherited from
  the priorities, also reads a deletion and an addition at the same place as an edit: deleting the
  last note of a category and adding a new one there, in the same uncommitted change, is one
  `Edited`.
- **Where**: task 2, `files/lines.rs` and `files/inbox/diff.rs`; task 4's change list

## R11: Task 2's smaller corrections to the plan

- **Decision**:
  - The spec's Data example holds 5 notes, not 4: `None`, then `UI` three times, then `CLI`.
  - The diff lives in `files/inbox/diff.rs`, re-exported from `files::inbox`, which stays under 500
    lines.
  - `add` writes `# Inbox\n`, the template, into an empty text, which gives `"# Inbox\n\n- note\n"`
    as the plan expects, and `"# Inbox\n\n## Editor\n\n- note\n"` for a new category, with no second
    blank line. A text without a `# ` title gets `# Inbox` and a blank line first, so the added note
    is under a heading, and so a note. `insert` and `move_to` without a category do the same.
  - `Inbox.names` lists each category's name once, for the add form; `category_names` keeps the
    repeated ones, for `ura check`.
  - The priorities' fenced-code test is in `tests/priorities.rs`.
- **Rationale**: Each follows the spec, or the plan's expected output, where the plan's text was
  off.
- **Alternatives considered**: None that keep the plan's expected outputs.
- **If wrong**: Each is a line or two.
- **Where**: task 2

## R12: The inbox is read without a worktree, and the workspace holds both files' texts

- **Decision**:
  - `api::read_inbox` reads `INBOX.md` and `INBOX-TRIAGE.md` like `read_priorities`, from the
    default branch's checkout or its tip, without the write lock or a worktree. Only the edits go
    through `write_lock` and `reach_default`.
  - `actions::inbox::of(text, committed, triage)` builds the `Inbox` for both reads. Until task 4,
    `changes` counts `inbox::diff` against the committed file.
  - `Workspace` holds the texts of `INBOX.md` and `INBOX-TRIAGE.md`, not the triage's status, and
    skips both in `ura status --json`.
  - `add_note` refuses an `about` that is not a dated folder name, without checking that the feature
    exists. `actions::inbox::add` refuses a slug that would not parse back as a mark, through
    `files::inbox::is_slug`, the parser's own rule.
- **Rationale**: A read that creates `.worktrees/main` would be a write, against the priorities'
  pattern. The watch flag must fire when the triage's answers change, not only its status, so the
  snapshot hashes the text. The JSON of `ura status` is a documented output that no story changes.
- **Alternatives considered**: `read_inbox` through `reach_default`, as the plan's interface said,
  which creates a worktree on a read. Storing the status, which misses answers typed in the file.
- **If wrong**: `read_inbox` takes the lock and reaches the default branch, a few lines; the
  workspace's fields gain `Serialize`.
- **Where**: task 3, `api/inbox_edits.rs`, `actions/inbox.rs`, `workspace.rs`, `watch.rs`

## R13: Moves leave the marks in the inbox; the change list's lines and Discard

- **Decision**:
  - A note moved into `PRIORITIES.md` or a draft drops its `[agent]` and `[<slug>]` marks: they
    describe the note in the inbox, and the change list pairs a removed note with an entry or a
    draft's line by their text without marks. Its nested lines follow it: into the entry or the
    draft's What, and, for a new draft, after the What paragraph.
  - A note that is a whole link is not made a new draft: "<note> already links <target>".
  - The body's lines of inbox changes are `- Add to the inbox: <note>`,
    `- Remove from the inbox: <note>`, `- Move to <Category> in the inbox: <note>`,
    `- Move within <Category> in the inbox: <note>`, `- Edit in the inbox: <before> -> <after>`,
    `- Move from the inbox to <Section>: <note>`, and
    `- Move from the inbox to the draft <title>: <note>`, the inbox's changes first, then the
    priorities' own, as today. `<Category>` is `No category` for none, and a reorder within a
    category, made by hand, is `move "<note>" within <Category> in the inbox`.
  - Commit with nothing changed is refused with "INBOX.md and PRIORITIES.md have no change to
    commit". Discard restores `INBOX.md` and `PRIORITIES.md` from `HEAD`; what it does to drafts is
    ruling R14's.
  - `read_priorities` moved to `api/priority_edits.rs`, next to `read_inbox`'s count, which `api.rs`
    had no room for; its `LARGE` row is lowered to 634.
- **Rationale**: The plan names the messages' subjects but not their bodies, nor what happens to the
  marks. Keeping the marks in `PRIORITIES.md` would show `[run-ui]` as an entry's text, and break
  the pairing by text that ruling R10 relies on.
- **Alternatives considered**: Keeping the marks in the moved lines, and pairing by text with marks
  stripped on one side only: the priorities would read the marks as text.
- **If wrong**: `inbox::unmarked_lines` returns the lines as written, and the pairing compares the
  note's markdown, a few lines.
- **Open for task 11**: the spec's US6 path `the-spec-pages-headings-are-body-sized` drops the
  apostrophe, while `slug::from_text` turns it into a hyphen, `the-spec-page-s-...`, as `ura draft`
  does. Task 4's test of `add_as_draft` avoids the apostrophe; task 11 decides the slug rule.
  Discard deletes only the file of an untouched, uncommitted folder draft, `<slug>/proposal.md`, not
  its images: task 11 extends it with the images.
- **Where**: task 4, `actions/inbox.rs`, `actions/changes.rs`, `files/inbox.rs`,
  `api/priority_edits.rs`

## R14: Discard never loses text the human typed

- **Decision**: The commit bar's Discard restores `INBOX.md` and `PRIORITIES.md` from `HEAD`. For
  drafts, it only takes back what the moves wrote:
  - a draft a move created, by Make a draft or Add as a draft, and never committed, is deleted only
    while its text is exactly what the move wrote; once typed in, it is kept;
  - a draft a note was added to loses that note's lines, and the blank line added before them, and
    keeps every other edit;
  - an entry's or an added note's link to an uncommitted draft does not otherwise bring the draft
    into Discard. Commit still holds the drafts of the moves and those an added note links.

  With it:
  - A new draft's title, What, and link text are the note's markdown, marks dropped, not its plain
    text: inline code is kept, and `[`, `]`, and `\` are escaped outside code spans in the link's
    text, so the link parses and pairs with the note.
  - A draft's commit from the editor holds a first, never committed `INBOX.md`, as it holds a
    changed one.
  - `commit_priorities` and `discard_priorities` hold the write lock while they read back.
  - `actions::priorities::message` is removed, having no caller. The tests
    `one_change_is_the_subject` and `more_changes_are_counted_and_listed_in_the_body` of
    `tests/priorities.rs` now check `changes::message` on a repository holding the same texts: the
    same subjects and bodies, through the code that writes them.
  - `append_to_what` adds a blank line before the note after indented code, which is not a list.

- **Rationale**: The spec's "restores the drafts the commit would hold" would delete a draft made
  with the Draft button from a moved entry, with the human's typing in it, and revert typing in a
  draft a note went into. The human's decision tightens it: Discard never loses text the human
  typed.
- **Alternatives considered**: Restoring whole drafts from `HEAD`, the first version, which lost
  that typing.
- **If wrong**: `changes::discard` restores the drafts of `Listed.paths` again, a few lines.
- **Where**: task 4's review, `actions/changes.rs`, `actions/inbox.rs`, `actions/text.rs`,
  `files/inbox.rs`, `files/lines.rs`, `files/proposal.rs`, `api/priority_edits.rs`

## R15: The inbox's checks find a repeated category's line, and the triage's status submits

- **Decision**:
  - `files::inbox::category_headings` gives each `##` heading's line and name, outside fenced code;
    `category_names` maps it. `inbox.category` reports the second and later headings of a name on
    their line, and `inbox.title` the first `#` heading that is not `# Inbox`, or no line when the
    file has none. An empty heading, `## ` or `##`, names no category, so it is never reported as
    repeated.
  - A category's name drops a closing run of `#` after a space, as CommonMark does, in
    `inbox::category_of`, which both the edits and the check use: `## UI ##` repeats `## UI`, and an
    add to `UI` goes under it.
  - `INBOX.md` and `INBOX-TRIAGE.md` are the inbox and its triage only directly in a `specs/`
    folder: a file of that name in a feature folder, a draft folder, or outside `specs/` is the
    human's, and is not checked as one. The triage takes the clarifications statuses, and
    `check::fields` gives `answered` the `Submit` action, as for a round.
  - The `ura check` paragraph of `conventions.md` names the inbox's checks, the priorities' four
    sections, and the started-feature exemption of links, which it did not; `projects.md` says what
    `ura init` prints and that a second run only adds what is missing.
- **Rationale**: `category_names` gives no lines, and a problem without a line would not point at
  the heading to rename. The CLI decision requires every checked rule in the skill, and the
  priorities' sections and the exemption were checked without being written there.
- **Alternatives considered**: Finding the repeated heading through the markdown parser's headings,
  a second rule for what a category is. Recognizing both files in any folder, as `PRIORITIES.md` is,
  which made a human's `INBOX.md` elsewhere fail the check. Reporting an empty heading, which no
  tool writes and which names nothing to rename.
- **If wrong**: `category_headings` folds back into `category_names`, and the check reports no line.
- **Where**: task 5, `files/inbox.rs`, `check/`, `references/conventions.md`, `projects.md`

## R16: The triage's API under the answers, and an answer ends at the notes

- **Decision**:
  - The answer actions take a `RoundFile`: a `Feature`, for its latest round, or a `str`, a path
    from the top level, for `specs/INBOX-TRIAGE.md`. `answer::record` writes a round answered,
    shared by a feature's `submit` and `actions::inbox::submit_triage`, which commits it alone as
    `chore: answer the inbox triage`. It takes the hash of the triage the page read, `previous`, and
    refuses with the conflict code when the file changed since, so answers the human never saw are
    not submitted.
  - The triage's API is in `api/answers/triage.rs`, a module of the answers re-exported by them, not
    `api/triage.rs`: `api.rs` is at its `LARGE` number and cannot take a `mod` and a `pub use` line.
    Its `FileView` has the id `inbox-triage`, which the server uses as is, an empty folder, and the
    clarifications' items, through `files::items::round`, now `pub(crate)`.
  - An answer ends at the `**Notes:**` line, as at a heading, when it is read and when it is
    written. The triage has no section between its last question and its notes, so the last answer
    read the notes' marker as its text, and writing it erased the marker.
  - The binding's inbox functions are in `crates/binding/src/inbox_writes.rs`, since `lib.rs` would
    pass 500 lines; an optional `category` and `about` come last in their arguments, as TypeScript
    requires.
  - The server's inbox, changes, and triage mutations are in `fate/inbox-mutations.ts`; the masked
    records the mutation files answer with, `priorities`, `draft`, and `inbox`, are in
    `fate/masked.ts`. `inbox.toPriorities` and `inbox.toDraft` answer with the `Inbox`. None calls
    `writable`, which refuses a write to a feature an agent works on: the inbox, the triage, and the
    drafts and backlog files `inbox.toDraft` accepts are no feature's, so it would never refuse. The
    `text.*` mutations keep it, as they also write a feature's proposal.
  - `live.ts` sends `Inbox` and `Priorities` when either file changes, as both carry the commit
    bar's count, and the `WorkflowFile` `inbox-triage` when the inbox does.
- **Rationale**: One home for the answer rules, as the plan asks, within the files' limits. The
  notes fix is the one the triage's format needs; rounds have a section before their notes.
- **Alternatives considered**: Moving the default branch's helpers out of `api.rs` first, in a
  structural commit, to make room: the two lines would still grow a file listed in `LARGE` after it.
  A copy of the answer code for the triage: a second home for the rules.
- **If wrong**: `api/answers/triage.rs` moves to `api/triage.rs` once `api.rs` has room, with two
  lines.
- **Where**: task 6, `actions/answer.rs`, `actions/inbox.rs`, `api/answers.rs`,
  `api/answers/triage.rs`, `files/clarifications.rs`, `files/items.rs`, the binding, and the server

## R17: `ura note` commits through a core action, and says where it wrote on stderr

- **Decision**:
  - `actions::inbox::note(place, category, marks, text, commit) -> Result<Noted, ActionError>` adds
    the note and commits `specs/INBOX.md` alone, as `chore: add "<note>" to the inbox`, unless
    `commit` is unset (`Noted::Written`) or the file differed from `HEAD` before the note
    (`Noted::Uncommitted`). Only when it will commit are other staged files refused, before anything
    is written. `crates/cli/src/note.rs` resolves the marks, checks the note through the core's
    `inbox::checked_note` before reaching the default branch, so a refused note creates no
    `.worktrees/main`, then reaches it and prints.
  - `--about` resolves a target like other commands, among features and bugs only, since a note is
    about one of them: a name that matches none, a draft's included, is refused with "--about names
    a feature or a bug: none is named <name>". Without it, the slug comes from the branch of this
    checkout, a feature's or `fix/` a bug's.
  - "No specs/ folder here." covers both a folder outside any git repository and a repository
    without `specs/`.
  - Where the note was written goes to stderr, with the message, through `output::place_message`,
    which `say_place` now prints. When that place is the main checkout itself, from another
    worktree, it names its full path: `say_place` printed `wrote in ` with nothing after it, for
    `ura draft` and `ura answer` too.
  - `place::switch_back` is not called: `place::reach` never switches the checkout.
- **Rationale**: Committing alone unless the file had uncommitted changes is a workflow rule of
  `references/inbox.md`, and the stack decision puts workflow logic in the core. The CLI decision
  sends messages to stderr, and the spec names the two messages `ura note` prints there.
- **Alternatives considered**: The commit logic in `note.rs`, as the plan's file list implied: a
  rule outside the core. Printing the place on stdout, as `ura draft` does: a message on the data
  stream.
- **If wrong**: `inbox::note` folds into `note.rs`, about 30 lines.
- **Where**: task 7 and its review, `actions/inbox.rs`, `crates/cli/src/note.rs`,
  `crates/cli/src/output.rs`

## R18: The core gives the note's line, without a hash, and an empty text cancels

- **Decision**:
  - `api::add_note_at(repo, category, about, text) -> Result<(Inbox, u32)>` adds the note over the
    inbox as it is, without a hash, as `ura note` does, and gives its 1-based line from where the
    splice put it: `files::inbox::add` and `lines::append_to_section` give the index of the line
    they inserted. `uraeda.note` calls it, and sends that line as `Outcome.line`.
  - `actions::inbox::add` gives `(Inbox, u32)`; `api::add_note`, which the binding uses, is
    unchanged.
  - In Neovim, the cursor moves only when the current buffer is the opened inbox: an `:edit` that
    failed, over an unsaved buffer with 'nohidden', leaves the cursor where it was.
  - An empty answer to "Note: " or "New category: " cancels, as `vim.ui.input` does for Escape. A
    text of spaces goes to the server, which refuses it with "A note needs text.".
  - `client.lua`'s `command` and `command_checkout` share one local `execute`, which shows the
    progress, reloads, opens `opened`, and reports errors.
  - The help (`doc/uraeda.txt`), `test_keys.lua`, and the refusal text in `test_actions.lua` and
    `test_client.lua` change with the action and the command, as their tests require. Every
    `Outcome` literal of `commands/attach.rs` and `commands/draft.rs` gets `line: None`.
- **Rationale**: Only the add knows where it put the note. Diffing two reads gave the wrong line
  when the add also wrote the title of an untitled inbox, and a hash read just before the write
  protected nothing the human had seen: a write by another tool in between lost the typed note. The
  plugin must not read the file, and the refusal for blank text stays in the core, its one home.
- **Alternatives considered**: Diffing the inbox read before and after the add, in the language
  server, which the title broke. A line in the core's `Inbox`, which the web UI does not need. The
  plugin refusing blank text itself, a second copy of the rule.
- **If wrong**: `add_note_at` folds into `add_note` with an optional hash, a few lines.
- **Where**: task 8, `crates/core/src/api/inbox_edits.rs`, `crates/core/src/actions/inbox.rs`,
  `crates/core/src/files/inbox.rs`, `crates/core/src/files/lines.rs`,
  `crates/core/src/files/priorities.rs`, `crates/lsp/src/commands/note.rs`,
  `editors/nvim/lua/uraeda/actions.lua`, `editors/nvim/lua/uraeda/client.lua`

## R19: The sidebar's forms are drawn beside the shell, and the top bar's ＋ tests follow the sidebar

- **Decision**:
  - The forms the sidebar's ＋ buttons open are drawn by `SidebarAddForms`, around the shell, not in
    the navigation's rows, each from its first opening on. On the phone, ＋ closes the drawer and
    opens its form once the drawer is closed.
  - The note's field is the app's one-line text area, `TextField` of kind `line`, as the priorities'
    form has; Enter adds, as SC-001 asks. On the phone, Astryx's bottom sheet takes the focus
    itself, so the browser test of SC-001 taps the field first there. The add form's sheet is as
    tall as its content.
  - The Category menu is Astryx's `Selector`, a popover on wide screens and a bottom sheet on narrow
    ones. "New category…" with a blank name keeps Add disabled, as blank text does. The new
    category's name is a text field like the note's, kept under `inbox-add#category`: restored with
    its "New category…" choice, and asked about by Cancel.
  - A note is about the page's folder only when it is dated, as a feature's or a bug's is: another
    `/f/<name>` adds a note with no mark, instead of an add the core refuses.
  - The core reserves the key `triage` among the inbox's notes, the triage's address: a note
    "Triage" is `triage-2`, through `lines::unique_keys_besides`.
  - Undo finds the note it added by its lines, its key first, as the priorities' Undo finds a line
    by its text.
  - The inbox page hides its count while it is empty, and says "1 note" for one. Its notes are not
    links yet, and `/inbox/<key>` and `/inbox/triage` show the inbox page: task 10 adds the note's
    view, and task 12 the triage's. "Organize with an agent" is task 12's, and "Attach an image"
    task 11's.
  - US1 4's test adds from `/f/2026-10-12-cli-tuis`, a feature of the fixture, and expects
    `[cli-tuis]`: the fixture has no `2026-10-14-run-ui`.
  - The tests that opened the top bar's "Add a priority" open the sidebar's "Add to the priorities"
    instead: `priorities.test.tsx`, `shell.test.tsx`, and the browser's `fields.test.tsx`.
    `round.test.tsx`'s bar test checks that the phone's top bar holds no ＋. The browser's folded
    navigation test checks that the ＋ buttons show only while it is unfolded. The two tests
    "no ＋ on a round" and "no ＋ on a review" of `shell.test.tsx` are removed: they guarded the web
    UI's rule that ＋ shows on home and the priorities page only, which this spec replaces with
    a ＋ in the sidebar on every page.
  - The browser tests run `checkLayout`, which holds `checkPage`, on the inbox page, the empty
    inbox, and the add form.
- **Rationale**: Astryx's `DialogHeader` focuses its title as it is drawn: two closed dialogs drawn
  on every page took the focus from a round's question. On the phone, the drawer is a native dialog,
  which gives the focus back to its menu button as it closes, and a form drawn inside the drawer
  would close with it. The spec asks for the top bar's ＋ to go and for the sidebar's to open "the
  one ＋ opened from the top bar, unchanged".
- **Alternatives considered**: The forms inside the navigation's rows, as the plan's file list read:
  lost with the phone's drawer. A form drawn closed on every page: it took the focus. Keeping the
  two removed tests with the new button's name: they would fail on every page by design.
- **If wrong**: `SidebarAddForms` moves into `SessionNav.tsx`'s rows, a few lines, once Astryx's
  dialogs stop taking the focus while closed.
- **Where**: task 9 and its review, `packages/web/src/SidebarAdd.tsx`, `AddNote.tsx`,
  `InboxPage.tsx`, `Shell.tsx`, `crates/core/src/files/inbox.rs` and `files/lines.rs`, and the tests
  named above

## R20: The note's view: Astryx menus, one core call per Undo, and one bar that reads both files

- **Decision**:
  - "Move to priorities" and "Make a draft" are Astryx `DropdownMenu`s of the four sections, a
    popover on wide screens and a sheet of buttons on narrow ones. "Category" is a `Selector`
    showing the note's category, like the add form's. "Add to a draft" is a `Selector` with
    `hasSearch`, its search field's placeholder "Find a draft", whose trigger is a button named "Add
    to a draft". The workspace lists drafts by path only, a folder by its folder: the view reads
    their titles in one request of `drafts` by ids (`useDraftTitles`), a folder's at
    `<folder>/proposal.md`. A note's own draft is not offered.
  - "Edit" opens the note's text in place through `useLineSave` and `EditableLine`'s field, now
    exported as `LineField`; `useLineSave` takes the empty text's refusal, "A note needs text.".
    While the text is saved, the view finds the note by its id only while that note holds the text
    saved, and forgets the id once the save is done: an id is a place, which another note takes once
    this one goes.
  - Make a draft shows no toast: it opens the editor, as the task view's Draft does, and the spec
    lists no toast for it.
  - Move to priorities and Make a draft read the priorities' hash just before they write: the view
    shows no priorities, so a `PRIORITIES.md` changed since the view was drawn is not refused from
    it; one changed between that read and the write is.
  - Every Undo of a move is one call to the core, under the write lock, over the files as they are
    now, which changes both files or neither, and never writes a whole draft's text:
    - `inbox.undoToPriorities { lines, category?, index, section, entryKey? }` removes the line of
      the section whose lines are exactly the note's, marks dropped, and puts the note back at its
      place. With several such lines, it takes the one whose key is `entryKey`, read right after the
      move, or refuses: a line of the same text the human wrote is never taken. Once none is left,
      it refuses with "Could not undo: "<note>" is no longer in PRIORITIES.md.", a message the
      spec's INBOX.md one is the model for.
    - `inbox.undoToDraft { draft, lines, category?, index }` takes the note's lines out of the
      draft, every other edit kept, through `proposal::without_item`, the operation Discard uses,
      moved there from `actions/changes.rs`, then puts the note back. Both now take the last item of
      that markdown, the one a move appended, so a same bullet the human wrote above stays.
    - `inbox.undoCategory { lines, category?, index }` finds the note by its lines, and puts it back
      at its place in one write, or refuses with the spec's "Could not undo: "<note>" is no longer
      in INBOX.md." when no note, or two, hold those lines.
    - Delete's Undo is `inbox.insert` over the inbox read just before, one file.
    - They live in `actions/inbox/undo.rs`, with `files::inbox::of_lines` and `ids_of_lines` in
      `files/inbox/found.rs`, `priorities::remove_written`, and `lines::markdown_of`.
  - A note's view, once its note left the inbox, returns to the inbox only while it is still shown:
    by Back, when it was opened from the inbox, so the history holds the inbox once; otherwise in
    its place, as the task view does.
  - `CommitBar` shows its refusal, a hook's included, in the bar: the refactor 6c85be4 moved it
    there from above the priorities' list, and dropped the conflict reload the page's `run` did,
    which Commit and Discard, taking no hash, never needed. After Commit and Discard, refused or
    not, and after every move across files, the inbox and the priorities are read again
    (`rereadChanges`), as both carry the bar's count and only one comes back with the answer. A
    refused edit of a note's text reads them again on a conflict too.
  - The narrow note page has no ‹ in the top bar, as the task view has none: Back returns.
  - Review focus 2's tests are in the browser, at the desktop's size, with the page's clock faked,
    as the priorities' toasts tests are: in happy-dom, a dismissed toast's text stayed drawn.
- **Rationale**: The UI layout decision asks for popovers on wide screens and sheets on narrow ones,
  which these components give. An Undo made of several calls from the web UI could lose a note
  between them, write over a change made meanwhile, or take a line the human wrote: in the core,
  under the lock, it checks everything before it writes either file, as the moves do.
- **Alternatives considered**: An overlay with a filter field and a list for the drafts, a second
  picker where Astryx has one. The first Undo, a sequence of web calls, and the draft's text from
  before the move written back over its hash, which refused, or lost, the human's typing. Undo of a
  category move with `inbox.category`, which puts the note at the category's end, not its place.
- **If wrong**: The UI's parts are local to `NoteView.tsx`, `useNoteActions.ts`, or `CommitBar.tsx`;
  the Undo's rules to `actions/inbox/undo.rs`.
- **Where**: task 10 and its review, `packages/web/src/NoteView.tsx`, `useNoteActions.ts`,
  `CommitBar.tsx`, `EditableLine.tsx`, `useLineSave.ts`, `data.ts`, `views.ts`, `InboxPage.tsx`,
  `App.tsx`; `crates/core/src/actions/inbox/undo.rs`, `actions/changes.rs`, `api/inbox_edits.rs`,
  `files/inbox/found.rs`, `files/priorities.rs`, `files/proposal.rs`, `files/lines.rs`; the
  binding's `inbox_writes.rs`; the server's `fate/inbox-mutations.ts`

## R21: A note with an image: the core links it, a refusal leaves nothing, and the image waits for Add

- **Decision**:
  - A draft made from a note takes the slug of `slug::from_text`, as `ura draft` does: "The spec
    page's headings are body-sized" is `the-spec-page-s-headings-are-body-sized`. The spec's US6
    path, `the-spec-pages-...`, is illustrative; the tests use the real slug.
  - "Add as a draft" calls `inbox.addAsDraft`, then the existing `/attach` upload to the draft it
    wrote, which makes it a folder and rewrites the inbox's link (review focus 7), then
    `inbox.linkImage { draft, hash, link }`: the core puts the image's link on a line of its own at
    the end of the draft's What, through `proposal::append_to_what`, over the draft as read, and
    only for an image saved in that draft's own `images/`. The web UI places no link in a draft's
    markdown.
  - An image the core refuses takes the note and its draft back out, through `inbox.undoAsDraft`:
    the form shows the core's message under the image, as image attachments do, keeps the text, and
    the inbox and the drafts are as before. The toast's Undo makes the same call.
  - `inbox.undoAsDraft { lines }` removes the note found by its lines, and its draft while no commit
    has it and it holds only what the add wrote, with at most a note's images. Discard deletes such
    a draft the same way, through `draft::remove_written`: the draft's file, the images its added
    lines link, then its `images/` and its folder once empty. A draft typed in is kept, its images
    with it (ruling R14).
  - The commit bar's Commit holds a draft folder's linked images, those no file of the folder links
    deleted, as a draft's own commit does.
  - The picked image waits for Add, as the text does: the form's overlay holds it in memory, so it
    is shown again as the form opens again, until Add, Remove, or a confirmed Cancel; it counts as a
    change for Cancel's "Discard your changes?". It is lost on a reload. The UI behaviour decision's
    "Adding an image to a field MAY save that field at once" is not used: saving it would make the
    draft, which "Add as a draft" decides, and Cancel could no longer leave nothing behind.
  - The image's row shows a decorative thumbnail, its name, and "Remove", whose name is "Remove
    <name>". "Attach an image" is `AttachButton` with a `text` that replaces its "Add image".
  - An inbox row draws its note's text without its links: the row is one link, and a draft's link
    nested in it took the tap on the phone. The note's view still shows the link.
  - `retarget` puts `PRIORITIES.md` back when the write of `INBOX.md` fails, so neither list links a
    path that does not exist.
- **Rationale**: The plan names the upload but not where the image's link goes, and the spec puts it
  right after the What paragraph: a rule about a proposal's markdown, which the stack decision puts
  in the core. Creating the draft before the upload is R4's order, so a refusal must undo the add
  for the human to find nothing changed. A `File` is not text the browser's unsaved store keeps.
- **Alternatives considered**: Inserting the link in the web UI and saving the draft with
  `text.save`, which needs the UI to find the What paragraph in the markdown. One mutation taking
  the note and the image's bytes, R4's rejected alternative. Leaving a text-only draft after a
  refused image, which R4's "If wrong" accepted: the human would find a draft and a note they did
  not mean to add. Keeping the image in the browser's storage, as large as 20 MB.
- **If wrong**: `link_note_image` and `undo_note_as_draft` are a few lines each over existing
  operations; the pending image is local to `NoteOverlay`.
- **Where**: task 11, `crates/core/src/actions/attach.rs`, `actions/changes.rs`, `actions/draft.rs`,
  `actions/inbox.rs`, `actions/inbox/undo.rs`, `files/proposal.rs`, `files/retarget.rs`,
  `api/inbox_edits.rs`; the binding's `inbox_writes.rs`; the server's `fate/inbox-mutations.ts`;
  `packages/web/src/AddNote.tsx`, `NoteImage.tsx`, `SidebarAdd.tsx`, `InboxPage.tsx`,
  `attach/AttachButton.tsx`
