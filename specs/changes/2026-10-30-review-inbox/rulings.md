# Rulings: Review the inbox and fix all small issues that can be fixed without extra feedback

The low-impact choices made while building [the proposal](proposal.md), within the decisions. None
binds future work: those are decisions.

## R1: Which notes the change fixes

- **Decision**: it fixes nine notes and leaves five in the inbox. It leaves the home columns, which
  [the wide guide](/specs/ui/wide.md) centres on the whole screen as you asked ("They should be
  center of _the whole screen_"), so the note asks for the opposite of a ruling of yours. It leaves
  the performance-pass mockups that did not work locally, since their links and story files are
  right, and the cause shows only in the running app. It leaves the replaced behaviour block, which
  the note says needs a review with the decisions changes, the phone's padding and text size, which
  names no page, and Claude Design, a test to run.
- **Rationale**: the proposal asks for what can be fixed without your feedback; each of these needs
  it, or a look at the app on your machine.
- **Where**: `specs/INBOX.md`

## R2: The inbox's `p` still promotes

- **Decision**: only the priorities' expand moves to `e`. The inbox's `p` promotes a note to the
  priorities, another action, which [the keyboard guide](/specs/ui/keyboard.md) names.
- **Rationale**: the inbox has no expand: its `p` is promote, and its mnemonic holds.
- **If wrong**: one line in `InboxList.tsx`'s row actions.
- **Where**: `packages/web/src/lists/useRowKeys.ts`

## R3: Approve held back by the web UI alone

- **Decision**: a comment on a part of a spec holds Approve back in the web UI. `ura review` and the
  core still accept a spec approved with any comments, and the skill's
  [conventions](/skills/uraeda/references/conventions.md) still say an approved spec's comments go
  to the plan: general ones now.
- **Rationale**: the note is about the review page. Refusing it in the CLI changes a public
  interface, which is a feature's work.
- **If wrong**: the same rule in `crates/core/src/actions/review.rs` and the skill, as a feature.
- **Where**: `packages/web/src/ReviewVerdict.tsx`

## R4: The editor gives the formatter's lines room rather than joining them

- **Decision**: of the note's two ways, the editor's field is wide enough on a wide screen for a
  formatted file's 100 columns, which then keep their lines, and it still wraps softly: a paragraph
  typed without line breaks, or a note expanded on one line, wraps at the field's edge.
- **Rationale**: joining the formatter's breaks rewrites your file at each save, and the formatter
  wraps it back, a fight on every commit; it would also join breaks a project without a formatter
  meant. Turning wrapping off, tried first, made every unformatted paragraph one line scrolling
  sideways, worse than the line jumps. 100 columns is oxfmt's width, and wider than Prettier's 80.
- **If wrong**: on a wide screen narrower than the pane, about 1300 px with the sidebar open, a
  100-column line still wraps once at the field's edge.
- **Where**: `packages/web/src/EditorPage.tsx`, `packages/web/src/layout/pane.stylex.ts`

## R5: A started proposal's links are rebased

- **Decision**: starting a feature or a change rewrites the relative links of its proposal to point
  at the same files from its dated folder; its words stay yours.
  [Projects](/skills/uraeda/references/projects.md) said the proposal moves "unchanged", and now
  says its links change only.
- **Rationale**: a relative link written in `specs/proposals/` points nowhere once the file is one
  folder deeper, and `ura check` then fails every check of the branch, as phone-bottom's did. Expand
  already rebases links the same way.
- **Alternatives considered**: asking for rooted links (`/specs/ui/phone.md`) in proposals, which
  leaves every hand-written relative link to break.
- **Where**: `crates/core/src/actions/start/commits.rs`
