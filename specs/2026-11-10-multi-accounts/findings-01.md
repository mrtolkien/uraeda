---
reviewed: wave 1
commits: aab81867760467876a06883df708ff27d6bcd2f6..d6896e8d6bd50e79f33cb5b835a2ae45d3062450
---

# Findings: Multi-accounts management: auto rotation between multiple claude logins, wave 1

## Claude Code · Fable 5.2

10 findings, most severe first:

1. `packages/server/src/runner/__tests__/account-pick.test.ts:17`: Spec compliance (US1 more 2, test
   gap): the helper's `more.resets ?? at(2)` turns `resets: null` back into `at(2)`, so the row "a
   tie goes to the first listed" never builds a window with a null reset.

   Failure scenario: Two unused accounts with no five-hour window open (`resetsAt: null`, what
   Claude Code answers for an idle account) are never tested. That path only works because
   `Infinity - Infinity` is NaN and NaN is falsy in the `||` chain of the comparator. A refactor of
   `shortReset` or the comparator (for example `Number.MAX_SAFE_INTEGER`, or a `<`/`>` comparison)
   can break the idle-account tie while every row stays green. No row covers a null reset against a
   set one either.

2. `packages/server/src/runner/account-pick.ts:35`: Spec compliance (edge case "usage cannot be
   read"): "unknown usage" is only `askedAt === null`, so an account read once whose later reads
   fail is ranked on its stale windows as if known.

   Failure scenario: Account b was read yesterday at 0% (`askedAt` set). Today its usage request
   fails; Task 3 keeps its last windows and `askedAt`. `pickAccount` sees 0% used and picks b ahead
   of `default`, freshly read at 42%, though the spec says an unreadable account is picked after
   every account whose usage is known. `Account` has no field for "the last read failed", and
   `pickAccount` takes no `now` or max age to tell.

3. `packages/server/src/runner/account-pick.ts:20`: Contract fit (Tasks 3 and 4): the five hours and
   the week are told apart by position only (`windows[0]` and `slice(1)`), and `AccountWindow` has
   no duration to order by.

   Failure scenario: An account's list holds only `seven_day` at `used: 1`, because the usage answer
   has no `five_hour` entry, or because Task 4's `accountUsage` builds a never-asked account's
   windows from one process report. The week sits at index 0, `slice(1)` is empty, and the account
   is eligible. It is then ranked as an account with its five hours used up, and can be picked over
   accounts with room, against "whose week is not used up".

4. `packages/server/src/runner/adapter.ts:52`: Contract fit (Task 4): `askedAt` doubles as "usage is
   known", but Task 4 gives a never-asked account windows from its processes' reports while
   `askedAt` stays null.

   Failure scenario: Account b's ask never answers, and a running session on b reports 10% of its
   five hours used. `accountUsage` gives b those windows ("an account never asked takes its reports
   alone"), yet `pickAccount` still ranks b after `default` at 90%, because `askedAt === null`. The
   `isNext` mark and the next session go to the fuller account. Either `accountUsage` must fake an
   `askedAt`, or the pick needs a separate "known" signal; the contract does not say which.

5. `packages/server/src/runner/fake.ts:83`: `FakeAccounts.refresh` stamps `askedAt = now` on every
   account, never-read and hanging ones included, so the fake cannot stand for an unread account or
   an ask still under way.

   Failure scenario: Task 2's `accountFor` calls `refresh`, then picks. A fake account
   `{ askedAt: null, windows: [] }` comes back asked with no windows, counts as unused (0), and is
   picked first: the unread-last rule cannot be tested through the runner. With `hangs = true` the
   accounts are marked fresh before the promise hangs, so a second session's `refresh` resolves at
   once instead of sharing the pending ask. Review focus 2 and the 10-second wait cannot be
   reproduced for a second session. It also mutates the test's `Account` objects in place.

6. `packages/server/src/runner/account-pick.ts:15`: A malformed `resetsAt` or a non-numeric `used`
   from a runtime gives NaN in the comparator, which the `||` chain reads as a tie: the ordering
   stops being transitive.

   Failure scenario: An extension's runtime gives `resetsAt: "soon"` for one of three accounts tied
   on usage. `Date.parse` gives NaN, so that account ties with both others, while the other two
   compare by reset. `toSorted` on an inconsistent comparator may put the later-resetting account
   first. Nothing in the contract validates `Accounts.list()`, and `Accounts` is exported to
   extensions.

7. `packages/server/src/runner/adapter.ts:68`: Contract fit (Task 3, SC-005): `refresh` is
   documented as asking "each account read more than `maxAgeMs` ago", with `askedAt` as the only
   read time, but `askedAt` is set only when windows came.

   Failure scenario: A runtime written against the documented contract (docs/extensions.md line 261
   has the same wording) derives staleness from `askedAt`. An account that is signed out, or whose
   usage cannot be read, keeps `askedAt: null` and is asked again on every `refresh`: on each page
   read of `agentRecord` in Task 4 and before each pick. That breaks "each account's usage is asked
   at most once a minute". `FakeAccounts` itself uses `askedAt` this way, while Task 3 needs a
   separate last-attempt time the contract never mentions.

8. `specs/2026-11-10-multi-accounts/plan.md:355`: Conventions: commit d6896e8d's message ends with
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, which AGENTS.md forbids (anchored at
   the plan's commit step; the defect is in the commit message, not this file).

   Failure scenario: AGENTS.md, Authorship: "Never mention a coding agent, a model, or an AI tool as
   an author or a tool used: not in commit messages (no `Co-Authored-By` lines, no \"generated
   with\" footers)". The plan's global constraints repeat it. The commit must be reworded before the
   branch is pushed, and Tasks 2 to 5 stack on top of it.

9. `packages/server/src/runner/fake.ts:318`: Test gap for Task 2: `FakeAdapter.hasSession` drops
   `_account` without recording it, so no runner test can see whether the session's account reaches
   `hasSession`.

   Failure scenario: Task 2 changes `processes.ts` line 136 and `continuer.ts` line 324 to pass the
   account. If either call forgets it, every fake-based test still passes. With Claude's adapter,
   the transcript is then looked for in the server's own folder, `hasSession` is false for a session
   on account b, and a restart's continue or a resume starts a fresh conversation. A recorded
   `hasSessionCalls`, or a per-account `sessions` map, would catch it.

10. `docs/extensions.md:264`: The documented pick gives only the first rule: it leaves out both
    tie-breaks, the never-read-last rule, the fallback when every ready account is used up, and the
    case of no ready account.

    Failure scenario: A runtime author reads that a session starts on "the account with the most of
    its shortest window left" among eligible accounts. They cannot tell that `askedAt: null` ranks
    an account last, that `resetsAt` breaks ties with null last, that the first `ready` account is
    still picked when all are used up, or that a turn is refused when none is `ready`. Their
    `list()` order and `askedAt` handling give picks the page does not explain.

## Codex · GPT-6.1-Sol

The unread-usage rule does not cover failed refreshes after a successful read, and the fake
fabricates successful reads during hanging requests. The targeted test command was blocked by the
sandbox's read-only Nix cache.

Full review comments:

- [P2] Represent failed usage reads separately from successful timestamps —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-multi-accounts/packages/server/src/runner/account-pick.ts:35-36
  If an account previously reported 0% usage but its next usage read fails, its non-null `askedAt`
  still ranks it ahead of a successfully refreshed account at 42%. The
  [spec's edge case](specs/2026-11-10-multi-accounts/spec.md#edge-cases) requires an account whose
  usage cannot be read to come after accounts whose usage is known, while retaining its last
  windows. The contract currently cannot distinguish that failure from a successful read; expose
  usage availability separately from the last successful timestamp and use it in the ranking.

- [P2] Preserve unread usage when the fake refresh hangs —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-multi-accounts/packages/server/src/runner/fake.ts:82-85
  With `hangs = true`, `refresh()` marks every account successfully read before returning a promise
  that never answers. An unread account with empty windows consequently becomes a known, unused
  account and beats a genuinely known account at 42% when Task 2's pick times out. A concurrent
  refresh also resolves immediately because those timestamps now look fresh. Keep successful-read
  timestamps unchanged while the request hangs, tracking pending requests separately, so the fake
  exercises the planned timeout using only usage actually known.
