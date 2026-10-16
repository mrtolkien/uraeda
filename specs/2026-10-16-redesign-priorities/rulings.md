# Rulings: Redesign home, inbox, and priorities

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The pane edits the draft's whole text

- **Decision**: with C2, "Edit" on a drafted entry opens the draft's file text, as the editor page
  shows it, in the pane, under the line's field: the same field key, `${path}#editor`, so the pane
  and the page share unsaved text.
- **Rationale**: the web UI must not parse markdown ([stack](../decisions/stack.md)), so it cannot
  cut the H1 and frontmatter out of the text by itself; one editor keeps one save, conflict, and
  image path ([`EditorPage.tsx`](/packages/web/src/EditorPage.tsx)).
- **Alternatives considered**: a core function editing only the body under the title: a new write
  path for a small gain; a second editor in the pane: a copy of the save logic.
- **If wrong**: the title line shows twice, in the line and in the text; a body-only field can
  replace the text later inside `DraftEditor`.
- **Where**: task 11.

## R2: A decision's icon is a Lucide name, with a default

- **Decision**: `icon` holds a Lucide icon name, like `git-branch`; the core checks only that the
  field is allowed, and the web UI shows a default icon for a name it does not register.
- **Rationale**: C8 asks for an optional field, easy to backfill; a list of names in the core would
  tie the file format to the web UI's icons.
- **Alternatives considered**: an emoji: no icon set to keep, but against the theme's outlines; a
  closed list checked by `ura check`: a core change at every new icon.
- **If wrong**: a typo shows the default icon silently; a check can be added from the web UI's list.
- **Where**: tasks 7 and 14.

## R3: A commit limited to its paths

- **Decision**: "Add and commit" commits with `git commit --only -- <path>`, through a new
  `Git::commit_only`, so other staged files stay staged.
- **Rationale**: the spec's edge case keeps other staged files out of the commit, while today's
  `Git::commit` refuses when any are staged ([`git/commit.rs`](/crates/core/src/git/commit.rs)).
- **Alternatives considered**: refusing, as `ura note` does today: the edge case would fail.
- **If wrong**: a hook that reads the whole index sees only the path; `ura note` keeps its refusal.
- **Where**: task 6.

## R4: "Ongoing" names the started entries' section

- **Decision**: the section above Now, holding the entries whose feature or change runs, is titled
  "Ongoing", in green.
- **Rationale**: C6 offers "Ongoing" or "Working"; "Working" is already the status of an agent's
  turn on home and in the sidebar, and a feature waiting on the human is not working.
- **Alternatives considered**: "Working", "Running" (the entries' own mark).
- **If wrong**: one string in `PrioritiesList.tsx`.
- **Where**: task 8.

## R5: `pathLink` keeps its return value

- **Decision**: `pathLink` moves to `links.tsx` as it is, returning `{ href, inApp }`, not the
  `string` task 1's interface named; `sessionData.ts` reads `useRefreshOnShow` and `WORKSPACE_ID`,
  which `data.ts` now exports.
- **Rationale**: task 1 is structural, with no behaviour change, and every caller reads `inApp` to
  choose between a page of the UI and a file opened by the browser.
- **Alternatives considered**: returning only the `href`: a change of every caller in a move.
- **If wrong**: later tasks call `pathLink(...).href` where they need a string.
- **Where**: task 1.

## R6: The watch flags the priorities when a linked feature's step changes

- **Decision**: the watch's priorities hash covers the priorities record as the core joins it,
  nested lines, drafts, and the steps of the features the entries link included, and `live.ts` keeps
  pushing the record only on `priorities` or `inbox`, not on every `workspace` change. The server's
  record sends each running feature's step through `sentStep`, so the web reads entries as the
  record's `PriorityEntry`, not the binding's `EntryItem`.
- **Rationale**: the record changes exactly when that hash does, so a feature that starts, moves a
  step, or finishes reaches the page (review focus 4); a push on every `workspace` change would also
  send the record on a branch switch, which the test that a repository's changes do not reach
  another (`live.test.ts`) relies on not happening.
- **Alternatives considered**: pushing on `workspace` too, as the plan first said: redundant with
  the hash, and it would change that test's expectations.
- **If wrong**: a workspace change that alters the record without changing the hash would leave it
  stale until the next reload; adding `changes.workspace` to the condition in `publish` sends it.
- **Where**: task 2.

## R7: `placeNote` takes the category last

- **Decision**: the binding's `placeNote(repo, id, index, previous, category?)` takes the category
  last, and the mutation `inbox.place` names the note `note`, not `id`; `views.ts` is not changed,
  since the inbox's view sends `categories` whole, `nested` and `nestedSpans` included.
- **Rationale**: every inbox export of [`inbox_writes.rs`](/crates/binding/src/inbox_writes.rs) puts
  an optional category last, so napi-rs can make it optional, and every note mutation of
  [`inbox-mutations.ts`](/packages/server/src/fate/inbox-mutations.ts) takes `{ hash, note }`.
- **Alternatives considered**: the plan's `placeNote(repo, id, category, index, previous)`: a
  required `string | null` in the middle, unlike its neighbours.
- **If wrong**: the argument order of one export and its one caller.
- **Where**: task 5.
