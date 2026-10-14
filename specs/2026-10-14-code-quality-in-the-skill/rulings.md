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

## R4: The LSP verdict test keeps its tiers

- **Decision**: `crates/lsp/tests/reads.rs` `a_spec_verdict_names_its_commits` is left as it was,
  with tiers `[low:false, medium:false, high:true]`. The Neovim verdict test instead starts from a
  spec proposed at `medium` with `plan-review: false`, and checks that Tab to `high` shows
  `Plan review < false >` and approves `high` with `plan-review: false`.
- **Rationale**: the plan asked for `high:false` in the LSP test, but its spec proposes `high` with
  `plan-review: true`, and US6.3 and the task's own interface keep the spec's value at the tier it
  proposes: `high:true` is right. The Neovim test as planned also started from that spec, where Tab
  to `high` shows `true` under both the old and the new default; starting from US6.1's spec makes it
  catch a return of the `high` default.
- **Alternatives considered**: changing the LSP test's spec to another tier, which would change what
  that test is about (a verdict's commits and fields) for no new coverage, since the core, CLI, web,
  and Neovim tests already catch the old default.
- **If wrong**: the LSP layer has no test of its own for the new default. It passes the core's
  `tier_choices` through unchanged, so a row can be added to its test in a few lines.
- **Where**: task 1, `crates/lsp/tests/reads.rs` and `editors/nvim/tests/test_verdict.lua`.

## R5: The nesting threshold is 5, and holds methods to 3 levels

- **Decision**: `clippy.toml` sets `excessive-nesting-threshold = 5`.
  - Calibrated as R1 says, on scratch functions in `crates/core/src/lib.rs`: at 5, a free function
    with five nested blocks (`if` in `for` in `match` in `if` in `loop`) fails and one with four
    passes; at 6, both pass.
  - Clippy also counts an `impl` block, so at 5 a method with four nested blocks fails; it passes
    at 6.
  - No code of the workspace breaks the threshold at 5, so no `excessive_nesting` marker is needed.
- **Rationale**: the decision says no more than 4 levels. At 5 every function holding five fails,
  and methods are held one level tighter. At 6 a free function holding five passes, which breaks the
  decision's rule.
- **Alternatives considered**: 6, which matches the decision for methods but lets five levels
  through in free functions.
- **If wrong**: a method with four nested blocks fails, and is split one level earlier than the
  decision asks. Raising the threshold to 6 is one line.
- **Where**: task 2, `clippy.toml`.

## R6: The markers are the functions clippy reports

- **Decision**: the `too_many_lines` markers go on the functions clippy reports: `clean` (112), and
  the tests `each_rule` (165) and `feature_table` in `crates/core/tests/steps.rs` (109).
  - `read_feature` and `check_sections` get no marker: clippy counts code lines, without blank lines
    and comments, and they are under 100 by that count.
  - The marker break check of step 5 shortens `clean`, which carries a marker, instead of
    `check_sections`.
  - The existing `#[allow]` attributes gain a `reason`, which `allow_attributes_without_reason`
    requires: `dead_code` in the tests' shared `common` modules, and `deprecated` in the LSP.
- **Rationale**: the plan's list came from raw line counts. A marker on a function clippy does not
  flag is unfulfilled, and fails `-D warnings`.
- **Alternatives considered**: marking the plan's list, which fails clippy; or counting raw lines
  with a custom test, which duplicates a lint the decision names.
- **If wrong**: a function of over 100 raw lines with fewer than 100 code lines passes. The decision
  names clippy's lint as the check, so its count is the measure.
- **Where**: task 2, `crates/core/src/actions/clean.rs`, `crates/core/tests/{check,steps}.rs`.

## R7: The autofix commit keeps order and comments by hand

- **Decision**: the commit of the fate config's autofixes also holds the hand edits that keep them
  from changing anything but layout.
  - `QuickAdd`'s and `TaskView`'s section titles are a `Map`, in the order the page shows them: the
    sorted object put Blocked first.
  - A comment that headed one style of a `stylex.create` now sits inside that style, at its top.
  - Four other comments go back on their keys, and the keys around them get a comment of their own
    or move before it: a refusal in `session-state.ts`, `screenshots.ts`'s browser context,
    `live.test.ts`'s stream, and `vite.browser.config.ts`'s `browser` and `expect`.
  - The theme's generated files are rebuilt: the sorted theme orders their declarations, with no
    property or selector changed.
- **Rationale**: `perfectionist/sort-objects` runs with `partitionByComment`, so a comment above a
  key stays at the top of its group while the keys under it are sorted: it ends up above another
  key. The tests did not catch the segment order, which is behaviour.
- **Alternatives considered**: the autofixes alone in their commit, the hand edits in the next. That
  commit would change the priorities' order on screen, and leave dozens of comments on the wrong
  styles.
- **If wrong**: the first commit is not purely mechanical. Its message lists the hand edits.
- **Where**: task 3, `packages/web/src/{QuickAdd,TaskView}.tsx`, the web UI's styles, and the files
  above.

## R8: Logs write to the process's streams

- **Decision**: the server's logs and the scripts' output call `process.stderr.write` and
  `process.stdout.write`, with the same text and a newline, instead of `console`. The two tests that
  check a failure is logged spy on `process.stderr.write`.
- **Rationale**: `no-console` comes with `@nkzw/oxlint-config`, and no active decision covers
  logging, so the rule cannot be turned off. The spec's example of a conflict, the server's logging,
  presumed one. Writing to the stream prints the same line, and `main.ts` already did it.
- **Alternatives considered**: turning `no-console` off for `packages/server`, which no decision
  allows; a logging helper, an abstraction for one line.
- **If wrong**: a later logging decision can bring `console` back and turn the rule off, naming
  itself.
- **Where**: task 3, `packages/server/src/{dev,files,main}.ts`, `fate/errors.ts`,
  `runner/{cache,processes,turns}.ts`, `packages/server/scripts/validate-claude.ts`,
  `packages/web/scripts/screenshots.ts`, and `__tests__/{fate,files}.test.ts`.

## R9: What no behaviour-preserving fix clears is marked in place

- **Decision**: two rules of the config keep today's offenders, each marked in place with
  `oxlint-disable-next-line <rule> -- before the code quality decision: <reason>`.
  - `react/refs`, 8 times: hooks keep the latest value in a ref during render for their effects and
    timers. The web UI's old `"react/refs": "off"` is removed, since no decision names it.
  - `typescript/no-explicit-any`, once: `__tests__/helpers.ts` exports `Data`, the `any` of fate's
    results, which the server's tests read field by field.
- **Rationale**: the spec says the config's remaining violations are "either fixed or marked", and
  the decision marks code that broke a rule when it was approved. Moving a ref's write into an
  effect changes when it is read; typing every fate result is a rewrite of the server's tests.
- **Alternatives considered**: keeping `react/refs` off, which the decision forbids without a
  decision to name; `unknown` in the helpers, which fails dozens of type checks in the tests.
- **If wrong**: the markers say where to start, and fail once their code is fixed.
- **Where**: task 3,
  `packages/web/src/{useRoundPosition,useSave,EditorPage,Question,RoundPage,PrioritiesPage}.ts(x)`,
  `packages/server/src/__tests__/{helpers,sessions.test}.ts`.

## R10: The binding is imported whole by a dynamic import

- **Decision**: the files that pass the binding whole, as the server takes it, load it with
  `const binding = await import("uraeda-binding")`. A test that only calls one function imports it
  by name. `import/no-namespace` ignores `@stylexjs/stylex` only, naming the UI components decision.
- **Rationale**: `import/no-namespace` refuses `import * as binding`, and `createApp` and the
  session manager take the binding as one object, as `loadBinding` gives it in production. A dynamic
  import gives the same module object. `stylex.create`, which the UI components decision names, is
  StyleX's namespace.
- **Alternatives considered**: ignoring `uraeda-binding` in the rule too, which no decision covers;
  an object built from named imports, which would list the binding's 34 functions by hand.
- **If wrong**: the files change back in one line each, if a decision allows the namespace.
- **Where**: task 3, `packages/server/src/testing.ts`, the server's and the web UI's test helpers,
  `vite.config.ts`.

## R11: TypeScript files are marked at their top

- **Decision**: a file over `max-lines` is marked with
  `// oxlint-disable max-lines -- over the limit before the code quality decision: <what to split>`
  on its first line. Functions keep the plan's `oxlint-disable-next-line` marker. Task 4 marks 19
  functions and 5 files, as `vp lint` reported them once task 3's autofixes had moved lines, not the
  16 functions and 3 files the spec and plan counted before.
- **Rationale**: Oxlint reports `max-lines` at the file's last character, so a next-line marker
  would sit above the closing line of the file's last function, far from what it explains. A disable
  comment for one rule at the top is still a marker in place with its reason, and Oxlint reports it
  as unused once the file is under 500 lines, as the decision requires.
- **Alternatives considered**: a next-line marker above the file's last line; turning `max-lines`
  off per file in `vite.config.ts`, which keeps the reason away from the code.
- **If wrong**: each file marker moves in one line.
- **Where**: task 4, `packages/web/src/{Blocks,PrioritiesPage,Transcript}.tsx`,
  `packages/server/src/runner/cache.ts`, `packages/server/scripts/validate-claude.ts`.

## R12: The old-layout test keeps Details under Design

- **Decision**: the test of US2.2 builds the old layout from the example: `## Architecture` renamed
  `## Design`, `## Details`'s heading removed, and its four subsections put back before
  `## Assumptions`. It checks the missing `## Details`, the unknown `## Design`, and
  `"## Assumptions" must come before "### Testing"`.
  - The example's Architecture keeps the Approach text, followed by three bullets: its main units,
    where its rules live, and its tradeoffs.
  - `references/implementation.md` and `references/bug.md` are unchanged: their lines name the
    record's **Behaviour** and **Design**, which this feature does not change, and the `#tests`
    anchor, which stays.
- **Rationale**: US2.2 asks for the missing section and the sections out of order. With the
  subsections left after `## Risk tier`, as the plan's test sketched, they are in order and no order
  problem shows.
- **Alternatives considered**: the plan's arrangement, which tests two of the three problems US2.2
  names.
- **If wrong**: the test checks one more problem than planned; dropping its row is one line.
- **Where**: task 5, `crates/core/tests/check.rs`, the example spec.

## R13: This feature's spec moves to the new layout, its text unchanged

- **Decision**: after task 5, `spec.md` takes the layout it specifies: `## Design` and its
  `### Approach` become `## Architecture`, `### Mockups` becomes `## Mockups`, and Data, Components,
  Error handling, and Testing move under a last `## Details`. No other line changes. Its `revision`
  goes to 2, and the plan's `spec-revision` with it.
- **Rationale**: `ura check specs`, part of `vp run ready`, reports the old layout as 7 problems,
  and SC-003 needs `ready` to pass. Only headings move, so the approved behaviour and design stay as
  the human approved them.
- **Alternatives considered**: leaving the spec in the old layout, which fails `ready`; asking the
  human to re-approve a spec whose text did not change.
- **If wrong**: `git diff` of this commit shows only headings moved, and reverting it is one commit.
- **Where**: after task 5, `spec.md` and `plan.md`'s frontmatter and its link to the architecture.

## R14: The Details fold keeps its subheadings and ends at the next section

- **Decision**: `SpecItems.details` is every top-level block from the `## Details` heading up to the
  next heading of level 1 or 2, found with `headings`, its `###` subheadings included. It does not
  use `section`, which leaves headings out. `Story.details` is the intro paragraph and the list,
  only when both are there. The test adds a row with a `## Details` followed by another section, and
  its example row checks US2's lines 56 to 65, not 56 to 61 as the plan said.
- **Rationale**: the web UI hides the whole section behind one toggle, so its Data, Components,
  Error handling, and Testing headings must be inside the fold. The example spec ends with Details,
  so only a second section after it catches a fold that runs to the end of the file.
- **Alternatives considered**: changing `section` to keep headings, which changes the story blocks
  and the round's context for every other caller.
- **If wrong**: the fold's ids change in one function, `details` in `crates/core/src/files/spec.rs`.
- **Where**: task 6, `crates/core/src/files/spec.rs`, `crates/core/tests/items.rs`.

## R15: The review page's parts, each in a file

- **Decision**: step 1 of task 7 splits `ReviewPage` into `reviewHeadings` and `Band`
  (`ReviewHeadings.tsx`), `YourReview` and `StaleBanner` (`YourReview.tsx`), `useReviewActions`
  (`useReviewActions.ts`), and `ReviewForm`, which stays in `ReviewPage.tsx`. The selection parts
  moved to `Selection.tsx` take the `selection` alone, not `Blocks`' context.
- **Rationale**: the plan named the heading override, the "Your review" list, and the handlers. The
  comment field and the stale banner had to leave too for the component to fall under 100 lines. In
  files of their own, `ReviewPage.tsx` keeps room under 500 lines for task 7's folds and task 8's
  mockups.
- **Alternatives considered**: the same functions in `ReviewPage.tsx`, at about 390 lines before the
  folds and the mockups.
- **If wrong**: the parts move back into one file without a change to what they do.
- **Where**: task 7, `packages/web/src/{ReviewPage,ReviewHeadings,YourReview,Selection}.tsx`,
  `useReviewActions.ts`.

## R16: A fold's toggle takes the place of its title

- **Decision**: a fold's first block, the scenarios' "Acceptance scenarios:" intro or the
  `## Details` heading, is not drawn: the toggle stands in its place, and its anchor, like
  `#details`, moves to the fold. A pending comment on that line shows first inside the fold, which
  it opens.
- **Rationale**: the screenshots showed "Details" twice, the toggle above a heading of the same
  name, and "Scenarios (4)" above "Acceptance scenarios:". [The mockup](mockups/spec-folds.html)
  shows the toggle alone, the scenarios and Data straight under it.
- **Alternatives considered**: drawing every block of the fold under its toggle, as the plan read:
  each label twice. Leaving the title out of the core's fold: its anchor and its comments would have
  no place.
- **If wrong**: the title line can no longer be tapped for a new comment. Drawing it again is one
  line in `FoldNode`, in `Blocks.tsx`.
- **Where**: task 7, `packages/web/src/Blocks.tsx`.

## R17: A fold opened by a comment closes at a tap

- **Decision**: `useSpecFolds`, beside `useOpenKeys`, gives both pages their folds. A review adds
  the folds holding a pending comment's block or the selection, without writing them to the history
  entry; a tap that closes one of them keeps it closed until the human opens it again.
  - happy-dom applies no Astryx stylesheet, so its tests read a folded text as one inside the region
    a closed toggle's `aria-controls` names. The browser tests check what is drawn.
  - A link's target scrolls 16 px below the top, or below the phone's top bar, where a heading would
    otherwise sit under it.
- **Rationale**: review focus 1 closes a fold that holds the selection, and reopens it. A fold
  forced open by its contents could never close.
- **Alternatives considered**: writing the forced folds to the entry, which the plan ruled out; a
  union of the open and the forced keys, which keeps such a fold open whatever the human taps.
- **If wrong**: a fold closed over a pending comment stays closed while the page is shown, the
  comment still listed under "Your review". A reload opens it again.
- **Where**: task 7, `packages/web/src/{useOpenKeys.ts,ReviewPage.tsx,DocumentPage.tsx,Blocks.tsx}`,
  `packages/web/src/__tests__/review.test.tsx`.
