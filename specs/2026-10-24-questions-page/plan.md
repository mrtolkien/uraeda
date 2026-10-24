---
status: auto-approved
spec-revision: 1
---

# Plan: Questions page in the terminal look

**Goal:** the round of questions draws in titled panes with its question always in view, "Check
these" moves before the questions in the page and in the file, and a right column of three tabs,
Outline, Notes, and Session, sits beside the round at one width.

**Architecture:** four owners, as the [spec's architecture](spec.md#architecture) names them. The
**core** owns the format: it reads `## Check these` as the first settled group, a question's
"Example:" paragraph, and the block's verdict, and `ura check` owns the round's section order; the
web never parses. The **session's view** (`SessionView.tsx`) owns how a transcript follows its end,
in the window on the session's page or in a box in the column. The **document's column**
(`layout/DocumentColumn.tsx`, on top of `SideColumn`) owns the tabs, the one width, and its storage,
for the spec page to reuse. The **round's parts** (`RoundParts.tsx`, `QuestionCard.tsx`,
`RoundOutline.tsx`) own the round's look, how a question reads, and the outline. The round page,
`RoundPage.tsx`, puts them together and owns the notes field, which the Notes tab, the phone's
sheet, and the round's end share, and the session's draft, which asking writes to.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both. Its
approval comments, in [spec-review.md](spec-review.md), are carried out as
[Review comments](#review-comments) says.

## Review focus

1. **Back to a round with the Session tab open.** The round comes back to its place, and the
   transcript opens at its end in its box: the history entry's saved window scroll and a `#turn-`
   hash are the page's, never applied to the column's transcript. Task 1.
2. **A round with a `## Check these` but no Behaviour or Under the hood point.** It leaves
   `## Settled without the human` out, `ura check` reports nothing, and the points still take
   comments. Task 2.
3. **A comment on a point of `## Check these` that shares its subject with no other point.** It is
   read as that point's comment, not as a free note, and it draws under the point in the Check these
   pane. Task 2 for the core, Task 6 for the page.
4. **The window crossing 768 px with a comment, the notes, or the composer typed in.** The text
   stays, marked unsaved: the notes field and the session's draft are kept above the column, which
   unmounts on the phone. Task 8.
5. **Asking while the agent runs.** The quote replaces the previous one in the composer, and the
   composer stays as the session's page has it while working: Send waits, nothing is sent. Task 8.
6. **A dragged column width outside 400 to 720 px in the browser's storage**, from a hand edit or an
   older build: it is clamped when read, never drawn narrower than 400 px. Task 4.

## Global constraints

From the decision this spec changes, [UI layout](../decisions/ui-layout.md), word for word:

- "A feature's session MAY open beside any of the feature's documents, in the right column, at least
  400 px wide; everywhere else it stays a page of its own. Checked by the browser tests."
- "The UI MUST adapt to three width classes, narrow, semi-wide, and wide, not to the device, through
  the theme and never per-view media queries."
- "On narrow screens, views MUST be pages and menus and forms sheets; on wide screens, popovers and
  dialogs." "An open detail, tab, or sheet MUST be in the URL, so reload, Back, or a width change
  keeps it." "A column that takes room from the main content SHOULD be foldable and resizable."

From the spec, exactly:

- The column's width: a third of the window, between 400 and 600 px, until dragged; dragged between
  400 and 720 px, kept in the browser, for every round. Its tabs never change its width. At 1440 px
  it is 480 px; at 1205 px it is 402 px and the round 751 px.
- The quotes: "About Q2 of specs/2026-10-20-merge-chats/clarifications-01.md:" then "> Where does a
  new chat work?"; for a settled point, "About the settled point of
  specs/2026-10-20-merge-chats/clarifications-01.md:" then "> The light flow stays." Asking again
  replaces the quote and keeps the typed text.
- The outline's rows: "Verdict and summary", Goal, Today, Scope, Sources, "Check these · N", every
  question with its follow-ups under it, "Behaviour · N", "Under the hood · N", "Notes and submit".
- The block's pane is titled by the block's first line; the verdict's badge reads "As proposed",
  "With changes", or "Not as proposed", before the verdict's sentence.
- "Example" is a teal pane, "Why it matters" a peach pane, "Check these · N" a peach pane after
  Sources, Under the hood folded to "N choices in the code only", Today folded to its title.
- An option: one border, its letter and "★ Recommended" in it; picked: a mauve border twice as
  thick, the letter filled, "picked" beside it. On the phone, each pro, con, and why is a box with
  `+`, `−`, or `★` in its border.
- A follow-up on the phone: no line on its side, a mauve top border under "Q2.A · follows Q2,
  because you picked A".
- The approval comment C2 keeps SC-004 as written: "an option's text inside its border starts at
  most 11 px from the screen's edge", though the mockup does not meet it.

From the active decisions the code touches, word for word:

- [Stack](../decisions/stack.md): "Workflow logic, parsing, validation, and states MUST live in the
  Rust core, and TypeScript MUST reach them only through the binding, never reimplemented." "The web
  UI MUST draw workflow files from the core's document tree, never parsing their markdown."
- [Compatibility](../decisions/compatibility.md): "Before version 1.0, a format change MUST NOT keep
  the old format working: no fallback reading, no migration code." "A feature that changes a format
  MUST update the templates, examples, fixtures, and default-branch files it affects, in the same
  branch."
- [UI look](../decisions/ui-look.md): "The UI MUST look like a terminal tool: square corners, and
  content grouped in bordered panes whose title sits in their top border." "Every text colour MUST
  reach 4.5:1 against its background, and borders and controls 3:1, in every scheme."
- [UI coherence](../decisions/ui-coherence.md): "A kind of information MUST be drawn by one shared
  component on every page that shows it." "A change to how information is drawn MUST be made in its
  shared component, so every page follows." "Reading text MUST be drawn through `Prose`."
- [UI behaviour](../decisions/ui-behaviour.md): "Text MUST save only on an explicit action, and
  unsaved text MUST be marked and never dropped without asking." "Back and reload MUST keep the
  human's place and what they were reading." "Every action MUST work by tap and by keyboard, never
  by hover alone." "folded content MUST NOT be mounted".
- [UI components](../decisions/ui-components.md): views use Astryx components wherever one fits,
  styled only through its theme's tokens; a raw element standing in for a missing one is an Astryx
  gap, listed in [Complexity tracking](#complexity-tracking).
- [UI checks](../decisions/ui-checks.md): "UI tests MUST drive the UI as a user does, and MUST NOT
  assert markup, class names, or pixels." "Before handing over a UI change, the agent MUST review
  screenshots of every changed view at both sizes and in both themes against the decisions, and
  commit them." Widths the spec states in px are measured, as the round's browser tests already do.
- [Code quality](../decisions/code-quality.md): TypeScript files at most 500 lines, functions 100,
  depth 4, parameters 7; Rust functions 100 lines, 7 arguments; no new disable marker.
- [Toolchain](../decisions/toolchain.md): "After every task, fast MUST check formatting, lint,
  types, affected focused tests and boundary checks, and name broader checks deferred to ready." "An
  agent MUST run `vp run ready` before pushing a branch." Run everything inside `nix develop -c`.

Existing guarantees to keep: answers save on a tap, comments and notes on their button or Submit
([`round.test.tsx`](/packages/web/src/__tests__/round.test.tsx)); comments on settled points
([`settled.test.tsx`](/packages/web/src/__tests__/settled.test.tsx)); Back returns to the question
([`useRoundPosition.ts`](/packages/web/src/useRoundPosition.ts)); `n` and `p`; a question holding
stories never splits; an answered round is read-only without navigation; the triage and the
decisions check draw without a session; the session page's following, reading place, and Back
([`session.test.tsx`](/packages/web/src/__browser__/session.test.tsx),
[`session-tail.test.tsx`](/packages/web/src/__browser__/session-tail.test.tsx),
[`reading-place.test.tsx`](/packages/web/src/__browser__/reading-place.test.tsx)).

## Code read

The [discovery's map](discovery-01.md#the-code) holds; read in full for this plan:

- [`round.rs`](/crates/core/src/files/items/round.rs): `settled_groups` reads the `###` groups of
  `## Settled without the human`; `points_of` gives the points that take comments, which
  [`notes.rs`](/crates/core/src/files/clarifications/notes.rs) uses as the subjects of comments;
  `question_blocks` splits a question into context, why, and options. `RoundItems` and its types are
  in [`items.rs`](/crates/core/src/files/items.rs), exported to TypeScript by napi into
  [`index.d.ts`](/packages/binding/index.d.ts).
- [`sections.rs`](/crates/core/src/check/sections.rs): the checks read the embedded template.
  `check_order` orders fixed slots only, so `## Check these` after `## Q1` is missed without a
  change; `check_unknown` reports a `###` not in the template under Context or the settled section;
  `check_settled_groups` names the groups in its message. Tests:
  [`check.rs`](/crates/core/tests/check.rs), [`items.rs`](/crates/core/tests/items.rs).
- The template,
  [`clarifications-01.md`](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md),
  and the round's order in [`writing.md`](/skills/uraeda/references/writing.md) (the list under "A
  round of questions", rules 24–25) and [`discovery.md`](/skills/uraeda/references/discovery.md)
  ("The questions file"); records quote settled groups as
  [`finish.md`](/skills/uraeda/references/finish.md) says.
- Rounds with `### Check these`: the two example rounds, `fixtures/round-mockup/`,
  `fixtures/repo/branches/{2026-10-06-recurring-tasks,2026-10-12-cli-tuis,2026-10-13-plan-review}/`,
  this feature's `clarifications-01.md`, and the round texts of `settled.test.tsx`,
  `triage.test.tsx`, and `__browser__/round.test.tsx`. `benchmarks/runs/` keeps the old format.
- [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx): the page; `RoundNav` beside it on wide
  screens, `RoundIndex` under the block on the phone; `askAbout` leaves for the session's page.
  [`RoundOpening.tsx`](/packages/web/src/RoundOpening.tsx) draws the block with `Blocks`, then the
  context as headings. [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx) and
  [`Question.tsx`](/packages/web/src/Question.tsx) (328 lines): an Astryx `Card`, split from
  `--size-round-split` (840 px), sticky header on the phone only, options as `SelectableCard`.
  [`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx) holds the comment form's state;
  [`SettledGroups.tsx`](/packages/web/src/SettledGroups.tsx) draws the groups in a card, Under the
  hood folded through `useOpenKeys`. [`RoundNotes.tsx`](/packages/web/src/RoundNotes.tsx): the
  notes' field and its save, drawn by `RoundEnd` in
  [`RoundSubmit.tsx`](/packages/web/src/RoundSubmit.tsx).
- [`RoundNav.tsx`](/packages/web/src/RoundNav.tsx) (331 lines): `jumpTo`, `questionAtTop`, the
  index, `n`/`p`, and the phone's count in `TopBarSlot`, which the shell draws in its status line
  ([`StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx)).
- [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) (438 lines): `SessionLog`, `SessionPane`,
  and `FeatureSession`, which reads `?ask=` and `?continue=`. Following:
  [`following.ts`](/packages/web/src/following.ts) finds the nearest scrolling box (`scroller`);
  [`useKeepPlace.ts`](/packages/web/src/useKeepPlace.ts) reads and sets the window, and
  [`Transcript.tsx`](/packages/web/src/Transcript.tsx)'s `settled` scrolls the window to the entry's
  saved position or a `#turn-` hash. The draft is [`useDraft.ts`](/packages/web/src/useDraft.ts);
  quotes are made by `quoted` in [`sessions.ts`](/packages/web/src/sessions.ts).
- [`SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx): Astryx `LayoutPanel` and
  `ResizeHandle`, `useResizable` with `maxSize: 560` fixed, `]` folds it, a sticky panel as tall as
  the window that scrolls on its own. The session page's Progress column uses it
  ([`SessionAside.tsx`](/packages/web/src/SessionAside.tsx)). The shell's column follows the window
  until dragged in [`columnWidth.ts`](/packages/web/src/shell/columnWidth.ts).
- [`Pane.tsx`](/packages/web/src/layout/Pane.tsx): the titled pane, tones `attention` (peach) and
  `problem`. [`Blocks.tsx`](/packages/web/src/Blocks.tsx) `ListNode`: Astryx `List`, `edge="flush"`.
  The theme has Catppuccin's teal, peach, and mauve
  ([`theme.ts`](/packages/web/src/theme/theme.ts)), checked for contrast by
  [`theme-tokens.test.ts`](/packages/web/src/__tests__/theme-tokens.test.ts).
- Tests: UI tests in `packages/web/src/__tests__/` render the app over a copy of `fixtures/repo`
  ([`helpers.tsx`](/packages/web/src/__tests__/helpers.tsx): `renderPage`, `atWidth`, `fakeAgent`);
  browser tests in `src/__browser__/` run in WebKit, per test repository, at
  `atSize("phone" | "semi" | "desktop")`, with `show`, `drawn`, `checkPage`, `checkAccessibility`,
  `colorScheme`, and the fake agent's `startTurn` and `agentEmit`. Commands:
  `nix develop -c vp run fast`; `nix develop -c vp test --project desktop <file>` and
  `--project phone`; `nix develop -c cargo nextest run -p uraeda-core`;
  `nix develop -c vp run ready`. Screenshots: `packages/web/scripts/screenshots.ts`, with a view
  list per feature like [`round-shots.ts`](/packages/web/scripts/round-shots.ts). Stories:
  [`RoundPage.stories.tsx`](/packages/web/src/RoundPage.stories.tsx) over `fixtures/round-mockup/`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Complexity tracking

| New or grown                                                                                                           | Why                                                                                                     | Simpler alternative rejected                                                           |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `RoundVerdict`, `VerdictKind`, `QuestionItem.example` in the core                                                      | the stack decision keeps parsing in the core: the badge and the Example pane need them                  | the web reading "Verdict:" and "Example:" from spans, which the stack decision forbids |
| `SessionView.tsx`, lifted out of `SessionPage.tsx`                                                                     | the session's page and the column draw the same view; `SessionPage.tsx` is at 438 lines                 | a second session view for the column, a copy of how a session follows its end          |
| `layout/DocumentColumn.tsx`                                                                                            | the column's tabs and one width; the spec page reuses it                                                | tabs inside `RoundPage.tsx`, which the spec page would copy                            |
| `Pane`'s `fold`, `example` tone, and `isOpenOnPhone`                                                                   | Today, Under the hood, the Example pane, and the phone's open sides; one shared pane, as coherence asks | a round-only folding pane, a second titled border                                      |
| Round-only parts: the verdict badge, the Example and Why panes, the Check these pane with Ask, the boxed pros and cons | the spec's look for what only a round holds; the coherence decision asks the plan to name them          | today's generic callout and headings, which the human declined in round 01             |
| `RoundParts.tsx`, `QuestionOption.tsx`, `RoundOutline.tsx`, `roundJump.ts`                                             | `Question.tsx` (328) and `RoundNav.tsx` (331) would pass 500 lines; each file owns one part             | growing the two files past the limit                                                   |
| Astryx gap: the option's border with its letter in it, and the phone's pro and con boxes                               | `SelectableCard` has no title in its border, as `Pane` before it                                        | `SelectableCard` with the letter inside, which the human asked to replace              |

## Review comments

- **C1** (decision ui-layout, under "Why"): "Rewrite it as a simple, easy to read decision. History
  doesn't matter here: a decision is CURRENT info." Task 9 rewrites the decision's **Why** as the
  current reasons, without the history of past features. It is edited after the approval, so
  `ura check` warns `decision.unapproved` on it until the human's review of the pull request.
- **C2** (SC-004): "Not the case in the mockup but that's a good rule". SC-004 stays as written, and
  Task 5's browser test measures it; the mockup is not the reference for that measure.

## Test map

UI tests render the app over a copy of `fixtures/repo` in jsdom, with the fake agent; browser tests
run the real app in WebKit at 390 (phone), 1205 (semi), and 1440 px (desktop), in both schemes where
a colour is checked, over a test repository whose round the test writes from the fixtures
`fixtures/round-merge-chats/clarifications-01.md` (merge-chats round 01 in the new format) and
`fixtures/round-layout-look/clarifications-01.md` (layout-look round 01's block, context, Q4, Q5,
and settled points), both added by Task 2. Core tests parse strings and the fixtures; `ura check`
tests run the CLI's check over files.

| Requirement                                           | Task | Test                                                                                                                   |
| ----------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------- |
| US1 key 1 (block pane and badge)                      | 6    | `__tests__/round-parts.test.tsx` "the block is a pane titled by its count, with its badge"                             |
| US1 key 2 (Example, Why it matters)                   | 5    | `__tests__/question-card.test.tsx` "Q4's example and why are panes of their own"                                       |
| US1 key 3 (option letter, boxed points on phone)      | 5    | `__browser__/round-cards.test.tsx` "on the phone, option A's points are boxes at its edge"                             |
| US1 more 1, 2 (context panes, Today folded, `#today`) | 6    | `round-parts.test.tsx` "Today is folded, and a link to it unfolds it"                                                  |
| US1 more 3 (lists' hanging marker)                    | 3    | `__browser__/document-lists.test.tsx` "on the phone, a list's text starts at the paragraphs' edge"                     |
| US1 more 4 (follow-up on the phone)                   | 5    | `round-cards.test.tsx` "a follow-up on the phone has a top border, no side line"                                       |
| US1 more 5 (picked option)                            | 5    | `question-card.test.tsx` "a picked option says so"; browser border width in `round-cards.test.tsx`                     |
| US2 key 1, 2 (sticky header at every width)           | 5    | `round-cards.test.tsx` "Q4's header stays at the top, then leaves with its card", desktop, semi, phone                 |
| US2 key 3, more 1 (outline rows, marked row)          | 7, 8 | `__tests__/round-outline.test.tsx` "the outline lists the whole round"; Task 8 browser "the part at the top is marked" |
| US2 more 2 (`n` to Q2.A)                              | 7    | `round-outline.test.tsx` "n goes to the next blank question, follow-ups included"                                      |
| US2 more 3 (phone outline sheet)                      | 8    | `__tests__/round-column.test.tsx` "on the phone, 1/8 opens the outline in a sheet"                                     |
| US3 key 1 (column 480 px, three tabs)                 | 8    | `__browser__/round-column.test.tsx` "at 1440 px the column is 480 px, Outline open"                                    |
| US3 key 2 (Ask opens Session, nothing moves)          | 8    | `round-column.test.tsx` "asking about Q2 moves no card" (SC-002)                                                       |
| US3 key 3 (phone opens the session's page, Back)      | 8    | `round-column.test.tsx` (UI) "on the phone, asking opens the session's page"                                           |
| US3 more 1 (Ask a settled point)                      | 8    | `round-column.test.tsx` (UI) "asking about a point to check quotes its subject"                                        |
| US3 more 2 (quote replaced, text kept)                | 8    | `round-column.test.tsx` (UI) "asking again replaces the quote and keeps the text"                                      |
| US3 more 3 (reload keeps Session)                     | 8    | `round-column.test.tsx` (UI) "the open tab is in the address"                                                          |
| US3 more 4, 5 (402 px at 1205; dragged 560 kept)      | 4    | `__browser__/document-column.test.tsx` "a third of the window, kept once dragged"                                      |
| US3 more 6 (triage: no Session)                       | 8    | `__tests__/triage.test.tsx` "the triage's column has Outline and Notes only"                                           |
| US4 key 1, more 1 (Check these pane, comment)         | 6    | `round-parts.test.tsx` "Check these comes after Sources, with Ask and its comments"                                    |
| US4 key 2, 3 (`ura check` order, unknown)             | 2    | `crates/core/tests/check.rs` `check_these_before_the_questions`, `check_these_under_settled_is_unknown`                |
| US4 more 2 (no points to check)                       | 6, 7 | `round-parts.test.tsx` and `round-outline.test.tsx` "no Check these without points"                                    |
| US4 more 3 (Under the hood folded)                    | 6    | `round-parts.test.tsx` "Under the hood is folded to its count"                                                         |
| US5 key 1, 2 (Notes tab, same note, Submit saves)     | 8    | `round-column.test.tsx` (UI) "a note from the Notes tab shows at the end, and Submit saves it"                         |
| US5 key 3 (phone notes sheet)                         | 8    | `round-column.test.tsx` (UI) "on the phone, Notes opens a sheet over the same note"                                    |
| Edge: typed text through tab or width changes (High)  | 8    | `round-column.test.tsx` (UI) "typed notes and comments stay through tabs and widths"                                   |
| Edge: quote replaced, typed text kept (High)          | 8    | as US3 more 2                                                                                                          |
| Edge: transcript in the column (High)                 | 1    | `__browser__/column-session.test.tsx` "the column's transcript follows its end, the round stays"                       |
| Edge: agent running when asking                       | 8    | Review focus 5                                                                                                         |
| Edge: agent unavailable, default-branch round         | 8    | `round-column.test.tsx` (UI) "without an agent, no Session tab and no Ask"                                             |
| Edge: answered round                                  | 8    | `round-column.test.tsx` (UI) "an answered round has no column"                                                         |
| Edge: old format on this branch                       | 2    | `ura check specs` in `vp run ready` (`specs:check`)                                                                    |
| Edge: column folded, card splits from 840 px          | 8    | `round-column.test.tsx` (browser) "with the column folded, a wide card splits"                                         |
| Edge: crossing 768 px with Session open               | 8    | `round-column.test.tsx` (UI) "the tab stays in the address on the phone"                                               |
| Edge: question taller than the screen                 | 5    | as US2 key 1                                                                                                           |
| SC-001                                                | 5    | as US2 key 1, at 1440, 1205, and 390 px                                                                                |
| SC-002                                                | 8    | as US3 key 2, with tab switches                                                                                        |
| SC-003                                                | 8    | as US3 key 2, US3 more 1, US3 key 3                                                                                    |
| SC-004                                                | 3, 5 | `document-lists.test.tsx`; `round-cards.test.tsx` "an option's text is at most 11 px from the edge"                    |
| SC-005                                                | 3, 6 | `theme-tokens.test.ts` for the teal pane; `checkAccessibility` on the round in both schemes in `round-column.test.tsx` |
| SC-006                                                | 2    | `crates/core/tests/check.rs` `template_and_examples_pass`, and `specs:check`                                           |
| Review focus 1                                        | 1    | `column-session.test.tsx` "Back to the round keeps its place and the transcript's end"                                 |
| Review focus 2                                        | 2    | `crates/core/tests/check.rs` `check_these_alone`                                                                       |
| Review focus 3                                        | 2, 6 | `crates/core/tests/items.rs` `comment_on_a_point_to_check`; `round-parts.test.tsx`                                     |
| Review focus 4                                        | 8    | as the high edge case on typed text                                                                                    |
| Review focus 5                                        | 8    | `round-column.test.tsx` (UI) "asking while the agent works sends nothing"                                              |
| Review focus 6                                        | 4    | `__tests__/document-column.test.ts` "a stored width is clamped"                                                        |

## Waves

1. Tasks 1, 2, 3: the session's view, the format, and the shared lists and pane. Independent: Task 1
   touches the session's files and `RoundPage.tsx`, Task 2 the core, the skill, the fixtures, and
   the round texts of three test files, Task 3 `Blocks.tsx` and `Pane.tsx`.
2. Tasks 4, 5, 6, 7: the column, the question card, the round's parts, and the outline. Each its own
   files; none edits `RoundPage.tsx`, so the page keeps drawing with today's props until Task 8.
   Shared: each may add its own helpers to `src/__tests__/helpers.tsx`.
3. Task 8: the page together.
4. Task 9: the stories, the screenshots, the decision's **Why**, and the mockup's README.

---

## Task 1: The session's view, scrolling in the round's column

**Risky:** the session's scrolling moves into a box, and the spec marks it unverified: if the
transcript cannot follow its end inside the column, the column shows a link to the session's page
instead, as the spec's edge case says, with a ruling.

**Files:**

- Create: `packages/web/src/SessionView.tsx` (`SessionLog`, `SessionPane`, `useSessionRecord`,
  `Missing`, moved from `SessionPage.tsx`, and the boxed variant), `src/ColumnSession.tsx`
- Modify: `src/SessionPage.tsx` (imports what moved), `src/Transcript.tsx` (`settled`),
  `src/useKeepPlace.ts`, `src/following.ts` (export `scroller`), `src/RoundPage.tsx` (the Session
  column on wide and semi-wide screens, `?tab=session`)
- Test: `src/__browser__/column-session.test.tsx`

**Interfaces:**

- Produces: `ColumnSession({ folder: string; draft: Draft })`: the feature's latest session, or its
  composer alone before the first message creates one; its header, a link "Open the session's page"
  to `sessionPath(folder)`, the transcript scrolling in the nearest scrolling box, and the composer
  at that box's foot. `SessionPane` gains `isBoxed?: boolean`: no `Page`, no crumbs, no aside, and
  the transcript, the reading place, and the jump to the latest act on the box. `Transcript` and
  `keepPlace` act on the box their element is in, the window when there is none; in a box, the
  entry's saved window scroll and a `#turn-` hash are not applied (`windowPlace` in `following.ts`).
  `useKeepPlace` keeps the window's place only, and none for content in a box (R10). `RoundPage`
  draws the session in a `SideColumn` labelled "Session" while the address says `?tab=session`, wide
  and semi-wide only, through `WithSessionColumn` in `ColumnSession.tsx`, marked `TEMPORARY:`
  (`RoundPage` stays under 100 lines): Task 8 replaces it with the column's tab. `SessionView.tsx`
  also exports `NO_BRANCH`, which the page and the column share.

- [x] **Step 1: Move `SessionLog`, `SessionPane`, `useSessionRecord`, and `Missing` to
      `SessionView.tsx`**, unchanged, in a `refactor` commit: the session tests pass before and
      after (`session.test.tsx`, `session-tail.test.tsx`, `reading-place.test.tsx`, both projects).
- [x] **Step 2: Write the failing tests** in `column-session.test.tsx`, desktop and semi:
  - "the column's transcript follows its end, the round stays": on the web-ui round with
    `?tab=session`, start a turn of 80 lines; the last line is in view in the column, and
    `window.scrollY` is still 0; scroll the column up, emit more lines: the column does not move,
    and "Jump to the latest" shows; click it: the last line is in view.
  - "the composer stays at the column's foot": the column's last pixel row is the composer's, never
    the transcript's, and its last row keeps its place within 1 px, at the top and the end of the
    transcript.
  - "Back to the round keeps its place and the transcript's end" (Review focus 1): scroll the round
    to Q3, open the session's page from the column's link, go Back: Q3 is at the top, and the
    column's last line is in view.

  Breaks: following the window instead of the box (the round scrolls); the entry's saved scroll
  applied to the box (the transcript opens mid-way).

- [x] **Step 3: Run them to check they fail**:
      `nix develop -c vp test --project desktop src/__browser__/column-session.test.tsx`. Expected:
      FAIL, no composer in the round's page, so no column "Session".
- [x] **Step 4: Implement** `isBoxed`, `ColumnSession`, and the round page's Session column. The
      session's page keeps the window: its tests do not change. If the box cannot follow its end in
      WebKit, draw the link to the session's page in the column instead, change the tests to it, and
      write the ruling.
- [x] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, and the four session
      browser test files in both projects. Expected: PASS.
- [x] **Step 6: Commit**:
      `git commit -m "feat(questions-page): the session's view scrolls in the round's column"`.

## Task 2: "Check these" before the questions, in the core, the skill, and every round

**Risky:** the round's file format changes for every reader and writer, and `ura check`'s section
order changes for every round.

**Files:**

- Modify: `crates/core/src/files/items.rs` (`RoundItems.verdict`, `QuestionItem.example`,
  `RoundVerdict`, `VerdictKind`), `crates/core/src/files/items/round.rs`,
  `crates/core/src/check/sections.rs`, `packages/binding/index.d.ts` (generated by the binding's
  build)
- Modify: the template
  `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md`;
  `skills/uraeda/references/writing.md` (the round's order, rules 24–25), `discovery.md` (the
  questions file's order), `finish.md` (a record quotes the points to check under
  `#### Check these`); the two example rounds, and any example record quoting them
- Modify: every fixture round with `### Check these`, keeping `fixtures/broken/`'s breakage; this
  feature's `clarifications-01.md`, its words kept
- Create: `fixtures/round-merge-chats/clarifications-01.md`,
  `fixtures/round-layout-look/clarifications-01.md`
- Modify: the round texts of `packages/web/src/__tests__/settled.test.tsx`; `triage.test.tsx` and
  `__browser__/round.test.tsx` read the rewritten fixtures, their texts unchanged
- Test: `crates/core/tests/items.rs`, `crates/core/tests/check.rs`

**Interfaces:**

- Produces, in the binding: `RoundItems.verdict?: RoundVerdict`, with
  `RoundVerdict { kind: VerdictKind; item: number; text: Array<Span> }` and
  `VerdictKind = "as-proposed" | "with-changes" | "not-as-proposed"`: the block's list item starting
  "Verdict: " then "worth building as proposed", "worth building, with changes", or "not as
  proposed"; `text` is the item's spans after that phrase and its following ":" or ",", trimmed.
  `QuestionItem.example?: number`: the first top-level paragraph of the question before its answer
  whose text starts "Example:", left out of `context`. `RoundItems.settledGroups`: the
  `## Check these` section as the group of kind `check`, its `heading` the `##` heading, then
  `### Behaviour` and `### Under the hood`; a `### Check these` makes no group. `settledPoints` and
  `settledComments` include the points of `## Check these`.

- [x] **Step 1: Write the failing tests.** `items.rs`: the merge-chats fixture has a `check` group
      of 2 points first, "The change's proposal" and "The light flow stays.", then 3 and 3; its
      verdict is `with-changes`, its text starting "a chat cannot become a change today";
      clarifications-01.md of this feature reads `as-proposed`; the layout-look fixture's Q4 has an
      `example` whose text starts "Example: you are on a question", not in its `context`;
      `comment_on_a_point_to_check`: "- **The light flow stays.**: Say so in the PR." in the notes
      is a comment on that point, not a free note (Review focus 3). `check.rs`:
      `check_these_before_the_questions` (after `## Q1`: `sections.order`),
      `check_these_under_settled_is_unknown` (`sections.unknown` on `### Check these`),
      `check_these_alone` (no settled section: no problem, Review focus 2), the `settled.group`
      message naming Behaviour and Under the hood only, and the template, the example, and the
      fixtures passing: `the_rounds_template_has_no_problems`, `the_example_has_no_problems`, and
      `every_fixture_round_passes` with the merge-chats fixture added; the layout-look fixture,
      trimmed to Q4 and Q5, reports only its count and numbering
      (`the_trimmed_round_fails_only_its_numbering`, ruling R6). Breaks: a verdict read from the
      second item; an Example paragraph left in the context, drawn twice.
- [x] **Step 2: Run them to check they fail**: `nix develop -c cargo nextest run -p uraeda-core`.
      Expected: FAIL, no field `verdict` on `RoundItems`.
- [x] **Step 3: Implement the core.** `sections.order` reports `## Check these` anywhere but between
      `## Context` and the first question, a level-2 item like `## Q1` ordering the fixed sections
      after it (ruling R7); the template's settled section is optional, so a round with only points
      to check leaves it out; no file of the repository gains a report it did not have. Keep the
      rules in `round.rs` and `sections.rs`; no fallback for the old format.
- [x] **Step 4: Rewrite the template, the references, the examples, the fixtures, the test round
      texts, and this feature's round**, "Check these" before Q1, as the [data model](data-model.md)
      says. The two new fixtures copy their rounds from git history
      (`git show ce2147d3:specs/2026-10-20-merge-chats/clarifications-01.md`;
      `git show 6ed4502b:specs/2026-10-20-layout-look/clarifications-01.md`, trimmed to its block,
      context, Q4, Q5, and settled points), `status: awaiting-human`, no answers.
- [x] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, `ura check` built from
      the branch (`cargo run -q -p uraeda-cli -- check specs`), and the three web test files.
      Expected: PASS, no problem.
- [x] **Step 6: Commit**:
      `git commit -m "feat(questions-page): Check these before the questions, in the format and every round"`.

## Task 3: Lists hang their marker, and the pane folds

**Files:**

- Modify: `packages/web/src/Blocks.tsx` (`ListNode`), `src/layout/Pane.tsx`
- Test: `src/__browser__/document-lists.test.tsx` (create), `src/__tests__/titled-pane.test.tsx`
  (create): `lists.test.tsx` and `pane.test.tsx` already hold the priorities' list and pane (R8).

**Interfaces:**

- Produces: on narrow screens, every document's list draws its first-level text at the paragraphs'
  left edge, its marker hanging in the page's margin, nested lists one character in. `Pane` gains
  `tone: "example"` (teal border and title), `isOpenOnPhone?: boolean` (on narrow screens only the
  titled top border, no side or bottom border nor inset), and
  `fold?: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; folded?: string }`: its title
  is a button with `aria-expanded`; folded, its children are not mounted, and `folded`, when given,
  is a button in its body that opens it. On narrow screens each row draws its own marker, a dash,
  its typed sign, or its number then its sign, on its first line, in a box as wide as the list's
  widest marker, which hangs at most by the page's inset (R9, R11).

- [x] **Step 1: Write the failing tests.** `document-lists.test.tsx`, phone: in a round's block and
      in its context, a first-level item's text starts at the paragraphs' left edge, within 1 px,
      and its marker before it; a nested item's text starts one character right of its parent's.
      Desktop: unchanged. `titled-pane.test.tsx`: a folded pane names its button by its title,
      `aria-expanded` false, and has no content; a click opens it; the `folded` button opens it too.
      Break: hiding the folded content with CSS, which still mounts it.
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test --project phone src/__browser__/document-lists.test.tsx`. Expected:
      FAIL, the text 28.8 px right of the paragraph.
- [x] **Step 3: Implement**, through `useWidthClass`, never a media query in the view. The teal tone
      uses the theme's teal border and text tokens, which `theme-tokens.test.ts` checks.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`,
      `document-lists.test.tsx`, `lists.test.tsx`, and `blocks.test.tsx` in both projects. Expected:
      PASS.
- [x] **Step 5: Commit**:
      `git commit -m "feat(questions-page): lists hang their marker on the phone, and panes fold"`.

## Task 4: The document's column: tabs at one width

**Files:**

- Create: `packages/web/src/layout/DocumentColumn.tsx`, `src/layout/documentColumnWidth.ts`
- Modify: `src/layout/SideColumn.tsx` (`sizes.max`, a `header` in place of its name, and a `width`
  its caller keeps, which follows the window until dragged in `documentColumnWidth.ts`, R12),
  `src/shell/columnWidth.ts` (exports `useWindowWidth`)
- Test: `src/__browser__/document-column.test.tsx`, `src/__tests__/document-column.test.ts`

**Interfaces:**

- Produces: `DocumentColumn({ content: ReactNode; label: string; tabs: ReadonlyArray<ColumnTab> })`
  with
  `ColumnTab = { key: string; label: string; icon: IconName; badge?: ReactNode; panel: ReactNode }`,
  `IconName` Astryx's `Icon`'s name: on wide and semi-wide screens, a column at the window's right
  edge, a labelled `tablist` of its tabs and the open one's `tabpanel`, its width the same whatever
  the tab; `]` folds it; nothing on narrow screens. The open tab is `?tab=<key>` in the address, the
  first tab without it; switching replaces the entry.
  `useColumnTab(keys): [string, (key: string) => void]` reads and sets it, for the page's "Ask" and
  "Edit notes". Width, in `documentColumnWidth.ts`:
  `autoWidth(window) = clamp(round(window / 3), 400, 600)`, a dragged width clamped to 400–720 px,
  kept with the fold under `uraeda.documentColumn` for every document page, read by
  `readDocumentColumn()` and kept by `useDocumentColumnWidth()`. `SideColumn`'s other callers keep
  560 as their most.

- [x] **Step 1: Write the failing tests.** `document-column.test.ts`: `autoWidth(1440)` is 480,
      `autoWidth(1205)` 402, `autoWidth(900)` 400, `autoWidth(2400)` 600; a stored 900 reads as 720
      and a stored 200 as 400 (Review focus 6). `document-column.test.tsx`, over a test page drawing
      three tabs, rendered by the test itself: at 1440 px the column is 480 px; switching tabs keeps
      its width and the content's left and width; at semi 1205 px it is 402 px; dragged to 560 px it
      stays 560 after a reload; the arrows move between tabs; on the phone, no column. Break: a
      width read from the open tab.
- [x] **Step 2: Run them to check they fail**. Expected: FAIL, no module `documentColumnWidth`.
- [x] **Step 3: Implement** on `SideColumn`, its tabs Astryx's `TabList` with `role="tablist"`,
      which fits the column's header: no Astryx gap.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, the two tests, and
      `side-column.test.tsx` in both projects. Expected: PASS.
- [x] **Step 5: Commit**: `git commit -m "feat(questions-page): the document's column of tabs"`.

## Task 5: The question card

**Files:**

- Create: `packages/web/src/QuestionOption.tsx` (the option and its points, out of `Question.tsx`,
  first in a `refactor` commit)
- Modify: `src/QuestionCard.tsx`, `src/Question.tsx`, `src/QuestionCards.tsx`
- Test: `src/__tests__/question-card.test.tsx` (create), `src/__browser__/round-cards.test.tsx`

**Interfaces:**

- Consumes: `QuestionItem.example` (Task 2); `Pane`'s `example` tone and `isOpenOnPhone` (Task 3).
- Produces: `QuestionCard`'s props unchanged. Its header, the id line with "Ask the agent" and the
  title, sticks at the top of the window while its card is on screen, at every width, and leaves
  with its card. The example is a teal `Pane` titled "Example" before the context, the why a peach
  `Pane` titled "Why it matters"; both read through `Prose`, their text without the "Example:" or
  "Why it matters:" lead. An option is one border with its letter and "★ Recommended" in it,
  "picked" beside the letter once picked, picked a mauve border twice as thick and the letter
  filled; its accessible name and checkbox are as today. On narrow screens each pro, con, and why is
  a box with `+`, `−`, or `★` in its border; wider screens keep the signs beside the text. A
  follow-up on the phone has a mauve top border and no side line.

- [x] **Step 1: Move the option to `QuestionOption.tsx`**, unchanged, in a `refactor` commit;
      `round.test.tsx` and `round-cards.test.tsx` pass before and after.
- [x] **Step 2: Write the failing tests.** `question-card.test.tsx`, on the layout-look fixture:
      Q4's "Example" region holds "you are on a question", and its context does not; "Why it
      matters" is a region of its own; picking B shows "picked" in its option.
      `round-cards.test.tsx` at desktop, semi, and phone: scroll to Q4's option C, Q4's title is
      within the window, at its top; scroll until Q5's card reaches the top, Q4's title is gone and
      Q5's at the top (SC-001); phone: option A's first pro box starts within 11 px of the screen's
      edge (SC-004), Q2.A has a border on top and none on its left; a picked option's border is
      twice its neighbour's. Breaks: a header sticky to the page instead of its card; the phone's
      points indented.
- [x] **Step 3: Run them to check they fail**:
      `nix develop -c vp test --project desktop src/__browser__/round-cards.test.tsx`. Expected:
      FAIL, Q4's title above the window.
- [x] **Step 4: Implement.** The split from 840 px stays, and a question with stories still never
      splits.
- [x] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, `round.test.tsx`,
      `question-card.test.tsx`, and `round-cards.test.tsx`, `round.test.tsx` in both browser
      projects. Expected: PASS.
- [x] **Step 6: Commit**: `git commit -m "feat(questions-page): the question card in panes"`.

## Task 6: The round's parts: the block, the context, Check these, and the settled panes

**Files:**

- Create: `packages/web/src/RoundParts.tsx` (the block's pane and its badge, the context's panes,
  the Check these pane)
- Modify: `src/RoundOpening.tsx`, `src/SettledPoints.tsx`, `src/SettledGroups.tsx`, `src/views.ts`
  (selects `verdict`), `src/theme/lucide.ts` and `src/theme/icons.ts` (the panes' icons)
- Test: `src/__tests__/round-parts.test.tsx` (create), `src/__browser__/round-parts.test.tsx`
  (create: on the phone, a pane opened with `isOpenOnPhone` gives its text the screen's width),
  `src/__tests__/settled.test.tsx`; the tests of the old look follow the panes (R15)

**Interfaces:**

- Consumes: `RoundItems.verdict` and the `check` group (Task 2); `Pane`'s `fold` and `isOpenOnPhone`
  (Task 3).
- Produces: the opening draws the crumbs, the title, the block as a `Pane` titled by its first line
  with `id="summary"`, the verdict's badge then its sentence, then the rest of the block's items;
  then Goal, Today, Scope, and Sources as panes with their icons and their headings' anchors as ids,
  Today folded to its title until tapped or linked to by `#today`, open for the page's life; Scope
  and Sources side by side when the round is at least 820 px wide. A triage's free context is one
  pane titled "Context". `SettledPoints` gains `part?: "check" | "end"`: `check` draws the peach
  "Check these · N" pane, `id="check-these"`, with the lead "Settled without you. Object here before
  answering, if one is wrong."; `end` draws "Settled without you" with Behaviour as a pane and Under
  the hood folded to "N choices in the code only", ids `behaviour` and `under-the-hood`; without
  `part`, both, as today. Each point has its comment button, named `Comment on "<subject>"`, and,
  with `onAsk?: (subject: string) => void`, an "Ask" button: `PointActions`, in `RoundParts.tsx`.
  `RoundOpening` gains `check?: ReactNode`, drawn after Sources.

- [x] **Step 1: Write the failing tests.** `round-parts.test.tsx` on the merge-chats fixture: a
      region "7 questions and 1 follow-up, about 20 minutes." holds "With changes" before "a chat
      cannot become a change today"; Goal, Scope, and Sources are regions; Today is a button,
      collapsed, with no paragraph; clicking it shows its text; a link to `#today` opens it; "Check
      these · 2" holds "The change's proposal" and "The light flow stays.", each with "Ask" (when
      `onAsk` is given, tested on `PointActions`, as the page passes none until Task 8) and a
      comment button; a comment in the notes on "The light flow stays." shows under it (Review focus
      3); "Under the hood" shows "3 choices in the code only" and no point until opened; a round
      without points to check has no "Check these". Breaks: the verdict's badge from a guess on the
      text; Today hidden but mounted.
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test src/__tests__/round-parts.test.tsx`. Expected: FAIL, no region "7
      questions and 1 follow-up, about 20 minutes.".
- [x] **Step 3: Implement.** One comment form per `SettledPoints`, restored under its own point; the
      triage and the decisions check keep their look's parts without a session.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, `round-parts.test.tsx`,
      `settled.test.tsx`, `triage.test.tsx`, `decisions-check.test.tsx`. Expected: PASS.
- [x] **Step 5: Commit**:
      `git commit -m "feat(questions-page): the round's block, context, and settled points in panes"`.

## Task 7: The outline

**Files:**

- Create: `packages/web/src/RoundOutline.tsx`, `src/roundJump.ts` (`NavQuestion`, `jumpTo`,
  `questionAtTop`, `questionJumpedTo`, `useQuestionAtTop`, `endJump`, and `afterSheetCloses`, moved
  from `RoundNav.tsx`, which imports them until Task 8 removes it)
- Modify: `src/RoundNav.tsx`, `src/RoundSubmit.tsx`, `src/useRoundPosition.ts`,
  `src/spec/SpecContents.tsx` (import from `roundJump.ts`), `src/routeHistory.ts` (`openAnchor`)
- Test: `src/__tests__/round-outline.test.tsx` (create)

**Interfaces:**

- Consumes: the `check` group (Task 2); the part ids of Task 6, which are a contract: `summary`, the
  context headings' anchors (`goal`, `today`, `scope`, `sources`), `check-these`, each question's
  id, `behaviour`, `under-the-hood`, and `notes`.
- Produces:
  `RoundOutline({ round: RoundItems; document: Document; questions: ReadonlyArray<NavQuestion>; onSubmit: () => void; isActive: boolean })`:
  the count "N of M answered", Next or Submit, a bar, then the rows of the
  [global constraints](#global-constraints), questions with ✓ or ○ and follow-ups under their
  parent, a row for each part the round has (a triage's free context: "Context", id `context`); the
  part at the top marked; a click jumps there, opening Today through the address, `#today`, pushed
  by `openAnchor(anchor: string)` as a link does (R17); `n` and `p` as today while `isActive`.
  `OutlineSheet({ round; document; questions; isOpen: boolean; onClose: () => void })` for the
  phone: the count and the same rows in a sheet, a tap closing it then jumping.

- [x] **Step 1: Write the failing tests.** `round-outline.test.tsx` on the merge-chats fixture: the
      rows read, in order, "Verdict and summary", "Goal", "Today", "Scope", "Sources", "Check these
      · 2", "Q1" to "Q7" with "Q2.A" after "Q2", "Behaviour · 3", "Under the hood · 3", "Notes and
      submit" (US2 key 3); with Q1 and Q2 answered A, `n` from Q1 goes to Q2.A (US2 more 2); no
      "Check these" row without points; a tap on Today sets `#today`; the sheet closes on a tap on
      Q3, then focuses it. The outline is drawn beside the page on the phone until Task 8 (R16); the
      browser test "the part at the top is marked" is Task 8's. Break: follow-ups listed after every
      question.
- [x] **Step 2: Run them to check they fail**. Expected: FAIL, no module `RoundOutline`.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, `round-outline.test.tsx`,
      `round.test.tsx`. Expected: PASS.
- [x] **Step 5: Commit**: `git commit -m "feat(questions-page): the round's outline"`.

## Task 8: The page together: the column, the notes, the session, and asking

**Files:**

- Create: `packages/web/src/RoundColumn.tsx` (`RoundColumn`, `useRoundActions`, `columnKeys`)
- Modify: `packages/web/src/RoundPage.tsx` (`RoundBody` split out first, in a `refactor` commit),
  `src/RoundSubmit.tsx` (`RoundEnd`: the notes read-only, `id="notes"`, with "Edit notes" or "Write
  a note"), `src/RoundNotes.tsx` (`NotesRead`, `NotesSheet`), `src/RoundOutline.tsx`
  (`useBlankJumps`, `useBlankKeys`, `NextOrSubmit`, `RoundIndex`, R20, R21), `src/sessions.ts`
  (`withQuote`), `src/ColumnSession.tsx` (`WithSessionColumn` removed)
- Delete: `src/RoundNav.tsx`
- Test: `src/__tests__/round-column.test.tsx` (create), `src/__browser__/round-column.test.tsx`
  (create), `src/__tests__/triage.test.tsx`, `src/__tests__/round.test.tsx`,
  `src/__browser__/round.test.tsx` (the index column's tests move to the outline),
  `src/__tests__/round-outline.test.tsx` (the page's own outline, R16), `round-parts.test.tsx`
  (Check these before Q1, with Ask); the notes' tests open `?tab=notes` (R22): `notes.test.tsx`,
  `settled.test.tsx`, `writes.test.tsx`; `__browser__/column-session.test.tsx` finds the column by
  its name; the browser tests of the notes (`attach`, `fields`, `layout`) open them, and those of a
  split card (`round.test.tsx`, `round-cards`) fold the column; `blocks.test.tsx` taps Today's pane

**Interfaces:**

- Consumes: `ColumnSession` (Task 1); `DocumentColumn`, `useColumnTab` (Task 4); `QuestionCard`
  (Task 5); `RoundOpening`'s `check`, `SettledPoints`' `part` and `onAsk` (Task 6); `RoundOutline`,
  `OutlineSheet` (Task 7).
- Produces: `withQuote(text: string, quote: string): string` in `sessions.ts`: the quote, an empty
  line, then `text` without the quote it started with, if any. On wide and semi-wide screens, a
  round waiting for answers draws in a `DocumentColumn` with Outline, Notes, and, for a feature
  whose agent is available, Session; "Ask the agent" and "Ask" write the quote into the page's draft
  with `withQuote` and open Session; on narrow screens they open the session's page with `askAbout`.
  The status line on the phone holds "N/M" (the outline's sheet), "Notes" (the notes' sheet), and
  Next or Submit. An answered round draws no column. As built:
  `RoundColumn({ content, draft, file, nav, notes, onSubmit, sheet })` draws the `DocumentColumn`
  labelled "The round's column", its tabs, and the phone's status line and sheets;
  `useRoundActions(file, draft)` gives the asks, the phone's sheet, and "Edit notes", which opens
  the Notes tab or sheet with its field focused. The round's end is a region "Notes" (R22). `n` and
  `p` are the page's, whatever the tab (R21); the phone keeps its list of questions under the block
  (R20).

- [x] **Step 1: Write the failing tests.** UI tests (`round-column.test.tsx`), on the merge-chats
      fixture with the fake agent: asking about Q2 opens Session with the composer holding the
      spec's quote; typing "why would that cost more?" then asking about Q3 leaves Q3's quote and
      that text; asking about "The light flow stays." quotes it as the spec says; a reload keeps
      Session; Notes: typing "Check the spec page too." shows it at the round's end, marked unsaved,
      and Submit saves it with the answers; the phone: "1/8" (Q2 answered A) opens the outline in a
      sheet and a row closes it, "Notes" opens the notes in a sheet, asking opens the session's page
      with the quote; text typed in the notes, a comment, and the composer stays through a tab
      switch and a width change across 768 px (Review focus 4); asking while the agent works sends
      nothing (Review focus 5); no agent: Outline and Notes, no Session, no "Ask"; an answered
      round: no column; at 390 px with `?tab=session` the round shows and the address keeps the tab.
      In `triage.test.tsx`: the triage's column has Outline and Notes only. Browser tests
      (`round-column.test.tsx`): at 1440 px the column is 480 px with Outline open; asking about Q2
      moves no card's left, top, or width, nor does switching tabs (SC-002); folded with `]`, a card
      of 840 px or more splits; `checkAccessibility` and `checkPage` on the round in Mocha and
      Latte, at both sizes (SC-005).
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test src/__tests__/round-column.test.tsx`. Expected: FAIL, no tab
      "Session".
- [x] **Step 3: Implement.** The notes' field and the draft are held by `RoundPage`, above the
      column, so they survive the column unmounting on the phone. Remove Task 1's Session column and
      `RoundNav.tsx`.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, then the round, settled,
      triage, decisions-check, and session tests, UI and both browser projects. Expected: PASS.
- [x] **Step 5: Commit**:
      `git commit -m "feat(questions-page): the round's column of outline, notes, and session"`.

## Task 9: The stories, the screenshots, the decision's Why, and the mockup's README

**Files:**

- Modify: `packages/web/src/RoundPage.stories.tsx` (one export per state: waiting, Session open with
  a quote, Notes open, an answered round, the triage), `src/QuestionCard.stories.tsx`
- Create: the screenshots of the round page, phone and desktop, Latte and Mocha, in
  `specs/2026-10-24-questions-page/screenshots/`, their views in
  `packages/web/scripts/questions-page-shots.ts`
- Modify: `specs/decisions/ui-layout.md` (**Why**, review comment C1),
  `specs/2026-10-24-questions-page/mockups/README.md` (where the stories live)

- [ ] **Step 1: Write the stories**, over the merge-chats and layout-look fixtures.
- [ ] **Step 2: Build them**: `nix develop -c vp run storybook:build`. Expected: PASS.
- [ ] **Step 3: Take and review the screenshots** of the round, waiting, with Session and Notes
      open, and answered, and of the triage, at both sizes and in both schemes, against the UI look,
      layout, and coherence decisions, and commit them.
- [ ] **Step 4: Rewrite the layout decision's Why** as the current reasons for its rules, without
      the history of past features, and keep its rules, alternatives, and consequences as they are.
- [ ] **Step 5: Run the whole validation**: `nix develop -c vp run ready`. Expected: PASS.
- [ ] **Step 6: Commit**:
      `git commit -m "docs(questions-page): the stories, the screenshots, and the layout decision's Why"`.
