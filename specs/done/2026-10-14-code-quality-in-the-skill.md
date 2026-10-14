---
kind: feature
finished: 2026-10-14
pull-request: https://github.com/mrtolkien/uraeda/pull/13
---

# Record: Code quality and maintainability through the skill

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-14, finished on
> 2026-10-14, in [its pull request](https://github.com/mrtolkien/uraeda/pull/13). Its full files are
> in git: `git log -- specs/2026-10-14-code-quality-in-the-skill/`.

## What and why

The human wants high-quality, maintainable apps with the least work, without reading a line of code.
Research and a review of this repository showed agents grow and copy code feature after feature,
held back by instructions alone, and that specs of 431 to 719 lines bury what the human must
approve. This feature puts the human's part of a spec first and folds the build details in the web
UI, writes a few code-quality concepts into the skill, each backed by a check, pushes every project
to set those checks up, makes `SKILL.md` a lean entry point, and turns plan review off by default.
This repository adopts the checks itself. The maintenance flow, an audit the human answers like a
round of questions, was left for its own feature.

## Behaviour

- **Folds in the web UI.** On a spec's review and document pages, each story shows its band, title,
  description, and "Why this priority", then a closed "Scenarios (N)" toggle; the `## Details`
  section is one closed "Details" toggle. A story without a "…scenarios:" intro, or a spec without
  `## Details`, has no toggle. The toggle stands in place of the fold's first block (the "Acceptance
  scenarios:" intro, the Details heading), taking its anchor (`#details`): that line can no longer
  be tapped for a new comment, and a pending comment on it shows first inside the fold. A toggle
  never selects a block. The plan review folds nothing.
- **Open folds.** A fold holding a pending comment or the selection opens on its own, without being
  saved to the history entry; a tap closes it and it stays closed until opened again. Folds the
  human opens are kept in the history entry, so Back restores them. A link whose hash names a block
  inside a fold opens it and scrolls to it, 16 px below the top or the phone's top bar, on each new
  visit, a link to the page's own address included; Back or a reload to an entry with a saved
  position leaves its folds as they were, a fold closed after the link opened it included. A hash
  that is not a valid escape, like `#100%`, is read as written.
- **Mockups first.** A spec review with links under `## Mockups` shows a "Mockups" region after the
  stale comments' banner and before the "Tap a block" hint: one large primary button per mockup,
  "Open the mockup: <link text>", full width on the phone, opening the mockup's page in the review's
  repository. A comment written on a mockup's page lands on its line of the Mockups section; a
  mockup linked from nowhere else gets a general comment naming it.
- **Human-first specs.** The spec template orders the stories (one or two sentences each), edge
  cases, success criteria, `## Architecture`, an optional `## Mockups`, assumptions, decisions,
  constitution check, and risk tier, then a last `## Details` with Data, Components, Error handling,
  and Testing. `ura check` reports a spec in the old layout: the missing `## Details`, the unknown
  `## Design`, and the sections out of order. Specs are not migrated by a tool; records are not
  checked against the template.
- **Limits in this repository.** `vp run ready` fails on a Rust or TypeScript function over 100
  lines or 7 parameters, nesting over 4 levels, a TypeScript file over 500 lines, a Rust source file
  over 500 lines (counted up to its first `#[cfg(test)]`, outside the structural test's list), a
  `test.only`, and a marker left on code that no longer breaks its limit. Tests and generated files
  are exempt; Lua is held by review only.
- **Quality concepts in the skill.** One home per rule, extract don't grow, rules enforced by tools,
  tests that can fail, and UIs verified end to end, each written once and linked from the step that
  uses it. Each rule of a decision says how it is checked; a task touching a unit over its limit
  restructures it first, in a commit of its own; each new test names the break it catches, which the
  implementer causes once; the task reviewer gives two verdicts, spec compliance then quality; the
  pull request lists each function and file the branch grew, before and after; the final review
  leaves a place for a second reviewer. Changing or deleting a test needs a ruling, and unit tests
  never sleep for a fixed time.
- **Projects pushed toward checks.** Project setup proposes a code-quality decision for the
  project's own linters, with limits, the stack's shared lint config if any, and today's offenders
  marked in place. A project without one is asked once, in its next discovery round; a "no" is a
  decision with a date to revisit.
- **Plan review off by default.** Approving at another tier than proposed sets `plan-review: false`
  whatever the tier, in the web UI, `ura review --approve --tier`, and Neovim; a spec proposed with
  `plan-review: true` keeps it at its proposed tier.
- **A lean entry point.** `SKILL.md` holds what Uraeda is, the rules for agents, the folder map, the
  next step, coming back to the human, and a line per reference, at most 20,000 characters (16,027
  at the finish); a test also checks every `ura` command is still named in the skill.

## Design

The spec stays one markdown file, the single source for later steps. The core owns every fact about
it: which blocks fold, which mockups it links, and the plan-review default, sent with the spec's
items as the stack decision requires; the web UI only draws them. The limits live in the project's
own linters, with offenders marked in place so the numbers can only go down, and the concepts are
written once in a reference each step links to.

- The core: `SpecItems.details`, `Story.details`, `SpecItems.mockups`, and `plan_review_default` in
  [`crates/core/src/files/spec.rs`](/crates/core/src/files/spec.rs), their types in
  [`items.rs`](/crates/core/src/files/items.rs); the layout's checks follow the template.
- The web UI: the folds, their toggle, and `useHashFold` in
  [`Folds.tsx`](/packages/web/src/Folds.tsx); `useOpenKeys`, shared with the transcript's tool
  groups, and `useSpecFolds` in [`useOpenKeys.ts`](/packages/web/src/useOpenKeys.ts); the blocks'
  selection in [`Selection.tsx`](/packages/web/src/Selection.tsx); the mockup buttons in
  [`ReviewMockups.tsx`](/packages/web/src/ReviewMockups.tsx); `ReviewPage` split into
  `ReviewHeadings.tsx`, `YourReview.tsx`, and `useReviewActions.ts`.
- The checks: clippy's limits in [`clippy.toml`](/clippy.toml) and [`Cargo.toml`](/Cargo.toml)
  (nesting threshold 5, which holds free functions to 4 levels and methods to 3); Rust file lengths
  in [`crates/cli/tests/structure.rs`](/crates/cli/tests/structure.rs) and its `LARGE` list;
  `@nkzw/oxlint-config` and the size limits in [`vite.config.ts`](/vite.config.ts), with unused
  disable directives as errors, each rule made to fire by
  [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts); the skill's size in
  [`crates/cli/tests/skill.rs`](/crates/cli/tests/skill.rs).
- The skill: the concepts in
  [`references/code-quality.md`](/skills/uraeda/references/code-quality.md); markdown, statuses,
  review files, branches, and commits in
  [`conventions.md`](/skills/uraeda/references/conventions.md); setup, starting, postponing, and
  finishing in [`projects.md`](/skills/uraeda/references/projects.md); the commands in
  [`cli.md`](/skills/uraeda/references/cli.md); the example gained a
  [code-quality decision](/skills/uraeda/assets/example/specs/decisions/code-quality.md) and a
  structural step in its plan.

## Questions

### Round 01

#### Q1: What does this feature build?

**Answer:** A: the spec split, the concepts with their checks, and the constitution changes; the
maintenance flow becomes its own feature.

#### Q2: Where does the agent's design go?

**Answer:** C: one `spec.md`, the agent's part last, hidden in the web UI behind a "Details" toggle:
"we're allowed to parse it and show whatever we want", and later steps read it all anyway.

#### Q3: What stays in the spec you read?

**Answer:** A, with shorter stories whose details fold in the UI: "this rework of the flow is about
what the human SEES, not what EXISTS in the system".

#### Q4: How long may the spec be?

**Answer:** C: no budget for now, reviewed after use.

#### Q5: What happens to plan review?

**Answer:** A: kept, off by default for every tier.

#### Q6: How does the skill keep quality from going down, in any project?

**Answer:** A: limits in each project's own linters, today's offenders kept, and the final review
reports size changes.

#### Q7: Which checks does this repository adopt now?

**Answer:** A: clippy and Oxlint only, in a code-quality decision, and Uraeda "should push the user
towards setting up good guidelines".

#### Q7.A: What limits?

**Answer:** A: 100 lines per function, 7 parameters, 4 levels of nesting, 500 lines per file, and
"check what the rules are for the fate stack", read as adopting `@nkzw/oxlint-config`, which the
human confirmed in the spec's review.

#### Q8: How is a test shown to catch a break?

**Answer:** A: each test names its break, which the implementer causes and reverts; no tool.

#### Q9: Where do the two rules go in the constitution?

**Answer:** A: principle VI becomes "Code is checked and stays maintainable", version 1.3.0.

#### Q10: Who applies the constitution change?

**Answer:** A: the human commits the amendment after approving.

#### Q11: How much of the skill moves out of `SKILL.md`?

**Answer:** C: the leanest entry point, "the actual content is in the reference files", so an agent
reading it by mistake loses little context.

## Decisions

- [Code quality](../decisions/code-quality.md), new: size and nesting limits in clippy, Oxlint, and
  a structural test, `@nkzw/oxlint-config`, offenders marked in place, and each rule's check named.
- The constitution's principle VI, amended by the human to "Code is checked and stays maintainable":
  each rule in one place, and measured quality never goes up.

## Changes after approval

- The spec's revision 2 moved its own headings to the new layout, text unchanged, so `ura check`
  passes (R13).
- The spec's review asked for mockups front and center: a large button per mockup at the top of the
  review (R2, R18).
- A fold's toggle replaces its first block, so the scenarios' intro and the Details heading can no
  longer take a new comment (R16).
- A fold opened by a pending comment or the selection closes at a tap and stays closed while the
  page is shown (R17).
- A mockup linked only from a story, outside `## Mockups`, gets a general comment from its page
  (R18).
- A link's hash opens its fold only on an entry without a saved position, so Back keeps a fold
  closed (R19); it opens again on each new visit, and an undecodable hash no longer breaks the page.
- Logs are written to `process.stderr` and `process.stdout` instead of turning `no-console` off,
  which no decision allowed, against the spec's error handling example (R8).
- Offenders of rules other than the limits are marked: `react/refs` 8 times, `no-explicit-any` once
  for the tests' `Data` alias (R9); the binding is loaded whole with `await import` for
  `import/no-namespace` (R10).
- The example gained a code-quality decision, and a plan may list a new marker as a constitution
  exception for the human's plan review (R21).
- The code merged from main was brought under the checks: files that grew past their limit after the
  decision (`api.rs`, `mutations.ts`, `screenshots.ts`, `PrioritiesPage.tsx`) were split, not marked
  (R22).

## Follow-ups

- After a same-page `#…` link within an open spec, later fold changes are not saved to the history
  entry (`useOpenKeys` keeps the entry id it mounted with), so Back can restore them closed.
- A Mockups link written from the repository root, `/specs/<feature>/mockups/x.html`, is not
  recognised by `spec.rs`'s mockup filter and gets no button.
- Marked units can keep growing: TypeScript markers and Rust `#[expect]` have no growth check
  (`cache.ts` 630 to 633, `validate-claude.ts` 578 to 582); only Rust files' lengths are held.
- `crates/core/src/files/items.rs` is at 499 lines.
- Some commits from before the rebase fail the lint alone (`screenshots.ts` without its marker).
- The plan review folding nothing has no explicit test; US3.1, US3.4, and SC-002 for Rust were
  verified by hand only.
- `session.test.tsx`'s "US1.3: a message sent during a turn shows greyed" is flaky under load.
- The maintenance flow, its own feature.
