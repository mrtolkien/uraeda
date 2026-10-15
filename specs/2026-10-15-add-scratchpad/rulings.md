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

## R4: A note with an image is one core call that writes the draft folder, the image, and the note

- **Decision**: "Add as a draft" sends the note and the image in one request,
  `POST /r/<name>/inbox/note-image`, beside `/attach`, with its limits. The server passes the bytes
  to the core's `api::add_note_with_image`, which encodes the image first, so a refused one writes
  nothing, then, under the write lock and over the inbox's hash, writes the draft folder
  `specs/drafts/<slug>/proposal.md` with the image's link at the end of its What, the image in its
  `images/`, and the linked note, all or none.
- **Rationale**: The plan's first version, `inbox.addAsDraft`, then the `/attach` upload, then a
  link, left things behind on every failure between the calls: a refused link left a note, a draft,
  and an unlinked image, which a retry doubled; an upload the page stopped waiting for, though the
  server finished it, left the note and the draft, which the page then looked for at the old path;
  and a refused clean-up was lost. One call has nothing in between to fail. The image is still
  encoded by the core alone, as the [attachments decision](../decisions/attachments.md) asks.
- **Alternatives considered**: The three calls with an Undo of the add on a refusal, the first
  version of task 11, for the reasons above.
- **If wrong**: The endpoint and `add_note_with_image` are about 100 lines; the web UI's add is
  local to `NoteImage.tsx`.
- **Where**: tasks 4 and 11, and task 11's review

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
    into Discard. Commit still holds the drafts of the moves and those an added note links. Amended
    by ruling R33: a never-committed draft the lists link since the last commit is deleted while it
    holds what a tool wrote for the link.

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

## R21: A note with an image: one call, Discard and Undo take the whole draft, the image waits for Add

- **Decision**:
  - A draft made from a note takes the slug of `slug::from_text`, as `ura draft` does: "The spec
    page's headings are body-sized" is `the-spec-page-s-headings-are-body-sized`. The spec's US6
    path, `the-spec-pages-...`, is illustrative; the tests use the real slug.
  - The add is one core call (ruling R4): a refusal, the image's or a conflict, leaves nothing to
    clean up. The image's refusal shows under it, as image attachments' do, and the text stays; a
    conflict shows in the form and reads the inbox again, as a text note's does.
  - An add whose answer is lost, by a time-out or a dropped connection, reads the inbox again: a
    note it did not hold before, linking a draft, with the note's text, means the server finished
    it, and the add is done, so pressing Add again never adds it twice. Otherwise the refusal shows
    under the image.
  - The toast's Undo calls `inbox.undoAsDraft { lines }` with the lines the add wrote, as a text
    note's Undo finds its note by them: the core removes the note holding exactly those lines, and
    refuses once it changed or left. With it goes its draft while no commit has it and it holds only
    what the add wrote, the image's link included.
  - Discard and that Undo delete such a draft through `draft::remove_written`, with its whole
    `images/`, then its folder once empty: only the add filled it, since an image attached since
    would have changed the text, so no unlinked image is ever left. A draft typed in is kept, its
    images with it (ruling R14). `proposal::image_file` reads only a line the core writes, an image
    of `images/` whose alt text holds no bracket and whose name is a WebP or a GIF.
  - The commit bar's Commit holds a draft folder's linked images, those no file of the folder links
    deleted, as a draft's own commit does.
  - The picked image waits for Add, as the text does: the form's overlay holds it in memory, so it
    is shown again as the form opens again, until Add, Remove, or a confirmed Cancel; it counts as a
    change for Cancel's "Discard your changes?". The UI behaviour decision's "Adding an image to a
    field MAY save that field at once" is not used: saving it would make the draft, which "Add as a
    draft" decides, and Cancel could no longer leave nothing behind.
  - After a reload, the restored text's notice does not mention a lost image: a `File` is not kept
    in the browser's storage, and the form shows no image row, so the human sees that none is
    attached. A notice of its own would need the image's name kept beside the unsaved text, for
    little.
  - The image's row shows a decorative thumbnail, its name, and "Remove", whose name is "Remove
    <name>". "Attach an image" is `AttachButton` with a `text` that replaces its "Add image".
  - An inbox row draws its note's text without its links: the row is one link, and a draft's link
    nested in it took the tap on the phone. The note's view still shows the link.
  - `retarget` rewrites `INBOX.md`'s links too, for an image attached to a note's draft from the
    editor, and puts `PRIORITIES.md` back when the write of `INBOX.md` fails.
  - `inbox.addAsDraft` and the binding's `addNoteAsDraft` are removed, as nothing calls them;
    `actions::inbox::add_as_draft` stays, which the change list's tests use.
- **Rationale**: The plan names the upload but not where the image's link goes, and the spec puts it
  right after the What paragraph: a rule about a proposal's markdown, which the stack decision puts
  in the core. Task 11's review found the three calls left a note, a draft, or an image behind on
  their failures (ruling R4).
- **Alternatives considered**: Inserting the link in the web UI and saving the draft with
  `text.save`, which needs the UI to find the What paragraph in the markdown. Three calls with a
  clean-up on refusal, the first version. Keeping the image in the browser's storage, as large as 20
  MB. Deleting only the images the draft links, which left an image copied into the folder.
- **If wrong**: `add_note_with_image` and `undo_note_as_draft` are small over existing operations;
  the pending image is local to `NoteOverlay`.
- **Where**: task 11 and its review, `crates/core/src/actions/attach.rs`, `actions/changes.rs`,
  `actions/draft.rs`, `actions/inbox.rs`, `actions/inbox/image.rs`, `actions/inbox/undo.rs`,
  `files/proposal.rs`, `files/retarget.rs`, `api/inbox_edits.rs`; the binding's `inbox_writes.rs`;
  the server's `attach.ts`, `app.ts`, `dev.ts`, and `fate/inbox-mutations.ts`;
  `packages/web/src/AddNote.tsx`, `NoteImage.tsx`, `SidebarAdd.tsx`, `InboxPage.tsx`,
  `attach/AttachButton.tsx`

## R22: The triage's messages are a module the UI imports, and its saves are based on all the page saw

- **Decision**:
  - `ORGANIZE_INBOX` and `APPLY_TRIAGE` live in `packages/server/src/runner/triage-messages.ts`,
    free of Node's modules, re-exported by `runner/message.ts` and exported to the web as
    `uraeda-server/triage-messages`. The UI imports only constants from it, as it does from
    `uraeda-server/limits`: fixed strings, not core data, so no view carries them, and the UI never
    writes them out by hand.
  - `RoundPage` takes a `target`, `{ folder }` or `{ triage: true }`, and its answers, notes,
    submit, and retry go through `roundTarget.ts`'s `useRoundWrites`, to `answer.save`,
    `notes.save`, `answers.submit`, and `commit.retry`, or to `triage.answer`, `triage.notes`,
    `triage.submit`, and `triage.retry`. `Question` takes the target in place of its folder;
    `FilePage` passes `{ folder }`.
  - The triage's answers and notes take `base`, besides `previous`: the hash of the whole triage as
    the page last read or wrote it, and the core refuses them as a conflict once the file holds
    anything else, as another page's answer. This changes task 6's `triage.answer` and
    `triage.notes`, and the core's and the binding's `save_triage_answer` and `save_triage_notes`.
    The page keeps the hash in `Hashes`, provided by each `RoundPage`: its writes to the triage run
    one after another, each based on the hash the last one wrote, and the submit, over the same
    hash, commits only what the page saw. A read of a text the page already had, drawn late, does
    not replace it.
  - The triage hides the feature's crumbs, "Ask the agent", and the hand-over: its Submit is one
    "Submit answers" button, which goes back to the inbox once committed, where "Apply the answers"
    waits. A hook's refusal of its commit offers "Try again", as a round's does, through
    `triage.retry`: the core's `retry_triage` commits `INBOX-TRIAGE.md` alone, as
    `chore: answer the inbox triage`, when it is answered and differs from the last commit.
    `RoundPage` keeps the submit's state, so the refusal stays once the page reads the round as
    answered.
  - "Organize with an agent" and "Apply the answers" show only while the agent works on this
    machine, as the feature pages' agent buttons do. Without one, "Organize with an agent" opens its
    message, and the answered triage's banner holds the apply message, each with "Copy the message",
    to give an agent elsewhere. "Answer it" is a link drawn as a button, `Button` with an `href`,
    since a link in a banner's text is 20 px tall, under the 44 px of a control on the phone.
    `/inbox/triage` without a triage says "No inbox triage waits." with "Open the inbox".
  - The triage's comments and notes offer no image: `takesImages(path)` is false for
    `specs/INBOX-TRIAGE.md`, which hides "Add image", and drops and pastes skip the field. The core
    takes no image for a file that is no feature's, bug's, or draft's, and the triage is committed
    alone.
- **Rationale**: The plan left the boundary to the implementer; the limits module is the existing
  pattern for constants the server and the UI share, and `message.ts` imports `node:path`, which the
  UI's bundle cannot. The plan's `previous` for the submit only holds if every save before it was
  based on what the page saw: a check of the saved answer or notes alone let a save adopt another
  page's answers. The triage needs the retry the feature rounds have, or a refused commit leaves it
  answered and uncommitted, with nothing to try.
- **Alternatives considered**: A field of the `Inbox` view holding both messages: data sent with
  every inbox read for two constants. Reading the triage's hash from the server before the submit:
  answers written elsewhere would be submitted unseen. Saves in parallel, each based on the hash
  read: a second tap before the first save answered would be refused.
- **If wrong**: the messages module moves with one export line; `useRoundWrites` is the one place
  that picks the mutations, and `Hashes` the one that keeps the base.
- **Where**: tasks 6 and 12, `crates/core/src/actions/inbox.rs`, `api/answers/triage.rs`, the
  binding's `inbox_writes.rs`; `packages/server/src/runner/triage-messages.ts`, `runner/message.ts`,
  `fate/inbox-mutations.ts`, `packages/server/package.json`; `packages/web/src/roundTarget.ts`,
  `RoundPage.tsx`, `RoundNotes.tsx`, `RoundSubmit.tsx`, `Question.tsx`, `QuestionComment.tsx`,
  `useAnswer.ts`, `attach/useImageText.ts`, `attach/useImageDrop.ts`, `FilePage.tsx`,
  `TriagePage.tsx`, `InboxPage.tsx`, `InboxTriage.tsx`, `data.ts`, `App.tsx`

## R23: Catching up with the bugfixing flow: what the rebase kept from both sides

- **Decision**:
  - The decisions `main` changed since this branch started,
    [attachments](../decisions/attachments.md), [CLI](../decisions/cli.md), and
    [UI checks](../decisions/ui-checks.md), rename bugs to changes, and conflict with nothing here.
    The CLI's "without a target, the current branch's feature or change" applies to
    `ura note --about`'s default (ruling R25); the other two do not apply to the inbox, whose images
    go in drafts' folders.
  - `workspace.rs`, which `main` split down to its `LARGE` number, 967, got room for the inbox's two
    fields in a structural commit: `linked_draft` and `match_feature` moved, unchanged, to
    `workspace/links.rs`. The draft API this branch moved to `api/drafts.rs` takes `main`'s versions
    of its functions, a change's paths included, while `start_feature` and `draft_path` stay in
    `main`'s `api/start.rs`.
  - The sidebar's `Item` takes both `main`'s `tag` and this branch's `actions`: a tag fills the
    row's end when there is one, which no row with ＋ has. The rows read Home, Priorities, Inbox,
    then `main`'s "New change", so the two rows with ＋ stay together.
  - The links of this feature's discovery, clarifications, and spec to the files the bugfixing
    feature removed, its draft and `references/bug.md`, point at its record or name the old path as
    code, as `main` did for its own records, so `ura check specs` passes. Their words are unchanged.
- **Rationale**: The
  [catch-up](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch) keeps
  what both sides need. A marked file may not grow past its number, so the room is made by a move,
  not by raising it.
- **Alternatives considered**: Raising `workspace.rs`'s number, which the structural test exists to
  refuse. "New change" between Priorities and Inbox, which splits the two rows with ＋.
- **If wrong**: Each is a few lines: the row order in `SessionNav.tsx`, the moved functions back.
- **Where**: task 14, `crates/core/src/workspace.rs`, `workspace/links.rs`, `api/drafts.rs`,
  `packages/web/src/SessionNav.tsx`, `SessionNavRows.tsx`, the feature's spec files

## R24: The triage's "Bug" outcome is a change, made a draft and started from it

- **Decision**: A triage question's options offer "a change" in place of "a bug": its draft's title
  and the slug it starts with. Applying it makes the note a new draft, as a new draft option does,
  linked from the end of **Now**, in the apply commit, listed in its body as
  `- Start the change <slug>: <note>`. Then the agent starts the draft with
  `ura start <draft> --slug <slug> --change`, as **Start as a change** says, and tells the human to
  open `/f/<folder>`: the triage's run does not make the change. The proposal is the draft as
  written, the note's lines, without what the question's context found. By hand, a change is a new
  draft that the human starts. The template, the fixture's Q2, and `references/inbox.md` say so.
- **Rationale**: The spec's assumption: "whichever feature lands second turns the triage's 'Bug'
  outcome into 'a draft started as a change'". The
  [change flow](/skills/uraeda/references/change.md) starts only when a human asks, which the answer
  is, and only from a draft or a typed text; its proposal "is the human's words", so the agent's
  findings stay in the triage, which the change's agent can read in `git log`. Linking the draft
  from **Now** is where starting puts its entry.
- **Alternatives considered**: Running the change in the triage's chat, which the change flow keeps
  in the change's own session. Writing the context's findings into the proposal, as the bug's report
  did, which would put the agent's words in the human's scope.
- **If wrong**: The text of `references/inbox.md`'s triage and the template, and the fixture's Q2:
  no code reads the outcome.
- **Where**: task 14, `skills/uraeda/references/inbox.md`,
  `skills/uraeda/assets/templates/specs/INBOX-TRIAGE.md`, `fixtures/INBOX-TRIAGE.md`

## R25: A note is about a feature or a change: `--about`, the slug mark, and the web UI

- **Decision**: `ura note --about` resolves features and changes, as `main`'s target resolution
  does, and refuses anything else with "--about names a feature or a change: none is named <name>".
  Without it, a change's worktree, on its `change/` branch, marks the note with the change's slug,
  as the CLI decision's "the current branch's feature or change" asks. A change's slug is its
  folder's name without its date, the same mark as a feature's; the web UI marks a note added from a
  change's page, `/f/<folder>`, with it. The two CLI tests of bugs and the web UI's test of a bug's
  page now start a change, `change/2026-10-14-broken-link` and `2026-10-14-login-crash`, which
  `main`'s fixtures can create; the bugs they tested no longer exist.
- **Rationale**: `main` removed `specs/bugs/` and `fix/` branches: the old tests named folders no
  tool reads now. The code already took changes through `target::resolve` and `branch_folder`; the
  refusal and the help still said bug.
- **Alternatives considered**: A distinct mark for a change, like `[change:x]`, a format change the
  spec does not make: the slug finds the branch, a feature's or a change's.
- **If wrong**: The refusal's text in `crates/cli/src/note.rs`, and the tests.
- **Where**: task 14, `crates/cli/src/note.rs`, `crates/cli/src/main.rs`,
  `crates/cli/tests/note.rs`, `packages/web/src/__tests__/inbox.test.tsx`, comments of the inbox's
  code

## R26: A change's agent notes what it finds outside its proposal

- **Decision**: [Making the change](/skills/uraeda/references/change.md#making-the-change) gains
  "Findings outside the proposal": a problem outside the proposal's items is noted in the inbox, as
  [agents' notes](/skills/uraeda/references/inbox.md#agents-notes) says, with the change's slug, and
  named in the pull request's description, whose "Minor findings" item lists the notes added.
  Agents' notes now name changes, and link the change flow.
- **Rationale**: The implementation step already sends findings outside a task to the inbox; a
  change is the flow most likely to meet a neighbouring bug, and has no plan to note it in.
- **Alternatives considered**: Adding the finding to the change as an item, which grows its scope
  past what the human wrote.
- **If wrong**: One bullet of `change.md`.
- **Where**: task 14, `skills/uraeda/references/change.md`, `references/inbox.md`

## R27: `ura check` of the inbox and a change's folder

- **Decision**: The inbox may link a started change's proposal, `changes/<folder>/proposal.md`, as
  it may a started feature's, through the same dated-folder exemption, which `conventions.md` now
  says. An `INBOX.md` or `INBOX-TRIAGE.md` inside a change's folder is no inbox: `main`'s
  `names.change-file` reports it, and nothing checks it as one. Both have a test.
- **Rationale**: The exemption already covered any dated folder; no test showed it for changes. The
  inbox's files are recognized only directly in `specs/` (ruling R15), and a change's folder holds
  only its own files.
- **Alternatives considered**: None that keep both rules.
- **If wrong**: A test each, in `crates/core/tests/check.rs`.
- **Where**: task 14, `crates/core/tests/check.rs`, `references/conventions.md`

## R28: The inbox page has no action to start a change

- **Decision**: `NoteView` offers no "Start as a change". A change from a note goes through Make a
  draft, then a start, or through the triage, or the web UI's "New change" with the note's text.
- **Rationale**: The spec keeps a bug off the inbox page, since it starts a branch the human asks
  for; a change is the same. The web UI starts drafts as features only, and changes from a typed
  text, so no start action fits the note's view without a new view or a new start path.
- **Alternatives considered**: A "Start as a change" button opening "New change" with the note's
  text, which leaves the note in the inbox once the change starts, with no commit removing it.
- **If wrong**: A button in `NoteView.tsx` and a removal after the start, a small feature of its
  own.
- **Where**: task 14, `packages/web/src/NoteView.tsx`, unchanged

## R29: The core decides what the add form's page is about, and what takes images

- **Decision**: The add form sends the folder of any `/f/<folder>` page as `about`; the core marks
  the note with its slug when it is a dated folder, a feature's or a change's, and marks nothing
  otherwise, instead of refusing it. A dated folder whose slug cannot be a mark is still refused.
  The test that `run-ui` is refused now checks that it adds the note without a mark: the web UI's
  own check, which the core's replaces, kept such a folder from reaching the core. Undo of an added
  note is the core's `undo_add`, found by its lines as `undo_as_draft` finds its note, refused the
  same way, also with two notes of the same lines, where the page picked one by its key. A file's
  view says whether it takes images, `takesImages`, and a note linking a draft gives the draft's
  title as the core reads it, `draftTitle`, which an add whose answer was lost compares by its
  words.
- **Rationale**: The final review found these rules copied in TypeScript: the dated-folder rule of
  `workspace::folder_slug`, the lookup of a note by its lines, the triage's path, and the title an
  add with an image writes, whose plain text dropped inline code. One home per rule.
- **Alternatives considered**: An endpoint telling whether a folder is dated, a request per page.
  Keeping the page's pick by key between two same notes, the copy the review asked to remove.
- **If wrong**: `marks` in `api/inbox_edits.rs`; `undo_add` in `actions/inbox/undo.rs`.
- **Where**: final review, `crates/core/src/api/inbox_edits.rs`,
  `crates/core/src/actions/inbox/undo.rs`, `crates/core/src/files/inbox/read.rs`,
  `crates/core/src/view.rs`, `packages/web/src/SidebarAdd.tsx`, `packages/web/src/NoteImage.tsx`,
  `packages/web/src/attach/useImageText.ts`, `crates/core/tests/inbox_actions.rs`

## R30: `add_as_draft` is gone; its tests add with an image

- **Decision**: `actions::inbox::add_as_draft`, which no tool called once task 13 made an add with
  an image one core call, is removed. Its tests in `inbox_moves.rs` add through `add_with_image`,
  through the API as the add form does: Discard deleting the untouched draft and keeping the one
  typed in, a first `INBOX.md` committed with its draft, and a note with brackets and code linked as
  written. `a_note_is_added_as_a_draft` is removed:
  `a_note_with_an_image_is_a_linked_draft_committed_with_its_image` checks the same draft, link,
  commit subject, and committed files.
- **Rationale**: A path no product code reaches proved guarantees for an add the product does not
  make; the same guarantees now hold for the add it makes.
- **Alternatives considered**: Keeping it for a future add as a draft without an image, which the
  spec does not ask for.
- **If wrong**: The function is in git history, with its tests.
- **Where**: final review, `crates/core/src/actions/inbox.rs`, `crates/core/tests/inbox_moves.rs`

## R31: This repository's scratchpad moves in the finish commit, not as the reference says

- **Decision**: `references/inbox.md`'s "Setting it up" stays as it is: a project adopting the inbox
  moves its `## Scratchpad`, or any other list of notes, in one commit on its default branch. This
  repository follows its approved spec instead: the feature's last commit, the finish, moves the
  default branch's scratchpad into `INBOX.md`, after catching up with it, as the spec's "Settled
  while writing this spec" and SC-005 say.
- **Rationale**: The final review found the two disagree. They describe two different moves: the
  reference, a project that adopts the inbox once it exists, with no feature branch to carry the
  move; the spec, the one feature that builds the inbox, whose notes must not leave `PRIORITIES.md`
  before the inbox that takes them merges. The spec offered the exception to "feature branches only
  remove their own entry" for the human to refuse; they approved it, asking to move the scratchpad
  as it is ([C1](spec-review.md)).
- **Alternatives considered**: A reference that also describes a move in a feature's finish, a rule
  for one feature, which no other project has.
- **If wrong**: The finish commit's move becomes a default-branch commit once this merges.
- **Where**: final review, `skills/uraeda/references/inbox.md`, unchanged; the finish step

## R32: The answered round and the approved spec had links edited, not words

- **Decision**: Commit 28c252f edited `clarifications-01.md`, answered, `discovery-01.md`, and the
  approved `spec.md`: the links `main`'s merge of the bugfixing feature broke, its draft and
  `references/bug.md`, point at its record or name the old path as code, as ruling R23 says. No word
  of a question, an answer, or the spec changed, and the spec's `revision` stays.
- **Rationale**: Answered rounds stay as they were, and an approved spec changes only with the
  human: both protect what the human read and decided. A link to a file `main` deleted fails
  `ura check specs`, and its replacement says what the human read, to the same feature.
- **Alternatives considered**: Leaving the links broken, and the checks failing. A new round or a
  spec revision for a link, which asks the human to read again what did not change.
- **If wrong**: Revert the link edits of 28c252f, and exempt these files from the check.
- **Where**: final review, commit 28c252f, `specs/2026-10-15-add-scratchpad/clarifications-01.md`,
  `discovery-01.md`, `spec.md`

## R33: The commit holds every never-committed draft the lists link; a new note added to a draft is a draft edit

- **Decision**:
  - The commit bar's Commit holds, besides the drafts of the paired moves, every draft that
    `INBOX.md` or `PRIORITIES.md` links once committed and that no commit has, whatever made it: a
    note added since the last commit and then made a draft leaves no trace in the inbox to pair, and
    its entry's link would otherwise be committed without its file.
  - Discard deletes such a draft, linked since the last commit, while it holds what a tool wrote for
    the link, the proposal titled by the link's text, with at most a note's images, as
    `remove_written` does for a paired move: Make a draft of a note without nested lines, or the
    Draft button. One typed in, or a draft holding a note's nested lines, is kept.
  - A note added since the last commit and then added to a committed draft is not counted by the
    commit bar, nor committed or taken back by it: the draft's edit is committed from its editor,
    and Discard keeps the note's text in the draft.
- **Rationale**: The second review found the pairing missed a note added and moved within the
  uncommitted change, leaving a dangling committed link. A link's draft is in the files, so the
  commit can hold it with no state outside git (constitution III). A new note added to a committed
  draft leaves files byte for byte the same as a bullet the human typed in the draft's What:
  counting it would sweep the human's draft edits into the inbox's commit, and Discard would delete
  their typing (ruling R14). Nothing dangles and nothing is lost: the note's text stays in the
  draft.
- **Alternatives considered**: Recording the moves somewhere outside the two lists, state outside
  git. Counting every bullet added to a draft's What as a move, which takes the human's typing.
  Leaving the lines out of the commit instead, which leaves the draft untracked once the lists move
  on.
- **If wrong**: `never_committed` in `actions/changes.rs`.
- **Where**: second final review, `crates/core/src/actions/changes.rs`,
  `crates/core/src/files/inbox.rs`, `crates/core/tests/inbox_moves.rs`

## R34: A draft's commit from its editor holds the drafts its lists need

- **Decision**: A draft's commit from its editor that holds `INBOX.md` or `PRIORITIES.md` also holds
  the drafts the commit bar's Commit would hold with them, those of the moves and those the lists
  link that no commit has (ruling R33), each folder with its linked images. Its subject stays the
  draft's. The check of the staged files before any write allows them and their `images/`.
- **Rationale**: The second review found that, after two notes added with images, committing one
  draft committed the inbox linking both, the other draft left untracked. The lists' changes are
  committed whole, so the files they need go with them: no committed link points at a missing file,
  and no move is committed half, the note gone from the inbox and not yet in its draft.
- **Alternatives considered**: Leaving the other notes' lines out of the committed lists, which
  stages a text no file holds, through the index, and leaves the commit bar a commit the human did
  not see coming; a refusal, which leaves the human to find the other draft.
- **If wrong**: `text::change` drops its call to `changes::drafts`.
- **Where**: second final review, `crates/core/src/actions/text.rs`,
  `crates/core/src/actions/changes.rs`, `crates/core/tests/inbox_moves.rs`

## R35: A refused commit unstages what it staged, and Discard leaves its files unstaged

- **Decision**: `Git::commit` resets the index entries of the paths it added to `HEAD` when the
  commit fails, a hook's refusal included, through `git reset`, the files kept as written: the index
  is as it was, but for a staged edit of those same paths, which the add had already replaced. The
  commit bar's Discard resets the index entries of `INBOX.md`, `PRIORITIES.md`, and every draft of
  its list, with their `images/`, to `HEAD`, however they were staged: a file it deletes leaves no
  entry, and one it keeps is unstaged, its text kept.
- **Rationale**: The second review found that a refused commit left new files staged, and Discard
  then deleted them from disk only: the staged additions blocked every later tool commit as other
  staged files, and a plain `git commit` would bring them back. Trying again adds the paths again,
  so nothing needs them staged.
- **Alternatives considered**: Unstaging in Discard only, which leaves a refused commit's files
  blocking the other tools' commits until the human discards or commits. `git rm --cached` of the
  deleted files only, which leaves a kept draft staged, outside the restored lists.
- **If wrong**: `Git::commit` stops calling `unstage`; Discard's call is one line.
- **Where**: second final review, `crates/core/src/git.rs`, `crates/core/src/git/status.rs`,
  `crates/core/src/actions/changes.rs`, `crates/core/tests/inbox_moves.rs`

## R36: A note's relative links are rebased into the draft it goes into

- **Decision**: A note's lines moved into a draft, by Add to a draft, Make a draft, or an add with
  an image, have their relative links and images rebased from `specs/` to the draft's folder: inline
  ones, nested lines' included, and reference definitions, written in the draft as the path from its
  folder to the same file, their `?query` and `#anchor` kept. Rooted paths (`/…`), URLs, anchors,
  and a link climbing out of the top level stay as written. A move into `PRIORITIES.md` rebases
  nothing: it is beside `INBOX.md`. `files/retarget.rs` holds both rewrites of link destinations, a
  moved draft's links and a note's, over one parser of destinations, which now reads images and
  nested links too. `draft::from_note` gives what a draft made from a note holds, which the move
  writes and the Undo and Discard compare with; `into_draft` gives a note's lines as Add to a draft
  writes them, which its Undo looks for. A note made a draft pairs with its entry by the entry's
  text: the change list reads the note's markdown as a link's text, escaped by `inbox::link_to` as
  Make a draft writes it, through `inbox::drafted_text`. A note holding a link, whose entry escapes
  its brackets, so is one move, and Discard deletes its untouched draft, nested lines included.
- **Rationale**: The second review found `[README](../README.md)` in `INBOX.md` pointed at
  `specs/README.md` once in `specs/drafts/x.md`, and further off from a folder draft. A note keeps
  its meaning when it moves. A note holding a link, made a draft, showed as a removal and an
  addition, and Discard kept its draft when it had nested lines.
- **Alternatives considered**: Rewriting relative links as rooted ones (`/README.md`), which reads
  differently from what the human wrote, and from the links the core writes elsewhere.
- **If wrong**: `rebase` in `files/retarget.rs`, called from `draft::from_note` and
  `inbox::into_draft`; the pairing, `take_moved` in `actions/changes.rs`.
- **Where**: second final review, `crates/core/src/files/retarget.rs`, `files/inbox.rs`,
  `crates/core/src/actions/draft.rs`, `actions/inbox.rs`, `actions/inbox/image.rs`,
  `actions/inbox/undo.rs`, `actions/changes.rs`, `actions/changes/drafts.rs`,
  `crates/core/tests/inbox_moves.rs`

## R37: A committed draft an image made a folder is committed and discarded as a rename

- **Decision**: The change list recognizes a committed single-file draft that an attached image
  moved into a folder: the lists linked the old file at the last commit and link the folder's
  `proposal.md` in its place, the old file is gone, and the folder is named after it, numbered when
  the name was taken. Commit holds the old file's deletion with the folder and its linked images.
  Discard restores the old file from `HEAD` and deletes the folder while its `proposal.md` holds the
  old file's text, with at most images added at the end of its What, as `remove_written` does for a
  draft a move wrote. A folder typed in is kept whole: the old file is not restored, and the
  restored lists link the folder, as the attach wrote them.
- **Rationale**: The final review found the folder counted as a new draft: Commit left the old
  file's deletion uncommitted, and Discard restored the lists' link to the old file without the
  file. Restoring the old file beside a kept folder would leave two copies of one draft, the
  committed one linked by nothing; keeping the conversion whole loses nothing and leaves no link
  dangling.
- **Alternatives considered**: Restoring the old file in every case, beside a kept folder: a
  duplicate draft. Recording the conversion outside git: state outside the files (constitution III).
- **If wrong**: `converted_from` in `actions/changes/drafts.rs`, and Discard's `Undo::Converted` arm
  in `actions/changes.rs`.
- **Where**: third final review, `crates/core/src/actions/changes.rs`,
  `crates/core/src/actions/changes/drafts.rs`, `crates/core/src/actions/attach.rs`,
  `crates/core/tests/inbox_moves.rs`
