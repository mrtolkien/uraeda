# Discovery, round 02: Redesign and reword specs

## Why this round

Every task of the [plan](plan.md) is built. Before the pull request, the branch catches up with the
default branch, as the [implementation step](/skills/uraeda/references/implementation.md) asks. Two
commits on `main` changed the toolchain decision after this spec was approved:
[508810b](https://github.com/mrtolkien/uraeda/commit/508810b) and
[c5a1661](https://github.com/mrtolkien/uraeda/commit/c5a1661), "make CI validation reliable and
coverage opt-in". This branch rewrote the same decision, as the spec's decisions table approved. A
conflict in a decision is the human's to resolve.

## Summary

`main` changed the old, long toolchain decision. This branch replaced that text with a short one,
approved with the spec, of exactly 10 rules, the limit `decision.rules` warns past. The two cannot
both stand: the rebase stops on [`specs/decisions/toolchain.md`](/specs/decisions/toolchain.md).
`main`'s change holds one reversed rule and four new ones.

## How other products do it

### Any product

- Not relevant: the question is which of two texts the human approved stands, not a product choice.

### What they have in common

Nothing applies to this round.

## Standards and libraries

Not relevant, for the same reason.

## The code

### Important reads

- [`specs/decisions/toolchain.md` on `main`](https://github.com/mrtolkien/uraeda/blob/main/specs/decisions/toolchain.md):
  19 rules, the old long shape, with the changes below.
- [`specs/decisions/toolchain.md` on this branch](/specs/decisions/toolchain.md): 10 rules, intent
  first, approved on 2026-10-17 with the spec.
- [`docs/testing-review-2026-10-17.md` on `main`](https://github.com/mrtolkien/uraeda/blob/main/docs/testing-review-2026-10-17.md):
  the CI review behind `main`'s change.

### The proposal's path and existing actions

- `main`'s change, rule by rule, against the branch's rewrite:

| `main`'s change                                                                         | In the branch's rewrite                               |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Coverage MAY be collected with `vp run coverage`, outside `ready` and CI                | Reversed: "Coverage MUST be a report CI keeps"        |
| Test tasks track the binding's Rust sources and the pinned toolchain as inputs          | Missing: only "each cached on inputs it lists itself" |
| Generated reports and failure evidence MUST NOT invalidate checks                       | Missing                                               |
| Vitest MUST bound its workers to at most four, and to the machine's CPUs                | Missing                                               |
| Browser failures MUST keep screenshots, uploaded by CI even when the test command fails | Missing                                               |
| A newer revision MUST cancel an older CI run on the same branch, `main` included        | Missing                                               |

- `main` also rewrote the intent's "coverage is reported, never enforced" as "coverage is available
  on demand", added a paragraph to the Why on the October 17 CI review, and reworded two
  consequences.

### Likely changes

- [`specs/decisions/toolchain.md`](/specs/decisions/toolchain.md): the rebase's resolution.
- [`spec.md`](spec.md): the toolchain row of its decisions, then a new revision for the human to
  approve.

## The proposal

### Two approved texts of one decision

The human approved the rewrite with this spec, then changed the old text on `main`. Neither text
holds the other's changes. Picking one silently drops the other's.

## Approaches

Criteria: Principle I (humans stay in control), the spec's decision shape (intent first, at most 10
rules), and `main`'s CI fixes, which its code already relies on.

### Folding `main`'s change into the rewrite

How the rebase resolves `specs/decisions/toolchain.md`.

| Option                                                    | Rules | Keeps `main`'s rules | Keeps the approved shape |
| --------------------------------------------------------- | ----- | -------------------- | ------------------------ |
| A. The rewrite, with `main`'s rules merged into its rules | 10    | yes, merged          | yes                      |
| B. `main`'s text as it is, the rewrite dropped            | 19    | yes, word for word   | no: warns past 10 rules  |
| C. The rewrite as approved, `main`'s change dropped       | 10    | no                   | yes                      |

## Not checked

- Whether `main`'s CI workflow and Vitest configuration already enforce the new rules: they arrive
  with the rebase, and the final review checks them.
