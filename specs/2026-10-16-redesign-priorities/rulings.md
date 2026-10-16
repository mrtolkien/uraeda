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

## R8: "Add and commit"'s answer is `AddCommit` in JavaScript

- **Decision**: the core's `actions::commit::Added` is the napi object `AddCommit`, and the binding
  answers `addPriorityAndCommit` and `addNoteAndCommit` with `PrioritiesAdded` and `InboxAdded`,
  objects declared in the core. The mutations send it as `added`, a field of the `Priorities` and
  `Inbox` records, null on every other mutation's answer.
- **Rationale**: `Added` is already the JavaScript name of a repository added to the list
  ([`view.rs`](/crates/core/src/view.rs)), and napi-rs cannot return a tuple; a fate mutation
  answers a record of its type, so `added` is one of its fields.
- **Alternatives considered**: renaming the repository's `Added`: a change outside this feature; a
  record type of its own for the add's answer: a second view of the same priorities.
- **If wrong**: one `js_name`, and the two record fields.
- **Where**: task 6.

## R9: `last_change` takes the default branch as its revision

- **Decision**: `Git::last_change(revision, path)` runs
  `git log -1 --format=%cs <revision> -- <path>`, and the ledger passes the default branch, read
  once per decision. The ledger's tests are selected with `binary(ledger) | test(icon)`, since their
  names do not all hold "ledger".
- **Rationale**: the plan's `last_change(path)` reads the history of the checkout's `HEAD`, which is
  a feature's branch when the server runs in one, while the page shows the default branch only.
- **Alternatives considered**: one `git log --name-only` over `specs/decisions/` for every date at
  once: one process instead of one per decision, for a parser of the log's file lists.
- **If wrong**: a ledger read spawns one `git log` per decision; a batched read can replace the loop
  in `api/ledger.rs`.
- **Where**: task 7.

## R10: "Ongoing" gathers the running entries of every section

- **Decision**: "Ongoing" lists every entry with `running`, from any section, in the file's order,
  and shows only when one runs; each section on screen lists the others. A drop maps its index among
  a section's rows on screen to the file through `fileIndex`, in `PrioritiesList.tsx`. An entry
  whose feature waits at a human gate shows "Waiting on you" as its step, the step's own name being
  `human-gate`.
- **Rationale**: C6 asks for the running features apart; a running entry left in Next or Blocked
  would be the one row of its section without a handle, and a drop beside it would have two
  meanings. One rule, every running entry in "Ongoing", keeps every section on screen movable.
- **Alternatives considered**: "Ongoing" holding Now's running entries alone, the others fixed rows
  in their section; an empty "Ongoing · 0" always shown.
- **If wrong**: the filter of `ongoing` in `PrioritiesList.tsx`.
- **Where**: task 8.

## R11: The focus ring and the dividers are Astryx's own styles

- **Decision**: the app writes no style with the atomic value of an Astryx rule that another Astryx
  rule overrides in a state: `Selection.tsx`'s toggle takes Astryx's
  `focusOutlineStyles.focusVisible` with an offset of its own, the bars of `StoryEmbed.tsx` and
  `pane/EntryPane.tsx` and the options of `Question.tsx` draw their hairline with Astryx's
  `Divider`, and the shared list's rows override only the ring's offset, with a value Astryx does
  not write.
- **Rationale**: `@stylexjs/unplugin`'s `useCSSLayers` layers only the extracted stylesheet, not the
  runtime injection the tests use, so no browser test could prove it; and a layer of the app's after
  `astryx-base` would still let a copied `outline-style: none` beat Astryx's `:has(:focus-visible)`
  rule.
- **Alternatives considered**: `useCSSLayers` with the app's layers before `astryx-base`: every app
  override of an Astryx element outside `xstyle` would lose, and the tests would not see it.
- **If wrong**: another app style copying an Astryx atomic value hides a state again; the browser
  test of the row's ring catches the ring's case.
- **Where**: task 8.

## R12: A list reaches its pane through `listPane.ts`, and the keys act on a row or the page

- **Decision**: `useListKeys` takes no `count`: it reads the rows' links from the list's element,
  and returns the `ref` to put on it with `focusSelected`; `onEdit` and `onClose` return whether
  they acted, so Enter opens the row's link when its pane has nothing to edit. The keys act only
  when the focus is on a row's link or on the page, which leaves out text fields, the drag handles
  (their own keys move the row), and the pane's controls. The list and its pane meet through
  `ListPaneContext`, set by `TaskRoute` and `NoteRoute`: the pane follows only when one is open, so
  on `/priorities` and on a phone the keys move the focus alone. A task or a note page is keyed by
  its history entry, not its address, so the list is not drawn anew at each key.
- **Rationale**: a count would repeat the rows the list already draws; a handle's arrows move its
  row in a keyboard drag, and would move the selection too; and the page drawn anew loses the row's
  focus and restores the list's position at each key, as the browser test showed.
- **Alternatives considered**: the list listening to its own `keydown` only, through
  `useListFocus`'s `handleKeyDown`: after a click on a row, which WebKit does not focus, or once a
  field saves, the focus is on the page, and the keys would do nothing; opening the pane at the
  first ↓ on `/priorities`: a key that changes the page.
- **If wrong**: the target test and `isLayerOpen` in `useListKeys.ts`, and `pageKey` in `App.tsx`.
- **Where**: task 10.
