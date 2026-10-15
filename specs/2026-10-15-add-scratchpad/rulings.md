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
    file has none.
  - `INBOX.md` and `INBOX-TRIAGE.md` are recognized by name in any folder, as `PRIORITIES.md` is.
    The triage takes the clarifications statuses, and `check::fields` gives `answered` the `Submit`
    action, as for a round.
  - The `ura check` paragraph of `conventions.md` names the inbox's checks, the priorities' four
    sections, and the started-feature exemption of links, which it did not; `projects.md` says what
    `ura init` prints and that a second run only adds what is missing.
- **Rationale**: `category_names` gives no lines, and a problem without a line would not point at
  the heading to rename. The CLI decision requires every checked rule in the skill, and the
  priorities' sections and the exemption were checked without being written there.
- **Alternatives considered**: Finding the repeated heading through the markdown parser's headings,
  a second rule for what a category is.
- **If wrong**: `category_headings` folds back into `category_names`, and the check reports no line.
- **Where**: task 5, `files/inbox.rs`, `check/`, `references/conventions.md`, `projects.md`
