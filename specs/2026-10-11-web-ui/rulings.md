# Rulings: Web UI for the workflow files

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The watcher waits for quiet itself, without notify-debouncer-full

- **Decision**: the core's watcher uses `notify` alone, and waits for 200 ms without a file event
  before it reads the workspace again, in its own thread.
- **Rationale**: the watcher reads the whole workspace again after each burst, so pairing an
  editor's rename-on-save events, which `notify-debouncer-full` does, changes nothing: the file is
  read as it is once the burst ends. One dependency less, and the quiet time is exactly the spec's
  200 ms ([`watch.rs`](/crates/core/src/watch.rs)).
- **Alternatives considered**: `notify-debouncer-full` 0.7, as the spec's design named it, whose
  batches can split a burst in two and would need the same quiet loop on top.
- **If wrong**: a burst of renames could report a file twice; adding the debouncer in front of the
  loop is a local change in `watch.rs`.
- **Where**: task 7 of the plan.

## R2: Problems from `ura check` show for features read from disk

- **Decision**: a feature's page lists the problems `ura check` finds when the feature is read from
  a working tree, its checkout or its worktree; a feature read from its branch's tip lists the
  problems of its frontmatter only.
- **Rationale**: `ura check` reads files from disk, with the folder's other files and the links
  around them ([`check/mod.rs`](/crates/core/src/check/mod.rs)); a feature the UI wrote to always
  has its worktree, so the files the human edits are checked.
- **Alternatives considered**: checking texts read from git, which means a second entry point into
  every rule of `ura check`, links included.
- **If wrong**: a broken file on a branch checked out nowhere shows its problem once it is opened
  for writing, or with `ura check` on that branch.
- **Where**: `api::read_workspace`, task 8.

## R3: Refusals reach the UI as `BAD_REQUEST`, their kind in the message

- **Decision**: the server sends every refusal of the core as fate's `BAD_REQUEST`, its message
  starting with the core's code, `refused: `, `conflict: `, or `hook: `, the hook's output after a
  blank line; the UI reads the code from the message.
- **Rationale**: fate's client hands an error to the code that called the mutation only for the HTTP
  statuses of known codes, 400 among them; an unknown code such as `CONFLICT` goes to the nearest
  error boundary instead, which would replace the page
  ([`store-o9zgwPsF.mjs`](/node_modules/@nkzw/fate/lib/store-o9zgwPsF.mjs),
  `categorizeHTTPErrorStatus`).
- **Alternatives considered**: fate's `issues` field, made for validation issues with a message and
  a path each, which the hook's output does not fit.
- **If wrong**: a refusal whose message starts with another word shows as `refused`; the codes live
  in `crates/binding/src/lib.rs` and the UI's error helper only.
- **Where**: task 9.

## R4: The server answers selections inside objects with the whole object

- **Decision**: before fate reads a request, the server reduces each selected path to its first
  segment, `step.name` to `step`, and sends the field whole.
- **Rationale**: fate's client types ask views to select inside plain objects field by field, while
  its server plan matches a field declared `true` by its own path only, and drops `step.name`
  ([`fate/select.ts`](/packages/server/src/fate/select.ts)). Every field of the UI's records is
  declared whole, so the reduction loses nothing the core sent.
- **Alternatives considered**: declaring each object as a nested data view, which fate then
  normalizes as an entity needing an id; or one view per object type, with a source each.
- **If wrong**: a record later given a real relation would need its paths kept; the reduction lives
  in one function.
- **Where**: task 10, `packages/server/src/app.ts`.

## R5: Callouts are drawn as a bar, not a boxed banner

- **Decision**: the document page draws a callout with a 4 px bar on its left and its title in bold,
  as the mockup's spec review shows, rather than Astryx's `Banner`.
- **Rationale**: the reading layout allows no box inside a box, and a callout often holds lists and
  paragraphs; the human approved the mockup's bar. `Banner` stays for the page's own messages, like
  "Could not reach the Uraeda server.".
- **Alternatives considered**: `Banner` for every callout, as the spec's component list first named
  it.
- **If wrong**: one case of `Blocks.tsx` changes.
- **Where**: task 10.

## R6: The layout test counts text as cut where an element clips it

- **Decision**: SC-007's test fails on an element that clips its content, by an ellipsis or a hidden
  overflow, and whose text is wider than it; on anything reaching past the screen's right edge; and
  on a page scrolling sideways. An element declaring an ellipsis on a text that fits, like Astryx's
  badges, passes, as do the bands and tints that run into the page's own padding.
- **Rationale**: the criterion is about text a person cannot read; the badges' "Review" and "Merged"
  fit, and the full-bleed bands are the reading layout's design
  ([`layout.test.tsx`](/packages/web/src/__browser__/layout.test.tsx)).
- **Alternatives considered**: failing on any declared ellipsis, which means restyling Astryx's
  badges for text they never cut.
- **If wrong**: a badge given a long label could be cut without the test seeing a declared ellipsis;
  its clipping is still measured.
- **Where**: task 14.

## R7: Minor findings of the final review, left for the pull request

- **Decision**: these minor findings stay as they are, listed in the pull request for the human: a
  worktree deleted by hand without `git worktree prune` makes the reads of the default branch skip
  it only once it is written to; `vp dev` with the binding not built fails on the first request
  rather than at start; an answer with an unclosed code fence breaks the questions after it, as it
  would when typed by hand; the skill's setup section does not repeat the worktrees, which its
  branches section covers; the UI computes which follow-ups to show and the answer it displays while
  a save runs from the core's `applies`, letters, and comment.
- **Rationale**: none loses a human's text or makes a wrong commit; each has a local fix.
- **Alternatives considered**: fixing them in this branch, which grows it further.
- **If wrong**: each is a small change in `api.rs`, `dev.ts`, `clarifications.rs`, `SKILL.md`, or
  `RoundPage.tsx`.
- **Where**: the final review.
