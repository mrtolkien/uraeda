# Rulings: Code quality and maintainability through the skill

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The nesting threshold is calibrated on a scratch function

- **Decision**: clippy's `excessive-nesting-threshold` is the lowest value that flags a function
  whose body holds five nested blocks (`if` in `for` in `match` in `if` in `loop`), and lets four
  pass.
  - The implementer finds it with a scratch function, then reverts that function.
  - The value is noted in `clippy.toml`, with a comment saying it means "4 levels inside a function
    body".
- **Rationale**:
  [`excessive_nesting`](https://rust-lang.github.io/rust-clippy/master/index.html#excessive_nesting)
  counts every block, the function's own and those of `impl` and `mod`, so its number differs from
  the decision's 4 levels. Oxlint's `max-depth` counts inside the function, which is the decision's
  measure.
- **Alternatives considered**: setting the threshold to 4. It would flag most methods of an `impl`
  block that holds a `match`.
- **If wrong**: the limit is looser or tighter than 4 by one level. The threshold changes in one
  line, and the markers follow.
- **Where**: task 2, `clippy.toml`.

## R2: One button per mockup, at the top of the review

- **Decision**: the spec review page shows, before its first block, a region named "Mockups" with
  one large Astryx `Button` per mockup the spec's `## Mockups` section links, labelled "Open the
  mockup: <link text>". Each opens the mockup's page.
- **Rationale**: the human asked for "a big 'open mockups'" at the top of the review
  ([C2](spec-review.md#c2-lines-387388-under-mockups)). Mockups open one per page today, so a single
  button could only open the first one.
- **Alternatives considered**:
  - One "Open mockups" button opening the first mockup, with the others listed on its page: the
    other mockups would be hidden.
  - A gallery of the mockups in frames inside the review: heavier, and the phone has no room for it.
- **If wrong**: the region changes in one component, `ReviewPage`'s top, without touching the core.
- **Where**: task 8, `packages/web/src/ReviewPage.tsx`.

## R3: Rust file length is measured up to the first test module

- **Decision**: `structure.rs` counts a file's lines before its first `#[cfg(test)]` line, or all of
  them when it has none.
- **Rationale**: the decision exempts tests. Several source files hold their unit tests in a
  `mod tests` at the end, like `cli/src/picker.rs`, with 222 of its 418 lines in tests.
- **Alternatives considered**: counting every line, which would flag test code the decision exempts;
  or parsing the file to find test items, which is heavier for the same result on this codebase.
- **If wrong**: a file whose test module is not at its end is measured shorter. The test can read
  modules instead, without changing its list.
- **Where**: task 2, `crates/cli/tests/structure.rs`.
