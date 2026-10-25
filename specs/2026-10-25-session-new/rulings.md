# Rulings: Session and New in the terminal look

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A thought is timed from its block's start to the whole block

- **Decision**: the main agent's thought lasts from the stream's thinking start to the line that
  brings the whole block, the agent's next event. A sub-agent's thought, which arrives whole with no
  start, has a length of 0, and its row shows no length.
- **Rationale**: Claude Code prints each content block as its own `assistant` line as it ends
  ([`fixtures/claude/text.jsonl`](/fixtures/claude/text.jsonl)), and streams the main agent's block
  starts only.
- **Alternatives considered**: timing a sub-agent's thought from its previous call, which needs a
  record of every sub-agent's last event for a case Claude Code never reports today.
- **If wrong**: a sub-agent's thought reads "Thought" without a length; the transcript sets it.
- **Where**: task 1, `runner/transcript.ts`.

## R2: Each call of the main agent restarts the activity's time

- **Decision**: a main-agent tool call restarts the running turn's `since`, though its label stays
  "Working".
- **Rationale**: the live line reads "12 s · reading src/tasks/undo.ts", the time of the current
  call; until now, consecutive calls kept the first call's start.
- **Alternatives considered**: a label per call made by the server, which would copy the web's words
  of each kind.
- **If wrong**: one change event more per call; revert the restart in `#track`.
- **Where**: task 1.

## R3: The phone's sheet stays in `?tab=`, and the stretch is `?stretch=`

- **Decision**: the session column's sheet uses the documents' `useSheetTab`, which keeps the open
  sheet in `?tab=` in its own history entry. The stretch a recap line opens is
  `?stretch=<turn>:<seq>`. No `?sheet=` parameter.
- **Rationale**: one address opens the Activity at a stretch at every width, and the questions and
  spec pages already open their sheets this way.
- **Alternatives considered**: a `?sheet=` parameter, as the spec's assumption names it, which would
  be a second mechanism beside the documents'.
- **If wrong**: a parameter's name in two components.
- **Where**: tasks 5 and 7.

## R4: A run's length is its turn's, a recap's the sum of its calls

- **Decision**: "Run 1 · 2 min" is the turn's start to its end; a recap line's time is the sum of
  its calls' and thoughts' lengths, as the spec says.
- **Rationale**: the Activity draws a run without reading all its pages; the turn's record has its
  times.
- **Alternatives considered**: the sum over the run's stretches, which needs every page of the run.
- **If wrong**: a run's time counts the text the agent wrote too.
- **Where**: task 8.

## R5: The recap's counts, their words and order

- **Decision**: reads, edits, deletes, and moves count distinct files; searches, fetches, commands,
  sub-agents, other tools, and thoughts count calls; in that order, whatever came first.
- **Rationale**: the spec's line, "read 3 files · searched once · fetched 1 page · thought twice",
  puts the thoughts last though the first came first.
- **Alternatives considered**: the order of first appearance.
- **If wrong**: words in one table of `session/stretches.ts`.
- **Where**: task 5.

## R6: An activity row's words, and no length per call

- **Decision**: a call's row ends with "read", "edit", "delete", "move", "search", "fetch", "run",
  "sub-agent", or its tool's name; "failed" when it failed; "not finished" when its turn ended
  first. Its output unfolds under it. Only thoughts show their length. The test "a tool call shows
  its target, then its duration" is rewritten to the row's target and word.
- **Rationale**: the spec's rows, "src/tasks/undo.ts · read", "Thought · 8 s"; the output stays
  readable, as today's groups allow.
- **Alternatives considered**: "passed" for a command, as the mockup's `pnpm test`, which reads
  wrong for a command that is not a test.
- **If wrong**: a word in the stretches' table; the length can join the unfolded output.
- **Where**: tasks 5 and 8.

## R7: The branch's files: the first two, then the rest on demand

- **Decision**: "On the branch" lists its first 2 files, then "N more files", a button that unfolds
  the rest the core sends, its first 50, then "and N more files" past them.
- **Rationale**: the spec's scenario lists the first files, then "12 more files" of 14, in a pane of
  at most 40% of the column; the human can still read every file the column listed before.
- **Alternatives considered**: as many as fit the pane, which no test can state without pixels.
- **If wrong**: one constant.
- **Where**: task 7.

## R8: The column's tasks, links, round, and phone line go

- **Decision**: the progress bar shows only while the plan's implementation has a current task. The
  column's list of tasks, the feature's links (its Storybook row and a change's list of files among
  them), a change's round and pull request rows, the column's running sub-agents, and the phone's
  progress line are removed, and their tests with them: they are replaced by the spec's column of
  activity, changes, and progress, and the phone's status line, and the running sub-agents by task
  9's tab. A change has no plan, so no bar.
- **Rationale**: the spec's architecture: the changes "replace 'Changed on the branch' of the
  current column", the progress bar "replaces the step and tasks of the current column". The
  feature's files and its round stay one click away, in the crumbs and the navigation.
- **Alternatives considered**: keeping the links under the progress, which the approved mockup does
  not have.
- **If wrong**: a change's round is one more click away from its session.
- **Where**: task 7.

## R9: The session column's width at semi-wide

- **Decision**: at semi-wide, the session column takes 30% of the window, between 300 and 360 px; at
  wide, the documents' third, between 400 and 600 px. Dragged, between 300 and 720 px. Its fold and
  dragged width are the documents' column's, kept under the same key.
- **Rationale**: approval comment C2; the documents' column keeps its 400 px, which the UI layout
  decision asks for a session beside a document.
- **Alternatives considered**: narrowing every column at semi-wide, against that decision.
- **If wrong**: two numbers in `documentColumnWidth.ts`.
- **Where**: tasks 3 and 7.

## R10: Finished sub-agents are remembered by the page

- **Decision**: the server lists the running sub-agents only; the Sub-agents panel keeps the rows it
  drew while its tab is open, and marks those gone "Done".
- **Rationale**: the sidebar's rows read the same list, as running ones; the tab stays "until the
  human leaves it", which is the page's state.
- **Alternatives considered**: the latest turn's sub-agents with their state, from the server, which
  changes what the sidebar counts.
- **If wrong**: a reload on the tab after they ended shows an empty list.
- **Where**: task 9.

## R11: The live line shows its time from the first second

- **Decision**: the live recap line reads "4 s · thinking" from the start; the activity line's
  10-second threshold goes, and its test is rewritten.
- **Rationale**: the spec's live line always has its time first, as a recap line does.
- **Alternatives considered**: "thinking…" under 10 seconds, which makes the recap's first part come
  and go.
- **If wrong**: one condition in the live line.
- **Where**: task 6.

## R12: The New page's cards are a radio group drawn by the page

- **Decision**: a `radiogroup` named "What to start" of three cards with the radio role, each drawn
  by the shared `Pane`, active when picked. The arrow keys move the pick.
- **Rationale**: approval comment C3 forbids round radios; Astryx's `SelectableCard` is a checkbox,
  and its `RadioList` draws round radios: an Astryx gap.
- **Alternatives considered**: `SelectableCard`, without radio keys; `RadioList`, round.
- **If wrong**: the group's keys in one component.
- **Where**: task 4.

## R13: The chat skips a thought until its recap lines come

- **Decision**: task 1 makes `TranscriptMessages.tsx` skip a thought item, which neither draws a
  line nor parts the tool calls around it. Task 6's recap lines then count it.
- **Rationale**: `fast` type-checks the web, so the new item kind cannot wait for task 5: the chat's
  last branch drew every other kind as a denial, and a thought would have reached it.
- **Alternatives considered**: deferring the web's type check to ready, as the plan said, which
  `fast` does not do; drawing the thought, which the spec keeps out of the chat.
- **If wrong**: one condition in the chat, which task 6 rewrites.
- **Where**: task 1, `packages/web/src/TranscriptMessages.tsx`.

## R14: The session record's two reads live in their own module

- **Decision**: `editedFiles` and `subagentsOf` are `SessionCache` methods that call the SQL of a
  new module, `runner/cache-work.ts`, which also defines `SubagentRow`; `SubagentRecord` is that
  type. The three assertions of `sessions.test.ts` that compared a running sub-agent with
  `{ description, id }` now compare the whole new record: its 0 calls, null latest, null parent, and
  any start.
- **Rationale**: `cache.ts` had 467 of its 500 lines; the runner does not import the fate layer's
  types. The old assertions' exact equality fails on the fields task 2 adds.
- **Alternatives considered**: the SQL in `cache.ts`, over the file limit; `objectContaining` in the
  old assertions, which would loosen them.
- **If wrong**: the two queries move back into the class.
- **Where**: task 2.

## R15: The shared column keeps its width as dragged, and clamps it as drawn

- **Decision**: `useFollowedWidth` holds the kept width as the browser keeps it, and clamps only the
  width it draws to the column's limits. The documents' column draws a session's 320 px drag at 400
  px, and its fold, by `]` or `showDocumentColumn`, writes the 320 px back.
- **Rationale**: the session's and the documents' columns share `uraeda.documentColumn` with
  different least widths (R9). Holding the clamped width, the documents' column wrote its 400 px
  back with each fold, and lost the session's drag.
- **Alternatives considered**: merging each fold into a fresh read of the browser's value, which
  still loses the drag when the storage is refused, and keeps two meanings of the state.
- **If wrong**: the default `read` of `useFollowedWidth` and its drawn width.
- **Where**: fix 1 of tasks 1-3's review, `packages/web/src/layout/followedWidth.ts`.

## R16: A thought's text is cut to the tool output's limit

- **Decision**: a thought's text is cut to `OUTPUT_LIMIT`, 4,000 characters, as a tool call's output
  is, before it is cached.
- **Rationale**: a harness may give a thinking block's text, and a block can be long; every item is
  kept in the cache and sent with its page of items. A row's unfolded text (US1, scenario 3) then
  shows its first 4,000 characters, as a tool call's output does.
- **Alternatives considered**: no limit, which lets one block grow the cache and each page of items
  without bound; a limit of its own, a second number for the same need.
- **If wrong**: the limit's one use in `#thought`.
- **Where**: fix 6 of tasks 1-3's review, `packages/server/src/runner/transcript.ts`.

## R17: A single sub-agent reads "ran a sub-agent", and thoughts do not make a count

- **Decision**: a stretch with one call reads the call even with thoughts around it, "7 s · edited
  src/a.ts · thought once"; a single sub-agent reads "ran a sub-agent", not its description; a
  single other tool reads "used TodoWrite".
- **Rationale**: the spec's single call reads the call, and thoughts are not calls; a sub-agent's
  description is a sentence, which the Activity's row already shows, and would make the recap line
  as long as a message.
- **Alternatives considered**: counting as soon as thoughts join the call, "edited 1 file · thought
  once"; "ran Find the tests", the description as the target.
- **If wrong**: one branch of `single` in `session/stretches.ts`.
- **Where**: task 5; tasks 6 and 8 keep these words.

## R18: A stretch says whether its page cut it, and two halves join under the first key

- **Decision**: `slotsOf` marks a page's stretch `continued` when only a sub-agent's items precede
  it on the page, and `open` when only a sub-agent's items follow it; `joinStretches` makes an open
  stretch and the next page's continued one a single stretch under the earlier key. The chat's recap
  lines (task 6) and the Activity's marked rows (task 8) both use it.
- **Rationale**: a turn's pages hold 100 items each, so a stretch of 250 calls spans three; one rule
  in the pure module keeps one recap line per stretch and one key for the line and the rows. A
  sub-agent's items at a page's start do not part the main agent's stretch, as they do not inside a
  page.
- **Alternatives considered**: each consumer comparing a page's first item with its first stretch,
  which two tasks would write twice and could write apart.
- **If wrong**: `continued` and `open` are set in `slotsOf` alone.
- **Where**: task 5; tasks 6 and 8.

## R19: The live line is the running stretch's recap line

- **Decision**: while a turn runs, the open stretch at its last page's end draws no recap line of
  its own: the live line stands for it, and links its key. With no open stretch, as while the agent
  writes, the live line opens the Activity at no stretch, `?tab=activity`; `stretchAddress` takes
  its key as optional, and `Actions.stretchHref` with it. The live link is named by its working dot,
  the turn's activity, "Working", as its text changes each second and is hidden. The chat's tool
  groups go with their open state: `Actions.groups` gives way to `Actions.subagents`, the main
  agent's running sub-agents the live line counts.
- **Rationale**: the spec's recap line is "live while it runs", and the approved mockup ends a
  running turn with the live line alone; a static line above it would count the same calls twice.
- **Alternatives considered**: both lines, the static one growing above the live one; a live link
  named by its text, which a screen reader would hear change each second.
- **If wrong**: `endsOpen` in `tailPieces.tsx`, and the live link's name in `session/RecapLine.tsx`.
- **Where**: task 6, `packages/web/src/session/RecapLine.tsx` and `packages/web/src/tailPieces.tsx`.

## R20: The session column's fold is the documents' fold, kept for the page alone without storage

- **Decision**: the session's column folds and unfolds as the documents' column does, under
  `uraeda.documentColumn`: its buttons read "Hide the session's column" and "Show the session's
  column", and where the browser refuses storage, the fold lasts for the page only. The old column's
  test that a refused storage kept the fold on the next session's page goes with its own key,
  `uraeda.sessionAside`; the fold kept after a reload, with storage, is kept.
- **Rationale**: ruling R9 shares the fold and the dragged width with the documents' column, whose
  width hook keeps a refused fold for the page alone (ruling R15).
- **Alternatives considered**: a module-wide memory of the fold for refused storage, in the shared
  width hook, for every column, which no spec asks for.
- **If wrong**: the refused fold kept in memory by `useFollowedWidth`.
- **Where**: task 7, `packages/web/src/session/SessionColumn.tsx`.

## R21: At 1440 px, the chat keeps more room than the column, not 760 px

- **Decision**: the layout checks' assertion that a feature's session at 1440 px, beside the
  sidebar's 240 px and its column, keeps a transcript at least 760 px wide becomes a transcript at
  least 1.4 times as wide as the column, at 1440 px and at a semi-wide 1205 px. The session column
  takes the documents' third at wide (ruling R9), 480 px at 1440 px, which leaves the transcript 704
  px.
- **Rationale**: the old 760 px followed the old column's 320 px; the approved architecture gives
  the session column the documents' width at wide, and approval comment C2 asks that the chat
  clearly weigh more than the column, which the new assertion states.
- **Alternatives considered**: a narrower column at wide too, against ruling R9 and the UI layout
  decision's column of at least 400 px beside a document.
- **If wrong**: the wide share of `useSessionColumnWidth`, and the assertion back at 760 px.
- **Where**: task 7, `packages/web/src/__browser__/layout.test.tsx`.

## R22: A stretch that ends its page draws its line on the page after

- **Decision**: a stretch `open` at the end of a page before the turn's last, which the next page
  does not go on with (that page starts with another item), draws its recap line before that page's
  first item, joined back through the pages before as a continued stretch is. A page reads the page
  before only when the tail draws that page above it: `PageItems`' `after` is set when the piece
  before is its turn's page before, not when the page merely starts at its first item, since the
  tail may cut a page at a message that is its first item.
- **Rationale**: the page before leaves an open stretch to the page after, so a stretch ending
  exactly at a page's end, `[message, 99 reads, "Done."]`, drew no line at all on either page. A
  stretch before the tail's cut is not the tail's to draw, and once "Show earlier messages" draws
  its page it is drawn once, by the page after.
- **Alternatives considered**: the page before drawing its open stretch when the next page does not
  go on with it, which reads the page after from the page before, a page the tail may not draw.
- **If wrong**: `EarlierRecap` in `session/RecapLine.tsx`, drawn by `TranscriptItems`, and `follows`
  in `tailPieces.tsx`.
- **Where**: task 6, `packages/web/src/TranscriptMessages.tsx`, `packages/web/src/tailPieces.tsx`.

## R23: The phone's sheet is one, named Activity, with the column's tabs

- **Decision**: on the phone, the session's column opens in one sheet, named "Activity" after the
  status line's button that opens it, whichever panel shows. While more than one panel shows, the
  column's tabs head it, and a tap on one replaces `?tab=` in the sheet's own history entry, so Back
  closes the sheet rather than stepping back through its tabs. `useSheetTab` names every panel's
  sheet "Activity", and `DocumentColumn` shares its tab list, `ColumnTabs`.
- **Rationale**: ui-behaviour asks every action to work by tap, and the approved mockup's phone
  sheet is the column itself, tabs included (`mockups/session.html#sheet`); a sheet per panel, as
  the documents' status lines draw, opened the Sub-agents only from the address.
- **Alternatives considered**: a sheet per panel, a tab switching from one to the other, which
  closes one sheet and opens another, and pushes a history entry for each; the sheet named "The
  session's column", against the status line's Activity that opens it.
- **If wrong**: `ColumnSheet` in `packages/web/src/session/SessionColumn.tsx`.
- **Where**: the review of tasks 7 and 9, `packages/web/src/session/SessionColumn.tsx`.

## R24: The Activity's walk reads at most 4 pages for each 200 rows

- **Decision**: the Activity's walk back over the pages reads at most `WALK_PAGES`, 4, pages of 100
  items for each 200 rows it draws, 4 at first and 8 after one "Show earlier runs". When that budget
  stops it before the session's first page, "Show earlier runs" shows, though no row may be left
  there. Otherwise the walk reads one row past those it draws, and the button shows only when that
  row exists.
- **Rationale**: rows count the main agent's calls and thoughts alone, so a turn where a sub-agent
  made 5,000 calls, or a long chat of few calls, made the walk read every page back to fill its 200
  rows. Dense rows take two or three pages; 4 leaves room past them. The button showed whenever the
  walk had not reached the session's first page, though the turns before held no call.
- **Alternatives considered**: a count of the main agent's rows on the server, one more field on the
  turn's record for one view; a budget of pages per walk that does not grow with the presses, which
  would never reach a run older than it.
- **If wrong**: `WALK_PAGES` in `session/ActivityPanel.tsx`, and `capped` in
  `session/ActivityWalk.tsx`.
- **Where**: task 8, `packages/web/src/session/ActivityWalk.tsx`.

## R25: A stretch's Activity is a window of 200 rows from the stretch's page

- **Decision**: at a stretch the address names, the Activity draws 200 rows forward from the first
  row of the page of 100 items the stretch begins on, its run's title above them, read by a walk
  forward from that page. "Show earlier runs" above adds 200 rows before that page, through a walk
  back from the page before it; "Show later runs" below adds the next 200, toward the latest. Both
  show only while rows are left out on their side, or a walk's page budget (ruling R24) stopped it.
  The rows added above are kept in the history entry, as the latest window's; the later presses are
  the panel's, so a reload draws the stretch's first 200 again. Another stretch, or none, draws its
  own window from 200 rows: leaving the stretch's address returns to the latest 200.
- **Rationale**: the walk back from the latest drew every run from the stretch's to the latest in
  full, about 5,000 rows for a stretch in run 1 of a 5,000-call session, against SC-002 and the UI
  behaviour decision's bounded rows. The page is what the address gives (the stretch's key is its
  first item's `seq`) and what the walks read; a stretch begins at most 99 rows into it, so its
  first rows are always in the window. "Show later runs" adds rather than slides, as "Show earlier
  runs" does, so a press never takes away the rows being read; each press mounts 200 more, the bound
  the spec gives for "Show earlier runs".
- **Alternatives considered**: a window starting at the stretch's own first row, which needs the
  stretch's items before the walk can count, for at most 99 rows saved; a window sliding toward the
  latest, which drops the rows above the reader's place; drawing back to the stretch's run from the
  latest, the old way.
- **If wrong**: `windowOf` in `session/ActivityPanel.tsx`, `walkOf` in `session/ActivityWalk.tsx`,
  and `drawnRows` in `session/activityRuns.ts`.
- **Where**: task 8, `packages/web/src/session/ActivityPanel.tsx`.

## R26: The Activity scrolls to its stretch at each arrival of the address

- **Decision**: once the window read for the stretch the address names draws, the column's scroller
  brings to its top the stretch's run's heading when the stretch is the run's first, else the
  stretch's first row. It does so once per arrival of the address: the Activity's mount, so a
  reload, Back to the page, or a tab switch back to the Activity; another stretch; and a navigation
  to the address already shown, as a recap line followed again. A press of a "Show" button, or a
  live update, does not scroll.
- **Rationale**: the run's heading of a stretch deep in a long run left its marked rows out of view.
  A recap line followed a second time, after the reader scrolled away, did nothing. Nothing restores
  the session column's place on a reload or Back, so the stretch is the place to bring back.
- **Alternatives considered**: scrolling once per stretch, as before, which ignored the second
  click; the column keeping its place in the history entry, which no part of the column does today.
- **If wrong**: `useArrival` and `aimOf` in `session/ActivityPanel.tsx`.
- **Where**: task 8, `packages/web/src/session/ActivityPanel.tsx`.
