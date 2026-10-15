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
  then on.
- **Rationale**: Task 1 only restructures: its tests pass unchanged before and after. The
  priorities' parser never skipped fenced code, so skipping it in task 1 would change what
  `PRIORITIES.md` entries are, inside a structural commit.
- **Alternatives considered**: Skipping fenced code in task 1, a behaviour change in a refactor. A
  flag on `items` to skip or not, two rules for one scan.
- **If wrong**: Gate the skip behind a parameter, so the priorities keep reading fenced bullets.
- **Where**: tasks 1 and 2
