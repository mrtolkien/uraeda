---
status: auto-approved
spec-revision: 3
---

# Plan: Merge chats and changes

**Goal:** Make the session the one thing a human starts, growing in place into a change and then a
feature, with several sessions per change or feature, one sidebar list, one New page, and a way to
drop a change or a feature.

**Architecture:** The [spec's architecture](spec.md#architecture) holds. Ownership by layer:

- **Core (Rust)** owns the git and file moves: the in-place change-to-feature move, and dropping a
  change or a feature. Both are actions under `crates/core/src/actions/`, reached through `api`, the
  binding, and, for the move, `ura start <change> --feature`. They own every refusal of the move and
  the drop. The core never deletes a branch for a drop: the [git decision](../decisions/git.md)'s
  enforcement point stays `actions/clean.rs`.
- **Session store (server, `runner/`)** owns sessions: several per folder, a folder set once from
  none, the latest session of a folder, a session's done state, and "one working session per
  folder". The cache is the only writer of the `sessions` table; `LiveSessions` is a view that must
  be dropped and read again when a session's folder changes.
- **Session moves (server, `fate/`)** own the three moves a human triggers: a session becoming a
  change, a change becoming a feature, and dropping. Each calls the core, then the store, then sends
  the next run in the same session.
- **Web** owns what users see: the sidebar list, the New page, the session's actions and offer card,
  and a feature page's sessions. It never decides a rule the server owns: it shows the server's
  refusals.
- **Skill** owns the agent's behaviour: when to offer, the offer block's format, and the by-hand
  steps of the move and the drop.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both, with
[data-model.md](data-model.md).

## Review focus

1. **A session's live view after its folder changes.** `LiveSessions.of(row)` captures `folder`
   once, and the cwd, the opening line, and the live updates read it. After a session becomes a
   change, the next turn must run in the change's worktree, not the main checkout, even while a
   process for the session was open. Task 5.
2. **A move that fails midway.** The change starts, then attaching the session fails, or the core
   move renames the branch and then fails to commit. Nothing may be left half-attached: the session
   stays a plain session, and the core reports what was done and what is left, as `ura start` does.
   Tasks 1 and 5.
3. **Two sessions of one feature sending at once.** The guard must hold for a queued turn too, not
   only a direct send: a turn queued in one session must not start while another session of the
   folder works. Task 5.
4. **The latest session after a fresh step.** A run that starts in a new session must make that
   session the folder's latest, so "Next" and `/f/<folder>/session` reach it, and the earlier
   session's turns stay untouched. Task 5.
5. **Done sessions and a reply arriving.** A session read to its end leaves the list; a new reply
   must bring it back at its place, by its start date, not by its update date. Tasks 6 and 8.
6. **An offer block streamed in pieces.** The card must draw only once the fence is closed; a
   half-written block reads as text. Task 10.
7. **A drop over uncommitted work.** A worktree with uncommitted changes is never removed, and the
   drop still removes the **Now** entry and archives the sessions, saying what stayed. Task 2.

## Global constraints

- Agents decision: "Every conversation with an agent MUST be a session, and a change or a feature
  MUST have one or more sessions, all in its worktree and with the server's copy of the skill, where
  the agent acts on a human's message only when asked." "An agent MUST offer, and MUST NOT perform
  alone, turning a session into a change or a change into a feature: the human accepts it in the
  session or in a round." "Sessions MUST be a cache in Uraeda's data folder, never workflow state
  and never in a repository." ([agents](../decisions/agents.md))
- Git decision: "Tools MUST NOT lose the user's work: they never force-remove a worktree,
  force-push, or delete a branch the default branch lacks, and remove or delete anything only when a
  human asks." "Rust tools MUST read git with gix and run the system `git` for writes, through one
  core module." "Drafts, the backlog, and the human's inbox and priorities MUST be written on the
  default branch." ([git](../decisions/git.md))
- CLI decision: "Every rule the CLI enforces or checks MUST be written in the skill, and a change to
  either MUST update the other in the same change." ([cli](../decisions/cli.md))
- Code quality: files at most 500 lines (tests exempt), functions at most 100 lines, 7 parameters,
  depth 4 (TypeScript, Oxlint) or nesting 5 (Rust, clippy). No new `oxlint-disable` or `#[expect]`
  marker. A task that grows a file or function past a limit splits it first, in a `refactor` commit.
  ([code quality](../decisions/code-quality.md))
- UI checks: "UI tests MUST drive the UI as a user does, and MUST NOT assert markup, class names, or
  pixels." "Before handing over a UI change, the agent MUST review screenshots of every changed view
  at both sizes and in both themes against the decisions, and commit them."
  ([ui-checks](../decisions/ui-checks.md))
- Toolchain: Rust tests run under cargo-nextest; test runners never retry; unit tests never depend
  on elapsed time. ([toolchain](../decisions/toolchain.md),
  [code quality](../decisions/code-quality.md))
- Markdown in the web UI is drawn only through `Prose.tsx`'s `ProseMarkdown`
  ([ui-components](../decisions/ui-components.md), lint rule in `vite.config.ts`).
- Exact texts from the spec, used as written:
  - "Another session of this feature is working" (a change's: "Another session of this change is
    working")
  - "The agent is working"
  - "A branch or folder named 2026-10-20-login-redirect exists: pick another slug" (the folder
    varies)
  - "This change has a pull request: close it first, since its branch would be renamed"
  - "Its worktree has uncommitted changes: it stays at .worktrees/<folder>"
  - The drop confirmation: title "Drop the change <slug>?", body "Its entry leaves Now, its worktree
    is removed, and its sessions are archived. Its branch stays, so nothing is lost: git branch -D
    <branch> deletes it.", buttons "Drop the change" and "Keep the change" (a feature's: "feature").
  - The New page's sentences, from
    [`NewSession.stories.tsx`](/packages/web/src/NewSession.stories.tsx)'s `ABOUT`.
  - "Started a new session: the agent reads the repository, not the turns above." stays the
    `REPLACED`-style line only where a transcript is gone; a fresh step now starts a new session.
- Existing guarantees kept: one process per session (`claimSession`); a session's rename refuses
  blank text; a blocked session notifies; search finds sessions, changes, and features; `ura start`
  refuses a taken slug with `"{folder} exists: choose another slug with --slug"`.

## Code read

- [`runner/cache.ts`](/packages/server/src/runner/cache.ts) (435 lines): `createSession`,
  `featureSession(repo, folder)` (a `.get()` without ORDER BY), `updateSession` (columns from
  `sessionColumns`, no `folder`), `claimSession`, `sessions(repo,{limit,query})` by `updated_at`.
- [`runner/migrations.ts`](/packages/server/src/runner/migrations.ts): `migrations` array, one entry
  per version, `PRAGMA user_version`; migration 3 creates `one_session_per_feature`. Migration tests
  replay `migrations.slice(0, n)`
  ([`cache.test.ts`](/packages/server/src/runner/__tests__/cache.test.ts)).
- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts) (465 lines): `featureSession`,
  `newChat`, `#send` (79 lines; fresh flag at 244), `rename`/`archive` refusing a feature's session,
  `working`, `#busy`.
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts): cwd at line 90 from
  `live.folder`; fresh replaces `nativeId` at 92-99.
- [`runner/live-sessions.ts`](/packages/server/src/runner/live-sessions.ts): `of(row)` captures
  `folder`; `prune`.
- [`runner/turns.ts`](/packages/server/src/runner/turns.ts): queued turns open with `fresh` at 236.
- [`runner/send-input.ts`](/packages/server/src/runner/send-input.ts): `SendInput`, `openingOf`.
- [`runner/message.ts`](/packages/server/src/runner/message.ts): `runMessage`, `chatOpening`,
  `chatTitle`; [`session-state.ts`](/packages/server/src/runner/session-state.ts): `FRESH`,
  `REPLACED`, `REFUSALS`, `Queued`.
- [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts) (453 lines): `sendFirstRun`,
  `startTypedChange`, `change.start`, `feature.start`, `item.settings`, `session.*`.
- [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) (440 lines): `rows`,
  `featureStatuses`, `chatStatuses`, `sessionList`, `sessionSearch`, `featureRecord` (one
  `session`), `readWorkflowMessage`. [`fate/views.ts`](/packages/server/src/fate/views.ts) (477
  lines): `SessionRowRecord` has no start date or done state; `FeatureRecord.session`.
- [`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts): chat hrefs `/r/<name>/chats/<id>`.
- Server tests: [`runner/__tests__/helpers.ts`](/packages/server/src/runner/__tests__/helpers.ts)
  `testSessions()` (fake adapter, in-memory cache);
  [`__tests__/helpers.ts`](/packages/server/src/__tests__/helpers.ts) `testServer`, `mutate`,
  `byId`; fixtures from `uraeda-binding/test-utils` (`fixtureRepo`, `addChange`, `addPlan`,
  `commitOnBranch`).
- Core: [`actions/start/`](/crates/core/src/actions/start/) (`run`, `run_text`, `free_folder`,
  `check_clean`, `commit_proposal`, `StartError::Partial`),
  [`api/start.rs`](/crates/core/src/api/start.rs), [`git.rs`](/crates/core/src/git.rs) (491 lines:
  no branch rename), [`git/commit.rs`](/crates/core/src/git/commit.rs),
  [`actions/clean.rs`](/crates/core/src/actions/clean.rs) (never-forced worktree removal,
  `WhyLeft`), [`files/priorities/edits.rs`](/crates/core/src/files/priorities/edits.rs) (`link`,
  `remove`, `is_started`), [`files/frontmatter.rs`](/crates/core/src/files/frontmatter.rs) (`set`),
  [`decisions/branch.rs`](/crates/core/src/decisions/branch.rs) (`branch_changes`),
  [`repositories.rs`](/crates/core/src/repositories.rs) (`ItemSettings.color`),
  [`steps.rs`](/crates/core/src/steps.rs). A change's answered round in a feature folder leads to
  the Spec step, whose reference starts a new round ([spec.md](/skills/uraeda/references/spec.md)).
- Core and CLI tests: `crates/core/tests/actions.rs`, `tests/api.rs`, `tests/clean.rs` with
  `TestRepo`; `crates/cli/tests/start.rs` with `ura(&repo, &[...])`; file limit checked by
  `crates/cli/tests/structure.rs`. Near 500 lines: `crates/binding/src/lib.rs` (496), `git.rs`
  (491), `api.rs` (485).
- Web: [`sidebar/Sidebar.tsx`](/packages/web/src/sidebar/Sidebar.tsx) (`Rows`, `Cards`, `Chats`),
  [`ItemCard.tsx`](/packages/web/src/sidebar/ItemCard.tsx),
  [`cards.ts`](/packages/web/src/sidebar/cards.ts),
  [`DoneArea.tsx`](/packages/web/src/sidebar/DoneArea.tsx),
  [`Shell.tsx`](/packages/web/src/Shell.tsx) (`doneRows`),
  [`FeatureSettings.tsx`](/packages/web/src/sidebar/FeatureSettings.tsx),
  [`routes.tsx`](/packages/web/src/routes.tsx), [`App.tsx`](/packages/web/src/App.tsx) (redirect
  pattern `RunRedirect`), [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx),
  [`useSessionControls.ts`](/packages/web/src/useSessionControls.ts),
  [`Composer.tsx`](/packages/web/src/Composer.tsx) (`Composer` exactly 100 lines),
  [`ComposerSend.tsx`](/packages/web/src/ComposerSend.tsx),
  [`HandOver.tsx`](/packages/web/src/HandOver.tsx),
  [`TranscriptMessages.tsx`](/packages/web/src/TranscriptMessages.tsx) (`AgentMessage`),
  [`Prose.tsx`](/packages/web/src/Prose.tsx),
  [`feature/FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx),
  [`feature/AgentCard.tsx`](/packages/web/src/feature/AgentCard.tsx),
  [`NewChangePage.tsx`](/packages/web/src/NewChangePage.tsx),
  [`StartChat.tsx`](/packages/web/src/StartChat.tsx),
  [`pane/useStartChange.ts`](/packages/web/src/pane/useStartChange.ts),
  [`fields/Confirm.tsx`](/packages/web/src/fields/Confirm.tsx).
- Astryx's Markdown `components.code` gets `language` cut at the first non-word character, so
  `uraeda-offer change` arrives as `uraeda`; the semantic-fence plugin
  (`createMarkdownFenceTransform`, `@astryxdesign/core/Markdown/plugins`) keeps the language and the
  meta.
- Web tests: unit `packages/web/src/__tests__` (Vitest, happy-dom, `renderPage`, `fakeAgent`),
  browser `packages/web/src/__browser__` (projects `phone` and `desktop`). Screenshots: a
  `scripts/<name>-shots.ts` registered in `scripts/screenshots.ts`, written to the feature's
  `screenshots/` (see `session-look-shots.ts`).
- Validation commands, in the dev shell (`nix develop -c`): `vp check`, `vp test <file>`,
  `vp test --project uraeda-web`, `vp test --project desktop|phone`,
  `cargo nextest run -p <crate> --test <file> <filter>`, `vp run --filter uraeda-binding build`
  (regenerates `packages/binding/index.js` and `index.d.ts`), and `vp run ready` for everything.
- Baseline: `vp run ready` was run before any change; its result is in the first task's commit body.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Complexity tracking

| Abstraction or exception                                    | Why it is needed                                                                                 | Simpler alternative rejected because                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `actions/promote.rs` (core)                                 | the in-place move, shared by the CLI and the server                                              | doing it in the server breaks "Rust tools write git through one core module"   |
| `actions/drop.rs` (core)                                    | the drop's Now removal and never-forced worktree removal, from the server                        | reusing `clean` would delete the branch and requires a done step               |
| `git/branches.rs` (core), with `rename_branch`              | the only git write the move adds; `git.rs` is at 491 lines                                       | adding it to `git.rs` passes the 500-line limit                                |
| `fate/session-moves.ts` (server)                            | the mutations `session.toChange`, `session.new`, `feature.promote`, `feature.drop`               | `mutations.ts` is at 453 lines                                                 |
| `OfferCard` and a `plugins` prop on `ProseMarkdown` (web)   | the only way to read `uraeda-offer change` with its meta, through the one allowed Markdown entry | `components.code` loses the meta; a second Markdown entry breaks the lint rule |
| `NewPage` (web), replacing `NewChangePage` and the new chat | the spec's one "＋ New" with three kinds                                                         | keeping two pages contradicts US3                                              |
| `SessionsCard` (web), replacing `AgentCard`                 | a feature's several sessions                                                                     | `AgentCard` takes one session                                                  |
| Structural split of `Composer` (exactly 100 lines)          | the session's "…" joins its send actions                                                         | growing it passes the function limit                                           |

## Test map

Server tests run the runner on the fake adapter and an in-memory cache (`testSessions`), or the
whole app (`testServer`, `mutate`). Web unit tests render the app on the in-process server
(`renderPage`, `fakeAgent`). Core tests run real git in temporary repositories (`TestRepo`). No test
depends on elapsed time.

| Spec                                                              | Task     | Test                                                                                                                               |
| ----------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| US1 1 (one section, oldest started first, kind icons)             | 8        | `web/__tests__/sidebar.test.tsx`, "sessions, changes, and features share one list, oldest first"                                   |
| US1 2 (done session and merged change in Done)                    | 6, 8     | `server/__tests__/sessions.test.ts` "a session read to its end is done"; sidebar "Done lists…"                                     |
| US1 3 (rename from the "…")                                       | 8        | sidebar, "a session's … renames it"                                                                                                |
| US1 more 1 (a new reply brings it back)                           | 6        | `server/__tests__/sessions.test.ts`, "a reply brings a done session back"                                                          |
| US1 more 2 (`/chats/<id>` redirect)                               | 7        | `web/__tests__/routes.test.ts`, "old addresses redirect"                                                                           |
| US1 more 3 (no colour)                                            | 3        | `core/tests/repositories.rs`, "a colour saved before is ignored and dropped"; `feature-settings.test.tsx`                          |
| US2 1 (start the change from the offer)                           | 5, 10    | `server/__tests__/session-moves.test.ts` "toChange starts the change and runs it in the session"; `web/__tests__/offer.test.tsx`   |
| US2 2 (edited files carried over)                                 | 5        | `runner/__tests__/moves.test.ts`, "the opening names the files the session edited"                                                 |
| US2 3 ("Make it a change" opens the card)                         | 10       | `offer.test.tsx`, "Make it a change opens the card with the first message"                                                         |
| US2 more 1, 2, 3 (Not now; agent working; actions after the move) | 10       | `offer.test.tsx`; `session-actions.test.tsx`                                                                                       |
| US2 4 (drop a change)                                             | 2, 5, 10 | `core/tests/drop.rs`; `session-moves.test.ts` "drop archives the sessions"; `session-actions.test.tsx`                             |
| US3 1, 2, 3, more 1, 2                                            | 7, 9     | `web/__tests__/new-page.test.tsx`; `routes.test.ts`                                                                                |
| US4 1 (make it a feature)                                         | 1, 5     | `core/tests/promote.rs` "a change becomes a feature in place"; `session-moves.test.ts` "promote runs the next step in the session" |
| US4 2 (unattended run asks in a round)                            | 12       | skill text, checked by review; `ura check` on the example                                                                          |
| US4 3 (code stays)                                                | 1        | `promote.rs`, "the change's commits stay on the branch"                                                                            |
| US4 more 1 (decisions back to proposed)                           | 1        | `promote.rs`, "a decision the change applied is proposed again"                                                                    |
| US4 more 2 (pull request refusal)                                 | 1        | `promote.rs`, "a change with a pull request is refused"                                                                            |
| US5 1 (New session)                                               | 5, 11    | `session-moves.test.ts` "a new session of a feature works in its worktree"; `web/__tests__/feature-sessions.test.tsx`              |
| US5 2 (fresh step starts a new session)                           | 5        | `runner/__tests__/sessions.test.ts`, "a fresh run starts a new session of the feature"                                             |
| US5 3 (one working session)                                       | 5        | `runner/__tests__/sessions.test.ts`, "a second session of a working feature is refused"                                            |
| US5 more 1, 2 (runs to the latest; sub-agents listed)             | 5, 11    | `sessions.test.ts` "a run goes to the latest session"; `feature-sessions.test.tsx`                                                 |
| Edge: a file you also edited                                      | 5        | `moves.test.ts`, "the opening tells to merge by hand"                                                                              |
| Edge: slug taken                                                  | 5, 10    | `session-moves.test.ts`, "a taken slug is refused with its message"                                                                |
| Edge: server restarts between start and attach                    | 5        | `session-moves.test.ts`, "a failed attach leaves the session without a workflow"                                                   |
| Edge: two offers                                                  | 10       | `offer.test.tsx`, "only the latest offer has buttons"                                                                              |
| Edge: read while open                                             | 8        | sidebar, "the open session stays in the list"                                                                                      |
| Edge: change offer in a feature's session                         | 10       | `offer.test.tsx`, "a change offer in a feature's session reads as text"                                                            |
| Edge: dropped worktree with changes                               | 2        | `drop.rs`, "a worktree with changes stays"                                                                                         |
| Edge: pushed branch                                               | 1        | `promote.rs`, "a pushed change is renamed locally only"                                                                            |
| SC-001, SC-004                                                    | 10, 9    | `offer.test.tsx` one click; `new-page.test.tsx` two clicks                                                                         |
| SC-002                                                            | 5        | `session-moves.test.ts`, "earlier turns stay on their session"                                                                     |
| SC-003                                                            | 5        | `moves.test.ts`, "only the session's files are named"                                                                              |
| SC-005                                                            | 8, 13    | sidebar test checks each card has its status and "…" in its row; screenshots reviewed                                              |
| Review focus 1                                                    | 5        | `runner/__tests__/moves.test.ts`, "after the move, the next turn runs in the worktree"                                             |
| Review focus 2                                                    | 1, 5     | `promote.rs` "a failed commit reports what is done and left"; `session-moves.test.ts` failed attach                                |
| Review focus 3                                                    | 5        | `sessions.test.ts`, "a queued turn waits for the other session"                                                                    |
| Review focus 4                                                    | 5        | `sessions.test.ts`, "a fresh run's session is the latest"                                                                          |
| Review focus 5                                                    | 6        | `sessions.test.ts`, "a reply brings a done session back"                                                                           |
| Review focus 6                                                    | 10       | `offer.test.tsx`, "a block still streaming reads as text"                                                                          |
| Review focus 7                                                    | 2        | `drop.rs`, "a worktree with changes stays"                                                                                         |

## Waves

- **Wave 1**: tasks 1, 2, 3, 4, 7, 12. Core move, core drop, colour removal, session store, web
  routes, skill text. Shared files they each add to: `crates/core/src/api.rs` (re-export lines),
  `crates/core/src/actions/mod.rs` (module lines), `crates/binding/src/lib.rs` (module lines), and
  the generated `packages/binding/index.js` and `index.d.ts`, rebuilt after the merge.
- **Wave 2**: tasks 5, 6. Session moves, and session lists and statuses. Shared file:
  `packages/server/src/fate/views.ts`, each adding its own records.
- **Wave 3**: tasks 8, 9, 11. Sidebar, New page, feature page sessions.
- **Wave 4**: task 10. The session page's actions and offer card.
- **Wave 5**: task 13. Screenshots, and the slow suites.

---

## Task 1: Make a change a feature, in place, in the core and the CLI

**Risky:** renames a branch with work, moves a folder, and writes on the default branch.

**Files:**

- Create: `crates/core/src/actions/promote.rs`, `crates/core/src/git/branches.rs`
- Modify: `crates/core/src/actions/mod.rs`, `crates/core/src/git.rs` (module line only),
  `crates/core/src/api/start.rs`, `crates/core/src/api.rs` (re-export),
  `crates/binding/src/moves.rs` (create) and `crates/binding/src/lib.rs` (module line),
  `crates/cli/src/main.rs` (`Command::Start`), `crates/cli/src/start.rs`
- Test: `crates/core/tests/promote.rs`, `crates/cli/tests/start.rs`

**Interfaces:**

- Consumes: `start::plan`'s `free_folder` (taken-name check), `files::priorities::edits::link`,
  `files::frontmatter::set`, `decisions::branch::branch_changes`, `Feature.pull_request`.
- Produces:
  - `Git::rename_branch(&self, from: &str, to: &str) -> Result<(), GitError>` in `git/branches.rs`.
  - `actions::promote::run(git: &Git, workspace: &Workspace, folder: &str) -> Result<Promoted, StartError>`,
    with
    `pub struct Promoted { folder: String, branch: String, default_subject: String, subject: String, decisions: Vec<String> }`.
  - `api::promote_change(repo: &Path, folder: &str) -> Result<PromotedView>`
    (`#[napi(object)] PromotedView { folder, branch, decisions: Vec<String> }`).
  - Binding: `promoteChange(repo: string, folder: string): Promise<PromotedView>`.
  - CLI: `ura start <change> --feature`.

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/promote.rs`, on a `TestRepo` with a change `2026-10-20-priorities-sections`
started from a draft (its **Now** entry linking
`/specs/changes/2026-10-20-priorities-sections/proposal.md`):

- "a change becomes a feature in place": after `promote::run`, `current_branch` of the worktree is
  `2026-10-20-priorities-sections`, `change/2026-10-20-priorities-sections` no longer exists,
  `specs/2026-10-20-priorities-sections/proposal.md` exists on the branch and
  `specs/changes/2026-10-20-priorities-sections` does not, the default branch's `PRIORITIES.md`
  links `/specs/2026-10-20-priorities-sections/proposal.md`, and the branch's last subject is
  `chore(priorities-sections): upgrade to a feature`.
- "the change's commits stay on the branch": a commit adding `src/priorities/sections.ts` before the
  move is still in `repo.subjects(branch)` and the file exists after it.
- "a decision the change applied is proposed again": a decision edited on the branch with
  `status: active` and `approved-by: mrtolkien` reads `status: proposed` and `approved-by:` (nothing
  after the colon) after the move, and is listed in `Promoted.decisions`.
- "a change with a pull request is refused": with a cached pull request for the branch, the error is
  `This change has a pull request: close it first, since its branch would be renamed`, and nothing
  moved.
- "a taken name is refused": with a branch `2026-10-20-priorities-sections` already there, the error
  is the start's taken-name message, and nothing moved.
- "a feature is not promoted": promoting a feature folder is refused with
  `<folder> is not a change`.
- "a failed commit reports what is done and left": with a hook that refuses the branch's commit, the
  error is `StartError::Partial`, `done` naming the relinked entry and the renamed branch, `left`
  naming the folder's move.
- "a pushed change is renamed locally only": with the change's branch pushed, the remote still has
  `change/2026-10-20-priorities-sections` after the move.

In `crates/cli/tests/start.rs`: "`ura start <change> --feature` moves it", asserting stdout names
the new branch, exit code 0; and "`--feature` on a draft is refused" with
`--feature takes a change: start a draft as a feature without it`.

The breaks they catch: renaming before relinking the entry (a branch whose entry points nowhere);
`set(...,"approved-by","")` writing a trailing space; moving the folder with a copy that leaves the
old one; the PR check reading the default branch's pulls instead of the change's.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test promote`
- Expected: FAIL to compile, `unresolved import uraeda_core::actions::promote`.

- [x] **Step 3: Implement the move**

Order, so each failure leaves a consistent state: refuse first (not a change, a pull request,
uncommitted changes in the change's worktree via `check_clean`'s message, a taken name via
`free_folder`); then, on the default branch, relink the **Now** entry and commit
`chore(<slug>): start <name> as a feature`; then `rename_branch`; then in the worktree move the
folder with the filesystem, set each decision the branch changed and that reads `active` back to
`proposed` with an empty `approved-by`, and commit the old and new paths and the decisions as
`chore(<slug>): upgrade to a feature`. A failure after the first commit returns
`StartError::Partial` with `done` and `left`, as `start` does. `rename_branch` runs
`git branch -m <from> <to>` through the module's `run`. The CLI's `start` resolves a change target
with `Purpose::Inspect` when `--feature` is given, and prints
`Started <folder> as a feature, on <branch>.`

- [x] **Step 4: Run the tests, then the Rust checks**

- Run:
  `nix develop -c cargo nextest run -p uraeda-core --test promote && nix develop -c cargo nextest run -p uraeda-cli --test start && nix develop -c cargo clippy --workspace --all-targets -- -D warnings && nix develop -c vp run --filter uraeda-binding build`
- Expected: PASS, no warnings; `packages/binding/index.d.ts` declares `promoteChange`.

- [x] **Step 5: Commit**

```bash
git add crates packages/binding/index.js packages/binding/index.d.ts specs/2026-10-20-merge-chats/plan.md
git commit -m "feat(merge-chats): a change becomes a feature in place, with ura start <change> --feature"
```

## Task 2: Drop a change or a feature, in the core

**Risky:** removes a worktree and writes on the default branch.

**Files:**

- Create: `crates/core/src/actions/drop.rs`
- Modify: `crates/core/src/actions/mod.rs`, `crates/core/src/api.rs` (re-export),
  `crates/core/src/api/drop.rs` (create), `crates/binding/src/moves.rs` (add; create it if task 1's
  is not merged yet) and `crates/binding/src/lib.rs` (module line)
- Test: `crates/core/tests/drop.rs`

**Interfaces:**

- Consumes: `files::priorities::edits::remove`, `Git::remove_worktree`, `Git::has_local_changes`,
  `actions::clean`'s `WhyLeft` (reuse the type).
- Produces:
  `actions::drop::run(git: &Git, workspace: &Workspace, folder: &str) -> Result<Dropped, ActionError>`,
  `pub struct Dropped { branch: String, worktree: Option<WhyLeft> }`;
  `api::drop_item(repo: &Path, folder: &str) -> Result<DroppedView>`
  (`DroppedView { branch: String, worktree_left: Option<String> }`, the reason as the spec's text);
  binding `dropItem(repo: string, folder: string): Promise<DroppedView>`.

- [ ] **Step 1: Write the failing tests**

In `crates/core/tests/drop.rs`, on a started change `2026-10-20-login-redirect`:

- "dropping a change removes its entry and its worktree, and keeps its branch": **Now** no longer
  holds its entry (commit `chore(login-redirect): drop Login redirects twice` on the default
  branch), `.worktrees/2026-10-20-login-redirect` is gone, `change/2026-10-20-login-redirect` still
  exists with its commits, and `Dropped.branch` names it.
- "a worktree with changes stays": with an uncommitted file in the worktree, the worktree and the
  file stay, the entry is removed, and `worktree_left` reads
  `Its worktree has uncommitted changes: it stays at .worktrees/2026-10-20-login-redirect`.
- "a feature is dropped the same way": a started feature.
- "a done feature is not dropped": refused with `<folder> is done: ura clean removes it`.

Breaks caught: a forced worktree removal; a `branch -D`; removing the entry of another item with the
same name.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test drop`
- Expected: FAIL to compile, `unresolved import uraeda_core::actions::drop`.

- [ ] **Step 3: Implement the drop**

From the main checkout, as `clean` reaches it: remove the entry whose link is the folder's
`proposal.md` and commit it; then remove the worktree only when it has no local changes and is not
the caller's own, never forced; never touch the branch.

- [ ] **Step 4: Run the tests, then the Rust checks and the binding build**

- Run:
  `nix develop -c cargo nextest run -p uraeda-core --test drop && nix develop -c cargo clippy --workspace --all-targets -- -D warnings && nix develop -c vp run --filter uraeda-binding build`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates packages/binding/index.js packages/binding/index.d.ts specs/2026-10-20-merge-chats/plan.md
git commit -m "feat(merge-chats): drop a change or a feature, keeping its branch"
```

## Task 3: Remove an item's colour

**Files:**

- Modify: `crates/core/src/repositories.rs` (`Color`, `ItemSettings`, `set_item`),
  `crates/core/src/api/repository_list.rs`, `crates/core/src/view.rs` (`ItemSettingsView`),
  `crates/binding/src/lib.rs` (`set_item_settings`), `packages/server/src/fate/mutations.ts`
  (`item.settings`), `packages/server/src/fate/items.ts`, `packages/server/src/fate/views.ts`
  (`ItemLook`), `packages/web/src/sidebar/FeatureSettings.tsx`,
  `packages/web/src/sidebar/FeatureSettingsDialog.tsx`, `packages/web/src/sidebar/ItemCard.tsx`
  (`COLORS`, `CardColor`, the stripe), `packages/web/src/sidebar/cards.ts` (`toCard`),
  `packages/web/src/views.ts` (`FeatureView.color`), `packages/web/src/sidebar/Sidebar.stories.tsx`,
  `packages/web/src/sidebar/FeatureSettings.stories.tsx`
- Test: `crates/core/tests/repositories.rs`, `packages/binding/repositories.test.ts`,
  `packages/server/src/__tests__/repositories.test.ts`,
  `packages/web/src/__tests__/feature-settings.test.tsx`

**Interfaces:**

- Produces: binding `setItemSettings(dataDir, name, folder, label: string | null)` (no colour);
  `ItemSettingsView { folder, label }`; `item.settings` input `{ folder, label? }`.

- [ ] **Step 1: Change the tests first**

- `repositories.rs`: "a colour saved before is ignored and dropped": a `repositories.toml` holding
  `color = "purple"` for an item reads with its label, and the next `set_item` writes no `color`.
- `feature-settings.test.tsx`: the settings dialog has a name field and no "Colour" radio list;
  replace the "Purple" assertions.
- Remove the colour cases of `repositories.test.ts` (binding and server): a ruling records each
  deleted test, since the human asked for colours to go (spec, US1 more 3).

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test repositories`
- Expected: FAIL, the written file still holds `color`.

- [ ] **Step 3: Remove the colour through every layer**

Drop the field and the enum; serde ignores an unknown `color` on read. The card has no stripe.

- [ ] **Step 4: Run the validation**

- Run:
  `nix develop -c vp run --filter uraeda-binding build && nix develop -c vp check && nix develop -c vp test packages/web/src/__tests__/feature-settings.test.tsx packages/server/src/__tests__/repositories.test.ts && nix develop -c cargo nextest run -p uraeda-core --test repositories`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates packages specs/2026-10-20-merge-chats/plan.md specs/2026-10-20-merge-chats/rulings.md
git commit -m "feat(merge-chats): items have a name and no colour"
```

## Task 4: Several sessions per folder in the session store

**Risky:** changes the cache's schema, with a migration, and a rule several callers share.

**Files:**

- Modify: `packages/server/src/runner/migrations.ts`, `packages/server/src/runner/cache.ts`,
  `packages/server/src/runner/cache-rows.ts`
- Test: `packages/server/src/runner/__tests__/cache.test.ts`

**Interfaces:**

- Produces:
  - Migration 6: `DROP INDEX one_session_per_feature;` then a non-unique
    `CREATE INDEX sessions_by_folder ON sessions (repo, folder) WHERE folder IS NOT NULL;`.
  - `SessionCache.folderSessions(repo: string, folder: string): Array<SessionRow>`, latest first by
    `created_at DESC, rowid DESC`.
  - `SessionCache.latestSession(repo: string, folder: string): SessionRow | undefined`, the first of
    `folderSessions`. `featureSession` is renamed to it, every caller updated.
  - `SessionCache.attach(id: string, folder: string): void`: sets `folder` only when it is null;
    throws `refused: the session already belongs to <folder>` otherwise.
  - `SessionRow.createdAt` already exists; `lastEndedAt(id): string | null` for the done state.

- [ ] **Step 1: Write the failing tests**

- "a folder holds several sessions, latest first": two `createSession` with the same folder succeed,
  and `folderSessions` returns the second first.
- "migration 6 keeps every session": replay migrations 1-5, insert a feature's session and a chat,
  open the cache: both rows are there, and a second session of the folder can be created.
- "attach sets a session's folder once": a chat attached to `2026-10-20-login-redirect` reads that
  folder; attaching it again throws the refusal.
- Replace "a feature has one session" (line 68) by the first test: a ruling records it.

Breaks caught: a migration that recreates the table and loses rows; `latestSession` ordered by
`updated_at`, so a busy older session wins.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/runner/__tests__/cache.test.ts`
- Expected: FAIL, `UNIQUE constraint failed: sessions.repo, sessions.folder`.

- [ ] **Step 3: Implement the store's changes**

- [ ] **Step 4: Run the server tests**

- Run: `nix develop -c vp test --project uraeda-server && nix develop -c vp check`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/runner specs/2026-10-20-merge-chats/plan.md specs/2026-10-20-merge-chats/rulings.md
git commit -m "feat(merge-chats): a change or a feature holds several sessions"
```

## Task 5: Session moves, new sessions, and one working session per folder

**Risky:** concurrency (one working session per folder) and a session's folder changing under a live
process.

**Files:**

- Create: `packages/server/src/fate/session-moves.ts`, `packages/server/src/runner/moves.ts` (the
  opening line and the edited files)
- Modify: `packages/server/src/runner/sessions.ts` (split `#send` first if it passes 100 lines),
  `packages/server/src/runner/live-sessions.ts`, `packages/server/src/runner/turns.ts`,
  `packages/server/src/runner/processes.ts`, `packages/server/src/runner/session-state.ts`
  (`REFUSALS`), `packages/server/src/fate/mutations.ts` (register `session-moves`, `sendFirstRun` to
  the latest session), `packages/server/src/fate/views.ts` (a `Dropped` record)
- Test: `packages/server/src/__tests__/session-moves.test.ts`,
  `packages/server/src/runner/__tests__/moves.test.ts`,
  `packages/server/src/runner/__tests__/sessions.test.ts`

**Interfaces:**

- Consumes: task 1's `promoteChange`, task 2's `dropItem`, task 4's `folderSessions`,
  `latestSession`, `attach`.
- Produces:
  - `Sessions.newSession(repo: string, folder: string): Promise<SessionRow>`.
  - `Sessions.attach(repo: string, session: string, folder: string): Promise<void>`: attaches,
    closes the session's process, and prunes its `Live`, so the next turn reads the new folder.
  - `Sessions.send` refuses with `REFUSALS.otherWorking` ("Another session of this feature is
    working", or "of this change") when another session of the folder works; a queued turn of it
    waits in `turns.next` until the other ends.
  - A run whose step starts fresh, or `workflow.fresh: true`, goes to a new session of the folder;
    `session.send` returns that session.
  - `movedOpening(input: { branch: string; folder: string; worktree: string; edited: Array<string> }): string`
    in `runner/moves.ts`, and `editedFiles(cache, session): Array<string>` (targets of the session's
    edit and write tool calls, deduplicated, in order).
  - Mutations in `fate/session-moves.ts`: `session.toChange({ session, text, slug? })` returning the
    Feature; `session.new({ folder })` returning the Session; `feature.promote({ folder })`
    returning the Feature; `feature.drop({ folder })` returning `{ branch, worktreeLeft }`.
  - `rename` accepts every session; `archive` stays for sessions without a folder.

- [ ] **Step 1: Write the failing tests**

`runner/__tests__/sessions.test.ts`:

- "a second session of a working feature is refused": session A of `AGENT` working, a send to B of
  the same folder rejects with "Another session of this feature is working".
- "a queued turn waits for the other session": A working, B's turn queued before A started is not
  opened until A's turn ends.
- "a fresh run starts a new session of the feature": a `plan` run sent to the feature's session
  creates a second session; the first keeps its turns and its `nativeId`; `adapter.opens.at(-1)` is
  the new one, in the feature's worktree.
- "a fresh run's session is the latest" and "a run goes to the latest session".
- "every session can be renamed".

`runner/__tests__/moves.test.ts`:

- "after the move, the next turn runs in the worktree": a chat with an open process attached to a
  change; the next send opens in `binding.workDir(repo, folder)`, not the repository.
- "the opening names the files the session edited": a chat whose items hold Edit of
  `src/auth/guard.ts` and Read of `README.md`; the opening names `src/auth/guard.ts` only, and says
  to carry it over and restore it in the main checkout, merging by hand when the file changed there
  since ("the opening tells to merge by hand").
- "only the session's files are named" (SC-003).

`__tests__/session-moves.test.ts` (on `testServer`):

- "toChange starts the change and runs it in the session": the change `2026-10-20-login-redirect`
  exists with the card's text as its proposal, the session's folder is it, and its next turn is the
  change's start run, with the moved opening.
- "a taken slug is refused with its message": nothing attached, the session stays without a folder.
- "a failed attach leaves the session without a workflow": the cache's attach throws; the change
  exists, the session's folder stays null, and the error names the change.
- "earlier turns stay on their session" (SC-002).
- "promote runs the next step in the session": a change promoted; the same session's next turn is a
  run of the feature's next step.
- "a new session of a feature works in its worktree".
- "drop archives the sessions": both sessions of a dropped change are archived, and the result names
  the branch.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/runner/__tests__/sessions.test.ts packages/server/src/runner/__tests__/moves.test.ts packages/server/src/__tests__/session-moves.test.ts`
- Expected: FAIL, first `sessions.newSession is not a function`.

- [ ] **Step 3: Implement the moves and the guard**

The guard lives in one place, a `Sessions` method both `#send` and `turns.next` call. `toChange`
calls `binding.startChange` without `sendFirstRun`, then `attach`, then sends the start run with
`movedOpening` before it. `promote` calls `binding.promoteChange`, then sends the run of the
folder's next step (`readWorkflowMessage`) in the latest session. `drop` calls `binding.dropItem`,
then archives every session of the folder.

- [ ] **Step 4: Run the server suite and the checks**

- Run: `nix develop -c vp test --project uraeda-server && nix develop -c vp check`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server specs/2026-10-20-merge-chats/plan.md specs/2026-10-20-merge-chats/rulings.md
git commit -m "feat(merge-chats): a session becomes a change, a change a feature, and a feature holds several sessions"
```

## Task 6: Session lists, done sessions, and statuses across sessions

**Files:**

- Modify: `packages/server/src/fate/sessions.ts` (split first if it passes 500 lines),
  `packages/server/src/fate/views.ts`, `packages/server/src/fate/needs-you.ts`,
  `packages/server/src/runner/status.ts`
- Test: `packages/server/src/__tests__/sessions.test.ts`,
  `packages/server/src/__tests__/needs-you.test.ts`

**Interfaces:**

- Consumes: task 4's `folderSessions`, `latestSession`.
- Produces:
  - `SessionRowRecord` gains `startedAt: string` and `done: boolean`: done when the session has no
    folder, is not working or waiting on the human, has a turn, and its `seen_at` is later than its
    last turn's end.
  - `FeatureRecord` gains `sessions: Array<string>` (latest first); `session` stays the latest.
  - A feature's status is the most urgent of its sessions' (`STATUS_ORDER`).
  - Notification and status hrefs use `/r/<name>/sessions/<id>`.

- [ ] **Step 1: Write the failing tests**

- "a session read to its end is done": after `session.seen` past its last turn, its row reads
  `done: true`.
- "a reply brings a done session back": a new turn ending after `seen_at` reads `done: false`, and
  its `startedAt` is unchanged.
- "a feature's status is its most urgent session's": one session blocked, one idle: the feature
  needs you.
- "a feature lists its sessions, latest first".
- `needs-you.test.ts`: a blocked session's href is `/r/<name>/sessions/<id>`.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/__tests__/sessions.test.ts packages/server/src/__tests__/needs-you.test.ts`
- Expected: FAIL, `expected undefined to be true` on `done`.

- [ ] **Step 3: Implement the fields and the statuses**

- [ ] **Step 4: Run the server suite and the checks**

- Run: `nix develop -c vp test --project uraeda-server && nix develop -c vp check`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server specs/2026-10-20-merge-chats/plan.md
git commit -m "feat(merge-chats): sessions are done once read, and a feature lists its sessions"
```

## Task 7: Session addresses, and the old ones redirected

**Files:**

- Modify: `packages/web/src/routes.tsx`, `packages/web/src/App.tsx`,
  `packages/web/src/StartChat.tsx`, `packages/web/src/SessionPage.tsx` (the path after a new
  session's first message only), `packages/web/src/sidebar/Row.tsx`,
  `packages/web/src/sidebar/Sidebar.tsx` (the two paths only), and every test fixture path `/chats/`
  (`__browser__/helpers.tsx`, `scripts/session-look-shots.ts`)
- Test: `packages/web/src/__tests__/routes.test.ts`

**Interfaces:**

- Produces: routes `{ id; page: "session-id" }` at `/sessions/<id>`, `{ page: "new"; kind }` at
  `/new?kind=session|change|feature` (kind `session` by default). Until task 9, `/new` draws the new
  chat page for a session and `NewChangePage` for a change; `/chats/<id>` redirects to
  `/sessions/<id>`, `/chats/new` to `/new`, `/changes/new` to `/new?kind=change`, with `redirect`.

- [ ] **Step 1: Write the failing tests**

- "old addresses redirect": `/chats/abc` lands on `/sessions/abc`; `/changes/new` on
  `/new?kind=change`; `/chats/new` on `/new`.
- "a new session's first message opens /sessions/<id>".

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/routes.test.ts`
- Expected: FAIL, the route of `/sessions/abc` is `not-found`.

- [ ] **Step 3: Implement the routes and update the producers**

- [ ] **Step 4: Run the web suite**

- Run: `nix develop -c vp test --project uraeda-web && nix develop -c vp check`
- Expected: PASS, after updating the tests that pinned `/chats/<id>` paths to `/sessions/<id>`: a
  ruling lists them.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-20-merge-chats/plan.md specs/2026-10-20-merge-chats/rulings.md
git commit -m "feat(merge-chats): sessions live at /sessions/<id>, and the old addresses redirect"
```

## Task 8: One Sessions list in the sidebar

**Files:**

- Start from: [`Sessions.stories.tsx#Merged`](/packages/web/src/sidebar/Sessions.stories.tsx)
- Modify: `packages/web/src/sidebar/Sidebar.tsx`, `ItemCard.tsx` (a `session` kind, the kind icon,
  the "…" as a menu), `cards.ts` (order by start), `Row.tsx` (`Chat` goes),
  `packages/web/src/Shell.tsx` (`doneRows` with done sessions), `DoneArea.tsx` (a session's row icon
  and label), `packages/web/src/views.ts` (`SessionRowView` fields), `Sidebar.stories.tsx`; remove
  the mockup file once the real sidebar draws the same states
- Test: `packages/web/src/__tests__/sidebar.test.tsx`, `shell.test.tsx`, `cards.test.ts`

**Interfaces:**

- Consumes: task 6's `startedAt`, `done`; task 7's paths.
- Produces: `CardItem.kind: "session" | "change" | "feature"`; `byStart(items)` in `cards.ts`; the
  "＋ New" row at the top of Sessions, linking `/new`.

- [ ] **Step 1: Write the failing tests**

- "sessions, changes, and features share one list, oldest first": the US1 1 data; the "Sessions"
  group lists `look-and-feel`, `flaky-tests`, "Why is CI slow?"; their accessible names include
  "feature", "change", "session"; no "Changes", "Features", or "Chats" group.
- "Done lists a session read to its end, then a merged change".
- "a session's … renames it": Rename, type "CI speed", the card reads "CI speed".
- "the open session stays in the list" until its page is left.
- "each card has its status and its … in its row" (SC-005), by role, not pixels.
- Update the tests that pinned the old sections (list them in a ruling).

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/sidebar.test.tsx`
- Expected: FAIL, `Unable to find role "group" and name "Sessions"`.

- [ ] **Step 3: Implement the list**

- [ ] **Step 4: Run the web suite**

- Run: `nix develop -c vp test --project uraeda-web && nix develop -c vp check`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-20-merge-chats/plan.md specs/2026-10-20-merge-chats/rulings.md
git commit -m "feat(merge-chats): one Sessions list, each card's icon telling its kind"
```

## Task 9: The New page

**Files:**

- Start from: [`NewSession.stories.tsx#NewSessionPage`](/packages/web/src/NewSession.stories.tsx),
  `#NewChangePage`, `#NewFeaturePage`
- Create: `packages/web/src/NewPage.tsx`, `packages/web/src/NewPage.stories.tsx` (the three kinds,
  from the mockups)
- Modify: `packages/web/src/App.tsx` (`/new` draws `NewPage`), `packages/web/src/NewChangePage.tsx`
  (its composer and slug become `NewPage`'s change part; task 8 points the sidebar's "＋ New" row at
  `/new`)
- Test: `packages/web/src/__tests__/new-page.test.tsx` (moves `new-change.test.tsx`'s cases)

**Interfaces:**

- Consumes: task 7's `/new?kind=`; mutations `change.start`, `inbox.toNewDraft`, `draft.create`,
  `feature.start` (kind change), `priorities.add` / `priorities.insert`.

- [ ] **Step 1: Write the failing tests**

- "＋ New opens Session, with its sentence": the selector reads Session, the sentence "A
  conversation with the agent, in the main checkout, like plain Claude Code. It offers a change when
  the work grows.", and sending opens `/sessions/<id>`.
- "a change from an inbox note": Change, "Start the change" on the note "The PR texts lack context:
  start with what was done": `INBOX.md` no longer holds it, a change starts with its text, its
  session opens. Two clicks from "＋ New" (SC-004).
- "a feature from a title": Feature, "Keyboard navigation", "Write the proposal": the line is the
  first unstarted entry of **Now**, and `/edit/specs/drafts/keyboard-navigation.md` opens.
- "a feature from a priority line": "Open the draft" on "Empty inbox" opens its draft.
- "the steps that wait on you": Change shows Prompt, Questions, if any, Pull request; Feature shows
  Prompt, Questions, Spec, Pull request.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/new-page.test.tsx`
- Expected: FAIL, `Unable to find role "radiogroup" and name "What to start"`.

- [ ] **Step 3: Implement the page**

- [ ] **Step 4: Run the web suite**

- Run: `nix develop -c vp test --project uraeda-web && nix develop -c vp check`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-20-merge-chats/plan.md
git commit -m "feat(merge-chats): one New page starts a session, a change, or a feature"
```

## Task 10: A session's actions and the agent's offer

**Files:**

- Start from: [`NewSession.stories.tsx#ChangeOffer`](/packages/web/src/NewSession.stories.tsx),
  `#SessionActions`, `#ChangeStarted`, `#DropChange`, `#FeatureOffer`
- Create: `packages/web/src/OfferCard.tsx`, `packages/web/src/SessionActions.tsx`
- Modify: `packages/web/src/Composer.tsx` (structural split first:
  `refactor(merge-chats): split the composer's send actions`), `ComposerSend.tsx`, `Prose.tsx`
  (`plugins` prop), `TranscriptMessages.tsx` (`AgentMessage` draws the offer), `SessionPage.tsx`
  (header rename for every session; the "…" in place of the footer's Archive),
  `useSessionControls.ts`
- Test: `packages/web/src/__tests__/offer.test.tsx`, `session-actions.test.tsx`

**Interfaces:**

- Consumes: task 5's mutations `session.toChange`, `feature.promote`, `feature.drop`,
  `session.rename`, `session.archive`.
- Produces: `OfferCard({ kind, proposal?, reason?, session, isLatest })`.

- [ ] **Step 1: Write the failing tests**

`offer.test.tsx`:

- "Start the change from the agent's offer": an agent message with a ` ```uraeda-offer change `
  block holding `# Login redirects twice` and its text; the card shows them, the slug
  `login-redirect`; "Start the change" calls `session.toChange` once (SC-001), and the page shows
  "Started as the change Login redirects twice, on change/2026-10-20-login-redirect".
- "Not now closes the card and writes nothing".
- "Start the change waits while the agent works": the button is disabled with "The agent is
  working".
- "only the latest offer has buttons".
- "a change offer in a feature's session reads as text".
- "a block still streaming reads as text" (review focus 6).
- "Make it a change opens the card with the first message".
- "a taken slug shows its message under the card".

`session-actions.test.tsx`:

- "a session's … holds Make it a change, Rename, Archive".
- "a change's … holds Make it a feature, Rename, Drop the change…".
- "Drop the change… asks first": the confirmation's exact title, body, and buttons; confirming calls
  `feature.drop`; "Keep the change" calls nothing.
- Replace "a feature's session has no Archive" and the footer Archive tests (ruling).

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/web/src/__tests__/offer.test.tsx packages/web/src/__tests__/session-actions.test.tsx`
- Expected: FAIL, `Unable to find role "button" and name "Start the change"`.

- [ ] **Step 3: Implement the actions and the card**

- [ ] **Step 4: Run the web suite**

- Run: `nix develop -c vp test --project uraeda-web && nix develop -c vp check`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-20-merge-chats/plan.md specs/2026-10-20-merge-chats/rulings.md
git commit -m "feat(merge-chats): a session's actions beside Send, and the agent's offer as a card"
```

## Task 11: A feature's sessions on its page

**Files:**

- Start from: [`NewSession.stories.tsx#FeatureSessions`](/packages/web/src/NewSession.stories.tsx)
- Create: `packages/web/src/feature/SessionsCard.tsx`
- Modify: `packages/web/src/feature/FeaturePage.tsx` (`NextAndAgent`, `FeatureBody`),
  `packages/web/src/views.ts` (`FeatureView.sessions`); remove `AgentCard.tsx` once its parts move
- Test: `packages/web/src/__tests__/feature-sessions.test.tsx`

**Interfaces:**

- Consumes: task 6's `FeatureRecord.sessions`, task 5's `session.new`.

- [ ] **Step 1: Write the failing tests**

- "a feature's page lists its sessions, latest first, with their sub-agents".
- "New session opens a session of the feature": `session.new` called with the folder, the page
  `/sessions/<id>` opens, the list then holds both.
- "Stop stops the working session".

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/feature-sessions.test.tsx`
- Expected: FAIL, `Unable to find role "heading" and name "Sessions"`.

- [ ] **Step 3: Implement the card**

- [ ] **Step 4: Run the web suite**

- Run: `nix develop -c vp test --project uraeda-web && nix develop -c vp check`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-20-merge-chats/plan.md
git commit -m "feat(merge-chats): a feature's page lists its sessions, with New session"
```

## Task 12: The skill: sessions, the offer, the in-place move, and the drop

**Files:**

- Modify: `skills/uraeda/SKILL.md` (rule 8, "chat" wording), `references/change.md` (starting a
  change from a session, the offer block, Upgrading in place, its commits and red flags),
  `references/projects.md` (Start as a change from the New page, Drop keeping the branch, Start a
  change as a feature), `references/spec.md` (Is the scope clear?), `references/cli.md`
  (`ura start <change> --feature`, its refusals), `references/implementation.md` and
  `references/conventions.md` ("chat" wording), `README.md` if it names chats or "New change"
- Test: `nix develop -c cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs`

- [ ] **Step 1: Rewrite the texts**

- Rule 8 becomes "In a session, offer a change for a code change": the offer is a fenced block,
  ` ```uraeda-offer change ` holding the proposal in the human's words with `# Title` first, or
  ` ```uraeda-offer feature ` holding the reason in a sentence. Start nothing without the human's
  yes; Uraeda shows the block as a card.
- Upgrading: offered in the session when the human is there, as a round "Make this change a
  feature?" otherwise, before or after the change's round. On yes, `ura start <change> --feature`,
  or by hand: relink **Now** on the default branch, `git branch -m change/<folder> <folder>`, move
  `specs/changes/<folder>` to `specs/<folder>`, set the decisions the change applied back to
  `proposed`, commit `chore(<slug>): upgrade to a feature`. The code stays. Remove the revert and
  merge procedure.
- Drop: remove the **Now** entry, remove the worktree when it has no changes, keep the branch, and
  give the human `git branch -D <branch>`.
- Replace "chat" by "session" where it means Uraeda's conversation.

- [ ] **Step 2: Check the skill**

- Run:
  `nix develop -c cargo run -q -p uraeda-cli -- check specs && nix develop -c cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs && nix develop -c vp check`
- Expected: PASS; `rg -n -w chat skills/uraeda` finds only generic uses.

- [ ] **Step 3: Commit**

```bash
git add skills README.md specs/2026-10-20-merge-chats/plan.md
git commit -m "docs(merge-chats): the skill offers moves in a session, moves a change in place, and drops"
```

## Task 13: Screenshots and the slow suites

**Files:**

- Create: `packages/web/scripts/merge-chats-shots.ts`
- Modify: `packages/web/scripts/screenshots.ts`, browser tests that pinned the old sidebar or
  `/changes/new` (`__browser__/new-change.test.tsx`, `change.test.tsx`, `layout.test.tsx`,
  `sidebar.test.tsx`)
- Write: `specs/2026-10-20-merge-chats/screenshots/*.webp`

- [ ] **Step 1: Update the browser tests to the new views**

- [ ] **Step 2: Run the browser suites**

- Run: `nix develop -c vp test --project desktop && nix develop -c vp test --project phone`
- Expected: PASS.

- [ ] **Step 3: Take and review the screenshots**

The sidebar, the New page's three kinds, a session with its offer and its actions, the drop
confirmation, and a feature's sessions, at both sizes and in both themes.

- [ ] **Step 4: Run the full validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-20-merge-chats
git commit -m "test(merge-chats): screenshots of sessions, the New page, and a feature's sessions"
```
