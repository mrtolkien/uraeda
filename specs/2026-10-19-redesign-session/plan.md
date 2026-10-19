---
status: auto-approved
spec-revision: 2
---

# Plan: Redesign session

**Goal:** the session page opens on its latest 20 messages, reads flat on a phone, allows every
blocked action of the latest turn in one press, keeps its actions by the composer, and a blocked
chat notifies like a blocked feature.

**Architecture:** the server owns which blocked actions can be allowed together: one function in a
new `runner/allow.ts` picks the denials of the latest turn that are not allowed and have a rule, and
both the session record's count (`allowable`) and the new `allowAll` read it, so the button's number
and the press cannot differ. The agent's process, the adapter, and the turn's stored `allowed` take
a list of rules. `needsYouList` adds chat rows from the same session statuses as a feature's. The
web UI owns the tail: a module of its own walks the turns from the latest, page by page, and draws
only the latest 20 messages; the message look, the composer's height, the actions by the composer,
and the page's inset are changes of existing components. See the
[spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both, and the
[data model](data-model.md).

## Review focus

The spec is silent on these inputs, and each gets a test in the task that owns the code.

1. **A blocked action whose rule holds a line break** (a multi-line Bash command, a file path with a
   newline) has no rule: "Allow all" skips it, it keeps its note, and no stored line holds a
   newline. Task 2.
2. **"Allow all" in a session that works**, or with no covered action, is refused by the server, not
   only disabled in the page. Task 2.
3. **Denials of an earlier turn** are not covered, and stay blocked with their own button. Task 2.
4. **A reopen that fails** with several rules marks no denial allowed and starts no turn. Task 2.
5. **A turn of 250 items** (3 pages) whose latest 20 messages start inside its last page: the cut
   falls inside a page, and a sub-agent's tools whose start was cut still draw as a group of their
   own. Task 4.
6. **A turn with no item yet** (0 pages) at the end of the session draws nothing and does not stop
   the walk. Task 4.
7. **A blocked chat that is allowed and blocked again** notifies again: the row's key changes with
   the latest turn. Task 3.
8. **An archived chat** blocked by auto mode does not notify: the human put it away. Task 3 (a
   [ruling](rulings.md#r1-archived-chats-do-not-notify)).
9. **A keystroke in the composer** redraws no message of the transcript. Task 1.

## Global constraints

From the decisions, word for word. Every task's requirements include these.

From [UI layout](../decisions/ui-layout.md):

- A view's spec MUST say why its layout reads best, and what it shows at both width classes, with
  mockups of both. Checked by review.
- The UI MUST have two width classes, split at the theme's `md` breakpoint, 768 px, which components
  read from the shared hook or theme, never their own media queries. Checked by review.
- Body text MUST be 17 px on narrow screens and 19 px from 1024 px wide, and controls at least 44 px
  tall under a coarse pointer. Checked by the browser tests.
- Reading text MUST stay left-aligned, never justified, and no wider than about 120 characters.
  Checked by the browser tests.

From [UI behaviour](../decisions/ui-behaviour.md):

- Multi-line fields, except the chat composer, MUST share the app's one text area, at a fixed height
  that scrolls rather than grows. Checked by the UI tests.
- Status MUST show next to what it concerns, and errors MUST stay there until dealt with; a toast
  MAY only confirm a result the human cannot see, and MUST NOT be an error's only place. Checked by
  the UI tests.
- Back MUST restore the scroll position and open items, and a reloading page MUST keep its content
  shown. Checked by the UI tests.
- Every action MUST have a tap and a keyboard path; a control shown on hover MUST also show on focus
  and without hover, and shortcuts MUST NOT act in a text field. Checked by the UI and browser
  tests.

From [UI components](../decisions/ui-components.md):

- Views MUST use an Astryx component wherever one fits the job. Checked by lint, which names the
  component to use for a raw button, input, text area, select, or dialog.
- Styles MUST be written with StyleX, in the file of the component that uses them, from the theme's
  tokens and sizes, raw values only for `0`, percentages, `auto`, and keywords. Checked by lint.
- Components MUST NOT take a `style` prop, and only Astryx's stylesheets MAY be imported. Checked by
  lint and review.

From [UI checks](../decisions/ui-checks.md):

- Every UI test MUST guard a spec's scenario, edge case, or success criterion, a change's expected
  behaviour, or a UI decision's rule, and MUST change or go with it, never loosened to keep passing.
  Checked by review.
- UI tests MUST drive the UI as a user does, by roles, labels, and visible text, and MUST NOT assert
  markup, class names, snapshots, or pixel comparisons. Checked by review.
- UI tests MUST be Vitest tests, in happy-dom or WebKit, and Storybook stories MUST NOT run as
  tests. Checked by review.
- `vp run ready` MUST check every page a UI decision governs in WebKit, at a phone and a desktop
  size: no cut text, no sideways scroll, the [UI layout](../decisions/ui-layout.md) measures, and
  WCAG 2.1 A and AA in both themes. Checked by review.
- Before handing over a UI change, the agent MUST screenshot every changed view at both sizes and in
  both themes, review and fix them against the decisions and the mockups or proposal, and commit
  them under the folder's `screenshots/`. Checked by review.

From [preview](../decisions/preview.md):

- Mockups and named states of views MUST be stories in a `<Component>.stories.tsx` file next to the
  component, one export per state or variant, following the
  [UI components](../decisions/ui-components.md) decision. Checked by review and lint.
- Stories MUST NOT run as tests, and Storybook's automatic story tests MUST stay off: UI tests are
  Vitest tests, per the [UI checks](../decisions/ui-checks.md) decision. Checked by review.

From [agents](../decisions/agents.md):

- Every agent MUST be reached through one adapter, in
  [`packages/server/src/runner/`](/packages/server/src/runner/), that keeps its formats inside and
  declares what it can do; the UI MUST offer only that, and `vp run ready`'s tests MUST use a fake
  adapter. Checked by review.
- Sessions MUST pass `--permission-mode auto`, never a mode that skips permissions; a granted
  permission MUST be a narrow `--allowedTools` rule until the process closes, never saved; tools
  MUST NOT touch the agent's credentials, model, effort, attribution, or settings. Checked by the
  runner's tests and review.
- A feature MUST have at most one session, with one live process and one turn at a time, and a
  message sent during a turn MUST be steered into it or queued, as the adapter declares, never start
  a second process. Checked by the runner's tests.
- Stopping MUST use the agent's own interrupt, which keeps the session, then SIGINT and SIGTERM 10
  seconds apart; an idle process MUST close after 15 minutes, never while a background task runs.
  Checked by the runner's tests.

From [stack](../decisions/stack.md):

- The `ura` CLI MUST be Rust needing no runtime, the server TypeScript on Node, and the web UI React
  with Astryx, fed only by the server through fate. Checked by review.

From [Notifications](../decisions/notifications.md), as changed on this branch:

- A notification MUST be shown only when an item or a chat, in any repository, comes to need the
  human, as the server's statuses say, never the web UI's own logic. Checked by the notifier's
  tests.
- A chat MUST count as needing the human only while an action auto mode blocked waits for their
  allowance, never for a finished reply. Checked by the notifier's tests.

From [code quality](../decisions/code-quality.md):

- Rust and TypeScript functions MUST NOT be longer than 100 lines, take more than 7 parameters, or
  nest blocks more than 4 levels deep. Checked by clippy and Oxlint.
- Rust and TypeScript source files MUST NOT be longer than 500 lines, except tests and generated
  files. Checked by Oxlint, and for Rust by a structural test.
- A new marker MUST NOT be added unless a human approves it as a constitution exception in the plan.
  Checked by review.
- Unit tests MUST NOT sleep for a fixed time or assert how long something took, except benchmarks of
  a spec's success criteria. Checked by review.

From [the spec](spec.md), exact values:

- The tail is 20 messages, and "Show earlier messages" adds 20. A message is one of the human's, or
  one text of the agent's. The count shown is kept with the history entry.
- The page's inset is 8 px on a phone, from `Page`'s `isSnug`, already on the branch. The composer's
  field is 3 rows empty on a phone (`--size-composer-input-narrow`, 66 px, already in the theme),
  growing to 9, and 7 rows (154 px) growing to 20 on wide screens.
- The human's bubble fill is the theme's `--color-background-blue` token. The agent's text is flat:
  no bubble, no border, the full width between the insets.
- "Allow all (N)" shows from two covered actions, beside Send in the composer, disabled while the
  session works. "Jump to the latest" is the centred floating button it is today. A chat's button
  reads "Archive" or "Unarchive", in the composer's footer.
- A blocked action allowed together reads, on its banner, "Allowed for the session's process."
- Existing guarantee, from [`allowRule`](/packages/server/src/runner/claude-events.ts): a Bash
  command with a `*` has no rule, and its banner keeps "No allow rule can match only this action."
  Task 2's tests keep it.

## Code read

- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts) (487 lines): `allow` finds the
  denial, refuses one without a rule or while the session works,
  `processes.open(live, { allowed })`, then `turns.begin` with `allowed` and the retry message, then
  marks the denial allowed and calls `changed`. Tests:
  [`runner/__tests__/sessions.test.ts`](/packages/server/src/runner/__tests__/sessions.test.ts)
  (`blockedPush`, `testSessions`), the fate layer's in
  [`__tests__/sessions.test.ts`](/packages/server/src/__tests__/sessions.test.ts).
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts): `open` reopens the process when
  `allowed !== undefined`, and passes it to `adapter.open`.
  [`adapter.ts`](/packages/server/src/runner/adapter.ts) `OpenOptions.allowed?: string`;
  [`claude.ts`](/packages/server/src/runner/claude.ts) `claudeArgs` ends with
  `--allowedTools <rule>`; [`fake.ts`](/packages/server/src/runner/fake.ts) records `opens`.
  `turns.allowed` is a text column, so no migration
  ([`migrations.ts`](/packages/server/src/runner/migrations.ts)).
- [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts): `turnsOf` reads a session's latest
  turn and `blocked`; `sessionRecord` builds the record; `featureStatuses` and
  [`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts) build the global list.
  [`live.ts`](/packages/server/src/live.ts) already republishes `NeedsYouList` on every session
  change that is not a turn's item change, or that carries a state: a turn's end reaches it, so chat
  rows need no new publishing. The web views are in [`views.ts`](/packages/web/src/views.ts), and
  `packages/web/.fate/client.generated.ts` is generated from the server's mutations.
- [`Transcript.tsx`](/packages/web/src/Transcript.tsx) (470 lines): `Transcript` maps every turn to
  `Turn`, which maps `turn.pages` pages to `TurnPage`, each `useTurnLog`.
  [`sessionData.ts`](/packages/web/src/sessionData.ts) has the three hooks.
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) (438): `SessionPane` holds the draft
  (`useDraft`) and passes it to `SessionLog` and `Composer`; `Header` holds Archive.
  [`Composer.tsx`](/packages/web/src/Composer.tsx) (483): `ComposerInput` (7 rows, max 20),
  `sendButtons`, `footerActions`.
- [`routes.tsx`](/packages/web/src/routes.tsx) `updateEntry` and `currentEntry` keep state in the
  history entry; [`keepPlace.ts`](/packages/web/src/keepPlace.ts) `keepPlace(read, change)` and
  `topOf(element)` keep a place across a change drawn above it;
  [`following.ts`](/packages/web/src/following.ts) opens at the end.
- [`SessionMockups.stories.tsx`](/packages/web/src/SessionMockups.stories.tsx), the spec's mockups:
  the human's bubble `xstyle`, the flat agent (`ghost`, `width="100%"`, no padding), the list's
  `--page-bleed` margin, the composer's `maxRows={9}` and narrow minimum height.
- Web tests: happy-dom tests in [`__tests__/`](/packages/web/src/__tests__/) over a real server with
  the fake agent (`fakeAgent`, `renderPage`, `atWidth`, `atRepo` in `helpers.tsx`;
  `session-turns.test.tsx` seeds runs with `cache.addTurn` and `appendItem`); WebKit tests in
  [`__browser__/`](/packages/web/src/__browser__/) (`phone` and `desktop` projects). Commands, in
  `nix develop -c`: `vp test <file>` for a file, `vp check` for the formatter, linter, and types,
  `vp run ts:test` for every test but the browser's, `vp run browser:phone` and
  `vp run browser:desktop` for WebKit, and `vp run ready` for everything.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Complexity tracking

| Addition                                                      | Why it is needed                                                                                                   | Simpler alternative rejected                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `runner/allow.ts`: the covered denials, and allowing them     | `sessions.ts` is at 487 lines, and the covered-denials rule is read by `allow`, `allowAll`, and the session record | Growing `sessions.ts` past 500, or copying the rule into `fate/sessions.ts` |
| `TranscriptMessages.tsx`: the message components, moved out   | `Transcript.tsx` is at 470 lines and the tail adds to it; the look task edits these components                     | Growing `Transcript.tsx` past 500                                           |
| `tail.tsx`: the walk, the window, and "Show earlier messages" | The spec asks for a module of its own: the tail is one rule with one owner                                         | The walk inside `Transcript.tsx`, past its limit                            |
| `ComposerSend.tsx`: `sendButtons` and `footerActions`, moved  | `Composer.tsx` is at 483 lines and gains "Allow all" and Archive                                                   | Growing `Composer.tsx` past 500                                             |

No unit is left over a limit, and no marker is added. No constitution exception.

## Test map

The server's integration tests run the real session manager over the fake adapter and a fixture
repository (`testSessions`), and the fate layer over the same. The web's run the real server with
the fake agent (`fakeAgent`, `renderPage`), at a fixed date, at the widths `atWidth` sets; the
WebKit tests run the page at 390 and 1440 px.

| Spec                                                               | Task | Test                                                                                            |
| ------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------- |
| US1.1 a chat of 120 messages draws the latest 20                   | 4    | `session-tail.test.tsx`: draws 20, ends at the latest, "Show earlier messages" at the top       |
| US1.2 "Show earlier messages" adds 20, keeps the place             | 4    | `session-tail.test.tsx` (40 show), `__browser__/session-tail.test.tsx` (the place)              |
| US1.3 a chat of 15 shows all, no button                            | 4    | `session-tail.test.tsx`                                                                         |
| US1 more 1: `#turn-<id>` older than the tail                       | 4    | `session-tail.test.tsx`: draws from that turn, scrolls to it                                    |
| US1 more 2: Back after two presses shows 60                        | 4    | `session-tail.test.tsx`: navigate away, back, 60 show                                           |
| US1 more 3: a reply growing moves nothing                          | 4    | `session-tail.test.tsx`: the reply's text grows, the count shown is unchanged                   |
| US1 more 4: a feature's session shows the latest 20                | 4    | `session-tail.test.tsx`                                                                         |
| SC-001 opening cost                                                | 4    | `session-tail.test.tsx`: 500 and 20 messages draw the same number of messages                   |
| Review focus 5, 6: page cut, empty turn, sub-agent group           | 4    | `session-tail.test.tsx`                                                                         |
| Typing lag, review focus 9                                         | 1    | `session-cost.test.tsx`: no message redraws on a keystroke                                      |
| US2.1 phone: bubble right, flat agent full width                   | 5, 6 | `__browser__/session-look.test.tsx` at 390 px: the reply spans the page between two 8 px insets |
| US2.2 dark theme tint, WCAG AA                                     | 5    | `__browser__/session-look.test.tsx`: the two senders' fills differ and pass AA, both themes     |
| US2.3 composer 3 rows, grows to 9                                  | 6    | `__browser__/session-look.test.tsx`: 66 px empty, grows, scrolls inside past 9 rows             |
| US2 more 1: 1440 px composer 7 rows, grows to 20                   | 6    | `__browser__/session-look.test.tsx`: 154 px                                                     |
| US2 more 2: a wide code block scrolls inside itself                | 5    | `__browser__/session-look.test.tsx`: the page has no sideways scroll                            |
| SC-003, SC-004, SC-005                                             | 5, 6 | the same WebKit file                                                                            |
| US3.1 two actions allowed with one reopen                          | 2    | `runner/__tests__/sessions.test.ts`: one close, one open with both rules, banners allowed       |
| US3.2 disabled while the session works                             | 6    | `session-allow-all.test.tsx`                                                                    |
| US3.3 the action with no rule stays blocked                        | 2    | `runner/__tests__/sessions.test.ts`                                                             |
| US3 more 1: one action has no "Allow all"                          | 6    | `session-allow-all.test.tsx`                                                                    |
| US3 more 2: a new turn clears "Allow all", old banners keep theirs | 2, 6 | server: `allowable` is 0 after a message; web: the old banner's button stays                    |
| US3 more 3: the rules end with the process                         | 2    | `runner/__tests__/sessions.test.ts`: after 15 minutes idle, the next open has no rules          |
| SC-002 one reopen                                                  | 2    | the US3.1 test counts `adapter.closes` and `opens`                                              |
| Review focus 1, 2, 3, 4                                            | 2    | `runner/__tests__/sessions.test.ts`, `runner/__tests__/claude.test.ts`                          |
| Edge: two actions with the same rule                               | 2    | one rule passed, both denials allowed                                                           |
| Edge: the CLI takes several rules                                  | 2    | `claude.test.ts`: `--allowedTools` and each rule its own argument, last in the arguments        |
| US4.1, US4.2 Archive in the footer, "Unarchive"                    | 6    | `session-allow-all.test.tsx` (renamed in Task 6: `session-actions.test.tsx`)                    |
| US4.3 Jump centred, "Allow all" beside Send                        | 6    | `session-actions.test.tsx`; the WebKit file measures the centre                                 |
| US4 more 1: a feature's session has no Archive                     | 6    | `session-actions.test.tsx`                                                                      |
| Edge: Archive while the session works                              | 6    | `session-actions.test.tsx`                                                                      |
| US5.1 a blocked chat notifies once, opens the chat                 | 3    | `needs-you.test.ts` (the row), `notify.test.tsx` (the click opens `/chats/<id>`)                |
| US5.2 the tab title counts the chat                                | 3    | `needs-you.test.ts` and `notify.test.tsx`                                                       |
| US5.3 allowing drops the count, no second notification             | 3    | `needs-you.test.ts`: the row leaves; `notify.test.tsx`: its key was seen                        |
| US5 more 1: a finished reply does not notify                       | 3    | `needs-you.test.ts`                                                                             |
| SC-006 within 2 seconds                                            | 3    | `needs-you.test.ts`: a chat turn ending blocked publishes `NeedsYouList` (no timing)            |
| Edge: allowed from another tab                                     | 3    | the same test: the list is read again and the row is gone                                       |
| Review focus 7, 8                                                  | 3    | `needs-you.test.ts`                                                                             |

## Waves

1. **Wave 1: Tasks 1 and 2.** Task 1 is the web page's typing, Task 2 the server's runner and
   mutation: no file in common.
2. **Wave 2: Tasks 3 and 4.** Task 3 touches `fate/sessions.ts`, `fate/needs-you.ts`, and the
   notifier's tests; Task 4 touches `Transcript.tsx`, `TranscriptMessages.tsx`, the new `tail.tsx`,
   and `routes.tsx`. Neither consumes the other.
3. **Wave 3: Tasks 5 and 6.** Task 5 touches `TranscriptMessages.tsx` and `theme.ts`; Task 6 touches
   `Composer.tsx`, `ComposerSend.tsx`, `SessionPage.tsx`, `useSessionControls.ts`, and `views.ts`.
   Task 6 consumes Task 2's mutation and field, from wave 1.
4. **Wave 4: Task 7.** The WebKit tests and the screenshots, on everything built.

---

## Task 1: Profile the typing, and cut what it redraws

**Files:**

- Modify: `packages/web/src/SessionPage.tsx` (`SessionLog`, `SessionPane`), only if the profile
  shows the cause
- Test: `packages/web/src/__tests__/session-cost.test.tsx`

**Interfaces:**

- Produces: a transcript that a keystroke in the composer does not redraw.

- [x] **Step 1: Write the profile as a test**

A chat with many agent messages is seeded in the cache (as `session-turns.test.tsx` seeds a run),
the page is rendered, and the test types five characters into the composer's field. It counts the
renders of the agent's messages by mocking Astryx's `Markdown` with a wrapper that counts its calls
(`vi.mock("@astryxdesign/core/Markdown", ...)`), the one component every agent message draws. Never
a duration: the count is the profile.

```ts
test("typing in the composer redraws no message of the transcript", async () => {
  const { user } = await openChatWith(30);
  const before = markdownRenders();

  await user.type(composer(), "hello");

  expect(markdownRenders()).toBe(before);
});
```

The break it catches: the draft's text held by the page, whose every change redraws the transcript.
Also write the one line of the finding in `rulings.md` (a ruling): how many agent messages redrew
per keystroke before the change.

- [x] **Step 2: Run it to check it fails, or to find the cause is not the page**
  - Run: `nix develop -c vp test packages/web/src/__tests__/session-cost.test.tsx`
  - Expected: FAIL, `expected 150 to be 30`, or a count multiple of the messages drawn. **If it
    passes**, the page's redraw is not the cause of the lag: keep the test as the guard, write that
    finding in a ruling, make no change, and go to step 4.

- [ ] **Step 3: Cut the redraw**

The transcript must not depend on the draft's text. `SessionLog` reads `draft` for two setters only
(`storyCommentsInto`, `takeBackInto`): hand it stable callbacks and memoise the transcript's subtree
(`SessionLog`, or `Transcript` and the components under it), so the page's draft state stays where
it is. The composer keeps what is typed while the page changes
([UI behaviour](../decisions/ui-behaviour.md): the feature session's creation path relies on the
draft being held by the page). Moving the field's text into the composer is allowed only if the
memoisation cannot hold, with a ruling saying why and a test that a created session keeps its typed
text.

- [x] **Step 4: Run the project's validation**
  - Run: `nix develop -c vp check` then `nix develop -c vp test packages/web/src/__tests__`
  - Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web/src/__tests__/session-cost.test.tsx packages/web/src/SessionPage.tsx specs/2026-10-19-redesign-session/
git commit -m "perf(redesign-session): a keystroke redraws no message"
```

## Task 2: Allow all the blocked actions of the latest turn

**Risky:** it widens one grant of a permission to several rules at once, changes the argument list
of the agent's process, and a rule shared by the runner, the record, and the page.

**Files:**

- Create: `packages/server/src/runner/allow.ts`
- Modify: `packages/server/src/runner/sessions.ts` (`allow`), `processes.ts` (`open`), `adapter.ts`
  (`OpenOptions`), `claude.ts` (`claudeArgs`), `claude-events.ts` (`allowRule`), `fake.ts`,
  `message.ts` (`retryMessage`), `session-state.ts` (`REFUSALS`), `fate/sessions.ts` (`turnsOf`,
  `sessionRecord`), `fate/views.ts` (`SessionRecord`), `fate/mutations.ts`,
  `packages/web/src/views.ts` (`SessionView`), and the generated
  `packages/web/.fate/client.generated.ts`
- Test: `packages/server/src/runner/__tests__/sessions.test.ts`, `runner/__tests__/claude.test.ts`,
  `runner/__tests__/message.test.ts`, `packages/server/src/__tests__/sessions.test.ts`

**Interfaces:**

- Produces:
  - `OpenOptions.allowed?: ReadonlyArray<string>` (was `string`), and
    `Processes.open(live, { allowed?: ReadonlyArray<string>, fresh? })`: reopens the process when
    `allowed` is given.
  - `claudeArgs`: `--allowedTools` followed by each rule as its own argument, still the last
    arguments. The fake adapter's `opens` records the list.
  - `retryMessage(denials: ReadonlyArray<{ target?: string; tool: string }>)`: one denial reads as
    today, `Try the blocked action again, now allowed: Bash git push origin HEAD`; several read
    `Try the blocked actions again, now allowed:` and one `- <tool> <target>` line each.
  - `runner/allow.ts`:
    `coveredDenials(cache: SessionCache, turn: number): Array<DenialItem & { seq: number; rule: string }>`:
    the turn's denials not yet allowed that have a rule; and `allowDenials(...)`, the one path that
    reopens the process, begins the retry turn, and marks the denials: used by `allow` (a list of
    one) and `allowAll`.
  - `Sessions.allowAll(repo, session): Promise<{ turn: number }>`: covers the latest turn only;
    refuses with `REFUSALS.working` while a turn runs or waits, and with a new refusal,
    `REFUSALS.nothingToAllow` ("No blocked action to allow."), when none is covered.
  - The mutation `session.allowAll`, input `{ session: string }`, returning the `Session`.
  - `SessionRecord.allowable: number`: `coveredDenials(latest turn).length`, 0 without a turn.
  - A turn's stored `allowed`: the rules joined with `\n`, deduplicated in first-seen order.
  - `allowRule` returns `undefined` when its rule contains `\n`.

- [x] **Step 1: Structural: move the allow logic out of `sessions.ts`**

`sessions.ts` is 487 lines and `allow` grows. Move `allow`'s body into `runner/allow.ts`, with
`Sessions.allow` calling it, and change nothing else. Run
`nix develop -c vp test packages/server/src/runner`: it passes before and after. Commit alone:
`refactor(redesign-session): move allowing a blocked action out of sessions.ts`.

- [x] **Step 2: Write the failing tests, and the helpers they use**

Helpers: `blockedTwo()` next to `blockedPush`, in `runner/__tests__/sessions.test.ts`: a feature's
session whose first turn ended with `Bash(rm -rf dist)` and `Edit(src/store/tasks.ts)` blocked.

```ts
test("US3.1: Allow all reopens the process once with both rules and asks for both again", async () => {
  const { adapter, cache, repo, session, sessions, turn } = await blockedTwo();
  adapter.script([]);

  const allowed = await sessions.allowAll(repo, session.id);
  await sessions.settled(allowed.turn);

  expect(adapter.closes).toBe(1);
  expect(adapter.opens).toHaveLength(2);
  expect(adapter.opens[1]?.allowed).toEqual(["Bash(rm -rf dist)", "Edit(src/store/tasks.ts)"]);
  expect(adapter.sent.at(-1)?.text).toBe(
    "Try the blocked actions again, now allowed:\n- Bash rm -rf dist\n- Edit src/store/tasks.ts",
  );
  expect(cache.itemsOf(turn, "denial").every((denial) => denial.allowed)).toBe(true);
  expect(cache.turn(allowed.turn)?.allowed).toBe("Bash(rm -rf dist)\nEdit(src/store/tasks.ts)");
});
```

Also: the action with `*` stays blocked when two others are allowed (US3.3); two denials with the
same rule pass one rule and mark both; a denial of an earlier turn is not covered (review focus 3);
a rule with a line break is skipped, and no stored line holds one (focus 1, in `claude.test.ts`
through `allowRule`, and in the sessions test); `allowAll` while a turn runs, and with nothing
covered, rejects with the refusals (focus 2); a reopen made to fail (the fake adapter's `open`
throws) leaves every denial not allowed and starts no turn (focus 4); the rules end with the process
(US3 more 3, as `US5.3` does); `claudeArgs` puts `--allowedTools`, then each rule as its own
argument, last; in `__tests__/sessions.test.ts`, the Session record's `allowable` is 2 after the
blocked turn, 1 after one `allow` whose retry is blocked on the other action again (an allow begins
a newer turn: see
[R5](rulings.md#r5-the-tests-that-asserted-a-string-now-assert-a-list-and-one-after-one-allow-needs-a-re-block)),
and 0 after a normal message.

The break each catches:

- US3.1: a loop that reopens once per rule (SC-002), or one that marks only the first denial.
- The `*` and line-break tests: allowing a command no narrow rule can match.
- The earlier-turn test: an "Allow all" wider than what the human just saw.
- The failed-reopen test: denials marked allowed before the process opened.
- `allowable`: a button whose number differs from what the press allows.

- [x] **Step 3: Run them to check they fail**
  - Run:
    `nix develop -c vp test packages/server/src/runner packages/server/src/__tests__/sessions.test.ts`
  - Expected: FAIL, `sessions.allowAll is not a function`

- [x] **Step 4: Implement the list and `allowAll`**

`allowDenials` keeps the order of `allow` today: refuse while a turn runs or waits, open the process
(`processes.open`, which throws before anything is marked), begin the retry turn with the stored
`allowed`, then mark each denial allowed and call `changed`. Pass the deduplicated rules.
`allow(turn, seq)` keeps its refusals (`noRule`) and its own turn lookup. `allowAll` looks at the
session's latest turn only. Update the existing tests that assert a string (`opens.at(-1)?.allowed`
in both `sessions.test.ts` files, and the two in `claude.test.ts`) to the list: a change of their
type, not of what they check; write it in a ruling. Regenerate the web client
(`nix develop -c vp run --filter uraeda-web build`) and add `allowable: true` to `SessionView`.

- [x] **Step 5: Run the project's validation**
  - Run: `nix develop -c vp check` then `nix develop -c vp run ts:test`
  - Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/server packages/web/src/views.ts packages/web/.fate specs/2026-10-19-redesign-session/rulings.md specs/2026-10-19-redesign-session/plan.md
git commit -m "feat(redesign-session): allow every blocked action of the latest turn at once"
```

## Task 3: A blocked chat notifies

**Files:**

- Modify: `packages/server/src/fate/needs-you.ts` (`NeedsYouRow`, `rowsOf`), `fate/sessions.ts`
  (export the chat sessions' statuses)
- Test: `packages/server/src/__tests__/needs-you.test.ts`,
  `packages/web/src/__tests__/notify.test.tsx`

**Interfaces:**

- Consumes: `turnsOf`, `statusOf`, and `titleOf` of `fate/sessions.ts`, which `featureStatuses`
  uses.
- Produces: `chatStatuses(ctx: RepoContext)` in `fate/sessions.ts`: each non-archived chat of the
  repository with its `status` and `statusReason`. `NeedsYouRow.folder` becomes optional (a chat has
  none); a chat's row has `id` `<repository>/chats/<session id>`, `href`
  `/r/<repository>/chats/<id>`, `label` its title, `message` "The agent was refused an action",
  `reason` `"blocked"`, and a `key` `<id>:blocked:<latest turn id>`, which changes with the blocked
  turn. `needsYouReason` is unchanged and decides for both.

- [x] **Step 1: Write the failing tests**

```ts
test("a blocked chat is listed, with its title and address, and a finished reply is not", async () => {
  const { chat, rows, sessions } = await twoRepositoriesWithChats();
  await blockChat(sessions, chat, "git push origin HEAD");

  const listed = (await rows()).filter((row) => row.id.includes("/chats/"));

  expect(listed).toHaveLength(1);
  expect(listed[0]).toMatchObject({
    href: `/r/${name}/chats/${chat.id}`,
    label: "Push it",
    message: "The agent was refused an action",
    reason: "blocked",
  });
});
```

Also: a chat whose reply finished is not listed (US5 more 1); allowing the action removes the row,
and a second block of the same chat gives a different `key` (review focus 7); an archived blocked
chat is not listed (focus 8, R1 in `rulings.md`); a chat turn that ends blocked publishes
`NeedsYouList` on the global bus (SC-006 and the another-tab edge case, as `needs-you.test.ts`
already spies `globalLive`: assert the update, never a duration). In `notify.test.tsx`: a chat row
notifies once from a background tab, a click navigates to its `href`, the tab title counts it with a
blocked feature ("(2)"), and once it leaves the list the count drops with no second notification.

The break each catches: chat rows built by the web's own logic; a key that does not change with the
turn, so a second block stays silent; a row for a reply.

- [x] **Step 2: Run them to check they fail**
  - Run:
    `nix develop -c vp test packages/server/src/__tests__/needs-you.test.ts packages/web/src/__tests__/notify.test.tsx`
  - Expected: FAIL, `expected [] to have a length of 1`

- [x] **Step 3: Implement the chat rows**

Chat rows come from the same `turnsOf` and `statusOf` as a feature's, through `chatStatuses`, and
only `statusReason === "blocked"` becomes a row. The notifier's web code reads the list as it is: it
needs no change if the new rows fit its `NeedsYouRow` type (`href`, `id`, `key`, `label`,
`message`).

- [x] **Step 4: Run the project's validation**
  - Run: `nix develop -c vp check` then `nix develop -c vp run ts:test`
  - Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server/src/fate packages/server/src/__tests__/needs-you.test.ts packages/web/src/__tests__/notify.test.tsx specs/2026-10-19-redesign-session/
git commit -m "feat(redesign-session): a chat blocked by auto mode notifies"
```

## Task 4: Draw the latest 20 messages

**Risky:** a rule several callers share (the transcript's drawing, the address's anchor, Back, and
following the end), and the page's scroll.

**Files:**

- Create: `packages/web/src/TranscriptMessages.tsx`, `packages/web/src/tail.tsx`
- Modify: `packages/web/src/Transcript.tsx`, `packages/web/src/routes.tsx` (`Entry`:
  `shown?: number`)
- Test: `packages/web/src/__tests__/session-tail.test.tsx`,
  `packages/web/src/__browser__/session-tail.test.tsx`

**Interfaces:**

- Produces: `Tail` in `tail.tsx`, drawn by `Transcript` in place of its map of turns, with the same
  `Actions`; `TAIL_MESSAGES = 20`. `Transcript`'s props do not change.

- [ ] **Step 1: Structural: move the message components out of `Transcript.tsx`**

Move `Message`, `AgentMessage`, `Denial`, `TranscriptItems`, `sentAt`, and the `Actions` type to
`TranscriptMessages.tsx`, re-exporting `Actions` and `sentAt` from `Transcript.tsx` where other
files import them. Change nothing else. Run `nix develop -c vp test packages/web/src/__tests__`: it
passes before and after. Commit alone:
`refactor(redesign-session): move the transcript's messages out of Transcript.tsx`.

- [ ] **Step 2: Write the failing tests, and the helpers they use**

Helper: `seedMessages(fake, repo, count)`: a chat in the cache with `count` human messages, each
followed by a tool call and an agent text, spread over several turns, written as
`session-turns.test.tsx` writes a run.

```ts
test("a chat of 120 messages draws the latest 20, with the button at the top", async () => {
  const { log } = await openChatWith(120);

  expect(messagesIn(log)).toHaveLength(20);
  expect(lastMessageIn(log)).toHaveText("Reply 60");
  expect(within(log).getAllByRole("button", { name: "Show earlier messages" })).toHaveLength(1);
});
```

Also, in the same file: pressing the button draws 40 and the message that was at the top stays
(US1.2); 15 messages draw all, with no button (US1.3); SC-001, 500 and 20 messages draw the same
number; `#turn-<id>` of a turn 80 messages back draws every message from it to the end and scrolls
to it, with the button above (US1 more 1); two presses, navigate away and Back draw 60 (more 2); the
agent's reply grows (a streaming `text` item) and the count shown is unchanged (more 3); a feature's
session of 50 messages draws 20, and its column is unchanged (more 4); a turn of 250 items whose cut
falls inside its last page, with a sub-agent's tools split by the cut, draws a group of their own
for the tools after it (focus 5); a turn with no item yet at the end does not stop the walk (focus
6). The WebKit file checks the place: the message read before "Show earlier messages" is at the same
screen position after.

The break each catches:

- The count tests: a draw of whole pages (100 items) instead of 20 messages.
- Back: a count kept in the component's state, lost with the page.
- The place: a button that inserts above without keeping the reader's position.
- The address: a tail that never reaches an older turn, so the anchor is missing.

- [ ] **Step 3: Run them to check they fail**
  - Run: `nix develop -c vp test packages/web/src/__tests__/session-tail.test.tsx`
  - Expected: FAIL, `expected 120 to have a length of 20`

- [ ] **Step 4: Implement the tail**

`tail.tsx` owns the window and walks backward from the session's latest turn: each segment is one
page of one turn, read with `useTurn` and `useTurnLog` (the pages the server already serves, one
request after another, as the spec's tradeoffs say). A segment counts the messages of its page
(items of kind `message` or `text`), and while fewer than `shown` messages are in, draws the
previous page (the page before, else the last page of the previous turn) above itself, with the
messages still needed. The segment that reaches the count draws "Show earlier messages" above its
items when anything lies before it, starting its items at the message that completes the count: the
tool calls before that message are left out, and `TranscriptItems` takes the slice with the page's
first message for take-back computed from the whole page. The walk continues past the count while
the address's `#turn-<id>` names an older turn, to that turn's first page. A turn's wrapper with its
`id="turn-<id>"` and workflow divider goes with its first page, its activity and ending lines with
its last. Every segment is its own boundary-free part of one Suspense reveal at open, so the window
appears at once and at its end; the button's press changes `shown` inside `startTransition` so the
drawn page stays while the earlier ones load.

`shown` starts at `TAIL_MESSAGES`, and is kept in the history entry (`updateEntry({ shown })`, read
back from `currentEntry()`), so Back and a reload draw the same count. "Show earlier messages" adds
`TAIL_MESSAGES` and keeps the reader's place with `keepPlace(topOf(button), change)`. The window is
the latest `shown` messages: a new message slides it by one, and a growing reply changes nothing
(R2).

- [ ] **Step 5: Run the project's validation**
  - Run: `nix develop -c vp check`, `nix develop -c vp run ts:test`, and
    `nix develop -c vp run browser:phone` (the place, and the page's other WebKit tests: opening at
    the end, Back's scroll, "Jump to the latest")
  - Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src specs/2026-10-19-redesign-session/
git commit -m "feat(redesign-session): draw the latest 20 messages of a session"
```

## Task 5: The message look

**Start from:** [`SessionMockups.stories.tsx`](/packages/web/src/SessionMockups.stories.tsx),
`Human` and `Agent`.

**Files:**

- Modify: `packages/web/src/TranscriptMessages.tsx` (`Message`, `AgentMessage`),
  `packages/web/src/Transcript.tsx` (the list's inset), `packages/web/src/theme/theme.ts` only if
  the tint needs a theme override
- Test: `packages/web/src/__browser__/session-look.test.tsx`

**Interfaces:**

- Consumes: `TranscriptMessages.tsx` from Task 4.
- Produces: the human's message in a bubble filled with `--color-background-blue`, aligned right;
  the agent's text in a `ghost` bubble with no padding and `width="100%"`, at every width.

- [ ] **Step 1: Write the failing tests**

In `session-look.test.tsx` (WebKit, phone and desktop projects, as `sizes.test.tsx` is): a chat with
one message of the human's and one reply at 390 px: the human's bubble is right-aligned and filled,
and the reply's left edge is at the page's 8 px inset and its right edge 8 px from the window's edge
(SC-003); in light and dark, the two senders' fills differ, and the human's text on its fill passes
WCAG AA (SC-004, using the contrast helper the browser tests already use for AA); a reply with a
code block wider than the screen scrolls inside the block and the page has no sideways scroll (US2
more 2).

The break each catches: the same fill for both senders; a bubble's padding on the agent's text; a
token with no dark value.

- [ ] **Step 2: Run them to check they fail**
  - Run: `nix develop -c vp run browser:phone`
  - Expected: FAIL, the reply is 40 px narrower than the page

- [ ] **Step 3: Implement the look**

Follow the mockup's two components, built on the transcript's real ones: the tint is the human's
bubble `xstyle`, from `colorVars["--color-background-blue"]`, and a pending message keeps its ghost
variant. The agent's `AgentMessage` keeps its width switch for an embedded story. The list takes
back its inset with `--page-bleed` (the mockup's `list`), which Task 6's `Page isSnug` sets.

- [ ] **Step 4: Run the project's validation**
  - Run: `nix develop -c vp check`, `nix develop -c vp run browser:phone`,
    `nix develop -c vp run browser:desktop`
  - Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-19-redesign-session/plan.md
git commit -m "feat(redesign-session): tell the human's messages from the agent's"
```

## Task 6: The actions by the composer, and the phone's composer

**Start from:** [`SessionMockups.stories.tsx`](/packages/web/src/SessionMockups.stories.tsx),
`Session`: its composer, `sendActions`, and footer.

**Files:**

- Create: `packages/web/src/ComposerSend.tsx`
- Modify: `packages/web/src/Composer.tsx` (`ComposerInput`, `Composer`),
  `packages/web/src/SessionPage.tsx` (`Header`, `SessionPane`), `useSessionControls.ts`
- Test: `packages/web/src/__tests__/session-actions.test.tsx`,
  `packages/web/src/__browser__/session-look.test.tsx`

**Interfaces:**

- Consumes: `fate.mutations.session.allowAll` and `Session.allowable` from Task 2.
- Produces: `Composer` props `allow?: { count: number; onAllowAll: () => Promise<void> }` and
  `archive?: { archived: boolean; onArchive: () => Promise<void> }`; `ComposerSend.tsx` holds
  `sendButtons` and `footerActions`, moved from `Composer.tsx`. `useSessionControls` returns
  `allowAll`.

- [ ] **Step 1: Structural: move `sendButtons` and `footerActions` out of `Composer.tsx`**

Move them to `ComposerSend.tsx`, import them back, change nothing else. Run
`nix develop -c vp test packages/web/src/__tests__`: it passes before and after. Commit alone:
`refactor(redesign-session): move the composer's buttons out of Composer.tsx`.

- [ ] **Step 2: Write the failing tests**

In `session-actions.test.tsx`: a chat with two blocked actions shows "Allow all (2)" beside Send,
and pressing it allows both (both banners read "Allowed for the session's process.", and the fake
agent opens once more) (US3.1); while the session works the button is disabled (US3.2); one blocked
action shows no "Allow all", and its "Allow and retry" is the only button (US3 more 1); after a
normal message "Allow all" is gone and the old banners keep their buttons (US3 more 2); an open chat
has "Archive" in the composer's footer and not in the header, whose title still renames in place; an
archived one reads "Unarchive" (US4.1, US4.2); a feature's session has no Archive (US4 more 1);
Archive pressed while the session works archives it (the edge case). In the WebKit
`session-look.test.tsx`: the empty composer's field is 66 px tall at 390 px and 154 px at 1440 px
(SC-005), grows to 9 rows (198 px) when 12 lines are typed at 390 px and scrolls inside, and to 20
at 1440 px (US2.3, US2 more 1); "Jump to the latest" is centred over the composer with "Allow all"
beside Send (US4.3).

The break each catches:

- "Allow all": a button of the web's own count rather than the server's; enabled while the session
  works.
- Archive: a button left in the header.
- The field: one `minHeight` for both width classes.

- [ ] **Step 3: Run them to check they fail**
  - Run: `nix develop -c vp test packages/web/src/__tests__/session-actions.test.tsx`
  - Expected: FAIL, `Unable to find a button with the name "Allow all (2)"`

- [ ] **Step 4: Implement**

`ComposerInput` takes `minHeight` from `--size-composer-input-narrow` on the phone and
`--size-composer-input` on wide screens, and `maxRows` 9 and 20, from the shared width hook. The
send row shows "Allow all (N)" (an Astryx `Button`) when `allow.count >= 2`, disabled while
`working`; the footer holds `archive`'s button beside the paperclip. `Header` loses its Archive
button. `SessionPane` uses `<Page isSnug>` for the session page (a `Page` option already on the
branch). `SessionLog` hands the composer the chat controls through `SessionPane`'s state, or the
page reads the session once and passes both (settle which in the code: the page reads it already).
Add the generated client's change from Task 2 to this commit if it moved.

- [ ] **Step 5: Run the project's validation**
  - Run: `nix develop -c vp check`, `nix develop -c vp run ts:test`,
    `nix develop -c vp run browser:phone`, `nix develop -c vp run browser:desktop`
  - Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src specs/2026-10-19-redesign-session/plan.md
git commit -m "feat(redesign-session): keep the session's actions by the composer"
```

## Task 7: Screenshots, and the whole check

**Files:**

- Create: `specs/2026-10-19-redesign-session/screenshots/` (`session-reading`, `session-blocking`,
  `session-scrolled`, each `<view>-<phone|desktop>-<light|dark>.webp`)
- Modify: `packages/web/scripts/session-shots.ts` (a new shot file) and
  `packages/web/scripts/screenshots.ts`

**Interfaces:**

- Consumes: every earlier task.

- [ ] **Step 1: Take the screenshots**

Add the session's views to the screenshot script, as its other shot files do, and run
`nix develop -c vp run --filter uraeda-web screenshots specs/2026-10-19-redesign-session session-reading session-blocking session-scrolled`.
Look at each at both sizes and both themes against the
[mockups](/packages/web/src/SessionMockups.stories.tsx) and the decisions, fix what differs, and
take them again.

- [ ] **Step 2: Run the whole validation**
  - Run: `nix develop -c vp run ready`
  - Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/web/scripts specs/2026-10-19-redesign-session/screenshots specs/2026-10-19-redesign-session/plan.md
git commit -m "test(redesign-session): screenshots of the session page"
```
