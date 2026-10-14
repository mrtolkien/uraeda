---
status: auto-approved
spec-revision: 1
---

# Plan: Code quality and maintainability through the skill

**Goal:** this feature makes four changes:

- the spec puts the human's part first and folds its build details in the web UI;
- the skill carries the code-quality concepts in a lean entry point;
- this repository enforces the [code quality](../decisions/code-quality.md) limits;
- plan review is off by default for every tier.

**Architecture:** four owners, one per kind of change.

- **The core owns every fact about a spec**: which blocks fold, which mockups it links, and the
  plan-review default. It lives in [`crates/core/src/files/spec.rs`](/crates/core/src/files/spec.rs)
  and is sent through `SpecItems`.
- **The web UI only draws what the core sends.**
  - [`Blocks`](/packages/web/src/Blocks.tsx) gains folds: runs of top-level blocks wrapped in
    Astryx's `Collapsible`.
  - The pages decide which folds must be open: a pending comment, the selection, or a hash link
    inside one.
  - The open folds live in the history entry, through one hook shared with the transcript's tool
    groups.
- **The linters own the limits.**
  - Clippy and Oxlint check them, with today's offenders marked in place.
  - One structural test, [`structure.rs`](/crates/cli/tests/structure.rs), holds Rust file lengths,
    which no clippy lint covers.
- **The skill owns the concepts.**
  - They are written once, in `references/code-quality.md`, and each step's reference links to the
    part it uses.
  - `SKILL.md` becomes an entry point, its conventions, project setup, and commands moved to three
    references.

See the [spec's design](spec.md#design).

The limits apply from task 2 on: every later task that grows a marked unit restructures it first, in
its own commit, as the decision's consequences say.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **Closing a fold while a comment draft is open under one of its blocks** keeps the draft's text.
   Reopening the fold shows the field with that text. Task 7.
2. **A link to `#details`**, the section's own heading, opens Details. Task 7.
3. **A story whose scenarios have no "…scenarios:" intro** gets no fold: its list stays in view.
   Task 6.
4. **An existing disable comment that the new config makes unused**, like the
   `react-hooks/exhaustive-deps` ones in `SessionPage.tsx`, `data.ts`, and `Transcript.tsx`, fails
   the lint. It is removed or kept with its reason, not left behind. Task 3.
5. **A Rust file whose lines past its first `#[cfg(test)]` line make it long** is measured without
   them, so `picker.rs` (418 lines, 222 of them tests) is not flagged. Task 2.
6. **A listed large file that grows by one line** fails the structural test, even though it was
   already over 500. Task 2.

## Global constraints

From [code quality](../decisions/code-quality.md), word for word:

- Rust and TypeScript functions MUST NOT be longer than 100 lines. Checked by clippy's
  `too_many_lines` and Oxlint's `max-lines-per-function`.
- Rust and TypeScript functions MUST NOT take more than 7 parameters. Checked by clippy's
  `too_many_arguments` and Oxlint's `max-params`.
- Code MUST NOT nest blocks more than 4 levels deep inside a function. Checked by clippy's
  `excessive_nesting` and Oxlint's `max-depth`.
- Rust and TypeScript source files MUST NOT be longer than 500 lines. Tests and generated files are
  exempt. Checked by Oxlint's `max-lines`, and for Rust by a structural test of the workspace.
- The TypeScript lint configuration MUST extend `@nkzw/oxlint-config`, the shared configuration of
  the fate stack. A rule of it MAY be turned off only where it conflicts with an active decision,
  and the decision MUST be named next to it.
- Code that broke a limit when this decision was approved MUST be marked where it stands, with a
  reason. A marker on code that no longer breaks its limit MUST fail the checks.
- A new marker MUST NOT be added unless a human approves it as a constitution exception in the
  plan's complexity tracking.
- A custom lint rule or structural test MUST say how to fix the problem in its message.
- Unit tests MUST NOT sleep for a fixed time, or assert how long something took.

From [stack](../decisions/stack.md):

- Workflow logic, parsing, validation, and workflow states MUST live in the Rust core,
  [`crates/core`](/crates/core/).
- The TypeScript types of core data MUST come from the declarations napi-rs generates for the
  binding. They MUST NOT be redeclared by hand in TypeScript.
- The web UI MUST draw workflow files from the document tree the core sends, and MUST NOT parse
  their markdown, with a library or by hand.

From [UI behaviour](../decisions/ui-behaviour.md):

- Back MUST return to the same scroll position and the same open items.
- Nothing MUST work only on hover: every action has a tap or a keyboard path.

From [UI checks](../decisions/ui-checks.md):

- Every UI test MUST guard a spec's acceptance scenario, edge case, or success criterion, or a rule
  of a UI decision.
- UI tests MUST drive the UI as a user does, through roles, labels, and visible text.
- A test that no longer matches the spec MUST be changed or removed with the spec, never kept
  passing by loosening its assertion.
- Before handing over a UI change, the agent MUST take screenshots of every changed view at both
  sizes and in both themes, review them, and commit them under `screenshots/`.

From [toolchain](../decisions/toolchain.md) and [CLI](../decisions/cli.md):

- `vp run ready` MUST run every check of the repository. A new language, package, crate, or tool
  MUST add its checks to it.
- Every rule the CLI enforces or checks MUST be written in the skill, `skills/uraeda/`.
- A change to a command's behaviour MUST update the skill in the same change.
- Files generated by napi-rs MUST be committed, and MUST NOT be edited by hand.

From [the spec](spec.md) and its review:

- The labels are "Scenarios (N)", where N is the story's number of scenarios, and "Details". Both
  folds are closed by default.
- `SKILL.md` is at most 20,000 characters.
- The spec's sections, in order: `## User stories`, `## Edge cases`, `## Success criteria`,
  `## Architecture`, `## Mockups` (optional), `## Assumptions`, `## Decisions`,
  `## Constitution check`, `## Risk tier`, `## Details`. Details holds `### Data`, `### Components`,
  `### Error handling`, and `### Testing`.
- Mockups should be front and center on the spec review page, with a big "open mockups" at its top
  when the spec has mockups ([C2](spec-review.md#c2-lines-387388-under-mockups)).

## Code read

**Spec items and the plan-review default**

- [`crates/core/src/files/spec.rs`](/crates/core/src/files/spec.rs): `REVIEWED_TIER`,
  `plan_review_default`, `tier_choices`, and `items`.
  - `items` builds each story's `scenarios` from the block ending in "scenarios:" and the list after
    it.
- [`items.rs`](/crates/core/src/files/items.rs): `Story`, `SpecItems`, `section`, `headings`, and
  `named_section`.
  - Sections are computed on demand: the document model is a flat list with no section nodes.
- **Callers of the default:**
  - `items.rs` line 224;
  - `actions/review.rs` `approve`, lines 268 to 277;
  - the help text of `crates/cli/src/main.rs`, lines 99 to 100;
  - the web's `ReviewVerdict.tsx`, lines 92 to 94;
  - the LSP `uraeda/verdict`, and Neovim's `verdict.lua`.

**Web rendering**

- [`Blocks.tsx`](/packages/web/src/Blocks.tsx), 527 lines:
  - `Blocks` draws the top-level blocks or `ids`, with a `selection` and an `override`.
  - `useSelect` ignores clicks on `button:not([aria-pressed])`, so a `Collapsible` trigger never
    selects.
- [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx): one component of about 222 lines.
  - It overrides story headings with a band and an h3.
  - It places pending comments with `usePlacedComments`, and keeps the draft in `useCommentDraft`.
- [`DocumentPage.tsx`](/packages/web/src/DocumentPage.tsx) draws `file.current.document` alone.
- [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx), lines 238 to 266, finds the spec block
  linking a mockup with its own `links()`, from the spans. This duplicates a fact the core can own.
- [`Transcript.tsx`](/packages/web/src/Transcript.tsx) `useOpenGroups`, lines 101 to 120: open keys
  in the history entry (`currentEntry().open`, `updateEntry`), for Back and reloads.
- **Astryx `Collapsible`** (0.6.8): `trigger`, `isOpen`, and `onOpenChange`.
  - Closed content stays mounted with `display: none`.
  - Its content area sets body typography, which must not override the reading size.
  - It is already used in `RoundPage.tsx` line 84.
- [`views.ts`](/packages/web/src/views.ts) lines 20 to 36:
  - `ItemsSelection.spec` lists its fields one by one.
  - Arrays come whole, so `stories` brings the new fields of `Story`.
- Routes: a mockup page is `/f/<folder>/mockups/<name>` (`routes.tsx` line 43).

**Tests**

- **Core:**
  - [`proposal.rs`](/crates/core/tests/proposal.rs): the plan-review table and the tier choices.
  - [`items.rs`](/crates/core/tests/items.rs) lines 115 to 153: stories, scenarios, and criteria of
    the example spec.
  - [`check.rs`](/crates/core/tests/check.rs) lines 79 to 255: `each_rule` mutates the example spec.
  - [`actions.rs`](/crates/core/tests/actions.rs) lines 268 to 286.
- **CLI:** [`review.rs`](/crates/cli/tests/review.rs) lines 155 to 285, and
  [`skill.rs`](/crates/cli/tests/skill.rs), whose command test already reads `SKILL.md` and every
  reference.
- **LSP:** [`reads.rs`](/crates/lsp/tests/reads.rs) lines 120 to 150; and `editing.rs`,
  `commands.rs`, and `diagnostics.rs`, which use the example spec's lines up to 60.
- **Neovim:** `test_verdict.lua` lines 170 to 204, plus `test_comment.lua`, `test_inline.lua`, and
  `test_jumps.lua` on lines 12 to 60 of the example spec.
- **Web, happy-dom:**
  - [`review.test.tsx`](/packages/web/src/__tests__/review.test.tsx) pads the fixture spec so
    scenario 1 of US2 is on line 92, and finds blocks through their `aria-pressed` toggles.
  - `mockup.test.tsx` expects `under "Mockups"`.
  - Line 147 of `review.test.tsx`: approving at `high` turns plan review on.
- **Web, browser** ([`__browser__/`](/packages/web/src/__browser__/), project `uraeda-web-browser`,
  WebKit at 402 × 874 and 1440 × 900):
  - `review.test.tsx` taps a US2 scenario;
  - `layout.test.tsx` checks a spec's insets;
  - `scroll.test.tsx` needs a link 500 px down.
- **Fixtures:**
  `fixtures/repo/branches/{2026-10-06-recurring-tasks,2026-10-12-cli-tuis,2026-10-13-plan-review}/specs/*/spec.md`
  in the old layout.

**Lint and checks**

- [`Cargo.toml`](/Cargo.toml) lines 41 to 42: `clippy::all` at warn. There is no `clippy.toml`.
  `vp run ready` runs clippy with `-D warnings` ([`package.json`](/package.json) line 7).
- **Rust functions over 100 lines:**
  - `clean` (`actions/clean.rs:64`, 125);
  - `read_feature` (`workspace.rs:776`, 106);
  - `check_sections` (`check/sections.rs:131`, 102);
  - the test `each_rule` (`tests/check.rs:87`, 169).
- **Rust files over 500 lines:** `workspace.rs` 1080, `api.rs` 1004, `files/document.rs` 686,
  `files/priorities.rs` 685, `git.rs` 625, and `lsp/src/commands.rs` 539. Each is to be measured
  without its test module.
- [`vite.config.ts`](/vite.config.ts) lines 106 to 156:
  - two JS plugins, and the UI rules for `packages/web/src/**`;
  - `options: { typeAware, typeCheck }`;
  - fixtures in `src/__lint__/`, linted one by one by
    [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts) with `URAEDA_LINT_FIXTURES=1`.
- **Oxlint 1.85.0**, bundled by vite-plus 1.0.0:
  - `extends` takes config objects;
  - `options.reportUnusedDisableDirectives` takes `"error"`;
  - `max-lines`, `max-lines-per-function`, `max-params`, and `max-depth` exist.
- **TypeScript functions over 100 lines:** 16, listed in
  [discovery](discovery-01.md#important-reads). Files over 500 lines: `runner/cache.ts` 636,
  `Transcript.tsx` 544, `Blocks.tsx` 527. Test files are exempt.
- **`@nkzw/oxlint-config` 2.0.1** ([repository](https://github.com/nkzw-tech/oxlint-config)): 185
  rules at `error`. Its JS plugins are `@nkzw/eslint-plugin`, `eslint-plugin-no-only-tests`, and
  `eslint-plugin-perfectionist`.

**The skill**

- [`SKILL.md`](/skills/uraeda/SKILL.md): 450 lines and 34,339 characters.
  - Other files link to its anchors `#coming-back-to-the-human` (13 times),
    `#going-back-to-the-human-with-new-questions` (7), and `#commits` (2).
  - `crates/core/src/steps.rs` line 115 names `references/<step>.md`, so the step references keep
    their names.

## Constitution check

| Principle                        | Complies | Notes                                                                   |
| -------------------------------- | -------- | ----------------------------------------------------------------------- |
| I. Humans stay in control        | yes      | The amendment stays the human's commit; no task edits `CONSTITUTION.md` |
| II. Git and plain text first     | yes      | The spec stays one markdown file; folds are a view                      |
| III. Asynchronous by default     | yes      | No change to how steps end                                              |
| IV. Review effort matches impact | yes      | Task 7 folds the build details; task 8 puts mockups first               |
| V. Tools are optional            | yes      | Limits live in clippy and Oxlint config; `ura` measures nothing         |
| VI. Code is checked against spec | yes      | Every scenario has a test below; no new abstraction without a row       |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Code quality](../decisions/code-quality.md): the limits and markers (tasks 2 to 4), and the
  structural steps of tasks 7 and 8.
- [Stack](../decisions/stack.md): folds and mockup links come from the core (tasks 6 and 8).
  `MockupPage` drops its own link search (task 8).
- [UI components](../decisions/ui-components.md): the folds are Astryx's `Collapsible`, and the
  mockup buttons Astryx's `Button` (tasks 7 and 8).
- [UI behaviour](../decisions/ui-behaviour.md): the open folds survive Back (task 7).
- [UI layout](../decisions/ui-layout.md): fold triggers at 44 px under a coarse pointer, checked by
  the layout test (task 7).
- [UI checks](../decisions/ui-checks.md): browser tests and screenshots (tasks 7 and 8).
- [Toolchain](../decisions/toolchain.md): the new checks run in `vp run ready`, and the new dev
  dependencies are pinned (tasks 2 to 4).
- [CLI](../decisions/cli.md): the plan-review default changes with its skill text (task 1), and
  every command stays named in the skill (task 9).

## Complexity tracking

| Abstraction or exception                                       | Why it is needed                                                                                    | Simpler alternative rejected because                                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Fold` and the `folds` prop of `Blocks`                        | One way to fold, used by the review page and the document page                                      | Each page splitting its blocks and calling `Blocks` per segment repeats the walk in two places |
| `useOpenKeys`, moved out of `Transcript.tsx`'s `useOpenGroups` | The transcript's tool groups and the spec's folds keep open items in the history entry the same way | A second hook with the same history logic would be a copy of a rule in the same layer          |
| `structure.rs` and its list of large files                     | Rust file lengths, which no clippy lint checks, as the decision requires                            | A shell line in `ready` could not list exceptions with their lengths, nor say how to fix       |
| `SpecItems.mockups`, replacing `MockupPage`'s `links()`        | The review page's buttons and the mockup page both need the spec's mockup links                     | Searching spans in TypeScript twice would be a second home for a fact the core owns            |
| `references/code-quality.md`                                   | The concepts are used by discovery, spec, plan, implementation, and setup                           | Repeating them in five references would copy each rule five times                              |

## Review comments

The spec was approved with two comments ([spec-review.md](spec-review.md)), which supersede nothing
in the spec. They add to it:

- **C1** ("No, it's good, use it"): confirms `@nkzw/oxlint-config`. Task 3.
- **C2** ("Mockups should be front and center … a big 'open mockups' at the top of the specs review
  page if there are mockups"): an "Open mockups" area at the top of the spec review page, with one
  large button per mockup, before the first block. Task 8.

---

## Task 1: Plan review off by default for every tier

**Files:**

- Modify: `crates/core/src/files/spec.rs` (`REVIEWED_TIER`, `plan_review_default`)
- Modify: `crates/cli/src/main.rs` (the `--tier` help, lines 99 to 100)
- Modify: `skills/uraeda/SKILL.md` (status table, lines 164 and 176),
  `skills/uraeda/references/spec.md` (frontmatter line 141, tier table lines 294 to 305),
  `references/plan.md` (line 388), `references/approval.md` (lines 39 to 41), templates
  `specs/YYYY-MM-DD-feature-slug/spec.md` (line 6) and `specs/README.md` (line 52)
- Test: `crates/core/tests/proposal.rs`, `crates/core/tests/actions.rs`,
  `crates/cli/tests/review.rs`, `crates/lsp/tests/reads.rs`,
  `packages/web/src/__tests__/review.test.tsx`, `editors/nvim/tests/test_verdict.lua`

**Interfaces:**

- Produces: `plan_review_default(proposed, current, chosen) -> bool` returns
  `current.unwrap_or(false)` when `chosen == proposed`, and `false` otherwise.
  - `tier_choices` gives `plan_review: false` for every tier the spec does not propose.
  - The signatures are unchanged.

- [ ] **Step 1: Write the failing tests**

```rust
// crates/core/tests/proposal.rs: US6. The plan never waits by default; the spec's own value holds
// while the tier stays the one it proposes.
for (proposed, current, chosen, expected) in [
    (Some("low"), None, Some("low"), false),
    (Some("medium"), Some(false), Some("high"), false), // US6.1, US6.2
    (Some("high"), None, Some("high"), false),
    (None, None, Some("high"), false),
    (Some("medium"), Some(true), Some("medium"), true), // US6.3
    (Some("low"), Some(true), Some("high"), false),
] { /* assert_eq!(spec::plan_review_default(..), expected) */ }
```

Change every other expectation of `true` for `high` to `false`:

- `proposal.rs` `a_spec_lists_its_tiers_with_their_plan_review`:
  `[low:true, medium:false, high:false]`;
- `actions.rs` lines 268 to 286, renamed `approving_with_a_higher_tier_leaves_the_plan_review_off`;
- `cli/tests/review.rs`:
  - lines 155 to 170, renamed `approve_with_a_high_risk_tier_leaves_the_plan_review_off`, expects
    `plan-review: false`;
  - the rows of lines 213 to 252;
- `lsp/tests/reads.rs` lines 120 to 150: tiers `[low:false, medium:false, high:false]`, with a
  proposed `high` and `plan-review: true` still read as `planReview: true`;
- the web test at line 147, renamed "approving with a higher tier leaves the plan's review off"
  (US6.1): it starts from medium and `false`, picks `high`, approves, and expects
  `plan-review: false` in the committed spec;
- `test_verdict.lua` lines 170 to 204: Tab to `high` shows `Plan review < false >`.

The break these catch: putting back `chosen == Some("high")` as the default makes each of them fail.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test proposal`
- Expected: FAIL, `(Some("high"), None, Some("high"))`: `left: true, right: false`.

- [ ] **Step 3: Implement the default, and its text everywhere it is written**

- Remove `REVIEWED_TIER`. The default is `false` whatever the tier.
- Every skill and help text that says "true for high" says the plan waits only when the human turns
  plan review on when approving, or when the plan lists a constitution exception.
- The spec template's frontmatter reads `plan-review: false`.
- The tier table of `references/spec.md` keeps its tiers and typical features, and drops the plan
  review column.

- [ ] **Step 4: Run all tests**

- Run: `cargo test && vp test packages/web/src/__tests__/review.test.tsx && vp run test:nvim`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates skills packages/web/src/__tests__/review.test.tsx editors/nvim/tests
git commit -m "feat(code-quality-in-the-skill): plan review is off by default for every tier"
```

## Task 2: Rust limits

**Files:**

- Create: `clippy.toml`, `crates/cli/tests/structure.rs`
- Modify: `Cargo.toml` (`[workspace.lints.clippy]`)
- Modify: `crates/core/src/actions/clean.rs` (`clean`), `crates/core/src/workspace.rs`
  (`read_feature`), `crates/core/src/check/sections.rs` (`check_sections`),
  `crates/core/tests/check.rs` (`each_rule`): markers only
- Test: `crates/cli/tests/structure.rs`

**Interfaces:**

- Produces:
  - `structure.rs`'s list `LARGE: &[(&str, usize)]`, each listed file with its length today;
  - the rule later tasks follow: a listed file may shrink, and must leave the list once it is at or
    under 500 lines.

- [ ] **Step 1: Write the failing structural test**

The test walks `crates/*/src/**/*.rs`. Each file's length is its lines before its first
`#[cfg(test)]` line, or all its lines. It checks three things:

```rust
// crates/cli/tests/structure.rs: US3.3, US3.5, and the review focus's growth of a listed file.
#[test]
fn rust_source_files_stay_under_500_lines() {
    // A file over 500 lines and not in LARGE:
    //   "crates/x/src/y.rs has 501 lines, over the 500 of the code quality decision: split it by
    //    responsibility, into modules of its folder."
    // A file in LARGE now longer than its listed length:
    //   "crates/core/src/api.rs grew from 1004 to 1005 lines: it is over the 500 of the code
    //    quality decision, so it may only shrink. Restructure it first, in a commit of its own."
    // A file in LARGE now at or under 500 lines:
    //   "crates/core/src/api.rs has 480 lines: remove it from LARGE in tests/structure.rs."
}
```

Write a second test, `the_measure_skips_test_modules`, on a temporary file: 10 lines, a
`#[cfg(test)]` line, then 600 lines. It measures 10.

`LARGE` starts empty, so the first run reports every large file.

The breaks these catch:

- counting the test module makes `picker.rs`-like files fail;
- dropping the growth check lets a listed file grow.

- [ ] **Step 2: Run it to check it fails**

- Run: `cargo test -p uraeda-cli --test structure`
- Expected: FAIL, `crates/core/src/workspace.rs has 1080 lines, over the 500 …` (lengths measured
  without test modules may be lower).

- [ ] **Step 3: Fill `LARGE` with each reported file and its measured length**

- [ ] **Step 4: Turn the clippy limits on**

- `clippy.toml`:
  - `too-many-lines-threshold = 100`;
  - `too-many-arguments-threshold = 7`;
  - the `excessive-nesting-threshold` that flags a fifth level of blocks inside a function body. See
    [R1](rulings.md#r1-the-nesting-threshold-is-calibrated-on-a-scratch-function).
- `Cargo.toml` `[workspace.lints.clippy]`: `too_many_lines = "warn"` and
  `allow_attributes_without_reason = "warn"`, next to `all`.
- Run `cargo clippy --workspace --all-targets -- -D warnings`. Mark each function it reports with
  `#[expect(clippy::<lint>, reason = "over the limit before the code quality decision: <what to split>")]`,
  with nothing else changed.

- [ ] **Step 5: Check that each limit catches its break**

Do each check, see it fail, and revert it before the next:

- Add a scratch function of 101 lines to `crates/core/src/lib.rs`: clippy fails with
  `too_many_lines` (US3.1).
- Shorten `check_sections` to under 100 lines, as a scratch change that keeps its marker: clippy
  fails with "this lint expectation is unfulfilled" (US3.4).
- Add a line to `crates/core/src/api.rs`: `structure` fails with "grew from …".

Write what each run printed in the task's commit body.

- [ ] **Step 6: Run all checks**

- Run: `cargo clippy --workspace --all-targets -- -D warnings && cargo test`
- Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add clippy.toml Cargo.toml crates
git commit -m "build(code-quality-in-the-skill): clippy limits and a size test hold the Rust code"
```

## Task 3: The fate stack's lint configuration

**Files:**

- Modify: `package.json` and `pnpm-workspace.yaml` (catalog: `@nkzw/oxlint-config`,
  `@nkzw/eslint-plugin`, `eslint-plugin-no-only-tests`, `eslint-plugin-perfectionist`, exact
  versions), `pnpm-lock.yaml`, `vite.config.ts` (`lint.extends`, `options`)
- Modify: every TypeScript file the config's autofixes or fixes touch, in `packages/`
- Create: `packages/web/src/__lint__/only-test.test.tsx`,
  `packages/web/src/__lint__/unused-directive.tsx`
- Test: `packages/web/src/__tests__/lint.test.ts`

**Interfaces:**

- Produces:
  - `vite.config.ts`'s `lint` extends `@nkzw/oxlint-config`, keeps today's rules and overrides, and
    sets `options.reportUnusedDisableDirectives: "error"`.
  - Rules turned off carry a comment naming the decision they conflict with.

- [ ] **Step 1: Write the failing lint tests**

Add to the `test.each` of `lint.test.ts` (US3.6, review focus 4):

- `["only-test.test.tsx", "no-only-tests"]`, on a file with one `test.only(...)`;
- `["unused-directive.tsx", "Unused eslint-disable directive"]`, on a file whose
  `// oxlint-disable-next-line no-console -- reason` sits above a line without a console call.

Match the message Oxlint really prints, checked once by hand.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/lint.test.ts`
- Expected: FAIL. The output of `only-test.test.tsx` does not contain `no-only-tests`.

- [ ] **Step 3: Add the config and its plugins, pinned, and extend it**

Import the config object in `vite.config.ts`, and pass it to `lint.extends`, as fate's own
`vite.config.ts` does. Run `vp lint` and keep its report.

- [ ] **Step 4: Apply the autofixes in a commit of their own**

- Run: `vp check --fix`, then `vp test`.
- Expected: PASS. The autofixes change no behaviour.

```bash
git add packages
git commit -m "style(code-quality-in-the-skill): apply the fate lint config's fixes"
```

- [ ] **Step 5: Fix what remains**

Fix each remaining error by hand, without changing behaviour. A rule may be turned off only where it
conflicts with an active decision, naming it next to the rule. If an error can be neither fixed nor
tied to a decision, stop and write a ruling before going on.

Each existing `oxlint-disable` that is now unused is removed. One still needed keeps its reason.

- [ ] **Step 6: Run all checks**

- Run: `vp check && vp test`
- Expected: PASS, the two new fixtures included.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml vite.config.ts packages
git commit -m "build(code-quality-in-the-skill): TypeScript follows the fate stack's lint config"
```

## Task 4: TypeScript limits

**Files:**

- Modify: `vite.config.ts` (`lint.rules`, and an override turning `max-lines` off for
  `**/__tests__/**`, `**/__browser__/**`, `**/*.test.ts`, `**/*.test.tsx`)
- Modify: the 16 functions and 3 files over the limits: markers only
- Create: `packages/web/src/__lint__/long-function.tsx`, `long-file.tsx`, `many-params.tsx`,
  `deep-nesting.tsx`
- Test: `packages/web/src/__tests__/lint.test.ts`

**Interfaces:**

- Produces:
  - `max-lines-per-function` `{ max: 100 }`, `max-lines` `{ max: 500 }`, `max-params` `{ max: 7 }`,
    and `max-depth` `{ max: 4 }`, at `error`;
  - each marker reads
    `// oxlint-disable-next-line <rule> -- over the limit before the code quality decision: <what to split>`.

- [ ] **Step 1: Write the failing lint tests**

Add to `lint.test.ts`'s `test.each` (US3.2, SC-002, SC-005), each fixture just over its limit:

- `long-function.tsx`, a function of 101 lines: `max-lines-per-function`;
- `long-file.tsx`, 501 lines: `max-lines`;
- `many-params.tsx`, a function of 8 parameters: `max-params`;
- `deep-nesting.tsx`, five nested `if` blocks: `max-depth`.

Then a test "a marked function over the limit passes", on `long-function.tsx`'s twin
`marked-function.tsx` with its marker: exit status 0.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/lint.test.ts`
- Expected: FAIL, `long-function.tsx`'s output lacks `max-lines-per-function`.

- [ ] **Step 3: Set the limits, then mark today's offenders**

- Run: `vp lint`.
- Mark each reported function and file with its marker, and change nothing else.
- Check that a marker left on a shortened function fails with the unused-directive error from task
  3, then revert the scratch change.

- [ ] **Step 4: Run all checks**

- Run: `vp check && vp test`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts packages
git commit -m "build(code-quality-in-the-skill): size and nesting limits hold the TypeScript code"
```

## Task 5: The human-first spec layout

**Files:**

- Modify: `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md`,
  `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/spec.md`, and the three spec
  fixtures under `fixtures/repo/branches/*/specs/*/spec.md`
- Modify: `skills/uraeda/references/spec.md`:
  - the overview, lines 13 to 35;
  - the document skeleton, lines 130 to 184;
  - Behaviour, lines 192 to 210, with stories of one or two sentences;
  - Design, lines 212 to 244, becoming Architecture and Details;
  - self-review and red flags, lines 317 to 345.
- Modify: `references/plan.md` (lines 34, 134 to 137, 200, 205 to 207, 304 to 306, 358, 366), the
  plan template (line 18: `spec.md#architecture`), `references/implementation.md` (line 217),
  `references/finish.md` (lines 58 to 61), `references/bug.md` (lines 53 to 57), the specs README
  template (line 31), the example's `plan.md` (links to `spec.md#design`), `README.md` (where it
  describes the spec)
- Test: `crates/core/tests/check.rs`

**Interfaces:**

- Produces:
  - **The section order** of the [global constraints](#global-constraints).
  - **The example spec.** Its lines up to `## Success criteria` are unchanged, so tests on lines 1
    to 120 keep their numbers. `## Design`'s Approach becomes `## Architecture`, which also names
    the main units and the tradeoffs. Mockups become `## Mockups`. Data, Components, Error handling,
    and Testing move under a last `## Details`.
  - **The template.** `## Mockups` keeps its `[Optional` placeholder; `## Details` and its four
    subsections are required.

- [ ] **Step 1: Write the failing test**

```rust
// crates/core/tests/check.rs: US2.2. A spec in the old layout reports what to move.
#[test]
fn a_spec_in_the_old_layout_reports_its_moved_sections() {
    // Arrange: the example spec with `## Architecture` renamed `## Design`, and `## Details`'s
    // heading removed, so Data, Components, Error handling, and Testing sit as before.
    // Assert: a `sections.missing` problem `missing section "## Details"`, and a `sections.unknown`
    // problem for `## Design`.
}
```

US2.1 is the existing `the_example_has_no_problems`, which fails as soon as the template changes.

- [ ] **Step 2: Change the template, then run the tests to check they fail**

- Run: `cargo test -p uraeda-core --test check`
- Expected: FAIL, `the_example_has_no_problems`: `missing section "## Architecture"`.

- [ ] **Step 3: Move the example and the fixtures to the new layout, then rewrite the references**

- The text of each moved section stays as it is. Only headings and their order change.
- Every reference line listed above names the new sections.
- The anchors `references/spec.md#what-is-a-decision` and `#tests` keep their headings.

- [ ] **Step 4: Run all tests**

- Run:
  `cargo test && cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs && vp test && vp run test:nvim`
- Expected: PASS. A test still keyed on a line after line 120 of the example spec gets its line
  updated, never its assertion loosened.

- [ ] **Step 5: Commit**

```bash
git add skills fixtures crates/core/tests/check.rs README.md packages crates editors
git commit -m "feat(code-quality-in-the-skill): specs put the human's part first and the details last"
```

## Task 6: The core finds a spec's folds

**Files:**

- Modify: `crates/core/src/files/items.rs` (`Story`, `SpecItems`), `crates/core/src/files/spec.rs`
  (`items`)
- Modify: `packages/binding/index.d.ts` (generated), `packages/web/src/views.ts`
  (`ItemsSelection.spec`)
- Test: `crates/core/tests/items.rs`

**Interfaces:**

- Produces:
  - `Story.details: Vec<u32>`: its scenarios' intro paragraph and their list, or empty.
  - `SpecItems.details: Vec<u32>`: the `## Details` heading and every top-level block after it, up
    to the next level-1 or level-2 heading. It is empty when there is no such section.
  - In TypeScript, through the generated declarations: `story.details` and `spec.details`, both
    `Array<number>`.

- [ ] **Step 1: Write the failing tests**

A table-driven test, `a_spec_has_its_folds`, with one row per case:

- the example spec: US2's details are the block ids of "Acceptance scenarios:" and its list (lines
  56 to 61), and `details` starts with the `## Details` heading block and ends with the Testing
  table;
- a story with no scenarios: empty;
- a story whose list has no "…scenarios:" intro: empty (review focus 3);
- a spec without `## Details`: empty.

The break this catches: folding from `## Details` to the end of the file, and not to the next
level-2 heading.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test items`
- Expected: FAIL to compile: `no field details on type Story`.

- [ ] **Step 3: Implement, from `section` and `headings`, then regenerate the binding**

Add `details: true` to `ItemsSelection.spec`. `stories` comes whole.

- [ ] **Step 4: Run all tests**

- Run: `cargo test && vp run --filter uraeda-binding build && vp check && vp test`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/core packages/binding/index.d.ts packages/web/src/views.ts
git commit -m "feat(code-quality-in-the-skill): a spec's scenarios and details are folds the core finds"
```

## Task 7: The web UI folds a spec

**Files:**

- Create: `packages/web/src/useOpenKeys.ts`, and the files the restructuring steps extract
- Modify: `packages/web/src/Transcript.tsx` (`useOpenGroups` becomes `useOpenKeys`),
  `packages/web/src/Blocks.tsx` (`folds`), `packages/web/src/ReviewPage.tsx`,
  `packages/web/src/DocumentPage.tsx`
- Test: `packages/web/src/__tests__/review.test.tsx`,
  `packages/web/src/__tests__/document.test.tsx`, `packages/web/src/__browser__/review.test.tsx`,
  `packages/web/src/__browser__/layout.test.tsx`

**Interfaces:**

- Consumes: `story.details` and `spec.details` (task 6).
- Produces:
  - `type Fold = { key: string; label: string; ids: ReadonlyArray<number> }`, exported from
    `Blocks.tsx`.
  - `Blocks` takes
    `folds?: { list: ReadonlyArray<Fold>; open: ReadonlyArray<string>; onOpenChange: (key: string, isOpen: boolean) => void }`.
    - It draws each fold where its first block would be, as a `Collapsible` whose trigger is the
      label, at the reading size, and skips the fold's blocks in the main walk.
    - When the location's hash names the anchor of a block inside a fold, it opens that fold and
      scrolls to the block.
  - `useOpenKeys(): { open: ReadonlyArray<string>; onOpenChange: (key: string, isOpen: boolean) => void }`,
    the former `useOpenGroups`, in its own file.
  - `specFolds(spec: SpecItems): Array<Fold>`, beside `Blocks`:
    - a fold per story with details, keyed by the story's id and labelled `Scenarios (${n})`, where
      n is its number of scenarios;
    - then `{ key: "details", label: "Details" }` when `spec.details` is not empty.

- [ ] **Step 1: Restructure `Blocks.tsx` and `ReviewPage.tsx` under their limits, alone**

`Blocks.tsx` is over 500 lines and the `ReviewPage` component over 100, both marked.

- Move the selection parts of `Blocks.tsx` (`Selection`, `selectable`, `useSelect`, `After`,
  `Selectable`) to `Selection.tsx`.
- Split `ReviewPage` into its heading override, its "Your review" list, and its handlers, until the
  component is under 100 lines.
- Remove both markers, move `useOpenGroups` to `useOpenKeys.ts`, and change no behaviour.

- Run: `vp check && vp test`
- Expected: PASS.

```bash
git add packages/web/src
git commit -m "refactor(code-quality-in-the-skill): blocks' selection and the review page's parts in their own files"
```

- [ ] **Step 2: Write the failing tests**

In `__tests__/review.test.tsx`, on the fixture spec:

- "a spec under review shows each story's scenarios and its details folded" (US1.1, SC-001):
  - the buttons "Scenarios (3)" (US1), "Scenarios (4)" (US2), and "Details" are `aria-expanded`
    false;
  - `screen.queryByText(/a weekly task due Monday the 5th/)` is not visible;
  - neither is the Data heading.
- "opening a story's scenarios lets the human comment on one" (US1.2): tap "Scenarios (4)", tap
  scenario 1, and the comment form names `Lines 92–93, under "US2: Complete a repeating task (P1)"`.
- "a pending comment opens its fold" (US1.3): with a pending comment on lines 92 to 93, US2's fold
  is open, showing Edit and Remove.
- "a pending comment in the details opens them": with a pending comment on the Testing table's
  "Upgrade of version 1 data" row, Details is open.
- "closing a fold keeps the draft" (review focus 1):
  - open US2, tap scenario 1, type "Twice?";
  - close and reopen US2;
  - the field still reads "Twice?".
- Existing tests that tap a scenario or the Testing row open its fold first. Their expectations
  stay.

In `__tests__/document.test.tsx`, "an approved spec shows the same folds" (US1.6).

In `__browser__/review.test.tsx`:

- "open folds survive Back" (US1.4): open US2 and Details, go to the feature page, go back, and both
  are `aria-expanded` true.
- "a link to the data opens the details" (US1.5, review focus 2): go to the spec's URL with `#data`.
  Details is open and the Data heading is in view. The same holds with `#details`.
- The existing scenario tap opens "Scenarios (4)" first.

`layout.test.tsx`'s spec case opens every fold before measuring, so the scenarios' insets are still
checked. Its control heights check covers the triggers.

- [ ] **Step 3: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/review.test.tsx`
- Expected: FAIL, `Unable to find role="button" and name "Scenarios (3)"`.

- [ ] **Step 4: Implement the folds, then pass them from both pages**

- Both pages pass `specFolds(spec)` with `useOpenKeys()` when the file is a spec.
- `ReviewPage` adds to the open keys every fold holding a placed comment's block or the selection,
  without writing them to the history entry.
- A trigger never selects a block: it is a button without `aria-pressed`.

- [ ] **Step 5: Run all tests, then take the screenshots**

- Run: `vp check && vp test`
- Expected: PASS.
- Take screenshots of the review page and of an approved spec, folds closed and open, at both sizes
  and in both themes, through `packages/web/scripts/screenshots.ts`. Review them against
  [the mockup](mockups/spec-folds.html), fix what differs, and save them in
  `specs/2026-10-14-code-quality-in-the-skill/screenshots/`.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src specs/2026-10-14-code-quality-in-the-skill/screenshots
git commit -m "feat(code-quality-in-the-skill): the web UI folds a spec's scenarios and details"
```

## Task 8: Mockups at the top of the spec review

**Files:**

- Modify: `crates/core/src/files/items.rs` (`SpecItems`), `crates/core/src/files/spec.rs` (`items`),
  `packages/binding/index.d.ts` (generated), `packages/web/src/views.ts`,
  `packages/web/src/ReviewPage.tsx`, `packages/web/src/MockupPage.tsx` (`links()` removed)
- Test: `crates/core/tests/items.rs`, `packages/web/src/__tests__/review.test.tsx`,
  `packages/web/src/__tests__/mockup.test.tsx`

**Interfaces:**

- Produces:
  - `SpecItems.mockups: Vec<MockupLink>`, where
    `MockupLink { path: String, label: String, block: u32 }`.
  - Each entry is a link of the `## Mockups` section whose target starts with `mockups/`, in order:
    its target, its text, and the selectable block holding it.
  - In TypeScript: `spec.mockups`.

- [ ] **Step 1: Write the failing tests**

- **Core `items.rs`.** The example's `mockups` is
  `[{ path: "mockups/repeat.html", label: "Repeat", block: <the list item's id> }]`. A spec without
  a Mockups section has none.
- **Web `review.test.tsx`**, "the mockups are first on a spec under review" (C2):
  - above the first story, a region named "Mockups" holds a button "Open the mockup: Repeat";
  - tapping it opens `/f/2026-10-06-recurring-tasks/mockups/repeat.html`;
  - a spec without mockups has no such region.
- **Web `mockup.test.tsx`**: its expectations are unchanged. A comment from the mockup page still
  lands `under "Mockups"`.

The break this catches: taking every link in the spec, which would also list a mockup linked from a
story.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test items`
- Expected: FAIL to compile: `no field mockups on type SpecItems`.

- [ ] **Step 3: Implement**

- The core finds the links of the section.
- `ReviewPage` draws, before the blocks, a region with an Astryx `Button` of the large size per
  mockup, linking to its page. See
  [R2](rulings.md#r2-one-button-per-mockup-at-the-top-of-the-review).
- `MockupPage` finds its block through `spec.mockups` instead of `links()`.

- [ ] **Step 4: Run all tests, then take the screenshots**

- Run: `cargo test && vp run --filter uraeda-binding build && vp check && vp test`
- Expected: PASS.
- Screenshots of the review page's top, at both sizes and both themes, in `screenshots/`.

- [ ] **Step 5: Commit**

```bash
git add crates/core packages specs/2026-10-14-code-quality-in-the-skill/screenshots
git commit -m "feat(code-quality-in-the-skill): a spec's mockups open from the top of its review"
```

## Task 9: A lean `SKILL.md`

**Files:**

- Create: `skills/uraeda/references/conventions.md`, `references/projects.md`, `references/cli.md`
- Modify: `skills/uraeda/SKILL.md`, every reference linking to `SKILL.md#commits`, `AGENTS.md`, and
  `README.md` where they point into `SKILL.md`
- Test: `crates/cli/tests/skill.rs`

**Interfaces:**

- **`SKILL.md` keeps** the frontmatter and its description, then:
  - what Uraeda is;
  - the rules for agents;
  - the folder map;
  - finding the next step, its table included;
  - "Going back to the human with new questions" and "Coming back to the human", whose anchors stay;
  - one line per reference, saying when to read it.
- **`conventions.md`**: markdown, the status table, review files, branches and worktrees, and
  commits, with the anchor `#commits`.
- **`projects.md`**: setting up a project; starting, postponing, and dropping a feature; finishing.
- **`cli.md`**: the `ura` commands and what they refuse.

- [ ] **Step 1: Write the failing test**

```rust
// crates/cli/tests/skill.rs: US7.1, SC-004.
#[test]
fn the_skill_entry_point_stays_lean() {
    let skill = repository().join("skills/uraeda/SKILL.md");
    let length = fs::read_to_string(&skill).unwrap().chars().count();
    assert!(
        length <= 20_000,
        "SKILL.md has {length} characters, over 20,000: move what most steps do not need to a \
         reference, and link it"
    );
}
```

- [ ] **Step 2: Run it to check it fails**

- Run: `cargo test -p uraeda-cli --test skill`
- Expected: FAIL, `SKILL.md has 34339 characters, over 20,000`.

- [ ] **Step 3: Move the content, then update the links**

- Text moves without rewording, except the sentences that join what is left.
- Every link to a moved section points to its new file. Find them with
  `grep -rn "SKILL.md#" skills specs AGENTS.md README.md crates packages`.

- [ ] **Step 4: Run all tests**

- Run: `cargo test -p uraeda-cli --test skill && cargo run -q -p uraeda-cli -- check specs`
- Expected: PASS. The command test still finds every command, now in `cli.md`.

- [ ] **Step 5: Commit**

```bash
git add skills AGENTS.md README.md crates/cli/tests/skill.rs
git commit -m "docs(code-quality-in-the-skill): SKILL.md is the entry point, its details in references"
```

## Task 10: The code-quality concepts in the skill

**Files:**

- Create: `skills/uraeda/references/code-quality.md`
- Modify:
  - `references/discovery.md`: who owns each rule; ask for a code-quality decision once; line 125;
  - `references/spec.md`: where new rules live in Architecture; decision rules say how they are
    checked; a decision's spec includes its check's task;
  - `references/plan.md`: a structural step first for marked units; complexity tracking covers
    growth; each test step names its break; lines 77 to 83 rewritten;
  - `references/implementation.md`:
    - the break caused and seen;
    - two verdicts from the task reviewer;
    - the size report in the pull request description;
    - a place for a second reviewer;
    - no fixed sleeps;
    - a ruling to change or delete a test;
    - lines 171 and 184 rewritten;
  - `references/projects.md`: setup proposes a code-quality decision.
- Modify: the decision template, whose rules each end with how they are checked; the template
  `CONSTITUTION.md`, which gains principle III; the example's `plan.md`, with one structural step
  and named breaks; the example's decisions, each rule saying how it is checked
- Test: `cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs`

**Interfaces:**

- Produces: `references/code-quality.md` with five sections:
  - "One home per rule"
  - "Extract, don't grow"
  - "Rules enforced by tools"
  - "Tests that can fail"
  - "UIs verified end to end"

  Each section says what the concept asks at each step, and the checks behind it. A last section,
  "Setting up checks", covers limits in the project's own linters, the stack's shared config if any,
  and markers in place with their reasons. The other references link to these anchors.

- [ ] **Step 1: Write `code-quality.md`, then link each step to it**

Each step's text says what that step does, in a sentence, and links the concept for the why. The
concepts are not repeated. The skill's wording carries the spec's scenarios:

- US4.1: each rule of a decision ends with how it is checked;
- US4.2: a task touching a unit over its limit starts with a step that only restructures it,
  committed alone;
- US4.3: each test step names its break, and the implementer reports the failure seen;
- US4.4: the final review lists each grown function and file, before and after, in the pull request
  description;
- US4.5: the task reviewer gives two verdicts, and flags what the task grew;
- US5.1: setup proposes a code-quality decision after the constitution;
- US5.2 and US5.3: discovery asks once when the project has no `specs/decisions/code-quality.md`,
  and a "no" is recorded with a date to revisit.

The template constitution's principle III is the amended VI of the
[spec](spec.md#constitution-check), as "### III. Code is checked and stays maintainable".

- [ ] **Step 2: Check the example and the skill**

- Run:
  `cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs && cargo test -p uraeda-cli --test skill`
- Expected: no problems, and `SKILL.md` still under 20,000 characters.
- Read each US4 and US5 scenario against the text, and name the line that carries it in the task's
  commit body.

- [ ] **Step 3: Run all checks**

- Run: `vp run ready`
- Expected: PASS (SC-003).

- [ ] **Step 4: Commit**

```bash
git add skills
git commit -m "docs(code-quality-in-the-skill): the skill's code-quality concepts, each backed by a check"
```
