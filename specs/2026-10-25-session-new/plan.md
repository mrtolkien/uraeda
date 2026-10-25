---
status: auto-approved
spec-revision: 1
---

# Plan: Session and New in the terminal look

**Goal:** a session reads chat first, its tool calls and thoughts folded into recap lines, beside a
column split into the calls by run above and the changed files below, with the plan's progress at
its foot; and the New page tells Session, Change, and Feature apart as three cards.

**Architecture:** the runner records a new cache item, the thought, and restarts the turn's activity
time at each main-agent call; the session record gains the files this session edited and the running
sub-agents' details, both computed by the server from the cache. In the web UI, one pure module,
`session/stretches.ts`, cuts a turn's items into stretches and owns every word a recap line, a live
line, or an activity row says. The chat draws a recap line per stretch, in place of Astryx's tool
groups; the session column draws the activity, the sub-agents, the changes, and the progress, each
one component of `src/session/`, so the feature page can reuse them. The column is the documents'
column itself, its tabs now **panels**: a panel shows as a tab, and a split is a panel holding two
panels, one above the other (approval comment C1). The address owns what the column shows: `?tab=`
the open panel, and `?stretch=<turn>:<seq>` the stretch a recap line opened, which every width reads
the same way. See the [spec's architecture](spec.md#architecture).

Ownership:

- **The cache and the runner** own the thought's length and text: the web never measures a thought.
- **The server** owns which files a session edited (completed edit calls only) and what each running
  sub-agent does: one SQL read each, behind the session record.
- **`stretches.ts`** owns what a stretch is, its counts, its time, and its words. The chat's recap
  lines, the live line, the activity's rows, and the sub-agents' rows only call it.
- **The address** owns the open panel, the marked stretch, and the phone's sheet: no component keeps
  them in state.
- **The documents' column** owns width, fold, tabs, and the split; the session column only lists its
  panels and its foot.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A stretch longer than a page of 100 items** draws one recap line, with the counts and time of
   the whole stretch, after its last call: not one line per page. Task 6.
2. **A recap line of a run older than the 200 rows drawn** opens the Activity drawn back to that
   run, scrolled to it, its rows marked. Task 8.
3. **A sub-agent's own calls, arriving after the main agent's text**, stay out of every stretch's
   counts and time, and out of the chat: they show only in their sub-agent's group. Tasks 5 and 8.
4. **The documents' column at a semi-wide window** keeps its 400 px: only the session column
   narrows. Task 7.
5. **Back after a recap line on the session page** leaves the page, as after a tab switch, and does
   not step back through the stretches. Task 6.
6. **Two thinking blocks in a row** each get their own length, from their own start. Task 1.

## Global constraints

Every task's requirements include these.

From the spec and its approval comments, word for word:

- Recap line: "2 min · read 3 files · searched once · fetched 1 page · thought twice"; live: "12 s ·
  reading src/tasks/undo.ts"; a single call: "read src/tasks/undo.ts", not a count.
- Activity: runs titled "Run 1 · 2 min", "Run 2 · failed" in the error colour; rows such as "Thought
  · 8 s" and "src/tasks/undo.ts · read", the last marked live. "The Activity mounts the latest 200
  rows, and 'Show earlier runs' adds 200 more".
- Changes: "This session · 2 files", rows "2 edits" and "1 edit", no diff; "On the branch · 14 files
  · +312 -41", then "12 more files"; "No file changed yet." when nothing changed.
- Progress: "Implementation · task 3 of 7", a bar 3/7 full, opening the plan at that task; no bar
  before the plan exists, and none in the main checkout.
- "The Changes pane takes at most 40% of the column's height, and scrolls past it."
- "An edit call that failed: It shows in the Activity, failed, and does not count in 'This
  session'".
- "A sub-agent that starts its own sub-agents: They show as rows of their parent's group, not in the
  Sub-agents tab".
- "A session cached before thoughts were stored: Its stretches count no thought; nothing is
  rebuilt".
- "A denied action, an offer, or 'Jump to latest' in a session: They stay in the chat, where they
  are today".
- New page: cards Session, Change, Feature; "Ends with" and "Waits on you": "the chat" and
  "nothing"; "a pull request" and "the pull request"; "a spec, then a pull request" and "questions,
  then the spec". No kind in the address picks Session; `?kind=feature` picks Feature.
- C2: "Make the right column a bit less wide on semiwide screens. The center content should CLEARLY
  have more importance and higher visual weight."
- C3: "The text is readable, right now 'Ends with' is 10km from the text"; "You use icons to make
  things clear"; "There's no round radio button (there's nothing round in the UI)".

From [UI layout](../decisions/ui-layout.md):

- The UI MUST adapt to three width classes, narrow, semi-wide, and wide, not to the device, through
  the theme and never per-view media queries.
- On narrow screens, views MUST be pages and menus and forms sheets; on wide screens, popovers and
  dialogs.
- An open detail, tab, or sheet MUST be in the URL, so reload, Back, or a width change keeps it.
- A column that takes room from the main content SHOULD be foldable and resizable.
- A feature's session MAY open beside any of the feature's documents, in the right column, at least
  400 px wide; everywhere else it stays a page of its own.

From [UI coherence](../decisions/ui-coherence.md):

- A kind of information MUST be drawn by one shared component on every page that shows it.
- Reading text MUST be drawn through `Prose` (`packages/web/src/Prose.tsx`): its size, line,
  measure, and the markdown that holds prose. A page MUST NOT import Astryx's `Markdown`, or set the
  reading size or measure, itself.

From [UI behaviour](../decisions/ui-behaviour.md):

- A view of something that grows, such as a session's log, MUST mount a bounded number of rows, and
  folded content MUST NOT be mounted, so typing stays smooth in a session of thousands of items. A
  component that mounts hidden content is wrapped once, in a shared component. Checked by the UI
  tests, which count what draws and never time it.
- Back and reload MUST keep the human's place and what they were reading.
- Every action MUST work by tap and by keyboard, never by hover alone.

From [UI look](../decisions/ui-look.md):

- The UI MUST look like a terminal tool: square corners, and content grouped in bordered panes whose
  title sits in their top border.
- Icons SHOULD come from Lucide, and another free set's glyph MAY stand in where it fits a concept
  clearly better.

From [UI components](../decisions/ui-components.md):

- Views MUST use Astryx components wherever one fits the job, and be styled only through its theme,
  with no global stylesheet or inline styles.
- A raw element MAY stand in for a missing Astryx component, with a reason, and the plan MUST list
  it as an Astryx gap.

From [UI checks](../decisions/ui-checks.md):

- Every UI test MUST guard something a spec or decision asks for, and MUST change or go with it,
  never loosened to keep passing.
- UI tests MUST drive the UI as a user does, and MUST NOT assert markup, class names, or pixels.
- Before handing over a UI change, the agent MUST review screenshots of every changed view at both
  sizes and in both themes against the decisions, and commit them.

From [code quality](../decisions/code-quality.md) and [toolchain](../decisions/toolchain.md):

- Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting, enforced by the existing linters. (TypeScript: 500 lines a file, 100 a function, 7
  parameters, depth 4.)
- Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria.
- After every task, fast MUST check formatting, lint, types, affected focused tests and boundary
  checks, and name broader checks deferred to ready.
- An agent MUST run `vp run ready` before pushing a branch.

Existing guarantees to preserve:

- The chat's tail draws the latest 20 messages, counts messages and not tool calls, and keeps its
  start as messages arrive ([`tail.tsx`](/packages/web/src/tail.tsx),
  [`session-tail.test.tsx`](/packages/web/src/__tests__/session-tail.test.tsx)).
- The log announces nothing that streams: the announcer says when a turn starts and ends
  ([`Transcript.tsx`](/packages/web/src/Transcript.tsx), "the transcript does not announce what
  streams" in [`session.test.tsx`](/packages/web/src/__tests__/session.test.tsx)).
- A column section whose read fails is left out, and the session and the rest go on
  ([`SessionAside.tsx`](/packages/web/src/SessionAside.tsx) `Section`, "a column's read that fails
  leaves the session and the rest of the column" in
  [`session-aside.test.tsx`](/packages/web/src/__tests__/session-aside.test.tsx)); "The changes
  could not be read." when git fails.
- The draft in a feature's session composer survives moving between the session page and a
  document's Session tab ([`ColumnSession.tsx`](/packages/web/src/ColumnSession.tsx),
  [`spec-asking.test.tsx`](/packages/web/src/__tests__/spec-asking.test.tsx)).
- The New page's starts from a note, a priority line, or a title, and their refusals, behave as
  today ([`new-page.test.tsx`](/packages/web/src/__tests__/new-page.test.tsx)).

## Code read

From the discovery's [map of the code](discovery-01.md#the-code), read in full:

- [`runner/events.ts`](/packages/server/src/runner/events.ts): `Item` and `AgentEvent`. Items are
  stored as `kind` plus JSON in the cache's `items` table, which also keeps each row's insert time
  `at`, not returned today ([`cache.ts`](/packages/server/src/runner/cache.ts) `appendItem`,
  `items`, `itemsOf`). A new kind needs no migration.
- [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts): a thinking block's
  start is an `activity` of kind `thinking`, from the stream, for the main agent only; the whole
  block arrives later as its own `assistant` line, with `thinking: ""` today
  ([`fixtures/claude/text.jsonl`](/fixtures/claude/text.jsonl)). It is dropped now. A sub-agent's
  text is dropped too.
- [`runner/transcript.ts`](/packages/server/src/runner/transcript.ts): `#output` records items,
  `#track` sets the main agent's activity, and `#activity` keeps `since` while the label stays the
  same, so consecutive tool calls all read "Working" since the first.
  [`session-state.ts`](/packages/server/src/runner/session-state.ts) holds `Running`.
- [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) `turnsOf`: the session record's
  `subagents`, the running turn's sub-agent calls in progress, `{ description, id }`; also used by
  the sidebar's rows ([`fate/views.ts`](/packages/server/src/fate/views.ts) `SubagentRecord`).
- [`SessionView.tsx`](/packages/web/src/SessionView.tsx): `SessionPane`, drawn as a page (`Framed`
  with `WithAside`) or boxed in a document's Session tab
  ([`ColumnSession.tsx`](/packages/web/src/ColumnSession.tsx)); a chat in the main checkout has no
  column today. [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) passes `useAsideShown()`.
- [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx),
  [`ChangeAside.tsx`](/packages/web/src/ChangeAside.tsx),
  [`ProgressLine.tsx`](/packages/web/src/ProgressLine.tsx): the column of today and its phone line;
  `Changes` reads `useBranchChanges` (first 50 files, total, counts), `Tasks` reads the plan's
  tasks, `Subagents` reads `session.subagents`.
- [`TranscriptMessages.tsx`](/packages/web/src/TranscriptMessages.tsx) `TranscriptItems`: groups a
  page's tool calls into [`ToolGroups.tsx`](/packages/web/src/ToolGroups.tsx), sub-agents apart; its
  `else` branch draws every other kind as a denial.
- [`tail.tsx`](/packages/web/src/tail.tsx), exactly 500 lines, at the limit: the walk back over
  turns' pages (`useTurn`, `useTurnLog` of 100 items, in
  [`sessionData.ts`](/packages/web/src/sessionData.ts)); `TailPage` draws a turn's piece, its live
  `Activity` line ([`TurnLines.tsx`](/packages/web/src/TurnLines.tsx), with `elapsed(ms)`), and its
  ending.
- [`layout/DocumentColumn.tsx`](/packages/web/src/layout/DocumentColumn.tsx): `ColumnTab`, the tabs
  in `?tab=`, `]` fold, rail of icons; width from
  [`documentColumnWidth.ts`](/packages/web/src/layout/documentColumnWidth.ts) (a third of the
  window, 400 to 600 px, drag 400 to 720, under `uraeda.documentColumn`, `showDocumentColumn()`
  unfolds) over [`followedWidth.ts`](/packages/web/src/layout/followedWidth.ts);
  [`SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx) scrolls the whole column. Users of
  `ColumnTab`: [`spec/SpecColumn.tsx`](/packages/web/src/spec/SpecColumn.tsx),
  [`RoundColumn.tsx`](/packages/web/src/RoundColumn.tsx),
  [`ColumnSession.tsx`](/packages/web/src/ColumnSession.tsx),
  [`spec/pageSession.ts`](/packages/web/src/spec/pageSession.ts),
  [`__browser__/document-column.test.tsx`](/packages/web/src/__browser__/document-column.test.tsx).
- [`layout/useSheetTab.ts`](/packages/web/src/layout/useSheetTab.ts) and
  [`layout/ColumnStatusLine.tsx`](/packages/web/src/layout/ColumnStatusLine.tsx): the phone's sheets
  in `?tab=`, as the spec page's `PhoneParts` uses them.
- [`layout/useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts): semi-wide from 768 px,
  wide from 1280 px.
- [`NewPage.tsx`](/packages/web/src/NewPage.tsx): a `SegmentedControl` in `?kind=`, `ABOUT` texts,
  and the session, change, and feature parts; [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx)
  draws the titled pane, `isActive` in the accent. Astryx's `SelectableCard` is a checkbox and
  `RadioList` draws round radios: neither fits C3.
- [`theme/icons.ts`](/packages/web/src/theme/icons.ts): the `uraeda:*` icon registry, Lucide glyphs
  added by name.

Tests and validation:

- Web UI tests: `packages/web/src/__tests__/*.test.tsx`, happy-dom, a real server over a fixture
  repository and the fake agent (`renderPage`, `fakeAgent`, `fake.sessions.cache` to seed turns and
  items, `atWidth`, `today` in [`helpers.tsx`](/packages/web/src/__tests__/helpers.tsx)). Browser
  tests: `packages/web/src/__browser__/*.test.tsx`, Playwright through Vitest's browser mode, for
  layout. Server tests: `packages/server/src/__tests__/` and `runner/__tests__/`, with the fake
  adapter's `emit`.
- Focused run: `nix develop -c vp test run <file>`. Fast check after each task:
  `nix develop -c vp run fast`. Complete validation: `nix develop -c vp run ready`.
- Screenshots: `nix develop -c vp run --filter uraeda-web screenshots <folder> <views>`, one module
  per feature in [`packages/web/scripts/`](/packages/web/scripts/screenshots.ts).

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Complexity tracking

| Abstraction or exception                                                | Why it is needed                                                                                                                                  | Simpler alternative rejected because                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ColumnPanel` and `splitPanel` ([`layout/`](/packages/web/src/layout/)) | Approval comment C1: one panel shown as a tab or in a split, the split a panel of two panels; the session column and the feature page next use it | A session-only column: two columns that drift, against UI coherence                                          |
| `session/stretches.ts`                                                  | One owner of a stretch's counts and words, called by the chat's recap lines, the live line, the activity, and the sub-agents                      | Words in each component: four copies of one rule                                                             |
| `useSessionColumnWidth`                                                 | C2: a narrower column at semi-wide, keeping the documents' fold and dragged width                                                                 | A second stored width: the fold would differ between pages, against the spec's architecture                  |
| The Activity's walk back over pages (`session/ActivityPanel.tsx`)       | It counts rows, not messages, and reaches the marked stretch's run                                                                                | Reusing the tail's walk: its kept start and probe are about messages, and sharing it would couple two bounds |
| A raw radiogroup of cards on the New page                               | C3 forbids round radios; Astryx's `SelectableCard` is a checkbox. Astryx gap: no radio card                                                       | `RadioList`: draws round radios                                                                              |
| `SessionCache.editedFiles` and `subagentsOf`                            | One SQL read each behind the session record, so the counts are the server's                                                                       | Counting on the web: it would read every page of every turn                                                  |

## Review comments

From [spec-review.md](spec-review.md), approved with comments:

- **C1** (a Panel abstraction): task 3. The column's tabs become panels; a split is a panel of two
  panels. The session column's panels are the split of Activity over Changes, and the split of
  Sub-agents over Changes, so Changes shows under either tab.
- **C2** (a narrower column at semi-wide): task 3 adds the width, task 7 uses it. At semi-wide the
  session column takes 30% of the window, between 300 and 360 px, rather than the documents' 400;
  wide is unchanged. Supersedes "It uses the documents' column's width" of the spec's architecture
  at semi-wide only.
- **C3** (the cards): task 4. Each card is a titled pane, as in the discovery's three-card prototype
  (`mockups/new-a.html`, deleted with the prototypes: see the commit before the plan), its name and
  icon in its border; "Ends with" and "Waits on you" each sit on one line, an icon, the label, then
  the value beside it; no round radio: the picked card is the active pane.

## Test map

Web tests render the app over a fixture repository with the fake agent, seed turns and items through
the server's cache (`addRun`, task 7), and set the clock with `today` or `vi.setSystemTime`; nothing
is timed. Server tests drive the fake adapter's events. Browser tests run the real layout for
widths, the split, the fold, and the sheet.

| Spec                                         | Task    | Test                                                                                                                                                                                |
| -------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1 key 1, SC-001                            | 6       | `session-recap.test.tsx`: one recap line with the exact text, no call row in the chat; 3 runs of 30 calls draw 3 to 6 recap lines                                                   |
| US1 key 2                                    | 6, 8    | `session-recap.test.tsx`: the recap's link is the stretch's address; `session-activity.test.tsx`: that address scrolls to "Run 1 · 2 min" and marks its rows, first "Thought · 8 s" |
| US1 key 3                                    | 6, 8    | `session-recap.test.tsx`: live line "12 s · reading src/tasks/undo.ts"; `session-activity.test.tsx`: last row live                                                                  |
| US1 more 1                                   | 7       | `session-column.test.tsx`: a main-checkout session has the column, no branch part, no progress                                                                                      |
| US1 more 2                                   | 7       | `__browser__/session-column.test.tsx`: Activity in the status line opens the sheet, Back closes it                                                                                  |
| US1 more 3                                   | 8       | `session-activity.test.tsx`: a thought with text unfolds it; one without has no fold                                                                                                |
| US1 more 4                                   | 8       | `session-activity.test.tsx`: "Run 2 · failed"                                                                                                                                       |
| US2 key 1                                    | 7       | `session-column.test.tsx`: "This session · 2 files", "2 edits", "1 edit", no diff                                                                                                   |
| US2 key 2                                    | 7       | `session-column.test.tsx`: "On the branch · 14 files · +312 -41", 2 files, "12 more files"                                                                                          |
| US2 key 3                                    | 7       | `session-column.test.tsx`: the bar reads the task, opens the plan at it                                                                                                             |
| US3 key 1, 2, 3                              | 9       | `session-subagents.test.tsx`                                                                                                                                                        |
| US4 key 1, 2                                 | 6       | `session-recap.test.tsx`: the Session tab draws recap lines and no column; a recap opens the session's page at the stretch                                                          |
| US5 key 1, 2, 3, more 2; SC-005              | 4       | `new-page.test.tsx`                                                                                                                                                                 |
| US5 more 1                                   | 4       | `__browser__/new-cards.test.tsx`: stacked on the phone, without examples                                                                                                            |
| Edge: thousands of calls; SC-002             | 8       | `session-activity.test.tsx`: 5,000 calls mount at most 200 rows; "Show earlier runs" adds 200                                                                                       |
| Edge: denied action, offer, Jump to latest   | 6       | existing `session-turns.test.tsx`, `offer.test.tsx`, `session-tail.test.tsx` kept passing                                                                                           |
| Edge: column folded with `]`                 | 7       | `session-column.test.tsx`: the stretch's address unfolds it                                                                                                                         |
| Edge: failed edit                            | 2, 8    | `session-record.test.ts`: not counted; `session-activity.test.tsx`: row "failed"                                                                                                    |
| Edge: no file changed                        | 7       | `session-column.test.tsx`: "No file changed yet."                                                                                                                                   |
| Edge: before the plan                        | 7       | `session-column.test.tsx`: no progress bar                                                                                                                                          |
| Edge: single call                            | 5       | `stretches.test.ts`: "read src/tasks/undo.ts"                                                                                                                                       |
| Edge: nested sub-agents                      | 8, 9    | `session-activity.test.tsx`: rows of the parent's group; `session-subagents.test.tsx`: not listed                                                                                   |
| Edge: cached before thoughts                 | 5       | `stretches.test.ts`: a stretch of calls only reads no thought                                                                                                                       |
| SC-003                                       | 7       | review: `ActivityPanel`, `ChangesPanel`, `PlanProgress` imported by the session column only                                                                                         |
| SC-004                                       | 6, 7, 8 | the recap's link (6), the address opening the column (7) and the Activity at the stretch (8)                                                                                        |
| Review focus: a stretch past a page          | 6       | `session-recap.test.tsx`                                                                                                                                                            |
| Review focus: an old run                     | 8       | `session-activity.test.tsx`                                                                                                                                                         |
| Review focus: a sub-agent's late calls       | 5, 8    | `stretches.test.ts`; `session-activity.test.tsx`                                                                                                                                    |
| Review focus: documents' column at semi-wide | 7       | `__browser__/session-column.test.tsx`                                                                                                                                               |
| Review focus: Back after a recap             | 6       | `session-recap.test.tsx`                                                                                                                                                            |
| Review focus: two thoughts in a row          | 1       | `sessions.test.ts`                                                                                                                                                                  |
| A thought's text, a sub-agent's thought      | 1       | `claude.test.ts`, `sessions.test.ts`                                                                                                                                                |

Tests removed or rewritten, each with its ruling in [rulings.md](rulings.md): R6 (a tool call's
target, then its duration), R8 (the column's tasks, its feature links, the progress line, and a
change's round row), R11 (the activity line's 10 s threshold), and the column tests that move to the
new column (`session-aside.test.tsx`, `__browser__/side-column.test.tsx`).

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1, 2, 3, and 4: the runner's thought (`runner/`), the session record (`cache.ts`, `fate/`,
   the web's `views.ts`), the column's panels (`layout/` and the four users of `ColumnTab`), and the
   New page. No file in common; task 4 alone adds icons in this wave.
2. Task 5: the stretches, which every later web task calls. Alone: it needs task 1's item.
3. Task 6: the recap lines in the chat; task 7: the session column. Task 6 touches the transcript
   (`TranscriptMessages.tsx`, `tail.tsx`, `ToolGroups.tsx`, `TurnLines.tsx`), task 7 the column and
   the pages (`session/SessionColumn.tsx`, `SessionView.tsx`, `SessionPage.tsx`). Task 6 adds
   `stretchHref` to `SessionPane`'s transcript props in `SessionView.tsx`; task 7 replaces its
   `Framed`: two separate parts of one file, kept side by side by the merge. Both may add icons to
   `theme/icons.ts`.
4. Tasks 8 and 9: the Activity (`session/ActivityPanel.tsx`) and the Sub-agents tab
   (`session/SubagentsPanel.tsx`, and its panel in `SessionColumn.tsx`). Both add icons and seeding
   helpers of their own.
5. Task 10: screenshots of every changed view, alone, once everything is drawn.

---

## Task 1: The runner records thoughts, and times each call

**Risky:** a new kind of stored cache item, and the turn's activity time, which every running
session reports.

**Files:**

- Modify: `packages/server/src/runner/events.ts` (`Item`, `AgentEvent`)
- Modify: `packages/server/src/runner/claude-events.ts` (`parseLine`'s `assistant` case)
- Modify: `packages/server/src/runner/transcript.ts` (`#output`, `#track`, `#result`)
- Modify: `packages/server/src/runner/session-state.ts` (`Running`)
- Modify: `packages/web/src/TranscriptMessages.tsx` (`TranscriptItems` skips a thought, see
  [R13](rulings.md#r13-the-chat-skips-a-thought-until-its-recap-lines-come))
- Test: `packages/server/src/runner/__tests__/claude.test.ts`,
  `packages/server/src/__tests__/sessions.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `Item` gains `{ kind: "thought"; durationMs: number; parent?: string; text?: string }`, as the
    [data model](data-model.md) says. Web code receives it through `uraeda-server/fate`'s `Item`.
  - `AgentEvent` gains `{ type: "thought"; parent?: string; text?: string }`: a thinking block,
    whole, its text only when the agent gave a non-empty one.
  - A main-agent `toolStart` restarts the running turn's `activity.since`, its label staying
    "Working".

- [x] **Step 1: Write the failing tests**

```ts
// runner/__tests__/claude.test.ts
test("a thinking block, whole, is a thought; its text only when given", () => {
  const line = (thinking: string, parent: string | null = null) =>
    JSON.stringify({
      message: { content: [{ signature: "s", thinking, type: "thinking" }] },
      parent_tool_use_id: parent,
      type: "assistant",
    });
  expect(parseLine(line(""))).toEqual([{ type: "thought" }]);
  expect(parseLine(line("Check the rule's shape"))).toEqual([
    { text: "Check the rule's shape", type: "thought" },
  ]);
  expect(parseLine(line("", "toolu_1"))).toEqual([{ parent: "toolu_1", type: "thought" }]);
});
```

Also update the `text.jsonl` row of the fixtures table: it now reads
`[{ type: "thought" }, { text: "ready", type: "text" }]`.

```ts
// __tests__/sessions.test.ts, with vi.setSystemTime
test("a thought lasts from its block's start to its whole block, each its own", async () => {
  // emit activity thinking at t0, thought at t0 + 8 s, activity thinking at t0 + 9 s,
  // thought at t0 + 14 s
  expect(thoughts).toEqual([
    { durationMs: 8000, kind: "thought" },
    { durationMs: 5000, kind: "thought" },
  ]);
});

test("a sub-agent's thought has no start to time it: its length is 0", async () => {
  // emit { parent: "agent-1", text: "Look in src/", type: "thought" }
  expect(thought).toEqual({
    durationMs: 0,
    kind: "thought",
    parent: "agent-1",
    text: "Look in src/",
  });
});

test("each call of the main agent restarts the activity's time", async () => {
  // toolStart read-1 at t0, toolStart read-2 at t0 + 30 s
  expect(activity.since).toBe(new Date(t0 + 30_000).toISOString());
});
```

The break each test catches:

- Whole block: thinking blocks still dropped, or an empty text stored as `""`.
- Each its own: the second thought timed from the first start (14 s), or from no start.
- Sub-agent: a sub-agent thought timed from the main agent's thinking start.
- Restart: `#activity`'s same-label shortcut keeps the first call's `since`.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test run packages/server/src/runner/__tests__/claude.test.ts packages/server/src/__tests__/sessions.test.ts`
- Expected: FAIL, `expected [] to deeply equal [ { type: 'thought' } ]`.

- [x] **Step 3: Implement**

- `claude-events.ts`: an `assistant` block of type `thinking` or `redacted_thinking` gives a
  `thought` event, with `parent` for a sub-agent's line, and `text` only when `thinking` is a
  non-empty string.
- `session-state.ts`: `Running` gains `thinking?: number`, the epoch milliseconds the main agent's
  current thinking block started.
- `transcript.ts`: a main-agent `activity` of kind `thinking` sets `turn.thinking` to now. A
  `thought` event appends `{ kind: "thought", durationMs, ...parent, ...text }`: for the main agent,
  `durationMs` is now minus `turn.thinking`, then cleared; without a start, or for a sub-agent, 0. A
  `thought` event goes through `#track` like the other main-agent events, so it is the main agent's
  next event. A main-agent `toolStart` sets `turn.activity = working(WORKING)` and reports the
  change, even when the label was already "Working".
- No cache migration: the `items` table stores any kind.
- `TranscriptMessages.tsx`: `TranscriptItems` skips a thought, neither a line nor a break between
  tool calls, as `fast` type-checks the web.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS. Deferred to ready: application journeys, browser phone/desktop, production
  builds/package smoke, full workspace/editor checks.

- [x] **Step 5: Commit**

```bash
git add packages/server/src/runner packages/server/src/__tests__/sessions.test.ts packages/web/src/TranscriptMessages.tsx specs/2026-10-25-session-new/plan.md specs/2026-10-25-session-new/rulings.md
git commit -m "feat(session-new): record the agent's thoughts, and time each call"
```

## Task 2: The session record holds its edited files and its sub-agents' work

**Files:**

- Modify: `packages/server/src/runner/cache.ts` (two reads, calling `cache-work.ts`)
- Create: `packages/server/src/runner/cache-work.ts` (the two reads' SQL, and `SubagentRow`: R14)
- Modify: `packages/server/src/fate/sessions.ts` (`turnsOf`, the session record)
- Modify: `packages/server/src/fate/views.ts` (`SubagentRecord`, `SessionRecord`, the data view)
- Modify: `packages/web/src/views.ts` (`SessionView`)
- Modify: `packages/web/src/__focused__/helpers.tsx` (`sessionRecord`, `edited: []`)
- Modify: `packages/server/src/__tests__/sessions.test.ts` (the running sub-agent's whole record:
  R14)
- Test: `packages/server/src/__tests__/session-record.test.ts` (new)

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `SessionRecord.edited: Array<{ edits: number; path: string }>`: the targets of the session's
    completed `edit` tool calls, every turn and sub-agent included, in the order of their first
    edit, with their number of completed edits. A failed or running edit does not count. Read by
    `SessionView` as `edited: true`.
  - `SubagentRecord` becomes
    `{ calls: number; description: string; id: string; latest: { target: string | null; toolKind: ToolKind } | null; parent: string | null; startedAt: string }`:
    `calls` counts the tool items whose `parent` is the sub-agent's id; `latest` is the last of
    them; `parent` is the sub-agent that started it, null for the main agent's; `startedAt` is the
    sub-agent's item's cached insert time, ISO 8601. The list still holds the running turn's
    sub-agents in progress only, for the session and the sidebar's rows.
  - `SessionCache.editedFiles(sessionId: string): Array<{ edits: number; path: string }>` and
    `SessionCache.subagentsOf(turnId: number): Array<SubagentRecord>`.

- [x] **Step 1: Write the failing tests**

```ts
// __tests__/session-record.test.ts
test("a session's edited files, with their completed edits, in order", async () => {
  // turn 1: edit complete.ts (completed), edit complete.test.ts (completed), edit complete.ts
  // (completed); turn 2: edit undo.ts (failed), read repeat.ts
  expect(record.edited).toEqual([
    { edits: 2, path: "src/tasks/complete.ts" },
    { edits: 1, path: "src/tasks/complete.test.ts" },
  ]);
});

test("a running sub-agent's calls, its latest call, and its start", async () => {
  // at 15:00:00, Agent "Research rrule" starts; then 6 tool calls with parent: agent-1, the last a
  // fetch of github.com/jkbrzt/rrule/issues/412; a nested Agent with parent agent-1
  expect(record.subagents).toEqual([
    expect.objectContaining({
      calls: 7,
      description: "Research rrule",
      latest: { target: "github.com/jkbrzt/rrule/issues/412", toolKind: "fetch" },
      parent: null,
      startedAt: "2026-10-25T15:00:00.000Z",
    }),
    // the nested sub-agent is listed too while it runs, with its parent: the tab leaves it out
    expect.objectContaining({ parent: "agent-1" }),
  ]);
});
```

The break each test catches:

- Edited files: a failed edit counted, reads counted, or files counted per turn instead of the
  session.
- Sub-agents: calls of the other sub-agents counted, or `latest` the first call.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/server/src/__tests__/session-record.test.ts`
- Expected: FAIL, `expected undefined to deeply equal [ { edits: 2, … } ]`.

- [x] **Step 3: Implement**

The two cache reads use SQL over the `items` table, the JSON fields read with `json_extract`, so no
page is read into memory: `editedFiles` over the session's turns, `kind = 'tool'`,
`toolKind = 'edit'`, `status = 'completed'`, grouped by target, ordered by the first edit's turn and
seq; `subagentsOf` over the running turn. `turnsOf` uses `subagentsOf`; the session record adds
`edited`. Keep `turnsOf` within the function limit: move the sub-agents' read into the cache, not
into the function.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS. Deferred to ready: the web's tests, whose session records now carry the new
  fields.

- [x] **Step 5: Commit**

```bash
git add packages/server/src packages/web/src/views.ts specs/2026-10-25-session-new/plan.md
git commit -m "feat(session-new): the session's edited files and its sub-agents' work"
```

## Task 3: The column's panels, its split, its foot, and the session's width

**Risky:** the documents' column is shared by the questions, spec, and plan pages: a rename and a
layout change there reach them all.

**Files:**

- Modify: `packages/web/src/layout/DocumentColumn.tsx` (`ColumnTab` → `ColumnPanel`, `footer`)
- Create: `packages/web/src/layout/SplitPanel.tsx`
- Modify: `packages/web/src/layout/SideColumn.tsx` (`isFilled`)
- Modify: `packages/web/src/layout/documentColumnWidth.ts` (`useSessionColumnWidth`)
- Modify: `packages/web/src/spec/SpecColumn.tsx`, `packages/web/src/RoundColumn.tsx`,
  `packages/web/src/ColumnSession.tsx`, `packages/web/src/spec/pageSession.ts`,
  `packages/web/src/__browser__/document-column.test.tsx` (the rename)
- Test: `packages/web/src/__tests__/document-column.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `type ColumnPanel = { badge?: ReactNode; content: ReactNode; fills?: boolean; icon: …; key: string; label: string }`,
    replacing `ColumnTab` and its `panel` field. A panel shows as a tab of the column.
  - `splitPanel(top: ColumnPanel, bottom: ColumnPanel): ColumnPanel`: a panel with the top's key,
    label, icon, and badge, `fills: true`, holding the top's content above, scrolling on its own,
    and the bottom's under it, titled by the bottom's label as a level-3 heading, at most 40% of the
    column's height and scrolling past it.
  - `DocumentColumn` gains `footer?: ReactNode`, drawn at the column's foot under the open panel.
    When the open panel `fills`, the column's content takes its height and does not scroll as a
    whole (`SideColumn`'s `isFilled`).
  - `useSessionColumnWidth()`, the same shape as `useDocumentColumnWidth()`, under the same key and
    fold: wide, the documents' width; semi-wide, `sessionAutoWidth(windowWidth)` = 30% of the window
    between 300 and 360 px; dragged between 300 and 720 px. It registers with `showDocumentColumn()`
    as the documents' column does.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/document-column.test.ts
test("the session column is narrower than the documents' at semi-wide (C2)", () => {
  expect(sessionAutoWidth(1000)).toBe(300);
  expect(sessionAutoWidth(1279)).toBe(360);
  expect(autoWidth(1000)).toBe(400);
});
```

The break it catches: the session column taking the documents' 400 px at semi-wide, or the
documents' column narrowed with it.

The rename and the split are checked by the existing column tests, which must keep passing, and by
task 7's browser tests, which draw the split on a page.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/web/src/__tests__/document-column.test.ts`
- Expected: FAIL, `sessionAutoWidth is not a function`, or its import missing.

- [ ] **Step 3: Implement**

The rename is mechanical; `splitPanel`'s layout is StyleX through the theme's tokens. The split's
bottom heading is the panel's label; the 40% bound is the spec's. `useSessionColumnWidth` picks its
auto width with `useWidthClass()`; its stored width is clamped to its own limits as it is read, as
`followedWidth.ts` does for each reader.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then
  `nix develop -c vp test run --config packages/web/vite.browser.config.ts packages/web/src/__browser__/document-column.test.tsx packages/web/src/__browser__/spec-column.test.tsx packages/web/src/__browser__/round-column.test.tsx`
- Expected: PASS: the documents' columns unchanged. Deferred to ready: the other browser suites.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-25-session-new/plan.md
git commit -m "feat(session-new): column panels, a split panel, and the session column's width"
```

## Task 4: New tells its three kinds apart, as cards

**Files:**

- Modify: `packages/web/src/NewPage.tsx` (`ABOUT`, `About`, `NewPage`)
- Create: `packages/web/src/KindCards.tsx`
- Modify: `packages/web/src/theme/icons.ts` (the cards' icons)
- Test: `packages/web/src/__tests__/new-page.test.tsx`,
  `packages/web/src/__browser__/new-cards.test.tsx` (new)

**Interfaces:**

- Consumes: `Pane` (`layout/Pane.tsx`), `isActive` for the picked card.
- Produces: `KindCards({ kind, onPick }: { kind: NewKind; onPick: (kind: NewKind) => void })`: a
  `radiogroup` named "What to start" of three `radio` cards named "Session", "Change", "Feature".

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/new-page.test.tsx
test("US5.1: New without a kind picks Session, its composer under the cards", async () => {
  await renderPage("/new", fixtureRepo(), { agent: await fakeAgent() });
  expect(card("Session").getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("textbox", { name: "Message Claude Code" })).toBeTruthy();
});

test("US5.2: picking Feature marks it, puts it in the address, and shows its form", async () => {
  await click(card("Feature"));
  expect(`${location.pathname}${location.search}`).toBe(atRepo("/new?kind=feature"));
  expect(screen.getByRole("textbox", { name: "Title" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Write the proposal" })).toBeTruthy();
  expect(screen.getByText("Or start from a note or a priority")).toBeTruthy();
});

test("US5.3: each card says what it ends with and what waits on you", async () => {
  expect(facts("Session")).toEqual(["Ends with", "the chat", "Waits on you", "nothing"]);
  expect(facts("Change")).toEqual(["Ends with", "a pull request", "Waits on you", "the pull request"]);
  expect(facts("Feature")).toEqual([
    "Ends with", "a spec, then a pull request", "Waits on you", "questions, then the spec",
  ]);
});

test("US5 more 2: the arrow keys move the pick", async () => {
  card("Session").focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(card("Change").getAttribute("aria-checked")).toBe("true");
  expect(document.activeElement).toBe(card("Change"));
});

test("SC-005: a reload keeps the picked kind", …);
```

Rewrite the helper `pick` to click a card, and the tests that read the old sentences and steps,
"＋ New opens Session, with its sentence" and "the steps that wait on you", to the cards' texts:
Session "Talk to the agent in the main checkout, like plain Claude Code.", Change "A bug fix or a
small change, on its own branch.", Feature "A larger piece of work, designed with the agent before
any code.", examples “Why is CI slow?”, “Fix the due-date typo”, “Add recurring tasks”.

```ts
// __browser__/new-cards.test.tsx
test("US5 more 1: on the phone, the cards stack, without their examples, the form after them", …);
test("C3: each fact's value sits on its label's line, beside it", …); // the value's box starts within 2 ch of its label's end
```

The break each test catches:

- Default pick: no kind reads as nothing picked, or Feature.
- Address: the pick kept in state, lost on reload.
- Facts: a card missing a fact, or the facts swapped between kinds.
- Arrows: cards as buttons, with no roving focus.
- Facts' line: the label and value in a grid column far apart, as C3 found.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/web/src/__tests__/new-page.test.tsx`
- Expected: FAIL, `Unable to find role="radio" and name "Session"` inside the cards' group, the
  segmented control's radios having no "Ends with".

- [ ] **Step 3: Implement**

Each card is a `Pane` titled by the kind with its icon, `isActive` when picked, inside a raw element
with `role="radio"`, `aria-checked`, and a roving `tabIndex`, in a `role="radiogroup"` (the Astryx
gap of the complexity tracking). Its body: the sentence in the reading font, the example in
secondary text (not drawn at narrow widths), then "Ends with" and "Waits on you", each a line of an
icon, the label in secondary text, and its value right after it. Arrow keys move the focus and the
pick, Home and End to the ends; a click or Space picks. Picking replaces the address, as today:
`/new` for Session, `/new?kind=<kind>` otherwise. Three columns at semi-wide and wide, stacked at
narrow, through the width class. The forms under the cards are unchanged.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then
  `nix develop -c vp test run --config packages/web/vite.browser.config.ts packages/web/src/__browser__/new-cards.test.tsx packages/web/src/__browser__/new-change.test.tsx`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-25-session-new/plan.md
git commit -m "feat(session-new): New's three kinds as cards"
```

## Task 5: The stretches, and every word they say

**Files:**

- Create: `packages/web/src/session/stretches.ts`
- Test: `packages/web/src/__tests__/stretches.test.ts`

**Interfaces:**

- Consumes: task 1's `thought` item, through `TranscriptItem` (`TranscriptMessages.tsx`).
- Produces:
  - `type ActivityItem = Extract<TranscriptItem, { kind: "thought" | "tool" }>`.
  - `type Stretch = { items: ReadonlyArray<ActivityItem>; key: string }`: the main agent's calls and
    thoughts between two other items of a turn, its sub-agents' starting calls included; `key` is
    `stretchKey(turn, firstSeq)`.
  - `type Slot = { item: TranscriptItem; kind: "item" } | { kind: "stretch"; stretch: Stretch }`.
  - `slotsOf(turn: string, items: ReadonlyArray<TranscriptItem>): Array<Slot>`: a page's items in
    order, each run of the main agent's calls and thoughts one stretch. Items with a `parent` are
    left out, and do not end a stretch.
  - `stretchKey(turn: string, seq: number): string`, `` `${turn}:${seq}` ``;
    `STRETCH_PARAMETER = "stretch"`; `stretchAddress(path: string, key: string): string`,
    `path?tab=activity&stretch=<key>`.
  - `lengthOf(items: ReadonlyArray<ActivityItem>): number`: the sum of their `durationMs`, in ms.
  - `recapText(items: ReadonlyArray<ActivityItem>): string`.
  - `doingText(tool: { target?: string | null; toolKind: ToolKind; name?: string }): string`: what a
    running call does, "reading src/tasks/undo.ts".
  - `liveText(lastingMs: number, doing: string, subagents: number): string`.
  - `rowWord(tool: ToolItem, ended: boolean): string`: an activity row's end word.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/stretches.test.ts
test("US1.1: a run of reads, a search, a fetch, and two thoughts", () => {
  expect(recapText([thought(8_000), read("src/tasks/complete.ts", 30_000),
    read("src/tasks/repeat.ts", 20_000), read("src/tasks/repeat.test.ts", 17_000),
    search('"rrule next occurrence"', 25_000), fetch("github.com/jkbrzt/rrule#usage", 15_000),
    thought(5_000)])).toBe("2 min · read 3 files · searched once · fetched 1 page · thought twice");
});
test("edits count files, commands count calls", () => {
  expect(recapText([edit("a.ts", 20_000), edit("b.ts", 20_000), edit("a.ts", 10_000),
    run("pnpm test", 10_000)])).toBe("1 min · edited 2 files · ran 1 command");
});
test("edge: a single call reads the call", () => {
  expect(recapText([read("src/tasks/undo.ts", 4_000)])).toBe("4 s · read src/tasks/undo.ts");
});
test("edge: a session cached before thoughts counts none", …); // reads only: no "thought"
test("a stretch ends at a text, a message, a system line, or a denial", …);
test("review focus 3: a sub-agent's calls leave the stretches as they are", () => {
  // tool(agent-1, subagent), text, tool(parent agent-1), tool(parent agent-1), text
  expect(slotsOf("7", items).map(kindOf)).toEqual(["stretch", "item", "item"]);
});
test("US1.3: the live line", () => {
  expect(liveText(12_000, doingText({ target: "src/tasks/undo.ts", toolKind: "read" }), 0))
    .toBe("12 s · reading src/tasks/undo.ts");
  expect(liveText(12_000, "reading src/tasks/undo.ts", 2))
    .toBe("12 s · reading src/tasks/undo.ts · 2 sub-agents running");
});
test("rows' words: read, edit, search, fetch, run; failed and unfinished", …);
test("the stretch's address", () => {
  expect(stretchAddress("/r/x/sessions/s1", stretchKey("7", 3)))
    .toBe("/r/x/sessions/s1?tab=activity&stretch=7%3A3");
});
```

The counts' words, in this order (ruling R5): reads "read N file(s)" and edits "edited N file(s)",
deletes "deleted N file(s)", moves "moved N file(s)", counting distinct targets; searches "searched
once", "twice", "N times"; fetches "fetched N page(s)"; commands "ran N command(s)"; sub-agents "ran
N sub-agent(s)"; other tools "used N other tool(s)"; thoughts "thought once", "twice", "N times". A
single call: its past verb and target, "read src/tasks/undo.ts", "ran pnpm test"; a single thought:
"thought once". The time is `elapsed(lengthOf(items))` from `TurnLines.tsx`. Doing: "reading",
"editing", "deleting", "moving", "searching", "fetching", "running", then the target; a sub-agent
"running a sub-agent"; another tool "using <name>". Row words (ruling R6): "read", "edit", "delete",
"move", "search", "fetch", "run", "sub-agent", the tool's name otherwise; "failed" for a failed or
cancelled call; "not finished" for a call still in progress in an ended turn.

The break each test catches:

- US1.1: thoughts counted as calls, or reads counted per call of the same file.
- Edits: edits counted per call ("3 files").
- Single call: a count, "read 1 file".
- Sub-agent: the sub-agent's later calls splitting the main agent's text from the next stretch.
- Live: the sub-agents' count missing, or the time read from the turn's start.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/web/src/__tests__/stretches.test.ts`
- Expected: FAIL, `Failed to resolve import "../session/stretches.ts"`.

- [ ] **Step 3: Implement `session/stretches.ts`**

Pure functions, no React. One table of the kinds' words serves recap counts, single calls, doing,
and rows, so a word changes in one place.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/session/stretches.ts packages/web/src/__tests__/stretches.test.ts specs/2026-10-25-session-new/plan.md
git commit -m "feat(session-new): stretches of calls, and their words"
```

## Task 6: Recap lines in the chat

**Files:**

- Modify: `packages/web/src/TranscriptMessages.tsx` (`TranscriptItems`, `Actions`)
- Create: `packages/web/src/session/RecapLine.tsx`
- Modify: `packages/web/src/tail.tsx` (`TailPage`'s live line)
- Modify: `packages/web/src/TurnLines.tsx` (remove `Activity`), `packages/web/src/Transcript.tsx`
- Delete: `packages/web/src/ToolGroups.tsx`
- Modify: `packages/web/src/SessionView.tsx` (`SessionLog`'s `Transcript` props only)
- Test: `packages/web/src/__tests__/session-recap.test.tsx` (new); rewrite `session-turns.test.tsx`
  "a tool call shows its target, then its duration" and "250 items of a turn show in order",
  `session.test.tsx` "a running turn ends with what the agent does now…" and "an activity's time
  reads in seconds, then minutes", and the `session-tail.test.tsx` tests that read tool groups
  (focus 5), against recap lines.

**Interfaces:**

- Consumes: task 5's `slotsOf`, `recapText`, `doingText`, `liveText`, `stretchAddress`; task 2's
  `session.subagents` for the live line's count; `addRun` from task 7 is not available in this wave:
  seed with `fake.sessions.cache` as `session-tail.test.tsx` does.
- Produces:
  - `Actions.stretchHref?: (key: string) => string`, set by `SessionPane`: on the session's page,
    `stretchAddress(location.pathname, key)`; boxed in a document's column,
    `stretchAddress(here(sessionPath(folder)), key)`. Without it, a recap line is text.
  - `RecapLine({ href, live, text }: { href?: string; live?: boolean; text: string })`: a link whose
    accessible name is `text` alone. On the session's page it replaces the history entry, as a tab
    does; from a document's column it opens the session's page in a new entry.

- [ ] **Step 0: `tail.tsx` is at the 500-line limit**

If replacing the live line grows it, first move `Pieces`, `useKeptStart`, and `useSettled` into
`tailPieces.tsx` without changing them, run
`nix develop -c vp test run packages/web/src/__tests__/session-tail.test.tsx` before and after (PASS
both), and commit `refactor(session-new): the tail's pieces in a file of their own`.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/session-recap.test.tsx
test("US1.1: one recap line for a stretch, above the answer, and no call in the chat", async () => {
  // thought 8 s, three reads, a search, a fetch, thought 5 s, summing 120 s, then the answer
  const recap = await screen.findByRole("link", {
    name: "2 min · read 3 files · searched once · fetched 1 page · thought twice",
  });
  expect(recap.compareDocumentPosition(answer()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(conversation()).queryByText("src/tasks/complete.ts")).toBeNull();
});
test("US1.2, SC-004: the recap line opens the Activity at its stretch", async () => {
  expect(recap.getAttribute("href")).toBe(`${location.pathname}?tab=activity&stretch=${turn}%3A1`); // its message is seq 0
});
test("SC-001: 3 runs of 30 calls draw 3 to 6 recap lines", …);
test("US1.3: a running turn reading a file for 12 s", async () => {
  // vi.setSystemTime: toolStart read src/tasks/undo.ts at t0, now t0 + 12 s
  expect(await screen.findByText("12 s · reading src/tasks/undo.ts")).toBeTruthy();
});
test("review focus 1: a stretch of 250 calls over three pages draws one line, after its last call", …);
test("review focus 5: Back after a recap line leaves the page", …);
test("US4.1: the Session tab of a document draws recap lines, and no column of its own", …);
test("US4.2: a recap line in the Session tab opens the session's page at the stretch", …);
```

The break each test catches:

- US1.1: tool groups still drawn, or the recap drawn after the answer.
- US1.2: a recap that only scrolls the chat, or an address without the stretch.
- SC-001: one line per call.
- US1.3: the time from the turn's start, or "Working".
- Focus 1: a line per page, each with a third of the counts.
- Focus 5: recap clicks pushing history entries.
- US4: the column drawn in the column, or the link opening the document's tab.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/web/src/__tests__/session-recap.test.tsx`
- Expected: FAIL, `Unable to find role="link" and name "2 min · read 3 files · …"`.

- [ ] **Step 3: Implement**

- `TranscriptItems` draws `slotsOf`'s slots: an item as today (a `thought` is never drawn alone), a
  stretch as a `RecapLine` with `recapText`. The `else` branch that drew any other kind as a denial
  names the denial kind.
- A stretch whose first item is the first of its page, on a page after the turn's first, continues
  one from the page before: its recap line reads the pages before back to the stretch's start, so it
  counts the whole stretch, and the page where the stretch starts draws no line for it. The line
  sits after the stretch's last call. Pages are read with `useTurnLog`, under `Suspense`, as the
  tail reads them.
- A running turn's end, in `TailPage`, draws the live `RecapLine`:
  `liveText(now - activity.since, doing, running sub-agents)`, `doing` the latest in-progress main
  call's `doingText`, else the activity's label in lower case. It ticks each second, and is
  `aria-hidden` text inside the link, as the activity line's time is today; the link names the open
  stretch, or the Activity with no stretch.
- Remove `ToolGroups.tsx` and `TurnLines.tsx`'s `Activity`; keep `elapsed`, `ending`, `Ending`.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then
  `nix develop -c vp test run --config packages/web/vite.browser.config.ts packages/web/src/__browser__/session.test.tsx packages/web/src/__browser__/session-tail.test.tsx packages/web/src/__browser__/session-look.test.tsx packages/web/src/__browser__/column-session.test.tsx`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-25-session-new/plan.md specs/2026-10-25-session-new/rulings.md
git commit -m "feat(session-new): recap lines in the chat, for every stretch of calls"
```

## Task 7: The session column: activity over changes, and the progress

**Files:**

- Create: `packages/web/src/session/SessionColumn.tsx`, `session/ChangesPanel.tsx`,
  `session/PlanProgress.tsx`, `session/ActivityPanel.tsx` (its empty state only: task 8 fills it)
- Modify: `packages/web/src/SessionView.tsx` (`Framed`, `SessionPane`'s `aside` prop),
  `packages/web/src/SessionPage.tsx`
- Delete: `packages/web/src/SessionAside.tsx`, `ChangeAside.tsx`, `ProgressLine.tsx`, and what only
  they used
- Modify: `packages/web/src/__tests__/helpers.tsx` (`addRun`)
- Test: `packages/web/src/__tests__/session-column.test.tsx` (new, from `session-aside.test.tsx`,
  deleted), `packages/web/src/__browser__/session-column.test.tsx` (new, from
  `side-column.test.tsx`, deleted)

**Interfaces:**

- Consumes: task 2's `session.edited`; task 3's `ColumnPanel`, `splitPanel`, `DocumentColumn`'s
  `footer` and `column`, `useSessionColumnWidth`; task 5's `STRETCH_PARAMETER`.
- Produces:
  - `SessionColumn({ content, folder, session }: { content: ReactNode; folder?: string; session?: string })`:
    the session's page with its column, labelled "The session's column", for every session. Its
    panels: `splitPanel(activity, changes)` with key `activity`, label "Activity", icon
    `uraeda:activity`; its foot `PlanProgress` for a folder. On the phone, the status line's
    "Activity", "Changes" with the session's file count, and the progress "3 / 7", the first two
    opening the sheet `activity` (`useSheetTab`), the third the plan at the task. `sessionPanels` is
    where task 9 adds the Sub-agents panel.
  - A `?stretch=` in the address unfolds a folded column (`showDocumentColumn()`), and opens
    `activity`.
  - `ChangesPanel({ folder, session }: { folder?: string; session?: string })`,
    `PlanProgress({ folder }: { folder: string })`,
    `ActivityPanel({ session }: { session: string })`.
  - `addRun(fake: Fake, session: string, items: ReadonlyArray<Item>, state?: "done" | "failed" | "running"): number`
    in `helpers.tsx`: a turn of the session with those items, ended unless running, its id.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/session-column.test.tsx
test("US2.1: this session's files, with their edits, and no diff", async () => {
  expect(changes().getByText("This session · 2 files")).toBeTruthy();
  expect(row("src/tasks/complete.ts").getByText("2 edits")).toBeTruthy();
  expect(row("src/tasks/complete.test.ts").getByText("1 edit")).toBeTruthy();
});
test("US2.2: the branch's files, the first two, then how many more", async () => {
  // 14 files, +312 -41, on the branch
  expect(changes().getByText("On the branch · 14 files · +312 -41")).toBeTruthy();
  await click(changes().getByRole("button", { name: "12 more files" }));
});
test("US2.3: the progress bar reads the task, and opens the plan at it", async () => {
  // addPlan: Task 7 of 11
  const bar = column().getByRole("link", { name: /Implementation · task 7 of 11/ });
  expect(bar.getAttribute("href")).toBe(atRepo(`/f/${CLI}/plan.md#task-7-…`));
});
test("edge: before its plan, no progress bar", …);
test("edge: a session that changed nothing reads No file changed yet.", …);
test("US1 more 1: a chat in the main checkout has the column, without the branch or progress", …);
test("edge: the stretch's address unfolds the folded column, at Activity", …);
// kept from session-aside.test.tsx, against the new column: a new commit adds a file; more than 50
// files; a binary file; git failing; a read that fails leaves the rest; nothing outside the folder;
// a merged feature has no branch part; the fold kept after a reload and with storage refused;
// folding keeps the focus on its button; an error under the composer stays as the column folds.

// __browser__/session-column.test.tsx
test("wide: the column is a third of the window; semi-wide: 300 px at 1000 px (C2)", …);
test("review focus 4: at 1000 px a document's column stays 400 px", …);
test("the Changes part takes at most 40% of the column's height, and scrolls", …);
test("US1 more 2: on the phone, Activity opens the column as a sheet, and Back closes it", …);
test("the column resizes, its width kept after a reload; ] folds it", …);
```

The break each test catches:

- US2.1: the branch's committed files listed as this session's, or a diff drawn.
- US2.2: all 14 files listed, or the total missing its counts.
- US2.3: the bar without its link, or linking the plan's top.
- Before the plan, nothing changed, main checkout: an empty bar, an empty list, or no column.
- Stretch address: a recap that does nothing on a folded column.
- C2 and focus 4: both columns narrowed, or neither.
- 40%: the changes pushing the activity out of view.
- Phone: a sheet outside the address, so Back leaves the page.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/web/src/__tests__/session-column.test.tsx`
- Expected: FAIL, `Unable to find role="complementary" and name "The session's column"`.

- [ ] **Step 3: Implement**

- `SessionColumn` draws `DocumentColumn` with `useSessionColumnWidth()`; `Framed` uses it for every
  page session, with or without a folder (Q4), and the boxed pane has no column.
- `ChangesPanel`: "This session · N files" and the session's `edited` rows, "N edits"; or "No file
  changed yet."; then, for a folder with a branch, "On the branch · N files · +A -R" and its first 2
  files with their lines (green, red, or "binary"), then "N more files", a button that unfolds the
  rest the core sends, then "and N more files" past them (ruling R7). The branch part keeps today's
  read failure, "The changes could not be read.", inside the error boundary that leaves the rest.
- `PlanProgress`: only while the feature's step has `progress` (ruling R8): a link to the plan page
  at the task's heading, "<step> · task P of T" and the task's title, over Astryx's `ProgressBar`.
- `ActivityPanel`: "No call yet." for now.
- The column's rail shows its panels' icons.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then
  `nix develop -c vp test run --config packages/web/vite.browser.config.ts packages/web/src/__browser__/session-column.test.tsx packages/web/src/__browser__/session.test.tsx packages/web/src/__browser__/status-line.test.tsx packages/web/src/__browser__/document-column.test.tsx`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-25-session-new/plan.md specs/2026-10-25-session-new/rulings.md
git commit -m "feat(session-new): the session column, its changes, and its progress"
```

## Task 8: The Activity, by run, bounded

**Files:**

- Modify: `packages/web/src/session/ActivityPanel.tsx`
- Create: `packages/web/src/session/ActivityRows.tsx` (if the panel would pass the limits)
- Modify: `packages/web/src/theme/icons.ts` (the rows' icons)
- Test: `packages/web/src/__tests__/session-activity.test.tsx` (new)

**Interfaces:**

- Consumes: task 5's `slotsOf`, `rowWord`, `STRETCH_PARAMETER`, `stretchKey`; task 7's `addRun` and
  the `activity` panel; `useTurn`, `useTurnLog`, `useOpenKeys`.
- Produces: `ACTIVITY_ROWS = 200`, exported for the tests; `ActivityPanel` with the same signature.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/session-activity.test.tsx
test("US1.2: the stretch's address scrolls to its run, and marks its rows", async () => {
  // run 1 at 15:41, 2 min long: thought 8 s, three reads, a search, a fetch, thought 5 s
  await renderPage(`/sessions/${id}?tab=activity&stretch=${turn}%3A1`, …);
  expect(scrolledTo()).toBe("Run 1 · 2 min");
  const marked = activity().getAllByRole("listitem", { current: true });
  expect(marked).toHaveLength(7);
  expect(marked[0].textContent).toContain("Thought");
  expect(marked[0].textContent).toContain("8 s");
});
test("US1.3: the running call is the last row, marked live", …); // within(last).getByLabelText("Live")
test("US1 more 3: a thought with text unfolds it; one without has no fold", …);
test("US1 more 4: a failed run reads Run 2 · failed", …);
test("edge: a failed edit shows failed", …);
test("SC-002: a session of 5,000 calls mounts at most 200 rows; Show earlier runs adds 200", async () => {
  expect(activity().getAllByRole("listitem").length).toBeLessThanOrEqual(ACTIVITY_ROWS);
  await click(activity().getByRole("button", { name: "Show earlier runs" }));
  expect(activity().getAllByRole("listitem").length).toBeLessThanOrEqual(2 * ACTIVITY_ROWS);
});
test("review focus 2: a stretch older than the 200 rows draws back to its run", …);
test("review focus 3, edge: a sub-agent's calls are its group's rows, folded and not mounted", …);
test("edge: a sub-agent's own sub-agent is a row of its parent's group", …);
```

The break each test catches:

- US1.2: the address read but no row marked, or the wrong run's rows.
- Live: in-progress rows drawn as done.
- Thought text: a fold on every thought, or the text mounted while folded.
- 5,000 calls: every row mounted, or the bound counting messages.
- Old run: a stretch past the bound ignored, nothing marked.
- Sub-agents: their calls among the main agent's rows, or mounted folded.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/web/src/__tests__/session-activity.test.tsx`
- Expected: FAIL, `Unable to find role="heading" and name "Run 1 · 2 min"`.

- [ ] **Step 3: Implement**

- The panel walks the session's turns from the latest back, and each turn's pages from its last,
  collecting rows until `ACTIVITY_ROWS`; past them, "Show earlier runs" at the top adds 200, the
  place kept as the tail keeps it. A folded sub-agent group counts as one row. While the address
  names a stretch, the walk goes back at least to its turn.
- A run: a level-3 heading "Run N · <length>", N its place among the session's turns, its length
  `elapsed(endedAt - startedAt)` (ruling R4), "live" while it runs, "failed" in the error colour,
  "stopped" for a stopped one; its start time, `sentAt`, at its end. Then a list of its rows.
- A row: the kind's icon, the target (or "Thought", or the sub-agent's description), and `rowWord`,
  or a thought's length when at least a second. A call with output, a thought with text, and a
  sub-agent's group unfold, their content not mounted while folded, kept open in the history entry
  through `useOpenKeys`. An in-progress call of a running turn shows a status mark named "Live". A
  sub-agent's group holds the calls whose `parent` is its id, nested sub-agents as rows.
- The stretch the address names: its rows are `aria-current="true"`, and its run's heading is
  scrolled into view once drawn, in the column's scroller.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS. Deferred to ready: the browser suites.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-25-session-new/plan.md
git commit -m "feat(session-new): the Activity, by run, bounded to 200 rows"
```

## Task 9: The Sub-agents tab, while they run

**Files:**

- Create: `packages/web/src/session/SubagentsPanel.tsx`
- Modify: `packages/web/src/session/SessionColumn.tsx` (`sessionPanels`)
- Modify: `packages/web/src/theme/icons.ts` (`uraeda:users`)
- Test: `packages/web/src/__tests__/session-subagents.test.tsx` (new)

**Interfaces:**

- Consumes: task 2's `SubagentRecord`; task 5's `doingText`; task 7's `sessionPanels`, `addRun`.
- Produces: the panel `subagents`, label "Sub-agents", its badge the running count, as
  `splitPanel(subagents, changes)`, shown while `session.subagents` lists one whose `parent` is
  null, or while the address's `?tab=` is `subagents`.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/session-subagents.test.tsx
test("US3.1: a run with no sub-agent has the Activity tab alone", …);
test("US3.2: two running sub-agents, their calls, what they do, and since when", async () => {
  // "Research rrule's undo of an occurrence", 6 calls, the last fetching
  // github.com/jkbrzt/rrule/issues/412, started 1 min ago; "Find every caller of complete()",
  // 3 calls, the last searching "complete(", started 20 s ago
  await click(tab("Sub-agents"));
  expect(rowText("Research rrule's undo of an occurrence"))
    .toContain("6 calls · fetching github.com/jkbrzt/rrule/issues/412");
  expect(rowText("Research rrule's undo of an occurrence")).toContain("1 min");
  expect(rowText("Find every caller of complete()")).toContain('3 calls · searching "complete("');
});
test("US3.3: once the last ends, each is marked done, and the tab stays until left", …);
test("edge: a sub-agent's own sub-agent is not listed", …);
```

The break each test catches:

- US3.1: the tab always shown.
- US3.2: the first call's target instead of the latest, or the time from the turn's start.
- US3.3: the tab vanishing under the human, or sub-agents still marked running.
- Nested: a nested sub-agent listed as one of the session's.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/web/src/__tests__/session-subagents.test.tsx`
- Expected: FAIL, `Unable to find role="tab" and name "Sub-agents"`.

- [ ] **Step 3: Implement**

Rows: the description, then "<calls> calls · <doingText(latest)>", then the time since `startedAt`
ticking each second, with a status mark "Working". The panel keeps the rows it drew while the tab is
open: a sub-agent gone from the record is marked "Done", its time frozen (ruling R10). A nested
sub-agent, one whose `parent` is not null, is left out of the tab and of its badge's count.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-25-session-new/plan.md
git commit -m "feat(session-new): the Sub-agents tab, while they run"
```

## Task 10: Screenshots of the changed views

**Files:**

- Create: `packages/web/scripts/session-new-shots.ts`
- Modify: `packages/web/scripts/screenshots.ts` (register the views), `packages/web/samples/` (a
  session with stretches, thoughts, edits, and sub-agents, if none fits)
- Create: `specs/2026-10-25-session-new/screenshots/*.webp`

**Interfaces:**

- Consumes: every earlier task.
- Produces: screenshots `session`, `session-subagents`, `session-plain`, `session-sheet` (phone),
  `embedded-session`, `new-session`, `new-change`, `new-feature`, each at phone and desktop sizes,
  in light and dark, plus `session-semi` at 1000 px for C2.

- [ ] **Step 1: Take them**

- Run:
  `nix develop -c vp run --filter uraeda-web screenshots specs/2026-10-25-session-new session session-subagents session-plain session-sheet embedded-session new-session new-change new-feature session-semi`
- Expected: the files in `specs/2026-10-25-session-new/screenshots/`.

- [ ] **Step 2: Review them against the spec's mockups and the UI decisions**

Square corners, titled panes, text readable at each size, the chat's prose in the reading font, the
column clearly lighter than the chat at semi-wide (C2), the cards' facts on one line each with their
icons (C3). Fix what they show in the task that owns it, as a fix commit, and take them again.

- [ ] **Step 3: Run the complete validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/scripts packages/web/samples specs/2026-10-25-session-new/screenshots specs/2026-10-25-session-new/plan.md
git commit -m "test(session-new): screenshots of the session and New pages"
```
