---
status: awaiting-human
---

# Clarifications, round 02: Multi-repo server

> [!IMPORTANT]
>
> 1 question on the CLI binary's size, about 3 minutes.
>
> - The constitution you amended today says measured size must not go up without your approval in
>   the plan: `ura add` makes the release `ura` 36 KB larger, 0.6%.
> - Accepting it sends the plan back to you for review, as every constitution exception does.

## Context

Every task of the plan is built and tested. Catching up with the default branch brought in
constitution 1.3.0, whose principle VI now says: "Warnings, size, complexity, and duplication
measured by the project's checks MUST NOT go up. An exception MUST be approved by a human in the
plan." CI prints the size of the release `ura` binary on every run.

The full investigation is in [discovery](discovery-02.md). Each question links to its topic.

## Q1: Do you accept the `ura` binary growing by 36 KB for `ura add`?

The release `ura` is 5,784,512 bytes on the default branch and 5,820,976 bytes on this branch:
36,464 bytes, 0.6%, for `ura add` and the repository list it writes, with no new dependency. Nothing
else the checks measure goes up. More in [discovery](discovery-02.md#the-binarys-growth).

Why it matters: the constitution makes each growth your call, recorded in the plan.

- **A (recommended). Accept the growth as an exception, recorded in the plan's complexity
  tracking.**
  - [pro] `ura add` stays, as you asked in round 01.
  - [con] the plan waits for your review before the pull request.
  - Why recommended: 0.6% for a command you asked for, with no new dependency.
- **B. Drop `ura add`: repositories are added from the web UI or by editing `repositories.json`.**
  - [pro] the binary stays as it is, with no exception.
  - [con] the spec loses US4, which you asked for.
- **C. Keep `ura add`, and shrink the binary elsewhere by 36 KB in this feature.**
  - [pro] no exception.
  - [con] unrelated work in this feature, with no known place to save it.

**Answer:**

## Settled without the human

- **One place for each rule**, the constitution's other new rule, holds: the data folder's rules
  moved from TypeScript into the core, and no rule of the list is written twice. See
  [discovery](discovery-02.md#one-place-for-each-rule).

**Notes:**
