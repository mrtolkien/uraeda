# Discovery, round 02: Multi-repo server

## Why this round

Every task of the [plan](plan.md) is built. Before the final review, the branch caught up with the
default branch, which amended the [constitution](../CONSTITUTION.md) to version 1.3.0 on 2026-10-14.
Its principle VI now says: "Warnings, size, complexity, and duplication measured by the project's
checks MUST NOT go up. An exception MUST be approved by a human in the plan." The branch makes one
measured size go up.

## Summary

CI prints the size of the release `ura` binary on every run ([`ci.yml`](/.github/workflows/ci.yml),
"Print the size of ura"). This branch adds `ura add` and the repository list to the CLI, and the
binary grows by 36,464 bytes, 0.6%. Nothing else the project's checks measure goes up:
`vp run ready` reports no warning, and the project has no complexity or duplication check yet. The
constitution's other new rule, one place for each rule, holds.

## How other products do it

This round needs no product research: it is about this project's own rule.

### What they have in common

Nothing to compare.

## Standards and libraries

### The CLI decision on binary size

The [CLI](../decisions/cli.md) decision says CI "MUST NOT fail on the release binary's size, and
MUST print that size on every run", and that the binary "grows with each dependency a feature
measures and the human accepts, with no limit to raise". The constitution now wins over it: each
growth needs the human's approval in the plan.

## The code

### Important reads

- Release `ura` built with `cargo build --release -p uraeda-cli`, as CI does, on 2026-10-14:
  5,784,512 bytes on the default branch (`main`), 5,820,976 bytes on this branch (`ca028ae`): 36,464
  bytes more.
- [`crates/core/src/repositories.rs`](/crates/core/src/repositories.rs): the list, its file, the
  naming rule, and the data folder, which `ura add` and the binding both use.
- [`crates/cli/src/add.rs`](/crates/cli/src/add.rs): `ura add`, the only CLI caller of the list. No
  new dependency: `serde_json` was already in the core.

### The proposal's path and existing actions

- Without `ura add`, the CLI would not call the list, and the release build's link-time optimisation
  would leave most of the core's list out of the binary. That share is an estimate: it was not
  built.

### Likely changes

- With the exception accepted: the plan's **Complexity tracking** records it, and the plan waits for
  the human's review, as the plan step requires of any constitution exception.
- Without it: `ura add`, its tests, and its row in the skill go, and the spec loses US4.

## The proposal

### One place for each rule

The constitution's other new rule, "Each rule MUST live in one place", holds: the data folder's
rules moved from TypeScript into the core in this branch, and no rule of the list is written twice.
Typed paths are read in the server and the CLI differently on purpose
([R1](rulings.md#r1-typed-paths-are-read-in-the-server-the-core-takes-absolute-ones)).

## Approaches

Criteria come from the constitution's principle VI and the human's answer asking for `ura add`
([Q4](clarifications-01.md#q4-how-do-you-name-a-folder-from-the-browser)).

### The binary's growth

| Option                         | Meets principle VI        | Keeps `ura add` | Work        |
| ------------------------------ | ------------------------- | --------------- | ----------- |
| A. Accept it as an exception   | Yes, approved in the plan | Yes             | Plan review |
| B. Drop `ura add`              | Yes                       | No              | Small       |
| C. Shrink the binary elsewhere | Yes, if it shrinks 36 KB  | Yes             | Unknown     |

## Not checked

- How much of the 36 KB `ura add` alone accounts for: the CLI was not built without it.
