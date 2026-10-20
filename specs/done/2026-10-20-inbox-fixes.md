---
kind: change
finished: 2026-10-20
pull-request: https://github.com/mrtolkien/uraeda/pull/50
---

# Record: Inbox quick fixes

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-20, finished on
> 2026-10-20, in [its pull request](https://github.com/mrtolkien/uraeda/pull/50). Its full files are
> in git: `git log -- specs/changes/2026-10-20-inbox-fixes/`.

## What and why

The inbox's **Deferred fixes** held 43 agent notes, most of them not worth the human's time. The
human dropped the low-value ones, and asked for the easy ones that need no input from them to be
fixed together, to clear the inbox: seven small defects in the skill, the web UI, and the
benchmarks.

## Behaviour

- `SKILL.md` has room again under its 20,000-character limit: 19,691 characters, from 19,995. The
  rule for a workflow file in an old format moved, word for word, to its own section of Conventions.
- A change whose workflow cannot go on reads "This change cannot go on" on its page; a feature still
  reads "This feature cannot go on".
- A done item whose commits cannot be traced on the default branch, after a squash merge or from
  before typed commits, reads "No figures: its commits could not be traced", in place of "Not found
  on the default branch", which read as a squash merge's words.
- A merged feature's or change's **Next** opens its pull request, "Open pull request #N", when its
  record names one, as an open pull request's **Next** does.
- A benchmark run's record names the repository's commit and dirtiness as the run started, not as it
  ended hours later.
- The benchmarks' leak audit sees the upstream reached without an http URL: `gh repo <verb>`,
  `gh api repos/...` after flags, `--repo` or `-R` inside a `gh` command, quoted or not, ssh URLs,
  and scp-form remotes with or without a user. A sibling repository whose name starts like the
  upstream's is not flagged, nor another tool's `-R`.
- The sidebar's uncoloured "+N −N" and its overflowing chat row were already fixed on the default
  branch when the change started; it changed nothing there.

## Design

- The old-format rule is
  [a file in an old format](/skills/uraeda/references/conventions.md#a-file-in-an-old-format);
  `SKILL.md` links it in one line, and `the_skill_entry_point_stays_lean` still guards the limit.
- The feature page passes the item's kind to `Blocking` in
  [`Notes.tsx`](/packages/web/src/feature/Notes.tsx).
- The untraced words are in [`Figures.tsx`](/packages/web/src/feature/Figures.tsx); the core's
  `found` ([`history.rs`](/crates/core/src/history.rs)) is unchanged, its comment naming both
  causes. Telling the two causes apart would take a new rule in the core, for one line of text.
- [`next.ts`](/packages/web/src/feature/next.ts) builds the pull request's action in one function,
  `openPull`, for the open and the merged pull request.
- Both arms read `stateOf` right after their start time and pass it to `baseRecord`
  ([`run-common.ts`](/packages/benchmarks/src/run-common.ts)).
- `addressesOf` ([`session.ts`](/packages/benchmarks/src/session.ts)) turns each address a fetching
  command names into a URL, and `isUpstream` ([`loop.ts`](/packages/benchmarks/src/loop.ts)) judges
  them as before, its `/repos` check now bounded by a `/`, a `.`, or the end of the path.
- The default branch had lost `fixtures/INBOX-TRIAGE.md` in an inbox commit, which failed
  `a_triage_is_checked_like_a_round`: the change restored it.

## Follow-ups

- The browser test "a note drags to another category" failed once on the desktop during the final
  validation, and passed twice after: a flaky test already there.
