---
status: auto-approved
spec-revision: 1
---

# Plan: Feature page in the terminal look

**Goal:** a feature's or a change's page is a Home of titled panes (Next, a timeline of its stages
holding their files, and a column of sessions, figures, and links), its old-look document pages join
the terminal look, and the Storybook page is gone.

**Architecture:** the Home is drawn from the parts the questions and spec pages built: `Pane`, the
document column's width and fold, and `SpecColumn`'s Contents and Session. See the
[spec's architecture](spec.md#architecture).

- `feature/FeaturePage.tsx` owns the page's order: head, banners, Next, timeline, a done feature's
  record, and the column. Each part below owns one rule.
- `feature/next.ts` owns who acts and the one button; `NextPane` runs it. A "Continue" button is the
  existing hand-over (`handOver` in `sessions.ts`), so the message and its composer are the session
  page's.
- `feature/stageFiles.ts` owns which file sits in which stage (SC-001); `Timeline` only draws.
- The server's `fate/agentTime.ts` owns what agent time counts, beside `fate/tokens.ts`. The browser
  owns the clock: elapsed time and a running turn's growth are `now` minus a start the server or the
  history gives.
- `dropItem.ts` owns "confirm, drop, say what stayed", used by the session's "…" and the Home's
  menu. A dropped item's notes go to the store `offers.ts` already keeps for sessions, under a key
  for Home.
- `document/` owns the old-look pages' new shape: `SectionPane` (moved out of `PlanPage.tsx`),
  `entries.ts` (Contents), and `useAskSelection` (select blocks, "Ask the agent").
- `StoryPage` owns a story linked inside a sentence, on a page of its own.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both. The
mockup [`mockups/feature.html`](mockups/feature.html) is the layout reference: open it with the
`?state=` and `?w=` of the spec's links.

## Review focus

1. **Every file shows once** (SC-001): the proposal, each discovery and round, the spec and its
   review, the data model, mockups, the plan and its review, the rulings, and the record each have
   one stage, and a file whose stage the history lacks (a change's round when it has no Questions
   stage) falls to the nearest earlier stage. Task 6.
2. **A pane's id is its heading's anchor**, so links like `discovery-01.md#approaches` and
   `data-model.md#task` still land on the right pane after the pages become panes. Task 2.
3. **A drop the server refuses keeps the page** and shows the refusal under the name until
   dismissed; a drop that happened but whose priorities commit did not (`committed: false`) opens
   Home with the note and the warning, as the session says them today. Task 4.
4. **Old addresses keep working**: `/f/<folder>/storybook?story=<path>#<export>` links, in documents
   and transcripts already written, open the story's page; `/f/<folder>/storybook` and `/storybook`
   open Home. Task 3.
5. **An agent time that cannot be counted is not guessed**: a turn with no end that is not running
   adds nothing, and no turn at all reads "Not recorded". Tasks 1 and 7.
6. **The proposal's start is unknown** (a feature whose first stage has no start): no "elapsed" row,
   rather than a wrong one. Task 7.
7. **Continue with text already in the composer** puts the message before it, unsent. Task 5.

## Global constraints

From the decisions, word for word. Every task's requirements include these.

From [UI look](../decisions/ui-look.md):

- The UI MUST look like a terminal tool: square corners, and content grouped in bordered panes whose
  title sits in their top border. Checked by review.
- Every text colour MUST reach 4.5:1 against its background, and borders and controls 3:1, in every
  scheme. Checked by a test of the theme's tokens.
- Icons SHOULD come from Lucide, and another free set's glyph MAY stand in where it fits a concept
  clearly better. Checked by review.

From [UI layout](../decisions/ui-layout.md):

- A view's spec MUST say why its layout reads best, with mockups at each width class. Checked by
  review.
- The UI MUST adapt to three width classes, narrow, semi-wide, and wide, not to the device, through
  the theme and never per-view media queries. Checked by the browser tests, at each class.
- On narrow screens, views MUST be pages and menus and forms sheets; on wide screens, popovers and
  dialogs. Checked by the browser tests.
- An open detail, tab, or sheet MUST be in the URL, so reload, Back, or a width change keeps it.
  Checked by the UI tests.
- A column that takes room from the main content SHOULD be foldable and resizable. Checked by the
  browser tests.
- A feature's session MAY open beside any of the feature's documents, in the right column, at least
  400 px wide; everywhere else it stays a page of its own. Checked by the browser tests.

From [UI coherence](../decisions/ui-coherence.md):

- A kind of information MUST be drawn by one shared component on every page that shows it. Checked
  by review.
- A page MUST NOT present information its own way, unless the plan names an extremely good reason
  and the human approves it. Checked by review.
- Reading text MUST be drawn through `Prose` (`packages/web/src/Prose.tsx`): its size, line,
  measure, and the markdown that holds prose. A page MUST NOT import Astryx's `Markdown`, or set the
  reading size or measure, itself. Checked by lint and a test, which hold the files that still set
  it by hand to a list that only shrinks.

From [UI behaviour](../decisions/ui-behaviour.md):

- Small edits MUST happen in place, and a dialog MUST only confirm an irreversible action or hold a
  short form. Checked by the UI tests.
- Status MUST show next to what it concerns, and an error MUST stay there until dealt with, never
  only in a toast. Checked by the UI tests.
- A git write MUST show its action at once and never a guessed status, and MUST block other git
  writes until it ends. Checked by the UI tests.
- Back and reload MUST keep the human's place and what they were reading. Checked by the UI tests.
- Every action MUST work by tap and by keyboard, never by hover alone. Checked by the UI and browser
  tests.
- A view of something that grows, such as a session's log, MUST mount a bounded number of rows, and
  folded content MUST NOT be mounted, so typing stays smooth in a session of thousands of items. A
  component that mounts hidden content is wrapped once, in a shared component. Checked by the UI
  tests, which count what draws and never time it.

From [Problems](../decisions/problems.md):

- Home and the sidebar's cards MUST show problems only, and notes MUST show only on their item's
  page. Checked by the UI tests.

From [UI components](../decisions/ui-components.md):

- Views MUST use Astryx components wherever one fits the job, and be styled only through its theme,
  with no global stylesheet or inline styles. Checked by lint.
- A raw element MAY stand in for a missing Astryx component, with a reason, and the plan MUST list
  it as an Astryx gap. Checked by lint and review.

From [UI checks](../decisions/ui-checks.md):

- Every UI test MUST guard something a spec or decision asks for, and MUST change or go with it,
  never loosened to keep passing. Checked by review.
- UI tests MUST drive the UI as a user does, and MUST NOT assert markup, class names, or pixels.
  Checked by review.
- `vp run ready` MUST check every page a UI decision governs at a phone and a desktop size, in both
  themes, for readability and accessibility. Checked by review.
- Before handing over a UI change, the agent MUST review screenshots of every changed view at both
  sizes and in both themes against the decisions, and commit them. Checked by review.

From [Preview](../decisions/preview.md):

- A spec's mockups and named states of views MUST be stories written with the real components, next
  to them. Checked by review and lint.
- Storybook MUST run Uraeda's real server over fixture data, and stories MUST NOT fake its
  responses. Checked by review.
- `vp run ready` MUST build Storybook, so a story that does not compile fails. Checked by the
  `storybook:build` task.

From [Code quality](../decisions/code-quality.md): functions and files stay within the limits the
linters enforce (`vite.config.ts`: `max-lines` 500, `max-lines-per-function` 100, `max-depth` 4,
`max-params` 7), and no new marker is added. A task that touches a unit over a limit starts with a
structural step; none of the files below is over one today.

From [the spec](spec.md), the words the tests pin (copy them exactly):

- Next: "The agent is building" with "Task 5 of 9: Undo restores the previous due date" and the
  button "Open the session"; "The agent writes the plan" with the button "Continue, write the plan";
  a waiting spec is a peach pane reading "You review the spec"; a merged feature reads "Merged" and
  "On Oct 6, in pull request #31."; no agent: "<agent> is not available on this machine" and no
  button.
- Timeline: Questions reads "09:32 · 3 h 10 min · 1 round" and links "Discovery 01" and "Questions
  01"; the current stage is marked; a file waiting on you reads "to review"; a stage not reached
  shows its name only, dimmed.
- Figures: "Produced so far" (live) or "What it produced" (done) reads "agent time 2 h 51 min" and
  "elapsed 6 h 02 min"; no turn recorded reads "Not recorded"; no cost in dollars.
- Drop: "Drop the feature…" asks first; Home then shows "Dropped the feature recurring-tasks: its
  branch 2026-10-06-recurring-tasks stays."; Send reads "Start the agent" after Continue.
- The documents' column holds Contents and Session; on the phone the status line holds "Contents"
  and "Session"; asking quotes "About specs/2026-10-06-recurring-tasks/proposal.md, lines 9–10:".

## Code read

- **Tests**: Vitest through `vp test`; page tests render the whole app over a fixture repository
  with `renderPage(path, repo, { agent: true })` and the helpers in
  [`__tests__/helpers.tsx`](/packages/web/src/__tests__/helpers.tsx) (`fixtureRepo`, `commitsAt`,
  `addPlan`, `fakeAgent`, `atWidth`, `click`, `today` for the core's day). Times are read in UTC
  (`vite.config.ts`). The browser's clock is `Date`: tests that need "now" use fake timers for
  `Date` only. Browser tests are in [`__browser__/`](/packages/web/src/__browser__/); stories in
  `*.stories.tsx`, whose feature pages come from `.storybook/samples/` (`FEATURE_PAGES`). Server
  tests are [`server/src/__tests__/`](/packages/server/src/__tests__/); `recordRun` in
  [`testing.ts`](/packages/server/src/testing.ts) writes a feature's past turn.
- **Validation**: `nix develop -c vp run fast` is the project's fast check, which stops today at
  `specs:check` (three links of `specs/done/2026-10-20-layout-look.md`, a failure already there):
  tasks run `vp check` and their tests instead; `vp check` formats, lints, and type-checks,
  `vp test` runs the tests, `vp run ready` is the complete validation (browser tests and Storybook's
  build included, see [`vite.tasks.ts`](/vite.tasks.ts)).
- [`FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx) (207 lines) draws the old page:
  `Stages` (Astryx stepper, `stageLine` exported and tested), `Blocking`/`LeftBanner`, `NextCard`
  beside `SessionsCard`, `Figures` (285 lines, tiles) and `FileList` (files, plus Links with a
  Storybook row), `Record` (a done feature's record in place, its questions folded under the history
  entry's open keys, `QUESTIONS_KEY`), `Notes`.
- [`next.ts`](/packages/web/src/feature/next.ts): `nextOf(feature, { merged, working })` returns
  `{ action?, line?, title }`; an agent's step has no action today, and `implementation` too.
- [`sessions.ts`](/packages/web/src/sessions.ts) `handOver(folder, trigger, file?)` opens
  `/f/<folder>/session?continue=<trigger>`; [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx)
  reads the message and puts it in the draft before what is typed (`withInserted`), unsent, Send
  reading "Start the agent" ([`ComposerSend.tsx`](/packages/web/src/ComposerSend.tsx)). The
  recommended message's `name` ("Continue, write the plan") and `trigger` come from
  `useRecommendedMessage(folder)` in [`data.ts`](/packages/web/src/data.ts).
- [`SessionActions.tsx`](/packages/web/src/SessionActions.tsx): `useDrop` confirms (`dropQuestion`),
  calls `fate.mutations.feature.drop`, then `markDropped` and `addNote` (see
  [`offers.ts`](/packages/web/src/offers.ts), whose notes are keyed by session). The server's
  [`feature.drop`](/packages/server/src/fate/session-moves.ts) returns
  `{ branch, committed, worktreeLeft }`; `committed: false` means the priorities entry stayed
  uncommitted, the drop itself done. A refused drop is an `error` result.
- Rename of a feature is the shell card's "…":
  [`sidebar/FeatureSettingsDialog.tsx`](/packages/web/src/sidebar/FeatureSettingsDialog.tsx)
  (`useOpenSettings`), which saves the card's label.
- [`spec/SpecColumn.tsx`](/packages/web/src/spec/SpecColumn.tsx) takes `content`, `contents`,
  `extra` (the Session tab), `file`, and a `review` that may be `undefined`: Contents then Session
  on wide screens, the status line's "Contents" and "Session" on the phone.
  [`spec/pageSession.ts`](/packages/web/src/spec/pageSession.ts) `usePageSession(file)` gives the
  Session tab and `ask(quote)`, none without an available agent or for a feature with no branch (so
  none for a done feature). [`reviewQuote.ts`](/packages/web/src/reviewQuote.ts)
  `quoteOfRange(file, text, range)` builds "About <path>, lines A–B:" and the quote.
- [`PlanPage.tsx`](/packages/web/src/PlanPage.tsx) (313 lines) holds `SectionPane` (a `##` section
  as a `Pane` whose id is `sectionId(heading)`) and `planParts(document, undefined)`
  ([`planParts.ts`](/packages/web/src/planParts.ts)) cuts any document at its `##` headings.
  [`Selection.tsx`](/packages/web/src/Selection.tsx) is how `Blocks` takes taps.
  [`spec/DataModelPage.tsx`](/packages/web/src/spec/DataModelPage.tsx) draws entities as panes
  (`DataPart`, ids without a prefix). [`DocumentPage.tsx`](/packages/web/src/DocumentPage.tsx) is
  the old look. [`FilePage.tsx`](/packages/web/src/FilePage.tsx) routes by kind.
- Storybook: [`StorybookPage.tsx`](/packages/web/src/StorybookPage.tsx) (frame and a `?story=`
  redirect into Storybook's own address), `StorybookRow` in `SessionAside.tsx` (381 lines) and
  `ChangeAside.tsx`, `OpenInStorybook` in [`StoryEmbed.tsx`](/packages/web/src/StoryEmbed.tsx) (also
  in its "missing" state), `storybookHref` in [`stories.tsx`](/packages/web/src/stories.tsx), the
  route in `routeTable.ts` and `App.tsx` (`StartsStorybook` stays). `StoryEmbed` already has the
  live window, with Phone and Desktop. Tests naming it: `__tests__/stories.test.tsx` (5-minute
  keep-alive of the page), `__browser__/layout.test.tsx` (the page ready, line 718), and the
  sessions' column tests.
- Server figures: [`fate/tokens.ts`](/packages/server/src/fate/tokens.ts) `featureTokens(turns)`
  over every session's turns; `featureRecord` in
  [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) adds `tokens`; the web's `FeatureView`
  in [`views.ts`](/packages/web/src/views.ts) selects `tokens`. A turn row has `startedAt`,
  `endedAt`, and `state` (`queued | running | done | failed | stopped`); stopping a turn sets its
  `endedAt`.
- In flight: the [session and New feature](/specs/2026-10-25-session-new/proposal.md) branch also
  redraws `SessionAside.tsx`; task 3 removes one row from it, a small change to merge.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Complexity tracking

| Addition                                               | Why                                                                                                   | Simpler alternative rejected                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `server/src/fate/agentTime.ts`                         | the rule of what agent time counts, with its own tests; `tokens.ts` sums a different thing            | growing `tokens.ts`: two rules in one file                                          |
| `feature/stageFiles.ts`                                | SC-001's single owner of "which file, which stage", shared by the timeline and its tests              | a switch inside `Timeline`: untestable apart from the page                          |
| `dropItem.ts`                                          | the session's "…" and the Home's menu run one confirm-drop-notes flow (constitution VI)               | copying `useDrop` into the menu: two copies of a destructive rule                   |
| `document/SectionPane.tsx` (moved from `PlanPage.tsx`) | the plan and the documents draw a `##` section the same way (UI coherence)                            | a second pane component for documents                                               |
| `document/useAskSelection.tsx`                         | read-only documents need block selection and one action; `useReview` writes comments to a review file | `useReview` on a proposal: a review file and comment form no document asked for     |
| `feature/FeatureColumn.tsx`                            | stacks Sessions, figures, Links in the shared column, and in the page's flow on the phone             | three panes placed by `FeaturePage`: the page would own the column's width and fold |
| A `Home` key in `offers.ts`' notes                     | the dropped note must outlive the page that dropped it                                                | a new store: the same code with another name                                        |

No constitution exception. No file touched is over a limit, and none becomes one: `Figures.tsx` (285
lines) is replaced by rows in `ProducedPane.tsx` and `figureRows.ts`, each far below 500.

## Review comments

Not applicable: the spec was approved without comments.

## Test map

Page tests render the whole app (`renderPage`) over a fixture repository with a fake agent, widths
by `atWidth`; pure rules (`agentTime`, `stageFiles`, `nextOf`, `figureRows`) have focused tests; the
clock is the browser's `Date` under fake timers; the browser tests run real layouts at 1440, 1205,
and 390 px.

| Scenario or criterion                                                  | Task | Test                                                                                      |
| ---------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| US1.1 Next for a build, "Open the session"                             | 5    | `a build says the agent is building, with its task and Open the session`                  |
| US1.2 timeline line and links of Questions, Build current with tasks   | 6    | `Questions shows its time, its round, and links its files`; `Build is current with tasks` |
| US1.3 waiting spec: peach Next, "to review"                            | 5, 6 | `a waiting spec is a peach Next`; `a file waiting on you reads to review`                 |
| US1 more 1 phone order                                                 | 8    | browser: `the Home at 390 px stacks Next, timeline, Sessions, Produced, Links`            |
| US1 more 2 `]` folds the column                                        | 7    | `] folds the Home's column and the width is the documents'`                               |
| US1 more 3 change stages, Rulings under Fix                            | 6    | `a change's stages are Proposal, Questions, Fix, Pull request, Merged; Rulings in Fix`    |
| US2.1 idle: "The agent writes the plan" and its button                 | 5    | `an idle agent offers the recommended message as Continue`                                |
| US2.2 Continue opens the session, unsent                               | 5    | `Continue opens the session with the message unsent, Send reads Start the agent`          |
| US2.3 Drop confirmed, Home note                                        | 4    | `Drop the feature… asks first, then Home says what stayed`                                |
| US2 more 1 working: "Open the session"                                 | 5    | same test as US1.1                                                                        |
| US2 more 2 Rename                                                      | 4    | `Rename changes the card's name and keeps the page's title`                               |
| US2 more 3 cancel                                                      | 4    | `cancelling the drop changes nothing`                                                     |
| US3.1 agent time and elapsed                                           | 1, 7 | `agentTime sums ended turns` (server); `Produced so far reads agent time and elapsed`     |
| US3.2 merged: Next, Merged links Record, record parts                  | 5, 8 | `a merged feature reads Merged and links its pull request`; `Merged links the record`     |
| US3.3 "What it produced" of a done feature                             | 7    | `a done feature's figures lead to the record's questions and decisions`                   |
| US3 more 1 running turn                                                | 1, 7 | `a running turn counts to now`; `agent time grows while a turn runs`                      |
| US3 more 2 no turn: "Not recorded"                                     | 1, 7 | `no turn is null`; `agent time reads Not recorded`                                        |
| US4.1 proposal panes, Edit, Contents and Session                       | 2    | `the proposal is panes, with Edit and the documents' column`                              |
| US4.2 Ask the agent quotes lines                                       | 2    | `asking about a paragraph opens Session with the quote`                                   |
| US4.3 phone status line                                                | 2    | `on the phone the status line holds Contents and Session`                                 |
| US4 more 1 data model keeps its panes, gains the column                | 2    | `the data model keeps its panes beside the column`                                        |
| US4 more 2 record file: Contents only                                  | 2    | `a done feature's record file has Contents and no Session`                                |
| US5.1 no Storybook link on feature page, session column, change column | 3, 8 | `no page links Storybook` (session, change); the Home's in task 8                         |
| US5.2 inline story link opens a page                                   | 3    | `a story linked in a sentence opens on a page of its own`                                 |
| US5.3 old address redirects                                            | 3    | `the Storybook address opens Home`                                                        |
| US5 more 1 missing story, no "Open in Storybook"                       | 3    | `a story that is gone reads as such, without Open in Storybook`                           |
| US5 more 2 Storybook still starts                                      | 3    | the existing `a story on screen is asked for again every 5 minutes` stays                 |
| Edge: Continue with typed text                                         | 5    | `Continue puts the message before typed text`                                             |
| Edge: Drop fails                                                       | 4    | `a refused drop keeps the page and shows why until dismissed`                             |
| Edge: step changes while open                                          | 5    | `Next follows the live update`                                                            |
| Edge: agent unavailable                                                | 5    | `without the agent, Next says so and has no button`                                       |
| Edge: blocked feature                                                  | 8    | `a blocked feature says it cannot go on before Next`                                      |
| Edge: done feature not traced                                          | 8    | `a done feature whose commits were not traced shows Merged alone`                         |
| Edge: worktree or branch left                                          | 8    | `a merged feature still says to run ura clean`                                            |
| Edge: a turn left without an end                                       | 1    | `a failed turn with no end adds nothing`                                                  |
| Edge: a document without `##`                                          | 2    | `a document without sections is one pane titled by its file`                              |
| SC-001 one place                                                       | 6    | `Review focus: every file of the folder shows once`                                       |
| SC-002 one click, one Send                                             | 5    | covered by US2.2                                                                          |
| SC-003 contrast                                                        | 9    | the theme-token test already covers the panes' colours; screenshots in both themes        |
| SC-004 three widths                                                    | 9    | browser: `the Home and the document pages scroll only vertically`, at 1440, 1205, 390     |
| SC-005 no Storybook                                                    | 3, 8 | `no page links Storybook`                                                                 |
| Review focus: pane ids are anchors                                     | 2    | `a link to discovery-01.md#approaches lands on its pane`                                  |
| Review focus: old story addresses                                      | 3    | US5.2 and US5.3 tests                                                                     |
| Review focus: drop `committed: false`                                  | 4    | `a drop whose priorities were not committed opens Home with the warning`                  |
| Review focus: no proposal start                                        | 7    | `no elapsed row without the proposal's start`                                             |

## Waves

1. Tasks 1, 2, 3, 4: they touch disjoint files. Task 1 the server and `views.ts`; task 2 the
   document pages and `PlanPage.tsx`; task 3 the Storybook page, routes, and the asides; task 4 the
   drop flow, `offers.ts`, `Home.tsx`, and the head of `FeaturePage.tsx`.
2. Task 5 (Next): `FeaturePage.tsx`, `next.ts`.
3. Task 6 (timeline): `FeaturePage.tsx`, `Stages.tsx`, `FileList.tsx`.
4. Task 7 (column): `FeaturePage.tsx`, `Figures.tsx`, `SessionsCard.tsx`.
5. Task 8 (assembly, record, banners, Storybook's last link, old tests).
6. Task 9 (stories, widths and themes, screenshots).

Tasks 5 to 9 all change `FeaturePage.tsx`, each on the one before.

---

## Task 1: Agent time, from the feature's turns

**Risky:** a figure on every feature's Home is read as true: the rule decides what is counted.

**Files:**

- Create: `packages/server/src/fate/agentTime.ts`
- Modify: `packages/server/src/fate/sessions.ts` (`featureRecord`), the feature's view and data view
  in `packages/server/src/fate/views.ts` (where `tokens` is declared), `packages/web/src/views.ts`
  (`FeatureView`)
- Test: `packages/server/src/__tests__/agent-time.test.ts`, and a case in
  `packages/server/src/__tests__/fate.test.ts`

**Interfaces:**

- Consumes: `TurnRow` from `runner/cache.ts`.
- Produces: `agentTime(turns: ReadonlyArray<TurnRow>): FeatureAgent | null` with
  `type FeatureAgent = { seconds: number; runningSince: string | null }`; the feature view gains
  `agent: FeatureAgent | null`, selected by `FeatureView` as
  `agent: { seconds: true, runningSince: true }`. `seconds` sums, over turns with both `startedAt`
  and `endedAt`, the seconds between them. `runningSince` is the `startedAt` of a turn in state
  `running` with no `endedAt`, else `null`. Any other turn without an end (queued, or failed or
  killed with no end) adds nothing. `null` when no turn has a `startedAt`. The browser adds
  `now − runningSince`, so the figure grows while a turn runs.

- [x] **Step 1: Write the failing tests**

```ts
// packages/server/src/__tests__/agent-time.test.ts
const turn = (over: Partial<TurnRow>): TurnRow => ({ ...BASE, ...over });

test("ended turns add up: 52 min and 1 h 59 min are 2 h 51 min", () => {
  const turns = [
    turn({ startedAt: "2026-10-06T09:14:00Z", endedAt: "2026-10-06T10:06:00Z", state: "done" }),
    turn({ startedAt: "2026-10-06T13:15:00Z", endedAt: "2026-10-06T15:14:00Z", state: "done" }),
  ];
  expect(agentTime(turns)).toEqual({ seconds: 10260, runningSince: null });
});

test("a running turn is not summed but named, so the browser counts it to now", () => {
  const running = turn({ startedAt: "2026-10-06T15:10:00Z", endedAt: null, state: "running" });
  expect(agentTime([running])).toEqual({ seconds: 0, runningSince: "2026-10-06T15:10:00Z" });
});

test("a failed turn with no end adds nothing, and does not count as running", () => {
  const crashed = turn({ startedAt: "2026-10-06T15:10:00Z", endedAt: null, state: "failed" });
  expect(agentTime([crashed])).toEqual({ seconds: 0, runningSince: null });
});

test("no turn with a start is null, which the page reads as Not recorded", () => {
  expect(agentTime([turn({ startedAt: null, state: "queued" })])).toBeNull();
  expect(agentTime([])).toBeNull();
});
```

The breaks they catch: summing a running turn's missing end as zero or as now on the server;
counting a crashed turn as running forever; showing "0 min" for a feature with no turn.

In `fate.test.ts`, use `recordRun` twice (52 min, 1 h 59 min) for a fixture feature and expect its
read feature's `agent.seconds` to be `10260`, so the summing runs over the real cache.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/__tests__/agent-time.test.ts`
- Expected: FAIL, `Failed to resolve import "../fate/agentTime.ts"`

- [x] **Step 3: Implement `agentTime`, add it to `featureRecord`, the views, and `FeatureView`**

Compute it from the same `turns` array as `featureTokens`, in `featureRecord`, and expose it next to
`tokens` in both views.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp check` and the task's test files with `nix develop -c vp test <files>`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server packages/web/src/views.ts
git commit -m "feat(feature-page): sum a feature's agent time"
```

---

## Task 2: The document pages in panes, with Contents and Session

**Files:**

- Create: `packages/web/src/document/SectionPane.tsx` (moved from `PlanPage.tsx`: `SectionPane`,
  `HeadingLine`, the `Drawing` type), `packages/web/src/document/entries.ts`,
  `packages/web/src/document/useAskSelection.tsx`
- Modify: `packages/web/src/DocumentPage.tsx` (rewritten),
  `packages/web/src/spec/DataModelPage.tsx`, `packages/web/src/PlanPage.tsx` (imports the moved
  `SectionPane`); `FilePage.tsx` stays as is (R10)
- Test: `packages/web/src/__tests__/document.test.tsx` (updated), `document-ask.test.tsx` (new)

**Interfaces:**

- Consumes: `planParts(document, undefined)`, `sectionId`, `SpecColumn`, `usePageSession(file)`,
  `quoteOfRange(file, text, range)`, `Selectable`/`Selection`.
- Produces:
  - `documentEntries(document: Document): Array<Entry>`: one `Entry` per `##` section, `id` the
    section's pane id, no counts.
  - `useAskSelection(file: File, ask: ((quote: string) => void) | undefined): Selection | undefined`:
    `undefined` without `ask` (no selection, nothing taps). With it, tapping a block selects its
    lines, tapping more extends the selection, and under the last selected block an "Ask the agent"
    button and a "Clear" button show; "Ask the agent" calls
    `ask(quoteOfRange(file, file.current.text, range))` and clears.
  - `DocumentPage({ file })` draws: title (proposal: `Edit` beside it), the blocks before the first
    `##`, each `##` section as a `SectionPane` (id = the heading's anchor), all inside `SpecColumn`
    with `review={undefined}`, `contents={<Contents entries={documentEntries(...)} />}`, `extra` the
    page's Session tab. A document with no `##` section draws its text in one pane titled by the
    file's name. The data model page draws its entity panes as today, inside the same `SpecColumn`,
    its Contents one entry per entity pane.

- [x] **Step 1: Write the failing tests**

In `document.test.tsx` (replacing the old-look assertions, with a ruling for each, R1):

```tsx
test("the proposal is panes, with Edit beside the title and the documents' column", async () => {
  await renderPage(`/f/${RECURRING}/proposal.md`, fixtureRepo(), { agent: true });

  expect(await screen.findByRole("region", { name: "What" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Why" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  const column = within(screen.getByRole("complementary", { name: "The proposal's column" }));
  expect(column.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Contents", "Session"]);
});

test("a link to discovery-01.md#approaches lands on its pane", async () => {
  await renderPage(`/f/${RECURRING}/discovery-01.md#approaches`, fixtureRepo(), { agent: true });

  expect(await screen.findByRole("region", { name: "Approaches" })).toBeTruthy();
  expect(document.getElementById("approaches")?.tagName).toBe("SECTION");
});

test("a document without sections is one pane titled by its file", async () => {
  /* a rulings.md with no ## */
});
test("the data model keeps its panes beside the column", async () => {
  /* panes of its entities + Contents */
});
test("a done feature's record file has Contents and no Session", async () => {
  /* tabs: ["Contents"] */
});
test("on the phone the status line holds Contents and Session", async () => {
  atWidth(402);
  await renderPage(`/f/${RECURRING}/proposal.md`, fixtureRepo(), { agent: true });
  expect(await screen.findByRole("button", { name: "Contents" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Session" })).toBeTruthy();
});
```

In `document-ask.test.tsx`, with the fake agent: select the proposal's paragraph (lines 9–10 of the
fixture's proposal: pick them by their text), click "Ask the agent", expect the Session tab open and
its composer to hold `About specs/2026-10-06-recurring-tasks/proposal.md, lines 9–10:` then the
paragraph quoted (`> …`); a second test: without the agent, tapping a paragraph selects nothing and
no Session tab shows.

The breaks they catch: a pane whose id is not its anchor (links land nowhere); a Session tab for a
feature with no branch; a quote of the wrong lines; Contents duplicating a section.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/web/src/__tests__/document.test.tsx packages/web/src/__tests__/document-ask.test.tsx`
- Expected: FAIL, `Unable to find role="region" and name "What"`

- [x] **Step 3: Move `SectionPane`, then write `entries.ts`, `useAskSelection`, and the pages**

Move first and run the plan page's tests (they pass before and after), then build the rest on it.
The Session tab comes from `usePageSession(file)` called in each document page, as `SpecPage` does
(R10); `ask` goes to `useAskSelection`.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp check` and the task's test files with `nix develop -c vp test <files>`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(feature-page): draw the document pages in panes with Contents and Session"
```

---

## Task 3: Remove the Storybook page

**Risky:** a route a human may have bookmarked, and links already written in documents and
transcripts, change meaning.

**Files:**

- Create: `packages/web/src/StoryPage.tsx` (replaces `StorybookPage.tsx`, deleted)
- Modify: `packages/web/src/App.tsx` (the `storybook` route), `packages/web/src/SessionAside.tsx`
  (`StorybookRow` and its use), `packages/web/src/ChangeAside.tsx`,
  `packages/web/src/StoryEmbed.tsx` (`OpenInStorybook` and both uses)
- Test: `packages/web/src/__tests__/stories.test.tsx`, `__browser__/layout.test.tsx` (line 718), the
  session and change column tests that list "Storybook"; new `__tests__/story-page.test.tsx`

**Interfaces:**

- Produces: the route `{ page: "storybook" }` keeps its path, `/f/<folder>/storybook`, and
  `/storybook` for the main checkout, so addresses already written open. With
  `?story=<path>#<export>` it draws `StoryPage({ folder, story })`: the crumbs, then one
  `StoryEmbed` of that story in the live window with Phone and Desktop (no "Open in Storybook").
  Without `?story=`, it redirects to the feature's page (`/f/<folder>`), or to Home (`/`) for the
  main checkout's. `storybookHref` keeps building the address; its last user outside links,
  `FileList`, goes in task 8. `StartsStorybook` stays.

- [x] **Step 1: Write the failing tests**

```tsx
test("a story linked in a sentence opens on a page of its own, in the live window", async () => {
  await renderPage(`/f/${STORY_FEATURE}/storybook?story=${path}#Open`, repoWithStories, {
    agent: true,
  });

  expect(await screen.findByRole("figure", { name: "Dragging" })).toBeTruthy(); // the live window
  expect(screen.queryByRole("link", { name: "Open in Storybook" })).toBeNull();
});

test("the Storybook address of a feature opens its page", async () => {
  await renderPage(`/f/${RECURRING}/storybook`, fixtureRepo(), { agent: true });

  expect(await screen.findByRole("heading", { name: "Recurring tasks" })).toBeTruthy();
  expect(window.location.pathname).toBe(atRepo(`/f/${RECURRING}`));
});

test("a story that is gone reads as such, without Open in Storybook", async () => {
  /* embed in a spec: the browser test of `story-embed.test.tsx` */
});
test("the main checkout's Storybook address opens Home", async () => {});
test.each(["session", "change"])("the %s's column does not link Storybook", async () => {
  /* no 'Storybook' row */
});
```

Replace the keep-alive test of the page by the same assertion on the story page (a story page asks
again every 5 minutes, as an embed does), and the browser test of the page ready by the story page
ready, in both modes. Each replaced test gets a ruling (R2, R3).
`__browser__/storybook-page.test.tsx` wholly tested the removed page and goes (R11). The breaks they
catch: an inline link that goes nowhere; a bookmark that opens a blank page; a link left in a column
(SC-005).

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/story-page.test.tsx`
- Expected: FAIL, the old page draws Storybook's frame, not the live window

- [x] **Step 3: Replace the page, remove the rows and the link, adjust the route**

`StoryPage` reads nothing of its own: it passes the story to `StoryEmbed` with `label` the export's
name, inside `Page`.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp check` and the task's test files with `nix develop -c vp test <files>`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(feature-page): remove the Storybook page, keep story links"
```

---

## Task 4: The feature's menu: Rename and Drop

**Risky:** Drop is destructive and moves to a page visited often; one confirm-drop flow serves two
pages.

**Files:**

- Create: `packages/web/src/dropItem.ts` (also holds `SessionItem` and `dropQuestion`),
  `packages/web/src/feature/FeatureMenu.tsx`
- Modify: `packages/web/src/SessionActions.tsx` (uses `dropItem`), `packages/web/src/offers.ts` (a
  Home key for notes, `dismissNote`, and `forgetNotes`, which the tests' setup calls),
  `packages/web/src/sidebar/FeatureSettingsDialog.tsx` (opens any feature with a folder, a label,
  and a slug), `packages/web/src/Home.tsx` (draws Home's notes),
  `packages/web/src/feature/FeaturePage.tsx` (the head only: the menu beside the title)
- Test: `packages/web/src/__tests__/feature-menu.test.tsx` (new); `session-actions.test.tsx` passes
  unchanged

**Interfaces:**

- Consumes: `dropQuestion` and `useConfirm` (moved with the flow), `fate.mutations.feature.drop`,
  `useOpenSettings()`.
- Produces:
  - `useDropItem(): (item: SessionItem) => Promise<Dropped>` with
    `type Dropped = { kind: "cancelled" } | { kind: "refused"; message: string } | { kind: "dropped"; notes: Array<MoveNote> }`.
    The notes are today's: "Dropped the <kind> <slug>: its branch <branch> stays.", the worktree
    left, and the priorities warning when `committed === false`.
  - `HOME_NOTES = "home"`, `dismissNote(key: string, index: number)` in `offers.ts`; `Home` shows
    its notes as banners with Dismiss.
  - `FeatureMenu({ item: SessionItem, feature, onRefused })`: a `MoreMenu` named "Feature actions"
    or "Change actions", with "Rename" (opens the shell card's settings dialog for the feature) and
    "Drop the feature…" / "Drop the change…". On `dropped`, notes go to `HOME_NOTES` and the page
    navigates Home; on `refused`, `onRefused(message)` is called and `FeaturePage` shows the message
    under the name until dismissed; `cancelled` does nothing. `SessionActions` runs the same
    `useDropItem`, then `markDropped` and `addNote(session, …)`.
  - `FeaturePage` draws `FeatureMenu` beside the title unless the feature is done.

- [x] **Step 1: Write the failing tests**

```tsx
test("Drop the feature… asks first, then Home says what stayed", async () => {
  await renderPage(`/f/${RECURRING}`, fixtureRepo(), { agent: true });
  await click(await screen.findByRole("button", { name: "Feature actions" }));

  await click(screen.getByRole("menuitem", { name: "Drop the feature…" }));
  await click(await screen.findByRole("button", { name: "Drop the feature" }));

  expect(
    await screen.findByText(`Dropped the feature recurring-tasks: its branch ${RECURRING} stays.`),
  ).toBeTruthy();
  expect(window.location.pathname).toBe(atRepo("/"));
});

test("cancelling the drop changes nothing", async () => {
  /* "Keep the feature": page and branch stay */
});
test("Rename changes the card's name and keeps the page's title", async () => {
  /* Rename → "Repeating tasks" → the sidebar card reads it, the h1 is still "Recurring tasks" */
});
test("a refused drop keeps the page and shows why until dismissed", async () => {
  /* a binding whose dropItem throws: the page stays, the refusal under the name, Dismiss removes it */
});
test("a drop whose priorities were not committed opens Home with the warning", async () => {
  /* a binding whose dropItem returns committed: false: both the note and the UNCOMMITTED warning show on Home */
});
```

The breaks they catch: a drop without its confirmation; the refusal shown only in a toast or lost on
navigation; a dropped item left on a page that no longer has it; two copies of the drop rule.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/feature-menu.test.tsx`
- Expected: FAIL, `Unable to find role="button" and name "Feature actions"`

- [x] **Step 3: Extract `useDropItem` from `SessionActions`, then build the menu and wire it**

Extract first, running `session-actions.test.tsx` before and after (it passes both times), and
commit it as `refactor(feature-page): share the drop flow`. Then the menu, the Home notes, and the
head.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp check` and the task's test files with `nix develop -c vp test <files>`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(feature-page): rename and drop from the feature's page"
```

---

## Task 5: Next, with one action

**Risky:** a button that starts an agent; it must never send by itself.

**Files:**

- Create: `packages/web/src/feature/NextPane.tsx` (replaces `NextCard.tsx`, deleted; `cardStyles`
  moves with `SessionsCard` users to task 7: keep what they use until then)
- Modify: `packages/web/src/feature/next.ts`, `packages/web/src/feature/FeaturePage.tsx`
- Test: `packages/web/src/__tests__/next.test.ts` (new, pure), `__tests__/feature-page.test.tsx`
  (the Next tests rewritten), `__tests__/feature-next.test.tsx` (new)

**Interfaces:**

- Consumes: `useRecommendedMessage(folder)` (`name`, `trigger`, `reason`), `useAgent()`,
  `handOver(folder, trigger, file?)`, `sessionPath(folder)`.
- Produces: `nextOf(feature, { merged, working, recommended, agent })` where
  `recommended: { name: string; trigger: Trigger } | { reason: string } | undefined` and
  `agent: { available: boolean; name: string } | undefined`; `NextAction` is
  `{ kind: "link"; external: boolean; href: string; label: string }` or
  `{ kind: "continue"; label: string; trigger: Trigger }`. **Behaviour change of `nextOf`**: an
  agent's step, `implementation` included, was a line and no button; now, while the agent works
  (`working`), the action is the link "Open the session"; idle with a recommended message, it is
  `continue` labelled with the message's `name`; idle with only a `reason`, the reason is the line
  and the action is "Open the session"; with the agent unavailable there is no action and the line
  is "<agent> is not available on this machine". Human gates and the pull request keep their
  actions. `implementation` while working keeps "The agent is building" and the "Task n of m: title"
  line; idle, the title is `agentNext("implementation")`.
- `NextPane({ next, folder, tone })` draws a pane titled "Next", named region "Next": peach
  (`attention`) for a human gate, active otherwise, its one button a `Button` (link or `handOver`).

- [x] **Step 1: Write the failing tests**

```ts
// __tests__/next.test.ts
test("an idle agent at a step offers the recommended message as its button", () => {
  const next = nextOf(plan, {
    working: false,
    recommended: { name: "Continue, write the plan", trigger: "manual" },
    agent: AVAILABLE,
  });
  expect(next.title).toBe("The agent writes the plan");
  expect(next.action).toEqual({
    kind: "continue",
    label: "Continue, write the plan",
    trigger: "manual",
  });
});
test("a working agent offers Open the session", () => {
  /* link to sessionPath */
});
test("a build with the agent working keeps its task line", () => {
  /* "Task 5 of 9: Undo restores the previous due date" */
});
test("an unavailable agent has no action and says so", () => {
  /* "Claude Code is not available on this machine" */
});
```

```tsx
// __tests__/feature-next.test.tsx
test("Continue opens the session with the message unsent, and Send reads Start the agent", async () => {
  await renderPage(`/f/${RECURRING}`, specApproved(fixtureRepo()), { agent: true });

  await click(await screen.findByRole("button", { name: "Continue, write the plan" }));

  expect(await screen.findByRole("button", { name: "Start the agent" })).toBeTruthy();
  expect(composerText()).toContain("Write the plan");
  expect(fake.sent).toHaveLength(0);
});
test("Continue puts the message before typed text", async () => {
  /* draft 'my note' first, then Continue: message then 'my note' */
});
test("Next follows the live update", async () => {
  /* a turn starts: the button turns into Open the session */
});
test("without the agent, Next says so and has no button", async () => {
  /* renderPage without agent */
});
```

The breaks they catch: a button that sends the message itself; typed text lost or put first; a stale
button after the step moves; a button for an agent that is not installed.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/next.test.ts`
- Expected: FAIL, `expect(next.action).toEqual(…)` received `undefined`

- [x] **Step 3: Implement `nextOf`'s new inputs, `NextPane`, and wire both in `FeaturePage`**

`FeaturePage` reads the recommended message and the agent, and passes them. `NextPane` replaces
`NextCard` where the page drew it, still beside `SessionsCard` until task 7.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp check` and the task's test files with `nix develop -c vp test <files>`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(feature-page): Next offers the step's recommended message"
```

---

## Task 6: The timeline

**Files:**

- Create: `packages/web/src/feature/stageFiles.ts`, `packages/web/src/feature/Timeline.tsx`
  (replaces `Stages.tsx`, deleted; `stageLine` and the stage labels move into `timeline.ts` or stay
  exported from `Timeline.tsx`)
- Modify: `packages/web/src/feature/FeaturePage.tsx` (the timeline replaces the stepper and the
  files list, `FileList.tsx`'s Files part)
- Test: `packages/web/src/__tests__/stage-files.test.ts` (new, pure),
  `__tests__/feature-page.test.tsx` (the stage tests rewritten)

**Interfaces:**

- Consumes: `history.stages`, `history.current`, `history.rounds`, `feature.files`,
  `feature.mockups`, the plan's tasks (`useFile(folder, "plan.md")` items) for Build.
- Produces: `stageOf(file: { kind: string; name: string }, stages: ReadonlyArray<string>): string`
  and `filesByStage(feature, stages): Map<string, Array<TimelineFile>>`, with
  `TimelineFile = { href: string; label: string; status?: string; waiting?: boolean }`. Rules: a
  proposal → `proposal`; discovery and clarifications → `questions`; spec, `spec-review.md`, data
  model, and each mockup → `spec`; plan, `plan-review.md`, and rulings → `plan`, or `fix` in a
  change; the record → `merged`. A file whose stage is not among `stages` goes to the nearest
  earlier stage of the list, else the first. Every file appears once. `stageLine` is unchanged,
  except a stage with one round reads "1 round" (R4: the old rule showed rounds only above one).
- `Timeline({ feature, history })`: an ordered list named "Stages", one item per stage,
  `aria-current="step"` on the current one, each with its name, its line, and its files (a link, its
  status after a middot, "to review" while it waits on you); Build lists its tasks (done ones
  grouped "Tasks 1–4", the current one by number and title, the rest grouped "Tasks 6–9"); a stage
  not reached shows its name only, dimmed.

- [ ] **Step 1: Write the failing tests**

```ts
test("every kind of file goes to one stage", () => {
  const kinds = [
    ["proposal.md", "proposal"],
    ["discovery-01.md", "questions"],
    ["clarifications-01.md", "questions"],
    ["spec.md", "spec"],
    ["spec-review.md", "spec"],
    ["data-model.md", "spec"],
    ["mockups/settings.html", "spec"],
    ["plan.md", "plan"],
    ["plan-review.md", "plan"],
    ["rulings.md", "plan"],
  ];
  /* each maps to its stage over the feature's stages; rulings → "fix" over a change's */
});
test("a file whose stage is absent falls to the nearest earlier one", () => {
  /* change with a round, no questions stage */
});
test("no file is listed twice", () => {
  /* over the fixture feature's whole folder */
});
```

```tsx
test("Questions shows its time, its round, and links its files", async () => {
  /* commitsAt as the old 'a passed stage shows its time' test: Questions reads "09:32 · 3 h 10 min · 1 round",
     links "Discovery 01" and "Questions 01" to their pages */
});
test("Build is current with its tasks", async () => {
  /* addPlan(repo, CLI, ELEVEN): "Tasks 1–6", "7 Session column", "Tasks 8–11" */
});
test("a file waiting on you reads to review", async () => {
  /* Spec's file: "to review" */
});
test("a change's stages are Proposal, Questions, Fix, Pull request, Merged, and Rulings sits in Fix", async () => {});
test("every file of the folder shows once", async () => {
  /* the page's file links = the folder's files, no duplicates (SC-001) */
});
```

The breaks they catch: a file listed twice or nowhere; a round count that reads "0 rounds" or omits
"1 round"; a current stage marked by colour alone; a change's rulings under a Plan stage it lacks.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/stage-files.test.ts`
- Expected: FAIL, `Failed to resolve import "../stageFiles.ts"`

- [ ] **Step 3: Implement `stageFiles.ts` and `Timeline`, wire it, delete `Stages.tsx` and
      `FileList`'s Files**

Draw it as a `Pane` titled "Timeline". `FileList`'s Links part stays until task 7.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp check` and the task's test files with `nix develop -c vp test <files>`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(feature-page): a timeline of stages holding their files"
```

---

## Task 7: The Home's column: sessions, figures, links

**Files:**

- Create: `packages/web/src/feature/FeatureColumn.tsx`, `packages/web/src/feature/ProducedPane.tsx`,
  `packages/web/src/feature/figureRows.ts`, `packages/web/src/feature/LinksPane.tsx`
- Modify: `packages/web/src/feature/SessionsCard.tsx` (a `Pane` titled "Sessions · n", same
  behaviour, renamed `SessionsPane.tsx`), `packages/web/src/feature/FeaturePage.tsx`; delete
  `Figures.tsx` and `FileList.tsx` (its tokens formatter `tokenCount` moves to `figureRows.ts`)
- Test: `packages/web/src/__tests__/figure-rows.test.ts` (new, pure),
  `__tests__/feature-page.test.tsx`, `feature-done.test.tsx`, `feature-sessions.test.tsx` (rewritten
  for the new look)

**Interfaces:**

- Consumes: the feature's `agent` (task 1), `tokens`, `history` (`lines`, `totalSeconds`, `rounds`,
  `questions`, `decisions`, `stages`), `useDocumentColumnWidth()`, `SideColumn`.
- Produces:
  `figureRows({ history, tokens, agent, now, done, change, pullRequest }): Array<FigureRow>` with
  `FigureRow = { label: string; value: string | { added: number; removed: number } | …; caption?: string; href?: string }`
  in the order lines, tokens, agent time, elapsed (live) or total time, lines, tokens, agent time,
  questions, decisions (done). Agent time is `agent.seconds` plus `now − runningSince`, formatted
  with `duration`; `null` is "Not recorded". Elapsed is `now −` the first stage's `started`, or no
  row when it has none (R5); a done feature's total time is `history.totalSeconds`, as today. No
  cost row.
- `FeatureColumn`: Sessions, "Produced so far" or "What it produced", Links (branch, worktree, pull
  request; mockups and Storybook are gone: mockups sit in the timeline), in the column of
  `SideColumn` on wide and semi-wide screens, its width and fold the documents' (`]` folds it to a
  rail); inline after the timeline in one column on the phone. A ticking `useNow` (30 s) re-renders
  the figures while a turn runs.

- [ ] **Step 1: Write the failing tests**

```ts
test("agent time and elapsed read 2 h 51 min and 6 h 02 min", () => {
  const now = Date.parse("2026-10-06T15:14:00Z");
  const rows = figureRows({ ...LIVE, agent: { seconds: 10260, runningSince: null }, now });
  expect(rows.find((r) => r.label === "agent time")?.value).toBe("2 h 51 min");
  expect(rows.find((r) => r.label === "elapsed")?.value).toBe("6 h 02 min"); // started 09:12
});
test("a running turn counts to now", () => {
  /* runningSince 4 min before now: agent time "4 min" */
});
test("no agent is Not recorded", () => {
  /* agent: null → "Not recorded" */
});
test("no start of the proposal means no elapsed row", () => {});
test("a done feature reads total time, questions and decisions leading to the record", () => {});
```

```tsx
test("Produced so far reads agent time and elapsed", async () => {
  /* recordRun ×2 + commitsAt, fake Date */
});
test("agent time grows while a turn runs", async () => {
  /* advance the Date and the tick: "4 min" → "5 min" */
});
test("] folds the Home's column and the width is the documents'", async () => {});
test("a done feature's figures lead to the record's questions and decisions", async () => {});
test("no page of the feature links Storybook", async () => {}); // SC-005, with task 8's
```

`elapsed` grows by the clock, so its test fixes `Date`, and none measures real time. The breaks they
catch: a summed running turn double counted; "0 min" for no data; a wrong hour from time zones; a
column whose width differs from the documents'.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/figure-rows.test.ts`
- Expected: FAIL, `Failed to resolve import "../figureRows.ts"`

- [ ] **Step 3: Implement the rows and the panes, build the column, delete `Figures.tsx` and
      `FileList.tsx`**

Sessions keeps its rows: status, name, start, sub-agents, task bar, Stop, "New session". The in-page
links of the done figures (`#record-questions`, `#record-decisions`) keep the existing jump that
opens the folded questions (`jumpInPage` moves with the rows' view).

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp check` and the task's test files with `nix develop -c vp test <files>`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(feature-page): the Home's column of sessions, figures, and links"
```

---

## Task 8: The Home assembled: head, banners, a done feature's record

**Files:**

- Modify: `packages/web/src/feature/FeaturePage.tsx` (order: head, blocking banner, left banner,
  Next, timeline, record, notes; the column beside or after), `packages/web/src/feature/Record.tsx`
  (each part a `Pane`, ids `record-questions`, `record-decisions`; "Open the record file" goes: the
  record file is Merged's link), `packages/web/src/feature/Notes.tsx` (folded as today, in a pane),
  `packages/web/src/feature/Section.tsx` (deleted if unused)
- Test: `__tests__/feature-page.test.tsx`, `feature-done.test.tsx`, `feature-settings.test.tsx`
  (rewritten for panes), the browser `__browser__/feature.test.tsx`

**Interfaces:**

- Consumes: everything above.
- Produces: the page's final order and the removal of every old-look part (`Stages`, `NextCard`,
  `Figures`, `FileList`, `Section`); `storybookHref`'s last use outside links goes with `FileList`.

- [ ] **Step 1: Write the failing tests**

```tsx
test("a blocked feature says it cannot go on before Next", async () => {
  /* banner first, with its file's button */
});
test("a merged feature reads Merged and links its pull request", async () => {
  /* Next: "Merged", "On Oct 6, in pull request #31.", "Open pull request #31" in a new tab; Merged links Record */
});
test("a done feature whose commits were not traced shows Merged alone", async () => {});
test("a merged feature still says to run ura clean", async () => {
  /* the banner before Next */
});
test("the Home at 390 px stacks Next, the timeline, Sessions, Produced, and Links", async () => {
  /* browser */
});
test("format notes are folded at the bottom", async () => {
  /* kept: moved under the panes */
});
```

The old tests of the stepper, the cards, the tiles, and the files list are replaced, each with its
ruling (R1): they asserted a look the human asked to replace. The breaks they catch: a banner after
Next; a record part that cannot be reached from its figure; a leftover link to Storybook.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/feature-done.test.tsx`
- Expected: FAIL, the old record layout (no "record-questions" pane)

- [ ] **Step 3: Assemble the page, redraw `Record` in panes, delete what no longer has a user**

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp check` and the task's test files with `nix develop -c vp test <files>`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(feature-page): assemble the Home in panes"
```

---

## Task 9: Stories, widths, themes, and screenshots

**Files:**

- Modify: `packages/web/src/feature/FeaturePage.stories.tsx` (the states: building, idle, waiting on
  you, blocked, pull request, done, change, menu open, column folded), `.storybook/samples/` (an
  idle feature with its spec approved, and runs for agent time), the stories of the document pages
  (`DocumentPage` states)
- Create: browser tests in `packages/web/src/__browser__/feature.test.tsx` (extended) for the three
  widths
- Create: the screenshots, in `specs/2026-10-25-feature-page/screenshots/`, the Home and the
  proposal at 1440 and 390 px in Mocha and Latte, reviewed against the decisions

**Interfaces:**

- Consumes: the finished pages.
- Produces: stories with the real components (the plan's stories hold what the spec's HTML mockup
  drew); the SC-003 and SC-004 checks.

- [ ] **Step 1: Write the failing browser tests**

```tsx
test.each([1440, 1205, 390])(
  "the Home and a document page scroll only vertically at %i px",
  async (width) => {
    /* both pages: document.scrollingElement.scrollWidth <= clientWidth; the status line covers no text */
  },
);
```

Plus the readability and accessibility check `vp run ready` already runs for pages a UI decision
governs, extended to the Home and a proposal page, in both themes.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp run browser:desktop`
- Expected: FAIL, no story or sample for the new states yet

- [ ] **Step 3: Write the stories and samples, take the screenshots, review them, fix what they
      show**

- [ ] **Step 4: Run the complete validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-25-feature-page/screenshots
git commit -m "test(feature-page): stories, widths, and screenshots of the Home"
```
