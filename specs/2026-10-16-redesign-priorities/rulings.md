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
  whose feature waits at a human gate shows what the gate asks as its step, like "Answer questions"
  or "Review the spec", as home names it (R13), the step's own name being `human-gate`.
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

## R13: A step names the kind of the file its gate waits on

- **Decision**: the core's `StepView` gains `file_kind`, the kind of `file` as `FileKind::of` reads
  it (`clarifications`, `spec`, `plan`, ...), and `labels.ts` names what a gate asks from it alone:
  `stepTitle(step)` for the priorities' rows and the pane, and `waiting(feature)` for home and the
  feature's page.
- **Rationale**: a running entry carries only its feature's step, not its files, and the web UI must
  not read a file's kind from its name ([stack](../decisions/stack.md)); the spec's assumption and
  home already show "Answer questions", "Review the spec", or "Review the plan".
- **Alternatives considered**: joining the workspace record's files in the pane, as the mockup did:
  the UI joining two records, which the spec's architecture rules out; "Waiting on you", as task 8
  wrote: the same words for every gate.
- **If wrong**: one optional field of `StepView`, and `gateAction` in `labels.ts`.
- **Where**: task 11.

## R14: Another row of the same list does not ask "Leave page?"

- **Decision**: `navigate` does not ask before leaving when the page is a priority's or a note's
  pane and the address is another of the same kind: the list stays, and the pane's unsaved text
  stays in the browser and comes back, with its notice, when its item opens again.
- **Rationale**: the spec's edge case "Clicking another row while a field holds unsaved text" opens
  the new pane at once; the leave guard asked first, as for leaving the page.
- **Alternatives considered**: a pane's own guard, set and cleared by the pane: a second guard for
  the same rule.
- **If wrong**: `besideSameList` in `routes.tsx`.
- **Where**: task 11.

## R15: Home's tests count the tests' fixture

- **Decision**: `home.test.tsx` checks the counts of `fixtures/repo`, "Needs you 3", "Agents 1",
  "Now 4", and "Inbox 10", not the spec's "Needs you 4" and "Agents 4", which Storybook's fixture
  shows: it adds a feature with stories under review and three checkouts for the story embeds'
  states ([`.storybook/fixture.ts`](/packages/web/.storybook/fixture.ts)).
- **Rationale**: the happy-dom tests read `fixtures/repo` alone; the counts are the same rule over
  fewer features, and the Hub story shows the spec's numbers.
- **Alternatives considered**: adding the story embeds' features to the happy-dom repository for
  this test: a copy of Storybook's fixture for two numbers.
- **If wrong**: the first test of `home.test.tsx` builds its repository as Storybook does.
- **Where**: task 13.

## R16: The decisions page's keys are tested in the browser

- **Decision**: US8's fifth scenario, ↓ from the last principle to the first decision, is a browser
  test, [`__browser__/decisions.test.tsx`](/packages/web/src/__browser__/decisions.test.tsx), not
  one of `decisions.test.tsx`'s happy-dom tests. The fixture repository gains this repository's
  constitution and five short decisions, `agents`, `git`, `stack`, `tui` (proposed), and
  `ui-behaviour`, with the icons they have here; the server's ledger test removes them first, as it
  checks one decision and a constitution without a version line.
- **Rationale**: happy-dom has no layout, so the repository menu's closed popover counts as shown
  for `useListKeys`, which then leaves every key to it; the priorities' and the inbox's keys are
  browser tests for the same reason, as the UI behaviour decision asks of each list.
- **Alternatives considered**: a happy-dom test faking `getClientRects`: a test of the fake.
- **If wrong**: a happy-dom test can join once happy-dom lays out the page.
- **Where**: task 14.

## R17: The branch's git-writing buttons join main's record of writes in flight

- **Decision**: the [UI behaviour](/specs/decisions/ui-behaviour.md) decision's rule on buttons that
  write to git, merged from the interface's redesign, applies to the buttons this branch adds. "Add
  and commit" in both ＋ forms, from its button or Enter, runs through `useAddAndCommit`, on the
  shared store's `useOwnWrite`: it reads "Committing…" with a spinner at once, and does nothing,
  blocked and focusable, while another write runs; Add, which only writes the file, stays free. The
  toast's Undo of a committed add is a `WriteButton`, "Undoing…", and its toast stays until the
  revert ends; the Undo of an uncommitted add stays a plain button. The pane's Commit of a draft and
  its "Start the feature" are `WriteButton`s, "Committing…" and "Starting the feature…", as on the
  editor page and in main's task view. None names a card: a draft has no feature yet.
- **Rationale**: "While any git write runs, every other button that writes to git, in the page and
  in the sidebar, MUST be blocked", and "Every button that writes to git goes through one shared
  record of writes in flight" (the decision's consequences).
- **Alternatives considered**: a write's key in the store, for a button to know its own write
  started by Enter: a change to the store, where the form's own state does.
- **If wrong**: `useOwnWrite` in [`writes/`](/packages/web/src/writes/), and its callers.
- **Where**: the catch-up with the default branch.

## R18: The decisions page stays reached from home's card

- **Decision**: home keeps its "Constitution and decisions" card as the way to the decisions page;
  the sidebar gains no Decisions row. Main's redesigned sidebar has the inbox's count this feature
  left to it (Q2, B), and no row for the decisions.
- **Rationale**: Q2's answer left the sidebar's inbox count and decisions row to the interface's
  redesign, and this feature reaches the decisions page from home; the redesign merged without the
  row, so home's card is still the way there, and nothing changes.
- **Alternatives considered**: adding the row to main's sidebar here: the choice Q2 left to the
  sidebar's owner, and the human's review of both branches.
- **If wrong**: a row in [`Sidebar.tsx`](/packages/web/src/sidebar/Sidebar.tsx)'s flow, and the
  card's removal from [`HomeHub.tsx`](/packages/web/src/home/HomeHub.tsx).
- **Where**: the catch-up with the default branch.

## R19: The sidebar's "All done features and changes" opens home with every done feature

- **Decision**: home's Recently done card carries main's `#done` anchor, which the sidebar's Done
  area's "…", "All done features and changes", opens and home scrolls to. At `#done`, the card lists
  every done feature, as "Show all (N)" does, not the five latest the sidebar already shows.
- **Rationale**: the interface's redesign has the "…" open "Home at its Done group", which listed
  every merged feature on main's home; this branch's card shows five until asked, the same five as
  the sidebar's Done area, so the "…" would have shown nothing more.
- **Alternatives considered**: the anchor alone, five rows: the link's name, "All done features and
  changes", then promises more than the card shows.
- **If wrong**: `DonePanel` in [`HomeHub.tsx`](/packages/web/src/home/HomeHub.tsx).
- **Where**: the catch-up with the default branch.

## R20: Main's new decisions have icons

- **Decision**: [notifications](/specs/decisions/notifications.md) gets `icon: bell`, and
  [settings](/specs/decisions/settings.md) `icon: settings`, the two decisions main added without
  one; the theme registers Lucide's `bell` for decisions, and main's cog as `settings`. A test reads
  every decision of this repository and fails on one whose icon the page would not draw.
- **Rationale**: C8 gives every decision an icon, and this branch gave one to each decision it
  found; the two merged since would show the default page icon among the others.
- **Alternatives considered**: leaving them to the default icon until a human picks one: the
  decisions page then reads as if they were broken.
- **If wrong**: the two `icon` lines, and `DECISION_ICONS` in
  [`icons.ts`](/packages/web/src/theme/icons.ts).
- **Where**: the catch-up with the default branch.

## R21: Main's tests wait on the new home

- **Decision**: in the rebase, the tests main added that wait for home to draw, in
  `sidebar.test.tsx`, `shell-checks.test.tsx`, `notify.test.tsx`, and `usage.test.tsx`, wait for
  "Needs you" instead of the old home's "Waiting on you", as this branch's own tests did when home
  became the hub. `usage.test.tsx` finds the working feature in main's sidebar group, "Features".
  Their checks are unchanged.
- **Rationale**: home's "Waiting on you" heading is gone with the hub; the text was only the sign
  that home had drawn.
- **Alternatives considered**: none: the old heading does not exist.
- **If wrong**: the `show("/", …)` calls of those files.
- **Where**: the catch-up with the default branch.

## R22: Entries' features follow main's committed reading

- **Decision**: an entry's `running` feature and its step, joined in `Workspace::join_priorities`,
  come from the workspace's features, which main's [git](/specs/decisions/git.md) decision reads
  from each branch's latest commit: a branch outside the workflow is never an entry's feature, and a
  step moves only once committed. No change was needed.
- **Rationale**: the rule "A feature's or a change's workflow state … MUST be read from its branch's
  latest commit" applies to the priorities' join this branch added, which reads no branch itself.
- **Alternatives considered**: none.
- **If wrong**: `running` in [`links.rs`](/crates/core/src/workspace/links.rs).
- **Where**: the catch-up with the default branch.

## R23: One join of a priorities entry to the workspace, for every reader

- **Decision**: `Workspace::link` in [`links.rs`](/crates/core/src/workspace/links.rs) gives an
  entry's link its feature, whatever its step, and its draft or backlog file, when the default
  branch has it; `EntryLink::running` its feature while not `done`. The web's priorities
  (`join_priorities`), the workspace's entries (`Workspace::priorities[].draft`), and the language
  server (`api::priority_links`) all read it. Two values change: an entry linking a draft that does
  not exist names no draft, and one linking a postponed feature names its backlog file. So the
  language server's hint "draft" shows on a backlog entry and not on a missing draft, and its Draft
  command opens a backlog entry's file and drafts an entry whose draft is gone, as the web does.
- **Rationale**: the final review found three joins with two rules for a draft (existing files and
  backlog in the web, any `specs/drafts/` path elsewhere) and `Workspace::running` repeating
  `linked_feature`: a later change to what an entry links would have needed all three.
- **Alternatives considered**: the old values for the workspace and the language server: two rules
  for one link, which already disagreed on a missing draft.
- **If wrong**: `Workspace::link`, and `PriorityLink.draft` for a hint naming backlog apart.
- **Where**: the final review.

## R24: A re-read answered after a line's save does not bring its old text back

- **Decision**: no change. A read of the priorities sent before a line's rename and answered after
  the rename's own answer leaves the new text on screen: fate gives each read the write generation
  it started with, and refuses an older read's write over a record a newer write already set while
  reads are in flight (`acceptWrite` in `@nkzw/fate`).
- **Rationale**: checked in `pane.test.tsx`'s setting, with a throwaway test: the page's
  refresh-on-show re-read, answered by the server with "Git listener process", was held until the
  rename to "Git listener" was saved and drawn, then released; the pane and the Next row kept "Git
  listener". In the app, the watch's push after the write reads the file again in any case.
- **Alternatives considered**: a hash or a version on the priorities record, kept by the client: a
  copy of what fate's write generations already do.
- **If wrong**: a slow re-read flashes the old line until the watch's next push; a test holding a
  read's answer, as the check did, shows it.
- **Where**: the final review.
