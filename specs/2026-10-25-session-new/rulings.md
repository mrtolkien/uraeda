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
  column's list of tasks, the feature's links, a change's round and pull request rows, and the
  phone's progress line are removed, and their tests with them: they are replaced by the spec's
  column of activity, changes, and progress, and the phone's status line. A change has no plan, so
  no bar.
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
