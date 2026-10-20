# Rulings: Merge chats and changes

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A dropped worktree says where it stays

- **Decision**: `Dropped.worktree` is an `Option<Left>`, the worktree's path with why it stays, not
  the plan's `Option<WhyLeft>`. Besides the spec's "Its worktree has uncommitted changes: it stays
  at <path>", the drop says "Its worktree is locked", "You are in its worktree", and "Its worktree
  is outside .worktrees/", each followed by ": it stays at <path>".
- **Rationale**: the spec's sentence names the path, and `WhyLeft::Changes` has none; the shared
  worktree step of `clean` already returns a `Left`. The other reasons are the ones `ura clean`
  leaves a worktree for, and the spec gives them no text.
- **Alternatives considered**: rebuilding the path as `.worktrees/<folder>` in the API: wrong for a
  worktree checked out elsewhere.
- **If wrong**: one field type and four sentences, in `actions/drop.rs` and `api/drop.rs`.
- **Where**: task 2, `crates/core/src/actions/drop.rs`, `crates/core/src/api/drop.rs`.

## R2: A drop commits the priorities only when they had no other change

- **Decision**: the drop removes the entry, then commits `PRIORITIES.md` alone, as "Add and commit"
  does: when the file had uncommitted changes before, or a hook refuses the commit, the removal
  stays written, uncommitted, for the commit bar. An item no entry links is dropped without a
  commit.
- **Rationale**: the human's uncommitted edits to the priorities are work in progress, never
  committed by a tool on its own (`add_alone`'s rule); refusing the drop for them would block it
  over an unrelated edit.
- **Alternatives considered**: refusing the drop while the priorities have changes: blocks it for an
  edit that does not touch the entry; committing the whole file: commits the human's edits.
- **If wrong**: the drop's commit step, in `remove_entry` of `actions/drop.rs`.
- **Where**: task 2, `crates/core/src/actions/drop.rs`.

## R3: An item saved with a colour and no name leaves the list on read

- **Decision**: `repositories.json` is read with an item's `color` ignored, and an item left with no
  name is dropped as the file is read, so the next write of the list removes both.
- **Rationale**: [data-model.md](data-model.md) says a colour is "ignored once read, dropped at the
  next write". An item that only held a colour holds nothing once its colour is ignored; keeping it
  would write an empty `{}` entry for it forever. Task 3,
  [`repositories.rs`](/crates/core/src/repositories.rs) `load`.
- **Alternatives considered**: keeping such items as empty entries, which `set_item` already refuses
  to write for an item without a name.
- **If wrong**: an empty entry has no meaning to any reader; undo by removing the `retain` in
  `load`.
- **Where**: task 3.

## R4: The colour cases of the item settings tests change into name-only cases

- **Decision**: the human asked for colours to go (spec, US1 more 3), so the tests that checked a
  colour change, each keeping its name case:
  - `crates/core/tests/repositories.rs`: `a_name_and_a_colour_are_kept_by_folder` becomes
    `a_name_is_kept_by_folder`, the stored JSON holding the label alone; `an_empty_name_removes_it`
    loses its step that set an empty name with a colour kept, since an empty name now always removes
    the item.
  - `packages/binding/repositories.test.ts`: "an item's name and colour are read back with its
    repository" becomes "an item's name is read back with its repository".
  - `packages/server/src/__tests__/repositories.test.ts`: `item.settings` is sent and read back with
    a label alone.
  - `packages/web/src/__tests__/feature-settings.test.tsx`: "a name and a colour rename the card"
    becomes "a name renames the card", and checks the dialog has no "Colour" radio list instead of
    picking "Purple".
- **Rationale**: no colour is left to set or read; the name and per-repository cases still hold. The
  new core test "a colour saved before is ignored and dropped" covers a colour already on disk.
- **Alternatives considered**: deleting the tests whole, which would drop the name cases they also
  check.
- **If wrong**: colours come back with their field, enum, and these tests from git history.
- **Where**: task 3.

## R5: "A feature has one session" is replaced, and the get-or-create is one transaction

- **Decision**: The cache test "a feature has one session" is replaced by "a folder holds several
  sessions, latest first", since US5 gives a change or a feature several sessions. With the unique
  index gone, `Sessions.featureSession` no longer catches a unique-index race: it reads the latest
  session and creates one when there is none in one `BEGIN IMMEDIATE` transaction.
- **Rationale**: The old test pins the index the spec removes. Without the index, two servers
  creating a feature's first session at once would make two; a write transaction taken before the
  read serializes them, as `claimSession` does.
- **Alternatives considered**: Keeping the catch: nothing throws anymore, so it would never run.
- **If wrong**: Two first sessions of one folder; `latestSession` still picks one. Undo by reverting
  `featureSession` in `runner/sessions.ts`.
- **Where**: Task 4, `packages/server/src/runner/__tests__/cache.test.ts`,
  `packages/server/src/runner/sessions.ts`.

## R6: Tests that pinned the old addresses now use the new ones

- **Decision**: the tests and screenshot scripts that opened or expected `/chats/<id>`,
  `/chats/new`, or `/changes/new` use `/sessions/<id>`, `/new`, and `/new?kind=change`. Unit:
  `decisions-check`, `links` (its page list, and its address check now compares the query too),
  `new-change`, `routes` (`/changes/new` left `parseRoute`'s table for the redirect test),
  `session-actions`, `session-aside`, `session-cost`, `session-tail`, `session`, `shell`, `triage`,
  `writes`. Browser: `helpers`, `layout`, `new-change`, `session`, `story-chat`. Scripts:
  `change-shots`, `image-shots`, `session-look-shots`, `sessionShots`. `notify.test.tsx` keeps
  `/r/<name>/chats/<id>`: it checks the server's href, task 6's, opened without the app.
- **Rationale**: the spec moves sessions to `/sessions/<id>` and the New page to `/new` (US1 more 2,
  US3); the old addresses still open through the redirect, which `routes.test.ts` covers once.
- **Alternatives considered**: keeping the old paths in tests that only render a page: they would
  pass through the redirect, but would test an address no link builds any more.
- **If wrong**: a search and replace of the paths.
- **Where**: task 7.

## R7: The New page's kind is part of the route, and old addresses are a `moved` route

- **Decision**: `parseRoute(pathname, search)` reads `?kind=` into `{ page: "new"; kind }`, Session
  for none or an unknown kind; `useRoute` passes the deferred query. `/chats/<x>` and `/changes/new`
  parse to `{ page: "moved"; path }`, which `App`'s `Moved` replaces with `redirect`, keeping the
  hash, as `RunRedirect` does. The sidebar's "＋" rows compare the path with its query, so "New
  chat" (`/new`) and "New change" (`/new?kind=change`) are not both selected.
- **Rationale**: the plan names `{ page: "new"; kind }`, which needs the query in the route; one
  `moved` route keeps each old address's target in `routes.tsx`, beside the parsing.
- **Alternatives considered**: reading the kind with `useSearch` inside the page: the route type the
  plan names would then lie about what draws.
- **If wrong**: local to `routes.tsx` and `App.tsx`.
- **Where**: task 7.

## R8: The move checks the change's worktree alone, and names it

- **Decision**: `ura start <change> --feature` refuses uncommitted changes in the change's worktree
  only, with "cannot move: the change's worktree <path> has uncommitted changes in <files>", the
  path from the main checkout. The main checkout's edits never refuse it. The test
  `uncommitted_changes_in_the_changes_worktree_are_refused` expects this message instead of start's
  "cannot start: uncommitted changes in README.md".
- **Rationale**: the plan requires a clean worktree only; the default branch's commit stages
  `PRIORITIES.md` alone, and `Git::commit` refuses other staged files. Start's message named neither
  the action nor the working tree, and the human may have two.
- **Alternatives considered**: keeping start's `check_clean` on both: refuses the move over an
  unrelated edit in the human's checkout.
- **If wrong**: `check_worktree` in `actions/promote.rs`.
- **Where**: wave 1 review, `crates/core/src/actions/promote.rs`.

## R9: A move whose feature name is taken says to rename or remove it

- **Decision**: `ura start <change> --feature` refuses a taken `YYYY-MM-DD-<slug>` with "<folder>
  exists: rename or remove that branch or folder first". `check_free` takes the hint as a parameter;
  start keeps "choose another slug with --slug". The test `a_taken_name_is_refused` expects the new
  message.
- **Rationale**: clap rejects `--slug` with `--feature`, and the move keeps the change's folder
  name, so start's hint pointed at an option the move does not have.
- **Alternatives considered**: accepting `--slug` with `--feature`: renames the folder, which the
  spec's in-place move does not do.
- **If wrong**: the hint string in `actions/promote.rs`.
- **Where**: wave 1 review, `crates/core/src/actions/promote.rs`, `actions/start/plan.rs`.

## R10: A typed change starts over the main checkout's uncommitted changes

- **Decision**: any start from a typed text, of a change or a feature, as `session.toChange` and the
  New page start one, refuses only staged files other than `PRIORITIES.md`, not uncommitted changes
  in the main checkout. A draft's start keeps refusing them. New core test
  `a_typed_text_starts_over_uncommitted_changes_elsewhere`.
- **Rationale**: US2 2 starts the change while the session's edit to `src/auth/guard.ts` and the
  human's to `README.md` are uncommitted in the main checkout, and the skill says to leave every
  other uncommitted file where it is. A typed start writes its proposal in its own new folder and
  commits that folder with `PRIORITIES.md` alone on the default branch, as the default branch's
  start does since the catch-up, so the main checkout's edits are neither carried nor touched.
  Without it, a session that edited a file could never become a change.
- **Alternatives considered**: a flag for the move alone, through the API and the binding: a second
  rule for the same typed start, and the New page would still refuse a start the move allows.
- **If wrong**: the `Origin::Text` arm of `Start::plan` in `crates/core/src/actions/start/plan.rs`.
- **Where**: task 5, `crates/core/src/actions/start/plan.rs`, `crates/core/tests/actions.rs`.

## R11: The tests of a fresh run in the same session follow the new session

- **Decision**: a fresh run now starts a new session of the folder (US5 2), so the tests that pinned
  a new agent session inside the same session change:
  - `runner/__tests__/sessions.test.ts`: "a fresh workflow run starts a new agent session in the
    feature's session, which says so" becomes "a fresh run starts a new session of the feature"; "a
    fresh workflow run queued after a chat turn starts its new agent session once it ends" becomes
    "a queued turn waits for the other session"; "a queued turn ended by %s while its process
    reopens does not start" sends its run with `fresh: false`, to stay in its session.
  - `runner/__tests__/tokens.test.ts`: "a fresh agent session starts from zero, and its resumed
    process from its own turns" counts the new session's tokens instead; "a fresh turn taken back
    while its process opens leaves its line to the next turn" becomes the same case for a gone
    transcript, whose `REPLACED` line is the only one left to pass on.
  - `__tests__/sessions.test.ts`: "session.send with a fresh workflow message starts a new agent
    session in the same session" becomes "…answers with the new session it started".
- **Rationale**: the data model says `native_id` is "no longer replaced for a fresh step, which
  starts a new session instead". Each test keeps its case: the token baseline of a new agent
  session, a line left by a taken-back turn, and the setting that decides a fresh run.
- **Alternatives considered**: deleting them: the token and taken-back cases still hold.
- **If wrong**: the tests come back from git history with the in-session fresh run.
- **Where**: task 5.

## R12: A fresh run sent while its session works waits behind it in the new session

- **Decision**: a fresh run sent to a session whose turn runs or waits is queued in the new session
  it starts, and starts once the other session is idle. Any other message to a session of a folder
  where another session works is refused with "Another session of this feature is working".
- **Rationale**: before, that run was queued in its session, after the turn running; the human sent
  it to that session, not beside it. US5 3's refusal covers a human writing in an idle session while
  another works.
- **Alternatives considered**: refusing it as any other message: "Next" would fail while the agent
  answers a question, where it used to wait.
- **If wrong**: the `behind` argument of `deliver` in `runner/send.ts`.
- **Where**: task 5, `packages/server/src/runner/send.ts`.

## R13: A done session is an idle one, and a blocked session's address is `/sessions/<id>`

- **Decision**: `SessionRowRecord.done` is true for a session without a folder whose latest turn
  ended and whose status is idle. Idle already means it was seen since its last turn ended (a later
  end reads "New reply"), and it also leaves out a failed or stopped last turn, which reads "Needs
  attention" however read. The needs-you test "a blocked chat is listed…" expects the href
  `/r/<name>/sessions/<id>`, and `notify.test.tsx`'s chat row, the server's row written by hand,
  uses that href too; both keep the row's ID, `<name>/chats/<id>`, which no address reads.
- **Rationale**: the spec says a session is done once read to its last message; a failed run asks
  for the human's attention, so it stays in the list. The plan moves the server's hrefs to
  `/sessions/<id>` (US1 more 2), and R6 left `notify.test.tsx` on the old href for this task.
- **Alternatives considered**: the plan's wording, "not working or waiting on the human": a read
  failed run would leave the list while it reads "Needs attention".
- **If wrong**: `sessionDone` in `runner/status.ts`, one comparison.
- **Where**: task 6, `packages/server/src/runner/status.ts`, `fate/needs-you.ts`.

## R14: The sidebar's old sections' tests follow one Sessions list, and Done dates a feature by its folder

- **Decision**: one Sessions section replaces Changes, Features, and Chats (US1), and every card's
  name says its kind, so the tests that pinned the old sections change, each keeping its case:
  - `web/__tests__/sidebar.test.tsx`: the flow's order ends with "＋New", then the cards, instead of
    "＋New change" and "＋New chat"; the Needs you card's exact name gains "feature"; "a change
    under Needs you says it is a change" checks its name and that no "Change" badge shows, the
    wrench telling it; three tests wait for the "Sessions" group instead of "Features".
  - `shell.test.tsx`: US4.1 clicks "New" and finds the session under Sessions; US4.3's Archived
    group is under Sessions; US2.1's exact name gains "feature".
  - `usage.test.tsx`: the allowance closes the Sessions section, not Features.
  - `repositories.test.tsx`: a missing folder's page has no Sessions group, instead of no "Features"
    navigation, a name no element had.
  - `cards.test.ts`: `byStep` and its cases go with the workflow-ordered sections; `byStart` and
    `startOf` replace them. The Done area orders a session by its last turn and a merged change or
    feature by its folder's date, the only date the client has for it, the latest first. A session
    needing the human sits under Needs you with the features, as the tab's title already counts it.
- **Rationale**: the spec orders Done latest first, and US1 2's change merged at 09:00 has no date
  in the workspace's records; its folder's date sorts before any session of that day. Needs you is
  what needs the human, whatever the kind, which the server's list already counts.
- **Alternatives considered**: a merge date read from git for every done item: a git read per item
  on every sidebar draw, for a list of five rows. Listing sessions before features in Done: a
  month-old read session would hide today's merge.
- **If wrong**: the `date` of `doneRows` in `sidebar/done.ts`; the Needs you filter in
  `sidebar/Sidebar.tsx`.
- **Where**: task 8.

## R15: A move or a drop holds its sessions through the core's call

- **Decision**: `feature.drop` and `feature.promote` hold the folder, and `session.toChange` the
  session, from the check that no session of it works until the core's call (and, for `toChange`,
  the attach) returns. A message sent to one of its sessions meanwhile is refused with "The agent is
  working", checked as the send starts and again just before its turn starts. A session whose turn
  is starting counts as working for these checks, as it does for another session's send.
- **Rationale**: the core moves or removes the worktree the sessions work in; a turn started during
  the call would open in a worktree that moves or goes. The refusal is the one the move gives while
  the agent works, since the human sees the two the same way.
- **Alternatives considered**: queuing the message until the move ends: the session may no longer
  exist as a change, or be archived, once it ends.
- **If wrong**: `Sessions.hold`, `LiveSessions.hold` and `moving`, and the `unmoved` checks of
  `deliver` in `runner/send.ts`.
- **Where**: review of tasks 5 and 6, `packages/server/src/fate/session-moves.ts`,
  `packages/server/src/runner/sessions.ts`, `packages/server/src/runner/live-sessions.ts`,
  `packages/server/src/runner/send.ts`.

## R16: A feature's status is its latest session's, and only the latest halts

- **Decision**: `featureStatuses` takes the folder's latest session's status, and raises it to an
  older session's only when that one works or is blocked by an action to allow. An older session's
  failed, stopped, halted, or unread state stays on its own row. A run that ended while the step
  still waits on the agent reads "Needs attention" (halted) in the latest session only:
  `sessionStatus` takes `latestSession`, false for an older session of the folder, which then reads
  idle. The test "a feature's status is its most urgent session's" becomes "a feature's status is
  its latest session's, raised by an older one blocked", its case unchanged.
- **Rationale**: the folder's runs go to its latest session (US5). With the most urgent status, an
  older session's stale failure or halted run made the feature "Needs attention", and notified,
  after every fresh run that started a new session, and an older session read halted because the
  step waits on the agent while another session works on it. A blocked action and a working agent
  still matter whichever session holds them.
- **Alternatives considered**: the most urgent of every session (task 6's text): flags features the
  human already moved on from.
- **If wrong**: the reduce in `featureStatuses` (`fate/sessions.ts`), and `latestSession` in
  `sessionStatus` (`runner/status.ts`).
- **Where**: review of task 6, `packages/server/src/fate/sessions.ts`,
  `packages/server/src/runner/status.ts`.

## R17: The New change tests move to the New page, and the pages' waits change text

- **Decision**: `__tests__/new-change.test.tsx` becomes `__tests__/new-page.test.tsx`, its four
  cases kept as they were, beside the New page's. `/new` draws the New page, whose heading is "New":
  the waits for "New chat" or the heading "New change" now wait for the Session sentence's "It
  offers a change when the work grows.", "Describe the bug or the change.", or the heading "New", in
  `__tests__/links.test.ts`, `__browser__/layout.test.tsx`, `__browser__/new-change.test.tsx`, and
  the screenshot scripts `image-shots.ts`, `sessionShots.ts`, and `session-look-shots.ts`. The
  layout case "a new chat" is "a new session". `SessionPage`'s `newChat` page goes: nothing draws
  it.
- **Rationale**: the plan moves the cases; the other tests checked the page at `/new`, which is now
  the New page with Session picked, and only the text they wait for changed.
- **Alternatives considered**: keeping a "New chat" heading on the New page: the spec's mockup has
  one heading, "New".
- **If wrong**: the texts the tests wait for, one line each.
- **Where**: task 9.

## R18: A feature's session is titled by its own title, else its first run's step

- **Decision**: the session record gains `name`, its own title (a chat's, kept once it became a
  change's or a feature's, null for a session started in one), and `startedAt`, its start. The
  sessions card titles a session by its `name`, else by its first turn's step label when that turn
  is a workflow run ("Plan"), else "Session", and shows its start, "Oct 17, 10:02", beside it.
- **Rationale**: a feature's session's `title` is its feature's, the same for every session of the
  list; the step of its first run says what it was started for, as the mockup's "Spec and plan" and
  "Build: tasks 4 to 7" do, and its start tells two plain sessions apart.
- **Alternatives considered**: "Session of <date>": repeats the start beside it; changing `title`
  for a feature's session: the session page's header and the sidebar read it as the feature's.
- **If wrong**: `SessionItem` and `TitledByTurn` in `feature/SessionsCard.tsx`, and the two fields
  of `SessionRecord`.
- **Where**: task 11, `packages/server/src/fate/views.ts`, `fate/sessions.ts`,
  `packages/web/src/feature/SessionsCard.tsx`.

## R19: The sessions card replaces the agent's card, and the tests that pinned it follow

- **Decision**: the feature page's "Agent" card is gone: its status, Stop, the task's progress, the
  last run, and the agent's absence move into the "Sessions" card, per session (status, Stop) or for
  the latest (progress, last run). A session's link replaces "Open the session": the latest's opens
  `/f/<folder>/session`, the feature's session that "Next" hands runs to, and an earlier one's its
  own page, `/sessions/<id>`. A feature without a session reads "No session yet." beside "New
  session", which is hidden when the agent is not on this machine. Its status is the session's own,
  as the sidebar shows it, so a session waiting on the human reads "Needs you" where the card read
  "Idle".
- **Tests changed**: `feature-page.test.tsx` ("an idle agent reads Idle" becomes "a feature without
  a session lists none, and offers New session"; "exactly one Open the session" becomes "exactly one
  New session"; the run tests read the status mark and click the session's link),
  `session-turns.test.tsx` (the card's "Idle" becomes the "Needs you" mark), `session.test.tsx`
  (US1.8 opens a session's link), `session-aside.test.tsx` (a new visit goes by the session's path,
  the feature having no session to link); the browser tests `feature.test.tsx`, `change.test.tsx`,
  `layout.test.tsx`, and `session.test.tsx` read the "Sessions" card, "New session", or the
  session's link, or open `/f/<folder>/session` directly; the screenshot `agent-section` becomes
  `sessions-card`.
- **Rationale**: US5 lists each session with its status and Stop for a working one; two cards for
  one agent would say it twice. `/sessions/<id>` draws a feature's session as a chat, without its
  progress and its workflow's composer, so the latest keeps the feature's session page.
- **If wrong**: `feature/SessionsCard.tsx` and `NextAndSessions` in `FeaturePage.tsx`.
- **Where**: task 11.

## R20: A change from an inbox note starts from its text, and the note leaves the inbox in its own commit

- **Decision**: "Start the change" on an inbox note calls one mutation,
  `change.fromNote({ hash, note, slug? })`: the note's text, then its nested lines, start a typed
  change (`startChange`, so only staged files refuse, R10); then the note leaves `INBOX.md`,
  committed alone when the file had no other change (new core API `remove_note_and_commit`, binding
  `removeNoteAndCommit`, subject `chore: remove "<note>" from the inbox`); then the change's first
  run is sent, as `change.start` sends it, and its session opens. A refused start leaves the note in
  the inbox. The New page test "a change from an inbox note" now commits the fixture's note and line
  in `startingRepo`, leaves an unrelated edit uncommitted, and checks the run sent and `INBOX.md`
  committed; "a change from a note that cannot start keeps the note" is new.
- **Rationale**: the note went through `inbox.toNewDraft`, which writes `INBOX.md` and
  `PRIORITIES.md` uncommitted, then `feature.start`, whose draft start refuses uncommitted files: a
  committed note was always refused, and lost from the inbox. The test passed only because its note
  was uncommitted. US3 2 says the note's text is the proposal, with no draft.
- **Alternatives considered**: committing the draft before the start: a draft and a Now line the
  human never asked for, and a refused start would leave them.
- **If wrong**: `startFromNote` in `packages/server/src/fate/change-starts.ts`.
- **Where**: review of task 9, `crates/core/src/actions/inbox.rs`,
  `packages/server/src/fate/change-starts.ts`, `packages/web/src/useStartFrom.ts`.

## R21: A change from a priority line starts with its agent at work

- **Decision**: "Start the change" on a priority line drafts it when it links no draft, then calls
  `change.startDraft({ draft, slug? })`, which starts the draft as `feature.start` with kind change
  does, then sends the change's first run as `change.start` does, a run that cannot be sent logged
  (R12). The page opens the change's session, and hands its message over unsent only when no run was
  sent (`session` null), as `NewChangePage.tsx` does. New tests: the server's "change.startDraft
  starts the draft as a change and sends its first run", and the New page's "a change from a
  priority line".
- **Rationale**: `feature.start` sends no run, so a change from a line opened with its message
  unsent, one more click than SC-004's two, and unlike a typed change or a note's, whose agent
  starts working.
- **Alternatives considered**: a `send` flag on `feature.start`: a feature's start would carry an
  input it never uses.
- **If wrong**: `startDraft` in `packages/server/src/fate/change-starts.ts`.
- **Where**: review of task 9, `packages/server/src/fate/change-starts.ts`,
  `packages/web/src/useStartFrom.ts`.

## R22: An archived session leaves the sidebar's list, and search still finds it

- **Decision**: the sidebar's Sessions section has no "Archived" group. Outside a search, an
  archived session is in neither the list nor Done; a search lists it among the sessions it finds,
  with Unarchive in its "…". The shell test US4.3, which opened the "Archived" group (R14), now
  checks that no such group shows, that searching "open draft" finds the archived chat, and that a
  message still brings it back to the list.
- **Rationale**: the spec's Assumptions say Archive "leaves Done and the list, and search still
  finds it"; the group kept it in the list, one click away.
- **Alternatives considered**: keeping the group collapsed: the list would still hold it.
- **If wrong**: the session filter of `entriesOf` in `packages/web/src/sidebar/Sidebar.tsx`.
- **Where**: review of task 8, `packages/web/src/sidebar/Sidebar.tsx`.

## R23: A start refused or failed on the New page leaves its files, and says why

- **Decision**: "Write the proposal" inserts the title in Now, then drafts it; when the draft is
  refused, the line is removed again (`priorities.remove`, over the hash the insert returned), the
  draft's refusal is shown, and the title stays typed. Any start whose read or call rejects, as a
  network failure, shows its error in the page's refusal banner instead of escaping to the error
  boundary. New tests: "a feature from a title whose draft cannot be written leaves Now as it was"
  and "a start whose read fails shows why".
- **Rationale**: the refused draft left an uncommitted Now line the human never saw added, and the
  title was cleared; a rejected read threw out of the click, and the page showed nothing useful.
- **Alternatives considered**: inserting and drafting in one server call: a new mutation for a case
  the two existing ones undo.
- **If wrong**: `titleDraft` and `run` in `packages/web/src/useStartFrom.ts`.
- **Where**: review of task 9, `packages/web/src/useStartFrom.ts`, `packages/web/src/NewPage.tsx`.

## R24: The sidebar's SC-005 and Done tests check each card's row and US1 2's day

- **Decision**: the sidebar test "each card has its status and its … in its row" names the cards it
  expects, `cli-tuis` and "Why is CI slow?", finds each link by role, its status by its `img` role
  and name inside the link, and its "…" by role inside the link's row, the row holding no other
  button; it reads no `aria-label` or `textContent`. `done.test.ts`'s "Done lists a session read to
  its end, then a merged change" uses US1 2's day, the session read at 10:00 and `ctrl-enter` merged
  on 2026-10-19, with a session read the day before, which a "sessions before features" order would
  put second. New test "a reply brings a done session back under Sessions, at its place" (US1 more
  1).
- **Rationale**: the SC-005 test searched the whole group for a button named after a label it read
  from the card's `aria-label`, so a "…" drawn outside its row passed; the Done test's change was
  older than its session, so ordering by kind passed too.
- **Alternatives considered**: a role on the card's row: the row is Astryx's, and a new role would
  change the navigation's tree for every other test.
- **If wrong**: the tests alone.
- **Where**: review of task 8, `packages/web/src/__tests__/sidebar.test.tsx`,
  `packages/web/src/__tests__/done.test.ts`.

## R25: A new session's live update is checked by the server; the web test reads the page again

- **Decision**: `session.new` publishes a session change with its folder, as `attach` does, so an
  open feature's page is sent its new session. The server test "a new session of a feature reaches a
  subscribed feature" checks it. The web test "New session opens a session of the feature" stays in
  one app: it presses New session, goes back with the browser's history, and reads the page again
  with `refreshUntil` until the card lists both sessions, instead of rendering a second app.
- **Rationale**: the second `renderPage` left two apps mounted, and failed under load without a bug.
  happy-dom has no `EventSource`, so live updates never reach the web tests: no web test can fail
  without the live update, and the server's tests check it, as `helpers.tsx` says.
- **Alternatives considered**: the client adding the new session to the feature from the mutation's
  result: a second path for what the live update already sends every open page.
- **If wrong**: the web test alone.
- **Where**: review of task 11, `packages/server/src/runner/sessions.ts`,
  `packages/server/src/__tests__/session-moves.test.ts`,
  `packages/web/src/__tests__/feature-sessions.test.tsx`.

## R26: Archive moves into the session's "…", and its footer tests become the "…"'s

- **Decision**: the composer's footer loses Archive and Unarchive: they are items of the session's
  "…", "Session actions", beside Send. The tests "US4.1: Archive is in the composer's footer…",
  "US4.2: an archived chat reads Unarchive in the footer", "US4 more 1: a feature's session has no
  Archive", and "Edge: Archive pressed while the session works archives it" are replaced by "a
  session's … holds Make it a change, Rename, Archive", "Archive in a session's … archives it, and
  Unarchive brings it back" (pressed while the session works), and "a feature's … holds Rename and
  Drop the feature…". `shell.test.tsx`'s "US4.3: an archived chat leaves the list…" archives and
  reads Unarchive through the "…"; `session-aside.test.tsx`'s chat tests wait for the "…" instead of
  Archive, and "a chat on the phone has no progress line" looks for toggles between the header and
  the composer's field, the "…" being after it. `feature-sessions.test.tsx`'s "New session opens a
  session of the feature" reads its list again with `refreshUntil`: the new session's page, still
  drawn, now reads its feature's column, and the list's one wait timed out under the full suite.
- **Rationale**: the spec puts a session's actions in the "…" beside Send, Archive among them for a
  session without a workflow; the footer tests asserted the place it leaves.
- **Alternatives considered**: keeping Archive in the footer too: two places for one action.
- **If wrong**: `SessionActions.tsx` and `footerActions` in `ComposerSend.tsx`.
- **Where**: task 10, `packages/web/src/__tests__/session-actions.test.tsx`.

## R27: The menu's moves open their card, and a session's own name titles its page

- **Decision**: "Make it a feature" in a change's "…" opens the feature's card at the session's end,
  as "Make it a change" opens the change's, with "Make it a feature" and "Keep it a change"; it does
  not move at once. "Rename" opens the sidebar's Rename dialog. Every session's page title renames
  in place, and shows the session's own name once it has one, else its change's or feature's title.
  The card's slug is the core's proposal for the proposal's title: "Login redirects twice" gives
  `login-redirects`, which the tests expect, not the plan's `login-redirect`.
- **Rationale**: the move renames a branch, so it gets the same one-click confirmation as the
  change's; a rename of a feature's session sets its name, which its page would not show otherwise.
  The slug is proposed by the core, whose rule the tests do not restate.
- **Alternatives considered**: promoting from the menu at once: a branch renamed by a stray tap.
- **If wrong**: `SessionActions.tsx`, `SessionOffers.tsx`, and the header's title in
  `SessionPage.tsx`.
- **Where**: task 10, `packages/web/src/SessionActions.tsx`, `packages/web/src/SessionPage.tsx`.

## R28: An offer's card draws only from a closed block in an ended message

- **Decision**: a message's last closed `uraeda-offer` block draws as the card, once the message
  ended, when it applies to the session: a change offer in a session without a workflow, a feature
  offer in a change's session. Of those, only the latest message's has the card; every other block,
  and one closed with "Not now" or "Keep it a change", reads as a code block. "Not now" lasts while
  the page is open. The lines a move leaves, "Started as the change …", a made feature's, and a
  drop's, with the worktree it left, show at the session's end, kept for the page, since the session
  draws again as its change's.
- **Rationale**: review focus 6, and the spec's edge cases; the session's page changes layout once
  it has a change, so the line cannot live in the card.
- **Alternatives considered**: drawing earlier offers as cards without buttons: the spec says they
  read as text.
- **If wrong**: `offers.ts` and `SessionOffers.tsx`.
- **Where**: task 10, `packages/web/src/SessionOffers.tsx`, `packages/web/src/offers.ts`.

## R29: A drop that commits nothing says so, without naming why

- **Decision**: when the drop's result says its priorities were not committed, the session's end
  adds "The priorities were not committed: if Now listed it, its entry’s removal waits in
  specs/PRIORITIES.md." The "Dropped the change …" line names the branch the server kept.
- **Rationale**: the core's `committed` is false in three cases it does not tell apart: the
  priorities held the human's own edits (R2), a hook refused the commit, or no entry linked the
  item, so nothing was removed. One sentence true in all three avoids a wider result for a rare
  case.
- **Alternatives considered**: telling the cases apart in the core's `DroppedView`: a binding and
  server change for a line the commit bar already backs up.
- **If wrong**: `useDrop` in `packages/web/src/SessionActions.tsx`, and `committed` in
  `crates/core/src/actions/drop.rs`.
- **Where**: review of task 10, `packages/web/src/SessionActions.tsx`.

## R30: A second start with the host token waits a minute for the starting server

- **Decision**: `handOff` waits 2 seconds for an answer on a port without a host token, and a minute
  with one. "a second start during the first's start waits for it" waits for the token until the
  first start writes it, or exits: since the second catch-up, through the default branch's `until`,
  which fixed the same wait, so this branch's own `written` helper went.
- **Rationale**: the test failed twice under load, at each of its two timing assumptions. The poll
  gave the first process 1 second to load its binding and take the port. And the handoff gave the
  starting server 2 seconds to answer, which `startServer` passes on a loaded machine: a second
  start then said the port was "used by another program", the follow-up `run-ui` left. The token is
  written by the data folder's own server as it takes the port, so a port with one is that server's.
- **Alternatives considered**: no deadline with a token: a token a killed server left, on a port a
  program then holds without answering, would hang the start. A "starting" answer the second start
  asks again after: a protocol change for the same result.
- **If wrong**: `packages/server/src/open-client.ts`.
- **Where**: `packages/server/src/open-client.ts`, `packages/server/src/__tests__/main.test.ts`.

## R31: The inbox's drags drop once the note is drawn where it goes

- **Decision**: the inbox's mouse drags measure their target once the page is laid out, fonts loaded
  and animations ended, and drop once the page draws the note at its place in the target category,
  not once its drag is announced.
- **Rationale**: "a note drags within its category" failed once under load with the inbox unchanged.
  The announcement of a drag's start says nothing of where it is over: dnd-kit takes pointer moves
  and finds where the note is over in later frames, and a drop before then moves nothing. A point
  measured while the page still settles may also land on another line. The order the page draws
  during a drag is the order the drop writes, as the priorities' drag test waits for a line to make
  room.
- **Alternatives considered**: waiting for the "Moved:" announcement: dnd-kit debounces it by 500 ms
  and computes it beside the order, not after it.
- **If wrong**: `drag` in `packages/web/src/__browser__/inbox.test.tsx`.
- **Where**: `packages/web/src/__browser__/inbox.test.tsx`.

## R32: The browser tests follow the one Sessions list and the New page

- **Decision**: `new-change.test.tsx` reaches a change's composer by the sidebar's "＋ New" and
  Change, not a "New change" row, and waits for the change's line before typing; `layout.test.tsx`'s
  folded navigation has no "New" row, where it had no "New change". `change.test.tsx`'s sidebar test
  finds the change's card in the one Sessions section, and a feature's card naming its kind, as
  `cardName` does for every card. The layout check lets a session's title in the phone's drawer be
  cut by an ellipsis, as it already did beside the page: the drawer has no `nav`. The feature page's
  accessibility test runs once per theme: its ten pages, each reading its sessions now, took longer
  than one test's 30 s. The New page's notes and lines are a wrapping link and their button, not a
  sidebar row: the row cut their text on a phone, and its link was under 44 px.
- **Rationale**: US1 and US3 of the spec; the UI layout decision's checks, which the cut text and
  the short tap area failed at 402 px.
- **Alternatives considered**: raising the feature test's timeout: one theme's failure would then
  hide the other's.
- **If wrong**: the tests named, `checkPage` in `__browser__/helpers.tsx`, and `Lines` in
  `NewPage.tsx`.
- **Where**: task 13, `packages/web/src/__browser__/`, `packages/web/src/NewPage.tsx`.

## R33: A merged change is done for the move once its branch is gone

- **Decision**: `a_done_change_is_refused` removes the change's worktree and deletes its branch
  after the merge, then expects the "is done" refusal. Changing an existing test, after the catch-up
  with the default branch.
- **Rationale**: the default branch's `fix(start): commit the proposal on main with the start` makes
  a dated folder on the default branch its branch's while the branch exists, locally or on `origin`:
  it reads as merged only once the branch is gone, and a finish writes the record before the merge.
  A merged change with its branch still there now reads as the branch's, in flight, so the old setup
  no longer reached the refusal.
- **Alternatives considered**: refusing the move for any change merged into the default branch,
  branch or not: a second meaning of "merged", against the default branch's.
- **If wrong**: the test, in `crates/core/tests/promote.rs`, and the `StepName::Done` check of
  `promote::run`.
- **Where**: the catch-up, `crates/core/tests/promote.rs`.

## R34: The move takes the change's folder on the default branch with the entry

- **Decision**: the in-place move's default-branch commit,
  `chore(<slug>): start <name> as a feature`, moves `specs/changes/<folder>/` to `specs/<folder>/`
  there with the **Now** relink, in one commit, when the default branch has the folder. Uncommitted
  changes to that folder on the default branch refuse the move, before anything is written; a
  refused commit moves the folder back. A move run again after its first commit, the feature's
  folder and entry already on the default branch, checks only that the feature's branch name is
  free. The done-list's first item names the folder's move. New core tests
  `the_folder_on_main_moves_with_the_entry` and
  `uncommitted_changes_to_the_folder_on_main_are_refused`;
  `uncommitted_changes_in_the_main_checkout_stay` and
  `a_failed_commit_reports_what_is_done_and_left` now expect the folder in the commit and in the
  done-list, and `a_refused_relink_renames_nothing` checks the folder moved back. The skill's
  by-hand move, in `change.md`, and `cli.md`'s refusals say the same.
- **Rationale**: since the default branch's
  `fix(start): commit the proposal on main with the start`, a start commits the change's folder on
  the default branch with its entry. Relinking the entry alone would leave it linking a folder the
  default branch does not have, the broken link that fix removed, and a change folder there whose
  branch no longer exists, which reads as merged.
- **Alternatives considered**: leaving the default branch's folder for the merge to move: the entry
  links a missing folder until then.
- **If wrong**: `check_on_default` and `Move::relink` in `crates/core/src/actions/promote.rs`.
- **Where**: the catch-up, `crates/core/src/actions/promote.rs`, `crates/core/tests/promote.rs`,
  `skills/uraeda/references/change.md`, `skills/uraeda/references/cli.md`.

## R35: The drop removes the item's folder on the default branch with its entry

- **Decision**: the drop's commit on the default branch, `chore(<slug>): drop <name>`, removes the
  item's folder there, `specs/changes/<folder>/` or `specs/<folder>/`, with the **Now** entry, in
  one commit, under R2's rule: when `PRIORITIES.md` had other changes, both removals stay
  uncommitted. An item with a folder there and no entry is dropped the same way, named by its slug.
  Uncommitted changes in that folder refuse the drop, before anything is written: they would be lost
  with it. New core tests `dropping_a_change_removes_its_folder_on_main` and
  `uncommitted_changes_to_the_folder_on_main_are_refused`; `a_feature_is_dropped_the_same_way` and
  `a_removal_beside_other_changes_is_not_committed` now expect the folder gone. The skill's by-hand
  drop, in `projects.md`, says the same.
- **Rationale**: since the default branch's
  `fix(start): commit the proposal on main with the start`, a start commits the item's folder on the
  default branch, and a folder there reads as the branch's while the branch exists, and as merged
  once it is gone. A drop that kept the folder would leave the dropped item reading as merged after
  the human deletes its branch.
- **Alternatives considered**: deleting the branch with the folder, as the default branch's
  `projects.md` said: the spec keeps the branch, so nothing is lost (`specs/decisions/git.md`).
- **If wrong**: `remove_from_default` and `check_folder` in `crates/core/src/actions/drop.rs`.
- **Where**: the catch-up, `crates/core/src/actions/drop.rs`, `crates/core/tests/drop.rs`,
  `skills/uraeda/references/projects.md`.

## R36: The default branch's focused-test helpers follow the branch's sessions and drop

- **Decision**: `sessionRecord` in `packages/web/src/__focused__/helpers.tsx` gives a session
  `name: null` and a `startedAt`, and the request fixture in
  `packages/server/src/__tests__/request-fixture.ts` serves `droppedDataView`. In the second
  catch-up, rebasing on the default branch's fix-testing and ui-sandbox merge.
- **Rationale**: the default branch added both helpers against its own `SessionRecord` and roots.
  This branch's sessions carry their own name and their start, as several sessions share a folder,
  and its drop adds the `Dropped` root. Without them the type check failed on `sessionRecord`, and
  `src/__focused__/composer.test.tsx` failed to load with "The request fixture has no data view for
  Dropped".
- **Alternatives considered**: none: both helpers mirror the server's types by design.
- **If wrong**: the two helpers.
- **Where**: the second catch-up, `packages/web/src/__focused__/helpers.tsx`,
  `packages/server/src/__tests__/request-fixture.ts`.

## R37: The branch follows the toolchain's fast check and its ready before the push

- **Decision**: since the second catch-up, the toolchain decision applies: `vp run fast` after each
  task, and `vp run ready` before the push. The branch's new tests need no registration. Ready finds
  them by its globs: the Rust tests `drop.rs` and `promote.rs` under cargo-nextest, the server's
  `src/**/*.test.ts`, the web's `__tests__`, and the browser's `src/__browser__/**/*.test.tsx`.
  Fast's families take the server's tests by glob. Its UI family lists only the focused tests, so a
  new application-journey test (`offer.test.tsx`, `new-page.test.tsx`, `feature-sessions.test.tsx`,
  `done.test.ts`, `offer-card.test.tsx`) makes fast ask for ready, as `selectFast` does for any new
  test outside a family. Fast ran on the catch-up's fixes (R36) and passed.
- **Rationale**: the default branch's `specs/decisions/toolchain.md` rules "after every task, fast
  MUST check…" and "an agent MUST run `vp run ready` before pushing a branch".
- **Ready before the push**: green. `vp run ready` passed on the rebased head, with nothing else
  running, before the push. Earlier runs had failed only in the browser tasks, on load-sensitive
  tests that fail on the default branch's `053924c7` too: `attach.test.tsx` "the link goes where the
  cursor was at the drop…", `session-tail.test.tsx` "US1.2: Show earlier messages…", and once
  `session.test.tsx` "opening the line moves the place read…" on the desktop.
- **Alternatives considered**: adding the journey tests to fast's UI family: the decision defers
  application journeys to ready.
- **If wrong**: `families` in `scripts/fast-selection.ts`.
- **Where**: the second catch-up.

## R38: A dropped change or feature takes no message, run, or new session

- **Decision**: a session of a dropped change or feature, one with a folder and archived, refuses a
  message with "This change or feature was dropped: its branch stays.", checked before the send
  reads the feature, and again after each wait, so a drop during a send refuses it too. A run sent
  to the folder, its "Next", and "New session" are refused the same way while the folder's latest
  session is archived. Only a drop archives a session with a folder, so that reads as dropped. A
  chat, without a folder, still comes back from the archive with a message. New server test "a
  dropped change refuses %s", for a message, a run, and a new session: each leaves the worktree
  absent and opens no process.
- **Rationale**: the final review found that a message to a dropped change's session un-archived it
  and opened a turn in its removed worktree, which `workDir` recreated from the branch the drop
  keeps.
- **Alternatives considered**: skipping archived sessions when picking the folder's latest: the run
  would then make a new session, whose first turn recreates the worktree all the same.
- **If wrong**: an item dropped before it had any session has no archived session to tell it by, so
  a run to its folder still makes one. A marker of dropped folders would close it.
- **Where**: the final review's fixes, `ofDropped` and `REFUSALS.dropped` in
  `packages/server/src/runner/session-state.ts`, `sendTo` and `deliver` in `runner/send.ts`,
  `featureSession` and `newSession` in `runner/sessions.ts`.

## R39: A change's move asks `gh` for its pull request first

- **Decision**: `ura start <change> --feature` reads the workspace with its pull requests asked of
  `gh`, as `ura next` does, and the binding's `promoteChange` refreshes them before it reads the
  workspace, so a change whose pull request `gh` lists now keeps its branch's name. Without `gh`, or
  when it fails, the check reads what the server last knew, kept 10 minutes after a failure, then
  nothing: the move goes on, and renames the branch locally only, so the remote branch and its pull
  request stay. The skill's `cli.md` says the check reads `gh` and is skipped without it. New CLI
  test `feature_on_a_change_with_a_pull_request_is_refused`, with a fake `gh`.
- **Rationale**: the final review found the check read only the cached pull requests: the CLI had
  none, and the server's could be minutes old.
- **Alternatives considered**: refusing the move when `gh` is missing: a repository without GitHub
  could never move a change.
- **If wrong**: `promote` in `crates/cli/src/start.rs`, `promote_change` in
  `crates/core/src/api/start.rs`.
- **Where**: the final review's fixes.

## R40: A session becomes a change only while its agent is available

- **Decision**: "Start the change", from a session without a workflow, is refused while the agent is
  not available on this machine, "Claude Code is not available on this machine.", before the change
  starts, as a run sent to a folder is. New server test "toChange waits for the agent".
- **Rationale**: the final review found that without the agent the session moved and its first run
  was not sent, so the line telling the agent where it works now, and which files to carry over, was
  lost: its next message opened in the worktree without it.
- **Alternatives considered**: keeping the line for the session's next message: it needs a new
  column, and the message the human sends later would carry a move it did not see.
- **If wrong**: the line is still lost when the run is refused after the move, as when another
  session of the change works: the server logs it. `toChange` in
  `packages/server/src/fate/session-moves.ts`.
- **Where**: the final review's fixes.

## R41: An untitled session reads "New session", and a run sent as a message says so

- **Decision**: a session without a workflow and without a title reads "New session", not "New
  chat", and a workflow message that no longer applied reads "Sent as a message: …", not "Sent as a
  chat: …". The tests pinning them follow: the server's `sessions.test.ts` (a new chat's title, the
  queued run's line), `runner/__tests__/sessions.test.ts`, `message.test.ts`, and `cache.test.ts`,
  and the web's `commit-actions.test.tsx` and `recommended.test.tsx`. A session titled "New chat"
  before keeps its title: `cache.test.ts`'s migration fixture still reads it.
- **Rationale**: the final review found "chat" still shown, after the spec merged chats into
  sessions.
- **Alternatives considered**: none.
- **If wrong**: `NEW_SESSION` in `packages/server/src/fate/sessions.ts`, `chatTitle` in
  `runner/message.ts`, the `SENT_AS_CHAT` lines in `runner/session-state.ts`.
- **Where**: the final review's fixes.

## R42: A blocked session's "Needs you" row is `<repository>/sessions/<id>`

- **Decision**: the "Needs you" row of a session without a workflow whose agent was refused an
  action has the ID `<repository>/sessions/<session id>`, as its page's path, not
  `<repository>/chats/<session id>`. Nothing keeps the old ID: the web notifies by each row's `key`,
  in a set held in memory since the page loaded, and the ID is only the notification's tag. A tab
  left open while the server updates notifies a still-blocked session once more. The tests pinning
  the ID follow: the server's `needs-you.test.ts` and the web's `notify.test.tsx`.
- **Rationale**: the final review found "chats" left in the ID after chats merged into sessions.
- **Alternatives considered**: keeping the old ID: nothing depends on it.
- **If wrong**: `chatRowsOf` in `packages/server/src/fate/needs-you.ts`.
- **Where**: the final review's fixes.

## R43: The failed-attach test sends a message after the attach failed

- **Decision**: "a failed attach leaves the session without a workflow" in
  `packages/server/src/__tests__/session-moves.test.ts` goes on: the session's next message runs as
  a chat, with no opening, in the main checkout, and no change's folder reads as working while it
  runs.
- **Rationale**: the final review asked the test to catch a swap of the cache write and
  `live.folder` in `Sessions.attach`. The session's process stays open across the failed attach, so
  the directory it opened in cannot tell: `working()` during the turn does, and the swap failed it.
- **Alternatives considered**: ending the process first: the session then leaves memory, and comes
  back from its row, without the swapped folder.
- **If wrong**: the test.
- **Where**: the final review's fixes.
