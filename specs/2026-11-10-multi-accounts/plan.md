---
status: auto-approved
spec-revision: 2
---

# Plan: Multi-accounts management

**Goal:** New Claude Code sessions start on the listed account with the most of its five hours left,
keep it, and each account's usage shows on Home and in the sidebar.

**Architecture:** An account is an optional part of the runtime's contract, so the runner stays
agent-neutral and its tests run on the fake agent. Claude's adapter owns what an account is: a
configuration folder, its name, its state, and Claude Code's usage request. The runner owns three
rules, each in one module: the pick, the usage per account, which merges asks and running processes'
reports, and the session's account, stored in the sessions' cache and never changed. The web UI only
draws what the server's records give. See the [spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A usage ask that never answers** must not hold a session: its first turn starts 10 seconds
   later, on what is known. Task 2.
2. **Two sessions starting together** share one ask per account, never two. Task 3.
3. **A session whose account left the list, or whose runtime no longer lists any**, still opens on
   its stored folder. Task 2.
4. **A window whose reset has passed** reads as unused, never as its last share used, in the pick
   and in the panes. Task 4.
5. **A refresh that asked nothing** announces nothing: a page that reads the agent's record on each
   announce would otherwise loop. Task 4.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these:

- "A session MUST keep the account it started on, a limit that refuses its run included."
  ([Models](../decisions/models.md))
- "Uraeda MUST NOT read or change an agent's credentials or settings."
  ([Agents](../decisions/agents.md)) Uraeda gives a process its account only as `CLAUDE_CONFIG_DIR`,
  and opens no file of an account's folder but its transcripts' names (SC-002).
- "Every agent MUST be reached through one adapter, which keeps the agent's formats inside it and
  declares what the agent can do." ([Agents](../decisions/agents.md)) `CLAUDE_CONFIG_DIR`,
  `get_usage`, and `claude auth status` appear only in `claude*.ts`.
- "Tests MUST reach agents through a fake adapter, never a real agent."
  ([Agents](../decisions/agents.md)) `~/.claude-gary`, `~/.claude-leo`, and `~/.claude-tato` may be
  used for smoke tests by hand, never by a committed test
  ([spec, assumptions](spec.md#assumptions)).
- "A run stopped by a usage limit MUST continue by itself once the limit resets, as a best effort."
  ([Run lifecycle](../decisions/run-lifecycle.md)) Nothing in the continuer's rules changes.
- "The settings file MUST NOT hold a secret, or be read from a repository."
  ([Settings](../decisions/settings.md)) The setting holds folders only.
- "At the `early` stage, a feature MUST test little beyond stored formats, git, security, contracts
  between the project's parts, pure logic with many cases, and the reproduction of each bug fixed."
  ([Testing](../decisions/testing.md)) The web views get no test: they are reviewed in the sandbox.
- "The agent MUST review each changed view in the running app before handing it over, in both themes
  and at a phone's and a desktop's width." ([Testing](../decisions/testing.md))
- "Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting." ([Code quality](../decisions/code-quality.md)) The limits are 500 lines a file, 100 a
  function, 7 parameters, and a depth of 4 ([`vite.config.ts`](/vite.config.ts)). No new marker.
- The pick's rule, word for word
  ([spec, US1](spec.md#us1-new-sessions-start-on-the-account-with-the-most-left-p1)): among the
  listed accounts that are signed in and whose week is not used up, "the one with the most of its
  five hours left; on a tie, the one whose five hours reset first; then the first one listed". "When
  every signed-in account's week is used up, the first signed-in one listed is picked."
- The exact texts: "Claude Code: account b is signed out, in ~/.claude-b", "Claude Code: account c
  has no folder at ~/.claude-c", "Claude Code: account folder docs is not an absolute path", "No
  Claude Code account is signed in: sign one in, or empty Accounts in Settings, Extensions", "b ·
  signed out" on Home, "b signed out" in the sidebar, and a header like "Claude Code · b · Opus 5.5
  · High".
- Usage is asked "when the server starts, when the list changes, before a pick, and when Home or the
  settings open, at most once a minute". A pick waits "at most 10 seconds for the answers".
- With no account listed, a session starts with no extra process, and stores no account (SC-003).
- No commit, file, or pull request names a coding agent or a model as author or tool
  ([`AGENTS.md`](/AGENTS.md)).

## Code read

- [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts): the runtime's contract.
  `OpenOptions` and `Adapter` have no account. Extensions get it as `Runtime`, from
  [`extension-api.ts`](/packages/server/src/extension-api.ts).
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts), 330 lines: `open` runs as a
  turn starts, claims the session, reads `ran`, whether a turn of it ever started, and calls
  `adapter.hasSession(row.nativeId)` then `adapter.open`. `#limits` keeps each open process's latest
  report per window, keyed by the runtime's name and the window's ID, with no time, and `usage`
  gives the freshest unexpired one.
- [`runner/session-state.ts`](/packages/server/src/runner/session-state.ts): `Proc`, a session's
  open process, and `REFUSALS`, which spreads `RUNTIME_REFUSALS` of
  [`limits.ts`](/packages/server/src/limits.ts), the texts the web UI shares.
- [`runner/cache-rows.ts`](/packages/server/src/runner/cache-rows.ts) and
  [`cache-sessions.ts`](/packages/server/src/runner/cache-sessions.ts): the session's row, its
  mapping from columns, and the fields a write may change.
  [`cache.ts`](/packages/server/src/runner/cache.ts) is 495 lines and needs no change.
- [`runner/migrations.ts`](/packages/server/src/runner/migrations.ts): the cache's schema is a list
  of steps; a new column is one more `ALTER TABLE` string at the end.
- [`runner/continuer.ts`](/packages/server/src/runner/continuer.ts), 497 lines: line 324 calls
  `hasSession(session.nativeId)` to decide a restart's continue. It waits a limit's reset from the
  limit's own `resetsAt`, so a session that keeps its account needs no other change there.
- [`runner/claude.ts`](/packages/server/src/runner/claude.ts), 464 lines: `#spawn` gives
  `spawnGrouped` the environment of `toolsEnv(options.tools)`; `hasSession` looks in
  `<configDir>/projects/*/<id>.jsonl`; `models()` runs a short process with `MODELS_ARGS`.
- [`runner/claude-control.ts`](/packages/server/src/runner/claude-control.ts): `Controls`, which
  writes a control request and resolves its answer.
- [`runner/child.ts`](/packages/server/src/runner/child.ts):
  `spawnGrouped(command, args, cwd, env)`, `endShortProcess`, `MODELS_TIMEOUT_MS`, 10 seconds.
- [`runner/runtimes.ts`](/packages/server/src/runner/runtimes.ts), 359 lines: `records(repo, usage)`
  builds each `RuntimeRecord`; `changed()` tells the listeners, the sessions
  ([`sessions.ts`](/packages/server/src/runner/sessions.ts), line 111) among them.
- [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts): `agentRecord` and `sessionRecord`
  build the records the web UI reads; [`fate/views.ts`](/packages/server/src/fate/views.ts) types
  them.
- [`extensions/builtins.ts`](/packages/server/src/extensions/builtins.ts): the `claude` built-in
  makes the adapter from `api.settings(null)`. A setting's change registers it again once its
  sessions' turns end.
- [`extensions/server.ts`](/packages/server/src/extensions/server.ts), `#state`: a built-in's
  problems come from `BuiltIns.state`; `#announce` sends the `Extensions` record.
- [`crates/core/extensions/claude.toml`](/crates/core/extensions/claude.toml): the manifest, with
  `[settings.command]`. A setting's `type` may be `list`.
- [`runner/fake.ts`](/packages/server/src/runner/fake.ts): `FakeAdapter`, scripted, which records
  each `open`'s options in `opens`.
- [`runner/__tests__/helpers.ts`](/packages/server/src/runner/__tests__/helpers.ts): `testSessions`
  gives `{ adapter, cache, changes, repo, sessions }` on an in-memory cache with fake timers;
  `restart`; `limitTurn(adapter, limit)`.
- [`web/src/UsageWindow.tsx`](/packages/web/src/UsageWindow.tsx),
  [`home/Usage.tsx`](/packages/web/src/home/Usage.tsx),
  [`sidebar/Allowance.tsx`](/packages/web/src/sidebar/Allowance.tsx),
  [`SessionHeader.tsx`](/packages/web/src/SessionHeader.tsx), and
  [`SessionView.tsx`](/packages/web/src/SessionView.tsx), line 104: the views to change.
  [`web/src/views.ts`](/packages/web/src/views.ts) picks the fields a view reads.
- [`web/src/AccountsMockups.stories.tsx`](/packages/web/src/AccountsMockups.stories.tsx): the
  approved mockups, built over fixed values.
- [`web/sandbox/agent.ts`](/packages/web/sandbox/agent.ts): the sandbox's fake agent, whose turn at
  work reports a five-hour window and a week.
- Validation: `nix develop -c vp test <file>` for one test file, `nix develop -c vp run fast` after
  each task, `nix develop -c cargo nextest run -p uraeda-core` for the core, and
  `nix develop -c vp run ready` before the push ([`CONTRIBUTING.md`](/CONTRIBUTING.md)).

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

- **`Accounts`, in the runtime's contract**: needed by the pick, the usage per account, and the
  settings' banner, on Claude's adapter and the fake. Rejected: reading Claude's folders from the
  runner, which would put Claude Code's formats outside its adapter.
- **`runner/account-pick.ts`**: the pick's rule and its wait, called by `Processes.open` and by the
  records, for the account a new session would start on. Rejected: inside `processes.ts`, where the
  spec asks for a module of its own.
- **`runner/account-usage.ts`**: which report wins, called by the pick and by the records. Rejected:
  two copies of the merge.
- **`runner/claude-accounts.ts`**: Claude's accounts, apart from `claude.ts`, which is 464 lines.
- **`FakeAccounts`, in `fake.ts`**: the fake's accounts, used by the runner's tests and the sandbox.
- **`continuer.ts` stays at 497 lines**: Task 2 changes one call in place. If the change adds a line
  past 500, the task first moves `agentBack`'s loop body to
  [`continue-reads.ts`](/packages/server/src/runner/continue-reads.ts), in a `refactor` commit.

No constitution exception.

## Test map

The runner's tests run `Sessions` on an in-memory cache, the fake agent, and fake timers, through
`testSessions`. Claude's accounts are tested through their pure functions and an injected ask: no
test starts `claude`. The core's test reads the built-in manifest. The web views have no test.

| Spec                                                                            | Task | Test                                                                                            |
| ------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| US1 key 1, more 1, 2, 3; SC-001; edge: usage cannot be read                     | 1    | `account-pick.test.ts`, "the pick: %s", one row each                                            |
| US1 key 1 (the header), key 2, more 4, more 6; SC-003                           | 2    | `accounts.test.ts`, "a session picks its account at its first turn, and keeps it"               |
| US1 key 3                                                                       | 2    | `accounts.test.ts`, "a run a limit refused continues on its own account"                        |
| US1 more 5                                                                      | 2    | none: a sub-session is a session, and the test above owns the pick at a first turn              |
| Edge: no listed account is signed in                                            | 2    | an assertion of "a session picks its account at its first turn, and keeps it"                   |
| Edge: an account leaves the list; review focus 3                                | 2    | an assertion of the same test                                                                   |
| SC-004; review focus 1                                                          | 2    | `accounts.test.ts`, "a pick waits 10 seconds for an ask, then goes on"                          |
| Data model: a session's `account`                                               | 2    | `cache.test.ts`, "a session keeps its fields, and their updates", two more assertions           |
| SC-002; replaced: the transcript's folder                                       | 3    | `claude.test.ts`, "a session exists when its transcript is found", rewritten with an account    |
| SC-002, the environment                                                         | 3    | `claude.test.ts`, "a process gets its account as its configuration folder"                      |
| US2, the names; US3 key 2, more 2; edges: twice, same name                      | 3    | `claude-accounts.test.ts`, "the listed folders become accounts: %s", one row each               |
| US2 more 1, the unused window; US3 key 1, the state                             | 3    | `claude-accounts.test.ts`, "Claude Code's usage answer gives the windows"                       |
| SC-005; review focus 2; US3 more 1                                              | 3    | `claude-accounts.test.ts`, "each account is asked at most once a minute, and once at a time"    |
| Data model: the `accounts` setting                                              | 3    | the core's existing test of the built-in manifests, which parses `claude.toml`                  |
| Replaced: a runtime's usage; edge: you use an account elsewhere; review focus 4 | 4    | `usage.test.ts`, "an account's usage is the freshest of its ask and its processes' reports"     |
| US3 key 1, the banner; review focus 5                                           | 4    | `extensions/__tests__/runtimes.test.ts`, "a runtime's account problems are its extension's"     |
| US2 key 1, 2, 3, more 2; US3 key 1, 3                                           | 5    | none: views, reviewed in the sandbox as the testing decision asks                               |
| Edge: a session's account is signed out since                                   | 2    | none: the turn fails in Claude Code's words through the existing path, which existing tests own |
| Edge: the list changes while sessions work                                      | 3    | none: the built-ins' reload, which `extensions/__tests__/runtimes.test.ts` owns                 |
| Edge: a session started before the feature                                      | 2    | the first test's no-list assertion: a null account opens without one                            |
| Edges: same account twice, API key, usage credits, other plan                   | 5    | none: nothing is built for them; the documentation says so                                      |

## Waves

1. Task 1: the contract every later task builds on.
2. Tasks 2 and 3: the runner's side and Claude's side of the contract. No file in common.
3. Task 4: changes `processes.ts`, which Task 2 changed.
4. Task 5: the views and the documentation, on Task 4's records.

---

## Task 1: The accounts contract and the pick's rule

**Files:**

- Modify: `packages/server/src/runner/adapter.ts` (`OpenOptions`, `Adapter`)
- Create: `packages/server/src/runner/account-pick.ts`
- Modify: `packages/server/src/runner/fake.ts` (`FakeAccounts`, `FakeAdapter`)
- Modify: `packages/server/src/extension-api.ts` (export the new types beside `Runtime`)
- Modify: `docs/extensions.md` (the Runtimes section)
- Test: `packages/server/src/runner/__tests__/account-pick.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces, in `adapter.ts`:

```ts
/** A usage window of an account: no reset while the window is not open. */
export type AccountWindow = { id: string; label: string; resetsAt: string | null; used: number };
export type AccountState = "ready" | "signed-out" | "missing";
/** An account a runtime offers. `windows` are shortest first: Claude's five hours, then its week. */
export type Account = {
  /** When its windows were last read, epoch ms: null while never; kept after a failed ask. */
  askedAt: number | null;
  /** What a session stores: for Claude Code, its folder as an absolute path. */
  id: string;
  /** Whether its usage is known: false while never read, and while its last ask could not read it. */
  known: boolean;
  name: string;
  state: AccountState;
  windows: ReadonlyArray<AccountWindow>;
};
export interface Accounts {
  /** The accounts as last asked, in the listed order. */
  list(): ReadonlyArray<Account>;
  /** The name of the account `id`, listed or not. */
  nameOf(id: string): string;
  /** What needs the human, in the runtime's words: "account b is signed out, in ~/.claude-b". */
  problems(): ReadonlyArray<string>;
  /** Asks again each account read more than `maxAgeMs` ago: settles once they answered. */
  refresh(maxAgeMs: number): Promise<void>;
}
// OpenOptions gains:  account?: string;        the account's id
// Adapter gains:      readonly accounts?: Accounts;
// Adapter changes:    hasSession(nativeId: string, account?: string): boolean;
```

- Produces, in `account-pick.ts`: `USAGE_MAX_AGE_MS = 60_000`, `PICK_WAIT_MS = 10_000`, and
  `pickAccount(accounts: ReadonlyArray<Account>): Account | undefined`.
- Produces, in `fake.ts`: `class FakeAccounts implements Accounts` with public
  `accounts: Array<Account>`, `asks: number`, counting `refresh` calls that ask, and
  `hangs: boolean`, which makes `refresh` never settle; `nameOf` gives the listed name, else the id.
  `FakeAdapter.accounts?: FakeAccounts`, unset by default.
  `FakeAdapter.hasSession(nativeId, account?)` ignores the account.

- [x] **Step 1: Write the failing test**

```ts
// account-pick.test.ts
const HOUR = 3_600_000;
const at = (hours: number) => new Date(Date.UTC(2026, 10, 10, 12) + hours * HOUR).toISOString();
const account = (
  name: string,
  five: number,
  more: Partial<Account> & { week?: number; resets?: string | null } = {},
): Account => ({
  askedAt: 1,
  id: `/home/u/.claude-${name}`,
  name,
  state: "ready",
  windows: [
    { id: "five_hour", label: "5h", resetsAt: more.resets ?? at(2), used: five },
    { id: "seven_day", label: "Week", resetsAt: at(72), used: more.week ?? 0.3 },
  ],
  ...more,
});

test.each([
  [
    "the most five hours left",
    [account("default", 0.42), account("b", 0), account("c", 0.88)],
    "b",
  ],
  [
    "a signed-out account and a used-up week are skipped",
    [
      account("default", 0.42),
      account("b", 0, { state: "signed-out" }),
      account("c", 0.2, { week: 1 }),
    ],
    "default",
  ],
  [
    "a tie goes to the first listed",
    [account("default", 0, { resets: null }), account("b", 0, { resets: null })],
    "default",
  ],
  [
    "a tie goes to the one that resets first",
    [
      account("default", 1, { resets: at(3) }),
      account("b", 1, { resets: at(5) }),
      account("c", 1, { resets: at(1) }),
    ],
    "c",
  ],
  [
    "an account whose usage was never read comes last",
    [account("default", 0, { askedAt: null, windows: [] }), account("b", 0.9)],
    "b",
  ],
  [
    "every week used up: the first signed-in one listed",
    [
      account("default", 0, { state: "missing" }),
      account("b", 0.5, { week: 1 }),
      account("c", 0.1, { week: 1 }),
    ],
    "b",
  ],
  ["no account signed in: no pick", [account("b", 0, { state: "signed-out" })], undefined],
])("the pick: %s", (_, accounts, picked) => {
  expect(pickAccount(accounts)?.name).toBe(picked);
});
```

The break each row catches: a pick by listed order; a skipped guard dropped; a tie resolved by the
later one; a reset ignored; an unread account read as unused; a used-up week falling through to no
pick; a signed-out account picked.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c vp test packages/server/src/runner/__tests__/account-pick.test.ts`
- Expected: FAIL, the import of `../account-pick.ts` does not resolve.

- [x] **Step 3: Add the contract's types, `pickAccount`, and `FakeAccounts`**

`pickAccount` is pure. An account is eligible when it is `ready` and no window after its first is
used up (`used >= 1`). Among the eligible: the least `used` of the first window, an account with no
`known` after every other; then the earliest `resetsAt` of the first window, a null one last; then
the listed order. With none eligible, the first `ready` one listed. With none `ready`, undefined. An
account that is `known` and has no first window counts as unused.

- [x] **Step 4: Document the contract in `docs/extensions.md`**

In the Runtimes section, after the models: a runtime may offer `accounts`, with `list`, `nameOf`,
`problems`, and `refresh`; `open` then gets `account`, and `hasSession` the session's account.

- [x] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/server/src/runner/adapter.ts packages/server/src/runner/account-pick.ts \
  packages/server/src/runner/fake.ts packages/server/src/extension-api.ts docs/extensions.md \
  packages/server/src/runner/__tests__/account-pick.test.ts
git commit -m "feat(multi-accounts): accounts in the runtime's contract, and the pick's rule"
```

## Task 2: A session picks its account, and keeps it

**Risky:** it adds a column to the sessions' cache, and changes how every session's process opens.

**Files:**

- Modify: `packages/server/src/runner/migrations.ts` (one step at the end)
- Modify: `packages/server/src/runner/cache-rows.ts` (`SessionRow`, `toSession`)
- Modify: `packages/server/src/runner/cache-sessions.ts` (`SessionFields`, `sessionColumns`)
- Modify: `packages/server/src/runner/account-pick.ts` (`accountFor`)
- Modify: `packages/server/src/runner/processes.ts` (`open`)
- Modify: `packages/server/src/runner/session-state.ts` (`Proc`)
- Modify: `packages/server/src/limits.ts` (`RUNTIME_REFUSALS`)
- Modify: `packages/server/src/runner/continuer.ts` (line 324, in place)
- Test: `packages/server/src/runner/__tests__/accounts.test.ts`,
  `packages/server/src/runner/__tests__/cache.test.ts`

**Interfaces:**

- Consumes: `Account`, `Accounts`, `OpenOptions.account`, `Adapter.hasSession(nativeId, account?)`,
  `pickAccount`, `USAGE_MAX_AGE_MS`, `PICK_WAIT_MS`, and `FakeAccounts`, from Task 1.
- Produces: `SessionRow.account: string | null`, written through
  `cache.updateSession(id, { account })`; `Proc.account: string | null`;
  `RUNTIME_REFUSALS.noAccount(name: string)`, giving "No Claude Code account is signed in: sign one
  in, or empty Accounts in Settings, Extensions" for the name "Claude Code"; and, in
  `account-pick.ts`, `accountFor(accounts: Accounts, name: string): Promise<string>`, the id of the
  picked account, which refreshes, waits, picks, and throws the `noAccount` refusal with none.

- [x] **Step 1: Write the failing tests**

```ts
// accounts.test.ts: three accounts on the fake, as in Task 1's test, at 0.42, 0, and 0.88
test("a session picks its account at its first turn, and keeps it", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const none = await sessions.newChat(repo); // no account listed
  await send(sessions, none, "hello");
  expect(adapter.opens.at(-1)?.account).toBeUndefined();
  expect(cache.session(none.id)?.account).toBeNull();

  adapter.accounts = fakeAccounts(); // default 0.42, b 0, c 0.88
  const chat = await sessions.newChat(repo);
  await send(sessions, chat, "hello");
  expect(adapter.opens.at(-1)?.account).toBe("/home/u/.claude-b");
  expect(cache.session(chat.id)?.account).toBe("/home/u/.claude-b");

  adapter.accounts.accounts = [account("default", 0.42), account("b", 0.95)]; // c left the list
  const again = await restart(sessions, cache, adapter);
  await send(again, chat, "more");
  expect(adapter.opens.at(-1)?.account).toBe("/home/u/.claude-b");
  await send(again, none, "more");
  expect(adapter.opens.at(-1)?.account).toBeUndefined(); // it ran on the server's login

  adapter.accounts.accounts = [account("b", 0, { state: "signed-out" })];
  const refused = await again.newChat(repo);
  await expect(send(again, refused, "hello")).rejects.toThrow(
    "No Claude Code account is signed in: sign one in, or empty Accounts in Settings, Extensions",
  );
});

test("a run a limit refused continues on its own account", async () => {
  // continues on, `b` refuses at its five-hour limit until 17:10 while `c` has room
  // after the timers run to 17:11: the continue's open has account "/home/u/.claude-b"
});

test("a pick waits 10 seconds for an ask, then goes on", async () => {
  // adapter.accounts.hangs = true; the first turn has not opened at 9.9 s, and has at 10 s,
  // on the pick of what is known
});
```

Use the helpers of `helpers.ts` and the sending pattern of `sessions.test.ts`; `limitTurn` scripts
the refusal, and `continuer.test.ts` shows how a limit's continue is run to its time. In
`cache.test.ts`, "a session keeps its fields, and their updates" also expects `account: null` when
created, and the folder after `updateSession(id, { account: "/home/u/.claude-b" })`.

The breaks to make, as the task is risky: remove the `ran` guard, and the session that ran on the
server's login must fail the test; pick on every open, and the kept account must fail it; drop the
race with the wait, and the third test must hang.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/runner/__tests__/accounts.test.ts packages/server/src/runner/__tests__/cache.test.ts`
- Expected: FAIL, `expected undefined to be '/home/u/.claude-b'`, and `account` missing from the
  created session.

- [x] **Step 3: Add the column and the row's field**

One migration step, `ALTER TABLE sessions ADD COLUMN account TEXT;`, with a comment as its
neighbours have: null for every session made before, and for one started with no account listed.
`account` joins `SessionRow`, `toSession`, `SessionFields`, and `sessionColumns`.

- [x] **Step 4: Pick in `Processes.open`, and keep**

In `open`, after the adapter is known and `ran` is read, with one `EXISTS` query on the session's
turns that have a start time: when no turn of the session ever started and
`adapter.accounts?.list()` is not empty, the session's account is
`await accountFor(adapter.accounts, adapter.name)`, stored with `cache.updateSession` before the
process opens, even when the row already holds one: a first turn that never started, taken back or
failed to open, fixed nothing, so the pick is made again on the usage of that moment (R3). A session
with a started turn keeps its row's account, none for one that ran before accounts; a session with
no started turn and no listed account keeps the row's. `accountFor` awaits the refresher's
`refresh(runtime)` (Task 4's `AccountRefresh`, which asks `refresh(USAGE_MAX_AGE_MS)`) raced with a
timer of `PICK_WAIT_MS`, then picks. A session with an account always opens on it, listed or not.
The account goes to `adapter.hasSession(row.nativeId, account)`, to `adapter.open` as `account`, and
to `Proc.account`. A refusal releases the session, as the existing `catch` does. In `continuer.ts`,
line 324 passes the session's account to `hasSession`, in place.

- [x] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/server/src/runner packages/server/src/limits.ts
git commit -m "feat(multi-accounts): a session picks its account at its first turn, and keeps it"
```

## Task 3: Claude's accounts

**Files:**

- Create: `packages/server/src/runner/claude-accounts.ts`
- Modify: `packages/server/src/runner/claude.ts` (`ClaudeAdapterOptions`, `#spawn`, `hasSession`,
  `models`)
- Modify: `packages/server/src/extensions/builtins.ts` (the `claude` built-in)
- Modify: `crates/core/extensions/claude.toml`
- Test: `packages/server/src/runner/__tests__/claude-accounts.test.ts`,
  `packages/server/src/runner/__tests__/claude.test.ts`

**Interfaces:**

- Consumes: `Account`, `AccountState`, `AccountWindow`, `Accounts`, `OpenOptions.account`, and
  `Adapter.hasSession(nativeId, account?)`, from Task 1.
- Produces, in `claude-accounts.ts`:

```ts
/** One listed folder: its id, absolute; the line as listed; its name. */
export type ClaudeFolder = { id: string; listed: string; name: string };
export function claudeFolders(
  lines: ReadonlyArray<string>,
  home: string,
): { folders: Array<ClaudeFolder>; problems: Array<string> };
/** The windows of a `get_usage` answer: undefined when it gives none. */
export function claudeUsageWindows(answer: unknown): Array<AccountWindow> | undefined;
/** What one ask of a folder gives: its state, and its windows when its usage was read. */
export type ClaudeAsk = (
  folder: string,
) => Promise<{ state: AccountState; windows?: Array<AccountWindow> }>;
export function claudeAsk(command: string): ClaudeAsk;
export class ClaudeAccounts implements Accounts {
  constructor(options: {
    ask: ClaudeAsk;
    home?: string;
    lines: ReadonlyArray<string>;
    now?: () => number;
  });
}
```

- Produces, in `claude.ts`: `ClaudeAdapterOptions.accounts?: ReadonlyArray<string>`, the setting's
  lines; `ClaudeAdapter.accounts`, always a `ClaudeAccounts`: an empty setting gives an empty list
  that asks nothing and has no problem (see
  [R1](rulings.md#r1-a-setting-of-invalid-lines-still-shows-its-banner)); and
  `claudeEnv(options: OpenOptions): Record<string, string> | undefined`, exported.

- [x] **Step 1: Write the failing tests**

```ts
// claude-accounts.test.ts
test.each([
  [
    "a folder's name drops its dot and its claude-",
    ["~/.claude-b"],
    [["/home/u/.claude-b", "b"]],
    [],
  ],
  ["~/.claude reads default", ["~/.claude"], [["/home/u/.claude", "default"]], []],
  [
    "a line that is no absolute path is left out",
    ["docs", "/srv/claude-work"],
    [["/srv/claude-work", "work"]],
    ["account folder docs is not an absolute path"],
  ],
  [
    "a folder listed twice is one account",
    ["~/.claude-b", "/home/u/.claude-b"],
    [["/home/u/.claude-b", "b"]],
    [],
  ],
  [
    "a second folder of the same name shows its path",
    ["~/.claude-b", "/srv/.claude-b"],
    [
      ["/home/u/.claude-b", "b"],
      ["/srv/.claude-b", "/srv/.claude-b"],
    ],
    [],
  ],
])("the listed folders become accounts: %s", (_, lines, folders, problems) => {
  const read = claudeFolders(lines, "/home/u");
  expect(read.folders.map(({ id, name }) => [id, name])).toEqual(folders);
  expect(read.problems).toEqual(problems);
});

test("Claude Code's usage answer gives the windows", () => {
  const limits = (five: unknown, week: unknown) => ({
    rate_limits: { five_hour: five, seven_day: week },
    rate_limits_available: true,
  });
  expect(
    claudeUsageWindows(
      limits(
        { resets_at: "2026-11-10T06:19:59.947714+00:00", utilization: 76 },
        { resets_at: "2026-11-15T22:59:59.947732+00:00", utilization: 38 },
      ),
    ),
  ).toEqual([
    { id: "five_hour", label: "5h", resetsAt: "2026-11-10T06:19:59.947Z", used: 0.76 },
    { id: "seven_day", label: "Week", resetsAt: "2026-11-15T22:59:59.947Z", used: 0.38 },
  ]);
  // An unused account, as Claude Code 2.1.322 answered for one: no reset.
  expect(
    claudeUsageWindows(
      limits(
        { resets_at: null, utilization: 0 },
        { resets_at: "2026-11-11T12:00:00+00:00", utilization: 0 },
      ),
    )?.[0],
  ).toEqual({ id: "five_hour", label: "5h", resetsAt: null, used: 0 });
  // A signed-out folder.
  expect(claudeUsageWindows({ rate_limits: null, rate_limits_available: false })).toBeUndefined();
});

test("each account is asked at most once a minute, and once at a time", async () => {
  let now = 0;
  const asked: Array<string> = [];
  const accounts = new ClaudeAccounts({
    ask: async (folder) => {
      asked.push(folder);
      return folder.endsWith("-b") ? { state: "signed-out" } : { state: "ready", windows: [] };
    },
    home: "/home/u",
    lines: ["~/.claude", "~/.claude-b"],
    now: () => now,
  });
  await Promise.all([accounts.refresh(60_000), accounts.refresh(60_000)]);
  expect(asked).toHaveLength(2);
  expect(accounts.problems()).toEqual(["account b is signed out, in ~/.claude-b"]);
  now = 59_000;
  await accounts.refresh(60_000);
  expect(asked).toHaveLength(2);
  now = 61_000;
  await accounts.refresh(60_000);
  expect(asked).toHaveLength(4);
});
```

In `claude.test.ts`, "a session exists when its transcript is found" also puts a transcript under a
second folder, and expects `hasSession(id, thatFolder)` true and `hasSession(id)` false for it. A
new test, "a process gets its account as its configuration folder", expects
`claudeEnv({ ...options, account: "/home/u/.claude-b" })` to hold `CLAUDE_CONFIG_DIR` with that
folder, and `claudeEnv(options)` to hold no `CLAUDE_CONFIG_DIR`.

The break each test catches: a name rule that drifts from the spec's; a share read as a percent; a
second ask started while one runs; a transcript looked for in the wrong folder; an account never
reaching the process.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/runner/__tests__/claude-accounts.test.ts packages/server/src/runner/__tests__/claude.test.ts`
- Expected: FAIL, the import of `../claude-accounts.ts` does not resolve.

- [x] **Step 3: Implement `claude-accounts.ts`**

`claudeFolders` expands a leading `~/`, or `~` alone, with `home`, leaves out a line that is not
then absolute, with the problem `account folder <line> is not an absolute path`, and a folder
already listed. A name is the folder's last segment without its leading dot and without a leading
`claude-`; a segment that is `claude` alone reads `default`; a name already taken reads the folder's
id.

`ClaudeAccounts` keeps each account as last asked: `missing`, `signed-out`, or `ready`, with its
windows, `askedAt` and `known` set only when the ask gave windows: an ask that did not keeps the
windows and their `askedAt`, and clears `known`. `refresh(maxAgeMs)` asks the accounts whose last
ask, answered or not, is older than `maxAgeMs`, all at once, and shares an ask under way with a
second caller. A rejected ask keeps the account as it was. A folder that is not a directory, gone or
a regular file, is `missing` without an ask: `ClaudeAccounts` checks it with a stat of the folder
itself, which opens no file, as it is built and at each `refresh`, before the asks start, so a pick
that stops waiting knows it. The folders are held once, in its entries. `problems()` gives the
folders' problems, then `account <name> is signed out, in <listed>` and
`account <name> has no folder at <listed>`. `nameOf` gives the listed name, else the name rule's.

`claudeAsk(command)` asks a folder that is a directory with two short processes at once, each with
`CLAUDE_CONFIG_DIR` set to the folder, run from the home folder, ended with `endShortProcess`, and
given up after `MODELS_TIMEOUT_MS`: `claude auth status` (through `spawnGrouped`), whose JSON
`loggedIn` false is `signed-out`, and a `get_usage` control request, sent as `models()` sends
`list_models`, with `SHORT_ARGS`. They combine: signed out wins; else `ready`, with the windows when
the usage was read, even when the status said nothing, as only a signed-in account gives a five-hour
window. A usage with no windows is `ready` without them. A status that says nothing, with no
windows, rejects the ask. Nothing else of the folder is read.

- [x] **Step 4: Give the account to Claude Code**

`askShort(command, cwd, env, requests, words)`, in `claude-accounts.ts`, is the short process
`models()` and the usage ask share: `models()` uses it, so `MODELS_ARGS` moved there as
`SHORT_ARGS`. `claudeEnv` merges `toolsEnv(options.tools)` with `CLAUDE_CONFIG_DIR` when
`options.account` is set; `#spawn` uses it. `hasSession(nativeId, account)` looks under `account`,
else under the adapter's own folder. `models()` first awaits the accounts'
`refresh(USAGE_MAX_AGE_MS)`, at most `PICK_WAIT_MS` (`refreshedWithin`, in `account-pick.ts`), then
runs in the folder of the first listed `ready` account, else of the first listed, when accounts are
listed. The built-in passes the `accounts` setting's lines, a list of strings, else none. The
manifest gains:

```toml
[settings.accounts]
type = "list"
default = []
label = "Accounts"
help = "The Claude Code configuration folders new sessions pick between, one per line: the one with the most of its five hours left."
```

- [x] **Step 5: Smoke test by hand, with the three folders**

With a script kept outside the repository, build
`new ClaudeAccounts({ ask: claudeAsk("claude"), lines: ["~/.claude-gary", "~/.claude-leo", "~/.claude-tato"] })`,
await `refresh(0)`, and print `list()` and `problems()`. Expected: three `ready` accounts named
gary, leo, and tato, each with a five-hour window and a week, and no problem. Then delete the
script. If an account gives no windows, stop and report it: the pick would not know idle accounts.

- [x] **Step 6: Run the task's validation**

- Run: `nix develop -c vp run fast`, then `nix develop -c cargo nextest run -p uraeda-core`
- Expected: PASS

- [x] **Step 7: Commit**

```bash
git add packages/server/src/runner/claude-accounts.ts packages/server/src/runner/claude.ts \
  packages/server/src/extensions/builtins.ts crates/core/extensions/claude.toml \
  packages/server/src/runner/__tests__/claude-accounts.test.ts \
  packages/server/src/runner/__tests__/claude.test.ts
git commit -m "feat(multi-accounts): Claude Code's accounts, from its configuration folders"
```

## Task 4: Usage per account, in the records and the settings

**Files:**

- Create: `packages/server/src/runner/account-usage.ts`
- Create: `packages/server/src/runner/account-records.ts` (`accountRecords`, `AccountRefresh`: R5)
- Modify: `packages/server/src/runner/processes.ts` (`#limits`, `#report`, `usage`, a new `reports`)
- Modify: `packages/server/src/runner/account-pick.ts` (`accountFor`)
- Modify: `packages/server/src/runner/runtimes.ts` (`RuntimeRecord`, `records`)
- Modify: `packages/server/src/runner/sessions.ts` (`accounts`, `refreshAccounts`, the start)
- Modify: `packages/server/src/fate/sessions.ts` (`agentRecord`, `sessionRecord`)
- Modify: `packages/server/src/fate/views.ts` (`SessionRecord`)
- Modify: `packages/server/src/extensions/server.ts` (`#state`)
- Test: `packages/server/src/runner/__tests__/usage.test.ts`,
  `packages/server/src/runner/__tests__/account-usage.test.ts` (the merge's rows),
  `packages/server/src/extensions/__tests__/runtimes.test.ts`

**Interfaces:**

- Consumes: `Account`, `Accounts`, `pickAccount`, `USAGE_MAX_AGE_MS`, and `FakeAccounts`, from Task
  1; `Proc.account`, `SessionRow.account`, and `accountFor`, from Task 2.
- Produces, in `account-usage.ts`:

```ts
/** A running process's latest report of one window, with its account and when it came. */
export type UsageReport = { account: string | null; at: number; window: UsageWindow };
/** The accounts with the freshest usage of each window: an ask's or a report's. */
export function accountUsage(
  accounts: ReadonlyArray<Account>,
  reports: ReadonlyArray<UsageReport>,
  now: number,
): Array<Account>;
```

- Produces, in `runtimes.ts`:

```ts
/** An account, for the UI. `isNext`: a new session would start on it now. */
export type AccountRecord = {
  id: string;
  isNext: boolean;
  name: string;
  state: AccountState;
  windows: Array<AccountWindow>;
};
// RuntimeRecord gains  accounts: Array<AccountRecord>;   empty with none listed
// Runtimes.records(repo, { accounts, usage })  takes both readers
// RuntimeRecord.usage  is empty while accounts are listed
```

- Produces: `SessionRecord.account: string | null`, the account's name;
  `Processes.reports(runtime: string): Array<UsageReport>`;
  `Sessions.accounts(runtime: string): Array<AccountRecord>`; `Sessions.refreshAccounts(): void`.
  `accountFor` gains a third parameter, `reports: () => ReadonlyArray<UsageReport>`, and picks from
  `accountUsage`.

- [x] **Step 1: Write the failing tests**

```ts
// usage.test.ts
test("an account's usage is the freshest of its ask and its processes' reports", async () => {
  const { adapter, repo, sessions } = await testSessions();
  adapter.accounts = fakeAccounts();          // default 0.42, b 0, c 0.88, asked at the start
  const chat = await sessions.newChat(repo);  // picks b
  // its process reports 0.3 of b's five hours
  const b = () => sessions.accounts("fake").find((each) => each.name === "b");
  expect(b()?.windows[0]?.used).toBe(0.3);
  expect(sessions.usage("fake")).toEqual([]);             // none without an account
  adapter.exit();                                          // the ask's usage stays
  expect(b()?.windows[0]?.used).toBe(0);
  // b's ask now says 0.5, as after a use in a terminal: it wins once refreshed
  // a window whose reset has passed reads { used: 0, resetsAt: null }
  expect(sessions.accounts("fake").filter((each) => each.isNext).map((each) => each.name)).toEqual([...]);
});
```

`isNext` marks one account, the one `pickAccount` gives from the merged usage. In
`extensions/__tests__/runtimes.test.ts`, "a runtime's account problems are its extension's": a
registered runtime whose `accounts.problems()` gives "account b is signed out, in ~/.claude-b" has
that message among its extension's problems in `states()`, its state still `on`; and a
`refreshAccounts()` that asked nothing announces no record.

The break each test catches: a stale report kept after its process exits; an ask that never replaces
a report; an expired window still counted; a problem that never reaches the settings; an announce on
every read.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/runner/__tests__/usage.test.ts packages/server/src/extensions/__tests__/runtimes.test.ts`
- Expected: FAIL, `sessions.accounts is not a function`.

- [x] **Step 3: Keep reports by account, and merge**

`Processes` keeps each account's latest report of each window with the time it came, after its
process closed and once expired, until an ask newer than it makes it moot. `usage(runtime)` gives
the windows of the processes without an account, as today; `reports(runtime)` gives the accounts'
reports. `accountUsage` gives, for each window the ask gave, the freshest of the ask (`askedAt`,
kept after a failed ask) and the account's reports (`at`); a report never adds a window, so the
first is always the shortest, and an account whose ask never read windows stays unknown, its reports
set aside. The account is `known` when its ask's usage is, or when a report of its first window is
fresher than its `askedAt`. A window whose reset is at or before `now` reads
`{ used: 0, resetsAt: null }`, applied in this merge.

- [x] **Step 4: The records, the asks, and the settings**

`Sessions.accounts(runtime)` maps the merged accounts to records, `isNext` on the pick's
(`accountRecords`, in `account-records.ts`, which keeps `sessions.ts` under its limit). `records`
gives each runtime its accounts, and an empty `usage` while it has some. `sessionRecord` gives
`account`, by `accounts.nameOf`, else the stored folder's last segment, else null.
`refreshAccounts()` (the `AccountRefresh` class) calls `refresh(USAGE_MAX_AGE_MS)` on each runtime's
accounts not being asked already, and, when the runtime's account records or problems differ from
before the ask, announces the agent's record and calls `runtimes.accountsChanged()`, a hook of its
own that the Extensions host listens to, not `runtimes.changed()` with its version checks. The
pick's ask goes through the same `AccountRefresh.refresh(runtime)`, so it announces too, and an ask
not settled within `PICK_WAIT_MS` stops blocking its runtime. It also arms one timer at the earliest
future `resetsAt` among the accounts' windows, which announces the records as it fires and is armed
again at each announce and each read, and cleared as the sessions close. It runs as the sessions
start, on each change of the runtimes, and from `agentRecord`, which every page reads. In
`extensions/server.ts`, a built-in runtime's state adds each of `accounts.problems()` as a problem
with an empty file, and the host announces the `Extensions` record on the runtimes' changes and on
`onAccounts`.

- [x] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/server/src
git commit -m "feat(multi-accounts): each account's usage, in the records and the settings"
```

## Task 5: The usage panes, the session's header, and the documentation

**Files:**

- Start from: `packages/web/src/AccountsMockups.stories.tsx`, and
  `packages/web/src/settings/SettingsView.stories.tsx#ExtensionsAccounts`
- Modify: `packages/web/src/UsageWindow.tsx`, `packages/web/src/home/Usage.tsx`,
  `packages/web/src/sidebar/Allowance.tsx`
- Modify: `packages/web/src/SessionHeader.tsx`, `packages/web/src/SessionView.tsx`,
  `packages/web/src/views.ts`
- Modify: `packages/web/src/settings/sampleExtensions.ts` (the built-in's Accounts setting)
- Modify: `packages/web/sandbox/agent.ts` (three sample accounts)
- Modify: `docs/web-ui.md`

**Interfaces:**

- Consumes: `RuntimeRecord.accounts`, `AccountRecord`, and `SessionRecord.account`, from Task 4;
  `FakeAccounts`, from Task 1.
- Produces: nothing a later task uses.

- [x] **Step 1: Draw accounts in the shared component**

`UsageWindows` draws a runtime's accounts when it has some, else its windows. Full, Home's: each
account's name in a line of its own, then its windows; a signed-out or missing account reads
`<name> · signed out` and no bar. Compact, the sidebar's: one line per login, its first window
alone, labelled `<name> 5h`; `<name> signed out` without a bar; and a runtime without accounts shows
its first window alone, so the week leaves the sidebar for every agent. A window without a reset
reads "5h 100% left" on Home and "b 5h 100%" in the sidebar. `useReportedRuntimes` also keeps a
runtime that has accounts. The mockups' stories then render these components over fixed records, and
their local copies go.

- [x] **Step 2: The rail's bar and the header**

The rail's bar shows the first window of the account of the session in view, by the name its record
gives; of a feature's latest session likewise; else of the account whose `isNext` is true. Without
accounts it stays as today. `SessionHeader` takes `account?: string`, shown after the agent's name
and before the model: "Claude Code · b · Opus 5.5 · High". `SessionView` passes the session's
`account`, which `views.ts` adds to the views that read it.

- [x] **Step 3: Sample accounts in the sandbox**

The sandbox's fake agent offers three accounts (`sandbox/accounts.ts`, for Claude Code's kind
alone): `default`, in use; `b`, signed out; and `c`, its week used up. The built-in Claude row of
`sampleExtensions.ts` gains the Accounts setting, as the manifest has it.

- [x] **Step 4: Document it in `docs/web-ui.md`**

Under "Sessions with Claude Code and Codex": the script of the
[spec's first story](spec.md#us1-new-sessions-start-on-the-account-with-the-most-left-p1), whole,
and how to run it; the `accounts` setting with its example; the pick's rule; that a session keeps
its account and waits for its own reset; that MCP servers added for the user are per folder; that
usage credits make an account pay past its limit, so turn them off; that an API key in the server's
environment outranks every account; and one sentence saying Anthropic's terms forbid using someone
else's account, and that limits "assume ordinary, individual usage". Where the page describes the
usage panes: the sidebar shows each login's five hours, and Home its week too.

- [x] **Step 5: Review the views in the sandbox**

- Run: `nix develop -c vp run sandbox`
- Check Home's Usage pane, the sidebar's pane, the closed rail's bar, a session's header, and
  Settings, Extensions, in both themes, at a phone's and a desktop's width, against the five
  mockups. Expected: each reads as its mockup, and the week shows on Home only.

- [x] **Step 6: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS. `vp run ready`, with Storybook's build, is left to the complete validation before
  the push.

- [x] **Step 7: Commit**

```bash
git add packages/web docs/web-ui.md
git commit -m "feat(multi-accounts): each account's usage on Home and the sidebar, and its name on a session"
```
