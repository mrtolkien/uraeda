---
status: awaiting-human
---

# Clarifications, round 03: Fix testing

> [!IMPORTANT]
>
> 2 questions, about 15 minutes.
>
> - Verdict: worth building, with changes. The fast check meets its minute for most edits, but not
>   for a root configuration edit, and a product race blocks a green browser run.
> - Fast's one-minute budget: amend what it measures, keep it and report it unmet, or narrow a
>   selection, which removes protection.
> - Following the end: a brief product change you will see, or scrolls told apart by input. A
>   loosened test would leave a known bug unguarded.
> - The race exists on main today and touches the same hook as the merge-chats branch.
> - Not revisited: tasks 1 to 6, already on main. Hosted CI evidence waits for the push.

## Context

### Since the last round

You answered [round 02](clarifications-02.md) on 2026-10-20: keep useful focused tests, and let fast
defer broad journeys to ready. Spec revision 2 was approved the same day, and the plan's tasks 1 to
6 were built. They reached main through the UI sandbox branch's merge.

The last task, which validates everything and opens the pull request, measured two problems. Fast
misses its one-minute budget for some edits. A browser test fails under load because of a product
bug. The spec asks that a budget conflict come back to you rather than be waived, and fixing the bug
changes what you see. Both block the push.

### Goal

Fast, trustworthy feedback while protecting Uraeda's important behaviour, with tests that are
understandable and cheap to maintain.

### Today

The one-minute criterion, SC-002, reads: "Complete fast-check command time after a one-file edit is
under 1 minute on the development machine." It lists the edits to measure, and adds "without waiving
a failed sample".

`vp run fast` is the check run after each task. It runs formatting, lint, types, and the tests
related to the edit. A test family is a package's set of tests, such as the server's or the UI's.

Measured on this 32-thread machine with no other checkout running checks, complete commands, warm
cache:

| Edit                                                              | What fast runs                                  | Seconds          |
| ----------------------------------------------------------------- | ----------------------------------------------- | ---------------- |
| `Composer.tsx`, a leaf, a helper, a deletion, a declaration, docs | type check, a few focused tests                 | 12 to 16         |
| a binding test helper                                             | type check, 40 files of TypeScript tests        | 47               |
| core Rust (`settings.rs`)                                         | type check, 1,078 Rust tests, binding contracts | 49.3, 52.4, 62.6 |
| skill (`SKILL.md`)                                                | the core's chain, plus the specs check          | 50.9             |
| server (`limits.ts`)                                              | type check, 41 files, 814 tests                 | 57.4, 49.6       |
| root configuration (`vite.config.ts`)                             | every family (1,115 tests), the Rust workspace  | 82.4, 93.6       |

The other checkouts on this machine often run stress loops, at a load average of 80 to 216. Then no
edit meets a minute. All the samples are in
[the validation ruling](rulings.md#r72-task-7s-validation-coverage-comparison-and-edit-matrix-sc-002-is-not-met-for-a-root-configuration-edit).

### Scope

This round asks about the budget and the race only. It does not revisit the approved architecture,
the tests already merged, or the other success criteria.

### Sources

- The approved [spec](spec.md), the [plan](plan.md)'s task 2 and task 7 evidence, and
  [the rulings](rulings.md) on validation and the race.
- [`following.ts`](/packages/web/src/following.ts),
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx), and the browser
  [`session.test.tsx`](/packages/web/src/__browser__/session.test.tsx).
- The HTML standard's
  [rendering update](https://html.spec.whatwg.org/multipage/webappapis.html#update-the-rendering),
  [CSS scroll anchoring](https://drafts.csswg.org/css-scroll-anchoring-1/), and the source of
  [use-stick-to-bottom](https://github.com/stackblitz-labs/use-stick-to-bottom).
- The full investigation is in [discovery round 03](discovery-03.md).

## Q1: How should the one-minute fast budget read, given these measurements?

Example: you edit a comment in the root `vite.config.ts`. Fast reruns every test family and the Rust
workspace, because a configuration file can change how any test runs. It takes 82 to 94 seconds.

That broadening is the spec's own edge case: uncertain selection broadens instead of omitting. Its
cost is the type check (about 15 s), 75 test files (about 50 s), and the Rust chain (about 22 s).

The core and skill edits pass with 7 to 10 seconds to spare, on a quiet machine. A third core sample
took 62.6 s, so "without waiving a failed sample" fails them too, at times.

Levers to shrink the slow paths exist, unmeasured as fixes. The task runner caches the built
binding, which costs 8 s of a core edit. Rust's test build takes 14 to 25 s. More in
[holding SC-002](discovery-03.md#holding-sc-002).

Why it matters: it decides what "fast" promises every future agent, and whether this feature ships
with an approved criterion recorded as unmet.

- **A (recommended). Amend SC-002 in a spec revision 3: under a minute for a one-file edit of a
  source, test, fixture, declaration, skill, or documentation file. The time is the median of 3 warm
  runs while no other checkout runs checks. A root configuration, lock, or toolchain file is
  measured and reported, without a budget.**
  - Example: the core edit's median is 52.4 s, met; the `vite.config.ts` edit is reported at 82 to
    94 s.
  - [pro] states what fast can honestly promise, and keeps every protection.
  - [con] a spec revision to approve, and the core path keeps only 7 to 10 s of margin. The levers
    become follow-up work, as in B.
  - Why recommended: the configuration edit is slow by the spec's own safety rule. A budget it
    cannot meet without running less only invites narrowing.
- **B. Keep SC-002 as written, and ship with it recorded as unmet for the root configuration edit
  and the slow core sample. A follow-up note names the levers: the binding's cache save, Rust's test
  build, and the reverse-dependent crates.**
  - Example: the pull request and the feature's record say "SC-002: not met" with the samples.
  - [pro] no spec change, and the unmet criterion stays visible.
  - [con] the criterion stays one that no implementation can meet without removing protection.
- **C. Narrow the root configuration selection: a `vite*.ts`, `tsconfig`, `package.json`, or pnpm
  file runs the TypeScript families without the Rust workspace.**
  - Example: an edit of `vite.config.ts` that changes how the Rust tasks run is caught only by
    ready, before the push.
  - [pro] keeps SC-002 as written.
  - [con] removes protection, and likely still misses: the type check and 75 test files alone take
    about 65 s, unmeasured.

**Answer:**

## Q2: How should the transcript keep following its end when the page shortens just before a reply?

Example: you read the end of a session whose run failed. You type "Now the tests." and send. The
banner "The agent's run failed." leaves, and on a busy laptop the reply draws a moment later.

Today, the page stops following, and "Jump to the latest" shows. The reply draws below the screen,
and the page stays off until you press the button.

The session view's approved behaviour says "only the human's scroll stops following, never the
transcript growing". The hook reads every scroll event as yours. When the banner leaves, the page
gets 28 px shorter, and the browser clamps the position, which queues a scroll event. Browsers
dispatch it at the next rendering update. Under load, the reply has drawn by then. The event
measures the longer page, 356 px from its end, and reads it as you scrolling up.

The bug exists on main, and any banner of a stopped, failed, or halted session can cause it. The
phone test "idle at the end, send" fails in about 4 of 26 runs of its file under load. The toolchain
decision forbids retries, and asks that such a test be fixed in the pull request that finds it.

Two fixes were tried and reverted. Ignoring scrolls that come with page growth also swallowed your
own scroll. Judging a position where a draw first leaves it failed: nothing observable lies between
the shortening and the reply. The browser tests scroll with `scrollTo`, which fires no wheel, touch,
or key input. More in [following the end](discovery-03.md#following-the-end-through-a-layout-clamp).

Why it matters: it decides what a reader sees when a session resumes, and whether a known bug ships
behind a loosened test.

- **A (recommended). While you follow the end, the session page never gets shorter. What leaves at
  its end leaves blank space, until new content fills it or you scroll up.**
  - Example: a blank strip the banner's size sits under your message for a moment, then the reply
    fills it, in view.
  - [pro] removes the clamp that causes the race; every existing test stays as written, plus one
    case that forces the race.
  - [con] a message taken back at the end of an idle session leaves its blank space until you scroll
    or leave.
  - Why recommended: it fixes the cause without guessing whose scroll it was, and keeps the approved
    following rule.
- **B. Only your input stops following: a wheel, a touch drag, a scroll key, or a scrollbar drag
  that moves the page up. A scroll without input never stops it.**
  - Example: the reply stays in view. Had you moved up with Find in page or a screen reader, the
    page would pull you back to the end as it grows.
  - [pro] no layout change; the approach chat libraries such as use-stick-to-bottom take in part.
  - [con] most of 19 `scrollTo` calls become wheel input, a phone test scrolls with a wheel, and
    touch and screen-reader scrolling go untested.
- **C. Accept the race as cosmetic, and loosen the case: it passes when the reply is in view or
  "Jump to the latest" brings it there.**
  - Example: on a slow laptop, the reply sometimes draws below the screen with the button showing;
    pressing it follows again.
  - [pro] no product change in a testing feature.
  - [con] the approved rule stays broken under load, and the case no longer catches a change that
    always breaks following after a send.

**Answer:**

## Settled without the human

### Check these

- **The merged tasks** are not reviewed again: tasks 1 to 6 and the first review fixes are on main,
  through commit `6a7c7d30`, merged with `058726fe`. See
  [why this round](discovery-03.md#why-this-round).
- **Hosted evidence** for the CI budget and stability criteria, SC-001 and SC-003, is gathered after
  the push, as the plan's last task says. Five runs of one commit, without retries.
- **The race's fix belongs to this feature**, when the race question picks a product fix. The spec
  leaves out unrelated product fixes, but the feature's own test found this one. The toolchain
  decision asks for it here. See [fixing the race](discovery-03.md#fixing-the-race-is-product-work).
- **The three sibling cases** failed once each under load. They are the progress line case, "a run
  that fails while the human is at its end", and "an ended session scrolled up". They are taken as
  the same race until a fix's stress run says otherwise. A remaining failure comes back as a ruling.
- **Server tests slow under extreme load**, two `preview.test.ts` cases and one `sessions.test.ts`
  case, failed only at a load above 150. They were not reproduced alone, and the hosted runs decide
  them.

### Behaviour

- **"Jump to the latest"** keeps its behaviour under every option: it shows when you are away from
  the end, and brings you back.
- **Scroll anchoring and a reversed column** are not options. Safari has scroll anchoring's switch
  only from version 27, and it never pins the end. A reversed column would scroll the transcript in
  a box, not the page. See
  [following the end](discovery-03.md#following-the-end-through-a-layout-clamp).

### Under the hood

- **A fix's evidence** is a case that forces the race and fails on today's code. Then 40 runs of the
  whole browser file pass under 20 to 24 busy loops, as the thumbnail-focus race was proven.
- **No retries and no longer bound**: raising the case's wait cannot help, since the state it waits
  for never comes back.
- **The merge-chats branch** also edits `following.ts`. Whichever lands second keeps both changes at
  its rebase.
- **The fix lives in the shared hook**, `useFollowEnd`, so every page that follows a transcript gets
  it, as the UI coherence decision asks.

**Notes:**
