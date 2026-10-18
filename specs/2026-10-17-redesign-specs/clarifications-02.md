---
status: awaiting-human
---

# Clarifications, round 02: Redesign and reword specs

> [!IMPORTANT]
>
> 1 question, about 5 minutes.
>
> - Verdict: worth building as proposed; every task is built, and only the pull request is left.
> - The toolchain decision changed on `main` after you approved its rewrite here: the two texts
>   conflict, and only you can say which stands.
> - `main` made coverage optional. The rewrite you approved still says CI must keep a coverage
>   report.
> - Once answered, the spec's toolchain row changes, and the spec comes back for a quick approval.

## Context

### Since the last round

You approved the spec, and every task of [the plan](plan.md) is built and reviewed. Before the pull
request, the branch catches up with `main`. Two commits on `main` changed the toolchain decision
after your approval: "make CI validation reliable and coverage opt-in". This branch rewrote the same
decision, intent first, as you approved. See [discovery](discovery-02.md#why-this-round).

### Goal

Keep one toolchain decision that holds both what you approved here and what you changed on `main`.

### Today

The rewrite you approved has 10 rules, the limit past which `ura check` warns. `main` reversed one
of its rules and added four:

| `main`'s change                                                                         | In the rewrite you approved                           |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Coverage MAY be collected with `vp run coverage`, outside `ready` and CI                | Reversed: "Coverage MUST be a report CI keeps"        |
| Test tasks track the binding's Rust sources and the pinned toolchain as inputs          | Missing: only "each cached on inputs it lists itself" |
| Generated reports and failure evidence MUST NOT invalidate checks                       | Missing                                               |
| Vitest MUST bound its workers to at most four, and to the machine's CPUs                | Missing                                               |
| Browser failures MUST keep screenshots, uploaded by CI even when the test command fails | Missing                                               |
| A newer revision MUST cancel an older CI run on the same branch, `main` included        | Missing                                               |

### Scope

Only `specs/decisions/toolchain.md`. Every other decision on `main` is unchanged since this branch
started, and the code conflicts of the rebase are settled without you.

### Sources

- [`main`'s toolchain decision](https://github.com/mrtolkien/uraeda/blob/main/specs/decisions/toolchain.md)
  and
  [the CI review behind it](https://github.com/mrtolkien/uraeda/blob/main/docs/testing-review-2026-10-17.md).
- [The rewrite on this branch](/specs/decisions/toolchain.md). The full comparison is in
  [discovery](discovery-02.md).

## Q1: How does the toolchain decision take `main`'s change?

The rebase stops on the toolchain decision: `main` edited the old text, this branch replaced it. One
text must stand, and the other's changes are either merged in or dropped. More in
[discovery](discovery-02.md#folding-mains-change-into-the-rewrite).

Why it matters: the decision binds every feature's validation, and CI already follows `main`'s
version. Dropping either side reverses a choice you made.

Under A, these rules replace the rewrite's, and the others stay as you approved them:

> - `vp run ready` MUST run every check of the repository, each cached on inputs it lists itself,
>   the binding's Rust sources and the pinned toolchain included, never on reports or failure
>   evidence; checks too slow for every run MAY run on CI only, and stay runnable locally.
> - CI MUST run every check of `ready` uncached, in the Nix dev shell, on Linux x64, cancel an older
>   run of the same branch, and fail when a job leaves the working tree changed; Windows MUST NOT be
>   assumed supported.
> - Tests MUST stay isolated between checkouts on one machine: temporary folders they remove, no
>   fixed port, a shared limit on browser runs, and at most four Vitest workers.
> - Test runners MUST NOT retry a failed test, a browser failure MUST keep its screenshots, uploaded
>   by CI, and a test failing without a bug MUST be fixed in the pull request that finds it.
> - Coverage MAY be collected with `vp run coverage`, outside `ready` and CI, and a coverage drop
>   MUST NOT fail a check.

The coverage rule moves last, as the weakest. The intent says "coverage is available on demand". The
Why gains a sentence on the October 17 CI review. A consequence says coverage can go down unnoticed.

- **A (recommended). Keep the rewrite, with `main`'s rules merged into its own, staying at 10.**
  - [pro] Both of your choices stand, in the shape you approved.
  - [con] Four rules grow longer, and `main`'s exact wording is paraphrased.
  - Why recommended: it keeps every rule you made, and the decision stays short.
- **B. Keep `main`'s text as it is, and drop the rewrite of this decision.**
  - [pro] `main`'s wording, word for word.
  - [con] 19 rules in the old shape: `ura check` warns, and the rewrite you approved is lost.
- **C. Keep the rewrite as you approved it, and drop `main`'s change.**
  - [pro] Exactly the text you approved with the spec.
  - [con] Coverage becomes required again, and the four new CI rules are lost, though `main`'s code
    already follows them.

**Answer:**

## Settled without the human

### Check these

- **The spec's revision** follows your answer: its toolchain row says what changed, and it comes
  back for your approval, as any changed decision does. The plan and the code need nothing more.
- **The code conflicts of the rebase** are resolved with both sides kept: `main`'s CI fixes and its
  questions-first round page, with this branch's spec page.

**Notes:**
