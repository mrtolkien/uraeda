---
kind: feature
finished: 2026-10-31
pull-request: https://github.com/mrtolkien/uraeda/pull/79
supersedes: [2026-10-20-merge-chats, 2026-10-29-amend-latest, 2026-10-29-performance-pass]
---

# Record: Proposal start flow

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-31, in [its pull request](https://github.com/mrtolkien/uraeda/pull/79). Its full files are
> in git: `git log -- specs/2026-10-30-proposal-start/`.

## What and why

Starting planned work from a line of the priorities took four steps: the line's Start, the New
page's Feature card, a proposal file in the editor, then the editor's Start pane. The New page's
composer also mixed texts: a line's Start appended the line under whatever draft was there, and each
of the three cards kept a text of its own. The human asked that a Start not add to the draft, that
the Session, Change, and Feature cards share one text, and that a feature started from the New page
land straight on its session, the composer's text being the proposal.

## Behaviour

- **The Feature card starts the feature into its session (US1).** `Ctrl+Enter` opens "Name the
  feature", its slug the one the core proposes for the text, selected, and "Research effort" with
  Low, Medium, and High, High picked. Enter starts it: the session of its folder opens at once, the
  discovery's message in its composer, unsent, as the editor's Start does, while the write queue
  commits it. The proposal is the text: `discovery: <level>` in its frontmatter, `# <title>` from
  the first written line cut at 80 characters, the rest as typed, then `![Image N](images/<file>)`
  per image, the images in the feature's `images/`. A line of **Now** it was filled from is replaced
  by the feature's link in the start commit, its nested lines going into the proposal; a line edited
  meanwhile stays, and the link is added at the top of **Now**. A taken slug keeps the dialog open
  with "A feature named dark-mode exists already.", and the text. Every text starts a feature: the
  New page no longer writes a proposal file for later, which the priorities' Add, then Expand, do.
- **One draft for the three cards (US2).** Switching between Session, Change, and Feature keeps the
  text byte for byte, its images, and the lines and notes it was filled from. A reload keeps the
  text and those sources, so a line's start still replaces it, but not the images. An emptied
  composer forgets its sources. The drafts the Change and Feature cards kept before are joined into
  the shared one at the first load, the Change's text, a blank line, then the Feature's, and their
  entries go.
- **A line's Start replaces the draft, with an Undo (US3).** Start on a line opens the Feature card,
  the composer holding the line and its nested lines as bullets, with no "From PRIORITIES.md" line.
  A draft it replaced, text, images, and sources, comes back with the "Draft replaced" toast's Undo,
  or `u`, for 5 seconds; an empty draft shows no toast. The cards under the composer still add to
  the draft, with their link.
- **The text goes once the start lands.** A change's start clears only the draft it sent; a newer
  one stays whole, images included. A feature's text stays until its feature can be read, so a hook
  refusing its commit leaves it in the composer, and the refused session says so.

## Design

The core already started a change from a typed text in one commit; the feature's start became the
same start with a kind, so a refused slug writes nothing, and the browser keeps one text.

- [`start::Text`](/crates/core/src/actions/start/mod.rs) and `run_text_with` and `plan_text`: the
  typed start of either kind, its text checked before anything is read or written, a feature's
  effort refused when it is not one of [`discovery_levels`](/crates/core/src/files/proposal.rs).
  [`typed.rs`](/crates/core/src/actions/start/typed.rs) owns the title rule and writes the proposal
  and images; [`line.rs`](/crates/core/src/actions/start/line.rs) owns which line of **Now** a start
  replaces, for both kinds.
- [`api::plan_text_start` and `api::start_text`](/crates/core/src/api/start.rs), and the binding's
  `planTextStart`, `startText`, and `discoveryLevels`, in
  [`crates/binding/src/start.rs`](/crates/binding/src/start.rs); `startChange` runs over them.
- `feature.startText`, in [`fate/starts.ts`](/packages/server/src/fate/starts.ts): it plans in the
  same turn and slug hold as a proposal file's `feature.start`, answers with the plan and the
  discovery's message, and queues the start on the plan's day. The `SlugProposal` record carries the
  dialog's levels.
- [`newDraft.ts`](/packages/web/src/newDraft.ts): the New page's draft, one entry per repository in
  the unsaved store, `new-draft`, with its `sources`, and its images in a draft kept for the
  document's life. It owns the old entries' join, the Start's replace and its Undo, and `sent`.
- [`NewFeatureComposer.tsx`](/packages/web/src/NewFeatureComposer.tsx): the Feature card's composer
  and dialog. Its plan is remembered by [`useStart.ts`](/packages/web/src/useStart.ts), whose
  `landed`, called by [`StartingSession.tsx`](/packages/web/src/session/StartingSession.tsx) once
  the feature can be read, clears the draft and takes the other sources out of their files, through
  [`takeOut.ts`](/packages/web/src/takeOut.ts).

## Replaced behaviour

- **The Feature card writes a proposal file and opens it in the editor.** Guarded by
  `keys-pages.test.tsx` "US3 5: on the New page, `i` focuses the composer of the kind picked", which
  still holds: the Feature card's box keeps its "Write Proposal" name.
- **A typed proposal is drafted as a line of Now and a file, in one call.** Removed with the core's
  `draft_proposal` and the `proposals.draft` mutation: `proposal.rs`'s
  `a_drafted_proposal_writes_its_line_and_its_file_in_one_call` and
  `a_refused_draft_leaves_the_priorities_and_the_folder_as_they_were`, and `cache.rs`'s
  `a_draft_after_a_start_seen_by_the_watcher_goes_below_it`.
- **Each card keeps a text of its own.** `new-page.test.tsx` "a start that answers late clears only
  the text it sent" now reads the shared draft.
- **A line's Start appends the line, with a link to `PRIORITIES.md`, under the draft.** Not guarded
  by a test.

## Gotchas

- **A reload before a feature's start lands forgets its plan**: the plan, and its landing, are kept
  in the page's memory, so the text and its sources then stay until the human empties the composer.
  A second start of the same text that day is refused, as its slug is taken. Keeping the plan with
  the draft would add a stored field.
- **A feature's record says `missing: false`**: the browser merges a record into the one it read
  before, so a page that read the folder missing before its start landed kept the flag, and never
  saw the feature land ([`fate/sessions.ts`](/packages/server/src/fate/sessions.ts)).
- **An inbox note's move to a proposal file stays**: `inbox.toProposalFile` lost its only web
  caller, but its core tests guard stored formats the spec did not list as replaced
  ([`api/inbox_edits.rs`](/crates/core/src/api/inbox_edits.rs)).

- **A feature's text waits for its session page**: the server answers once the start is planned,
  before its commit lands, so the draft is cleared by the session page of the start once it reads
  the feature. A human who leaves that page first finds the text still in the composer, and a second
  start of it is refused as its slug is taken
  ([`StartingSession.tsx`](/packages/web/src/session/StartingSession.tsx)).
- **A stored source keeps its line's section**: the start replaces only a line of **Now**, read from
  the source, so a reload must not make a line of **Next** look like one of **Now**
  ([`newDraft.ts`](/packages/web/src/newDraft.ts)).
- **Built on Feature state before its merge**: this branch merged the Feature state branch, whose
  line replacement for a typed change it builds on, and caught up with `main` by a merge rather than
  a rebase, so that branch's commits are not replayed as this one's.

## Questions

### Round 01

#### Q1: Does the Feature card start the feature for every text, or only for a text from a line?

**Answer:** A: every text starts the feature; the New page no longer writes a proposal for later.

#### Q2: Does the feature's discovery start running as soon as the feature starts?

**Answer:** A: the session opens with the discovery's message in its composer, unsent.

#### Q3: Where do you pick the research effort of a feature started from the New page?

**Answer:** A: in the start dialog, under the slug, Low, Medium, or High, High first.

#### Q4: What happens to a text the composer already holds when you press Start on a line?

**Answer:** A: the line replaces the text, and a toast's Undo brings the old text back.

### Round 02

#### Q1: How should the draft replaced by a line's Start be protected?

**Answer:** Neither option: "Just make it a SHOULD instead. Here it's warranted. User intent was
clear."

## Decisions

- [UI behaviour](/specs/decisions/ui-behaviour.md): "Unsaved text SHOULD NOT be dropped without
  asking", from a MUST NOT, so an action whose intent is clear may replace a draft.

## Changes after approval

- A line's Start replaces the draft's images too, and its Undo brings them back with the text.
- A refused start's dialog shows the core's reason as a sentence, with its period.
- The session page of a refused typed feature says "Nothing started: your text is still on the New
  page."
- A start that lands takes out only the images it sent: an image pasted since, over the same text,
  stays in the composer.
- A started feature's other sources, the notes it was filled from, are found again by their text: a
  note removed above one since the composer was filled no longer makes the start take out another.
