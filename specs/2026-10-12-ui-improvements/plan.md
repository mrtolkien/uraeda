---
status: auto-approved
spec-revision: 1
---

# Plan: UI improvements

**Goal:** Rebuild the web UI on Astryx and StyleX, under the four UI decisions, and deliver the
spec's round navigation, review highlight, task view, priorities grooming, placeholder-free drafts,
desktop sizing, mockup viewing, and missing-file fix.

**Architecture:** The core gains a stable key and an insert action for priority lines, mockup lists
on features, and placeholder-free drafts, and `ura start` stops refusing unwritten drafts. The
server answers missing files. The web UI gets its own build of Astryx's neutral theme, a width-class
hook, a list-detail pane layout, an adaptive overlay, and a router that restores scroll positions.
Each page is then rebuilt on those pieces, page by page, with `styles.css` deleted last and the lint
rules turned on. See the [spec's design](spec.md#design).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

Inputs the spec does not mention, most likely to bite a user first. Each gets a test in the task
that owns the code.

1. **A priority line that is a link**, like
   `[Web UI for the workflow files](/specs/2026-10-11-web-ui/proposal.md)`: its key comes from its
   visible text, `web-ui-for-the-workflow-files`, unless it links a draft. Task 3.
2. **A priority line whose text has no letter or digit**, like `- 🚀`: its key is `line`, and
   `line-2` for the next one. Task 3.
3. **A page reloaded, then Back**: the scroll position saved in the history entry survives the
   reload, and Back restores it. Task 6.
4. **A live update to `PRIORITIES.md` arriving during a drag**: the list does not jump under the
   finger; the update applies once the drag ends. Task 11.
5. **A comment on a mockup the spec does not link**: it is written as a general comment starting
   with "Mockup repeat.html: ". Task 13.

## Global constraints

From the decisions and the spec, every task's requirements include these.

From [UI components](../decisions/ui-components.md):

- Views MUST use an Astryx component wherever one exists for the job: buttons, links, inputs, text
  areas, menus, sheets, dialogs, toasts, banners, lists and rows, headings and text, outlines,
  breadcrumbs, and the shell.
- Raw `button`, `input`, `textarea`, `select`, and `dialog` elements MUST NOT be written in
  `packages/web/src`. Lint (`react/forbid-elements`) names the Astryx component to use instead.
- A raw element MAY be used where no Astryx component fits, only with a lint suppression on its line
  giving the reason, and the plan MUST list it as an Astryx gap.
- Components MUST NOT take a `style` prop, and Astryx components MUST NOT take a `className`. Their
  own styles go through `xstyle`.
- The app's own styles MUST be written with `stylex.create`, in the file of the component that uses
  them, and MUST use Astryx's tokens for colours, spacing, sizes, radii, borders, and type. Raw
  values are allowed only for `0`, percentages, `auto`, and layout keywords. StyleX's lint plugin
  (`valid-styles`) enforces it.
- No stylesheet MAY be imported besides Astryx's reset, core, and theme stylesheets.
- Sizes MUST come from the theme. A size the theme lacks is added to the theme, not written in a
  component.
- Reordering by drag MUST use `@dnd-kit/react`. No other drag-and-drop library MAY be added.
- Astryx, `@dnd-kit/react`, and StyleX MUST be pinned to exact versions, and upgraded deliberately.

From [UI layout](../decisions/ui-layout.md):

- The UI MUST have two width classes: narrow, under 768 px, and wide, from 768 px, taken from the
  theme's `md` breakpoint. A layout MUST be chosen by width, never by device type, user agent, or
  pointer.
- Components MUST NOT write their own media queries with sizes. They read the width class from one
  shared hook, or the theme's adaptations.
- On wide screens, a detail opened from a list MUST open in a pane beside the list, which stays
  usable. On narrow screens, it MUST open as its own page.
- On wide screens, menus MUST be popovers and short forms dialogs. On narrow screens, both MUST be
  bottom sheets. Astryx's `presentation="adaptive"` SHOULD be used where a component offers it.
- An open detail, tab, or sheet that can be returned to MUST be in the URL, so a reload, Back, or a
  change of width keeps it.
- Body text MUST be 17 px on narrow screens. From 1024 px wide, body text MUST be 19 px, and element
  heights and spacing MUST grow by the same factor, 1.2, through the theme's adaptations.
- Under a coarse pointer, every control MUST be at least 44 px tall, through the theme's
  adaptations.
- Reading text MUST NOT be wider than about 70 characters.
- Text MUST be left-aligned, never justified. Paragraphs SHOULD use `text-wrap: pretty`.

From [UI behaviour](../decisions/ui-behaviour.md):

- A row that leads somewhere MUST be tappable as a whole, not only through a button or a chevron.
- A small edit, like a line's text, MUST happen in place: Enter or blur saves, Escape cancels.
- A modal sheet or dialog MUST be used only to confirm an irreversible action or to fill a short
  form, like adding a line. Everything else happens in the page.
- Every sheet and dialog MUST have a visible close button, and Back MUST close it.
- A save's status MUST show next to its control: saving, saved, or the error.
- A toast MAY confirm only a result the human cannot see on screen. It MUST last 5 seconds, MAY
  carry one action, Undo, which reverts that change alone, and MUST NOT be the only place an error
  shows.
- Errors MUST stay on screen until the human deals with them, or the action is retried.
- Back MUST return to the same scroll position and the same open items. A page MUST keep showing its
  content while its data reloads.
- Nothing MUST work only on hover: every action has a tap or a keyboard path.
- A keyboard shortcut MUST NOT act while a text field has the focus.

From [UI checks](../decisions/ui-checks.md):

- Every UI test MUST guard a spec's acceptance scenario, edge case, or success criterion, or a rule
  of a UI decision. A test that guards neither MUST NOT be added.
- UI tests MUST drive the UI as a user does, through roles, labels, and visible text, and assert
  what the user sees or what is written to the repository. They MUST NOT assert markup structure,
  class names, or snapshots of rendered output.
- A test that no longer matches the spec MUST be changed or removed with the spec, never kept
  passing by loosening its assertion.
- `vp run ready` MUST run, in WebKit, at 402 × 874 and at 1440 × 900, on every page a UI decision
  governs: no text cut, no sideways scroll, the text sizes and control heights of the UI layout
  decision, and axe-core's WCAG 2.1 A and AA rules in light and dark.
- Pixel comparisons of screenshots MUST NOT be used.
- Before handing over a UI change, the agent MUST take screenshots of every changed view at both
  sizes and in both themes, review them against the UI decisions and the spec's mockups, fix what it
  finds, and commit them in the feature's folder under `screenshots/`, where the pull request shows
  them. The finish step removes them with the folder.

From the [spec](spec.md) and its [review](spec-review.md), exact texts:

- "No file <name> in <folder>." with "Open the feature".
- "This line is no longer in PRIORITIES.md." with a link to the priorities page.
- "PRIORITIES.md changed on disk. Your change was not applied." (the core's text, unchanged).
- "Added to <Section>, not committed", with Undo, 5 seconds.
- "Deleted "<text>"", with Undo, 5 seconds.
- "Could not restore "<text>": PRIORITIES.md changed on disk."
- "A priority cannot be empty."
- The round's bar reads "<answered>/<applicable>", and Next becomes "Submit" when nothing is blank.

## Code read

- [`packages/web/src/`](/packages/web/src/): every page reads its records through
  [`data.ts`](/packages/web/src/data.ts) (`useRequest` plus `useLiveView`, refreshed on
  `visibilitychange`); mutations go through `fate.mutations.*` with the views of
  [`views.ts`](/packages/web/src/views.ts); refusals through
  [`errors.ts`](/packages/web/src/errors.ts) `refusal()`; typed saves through
  [`useSave.ts`](/packages/web/src/useSave.ts).
- [`routes.tsx`](/packages/web/src/routes.tsx): `parseRoute`, `navigate` (always `scrollTo(0, 0)`),
  `usePathname`, `Link`, `pathLink`. [`App.tsx`](/packages/web/src/App.tsx): two `Suspense`
  boundaries with "Loading…".
- [`styles.css`](/packages/web/src/styles.css): 533 lines, imported by
  [`main.tsx`](/packages/web/src/main.tsx) and the browser test; no StyleX anywhere.
- [`PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx): `dropIndex(from, target)` gives the
  core's index for a drop, tested in [`drop.test.ts`](/packages/web/src/__tests__/drop.test.ts).
- Tests: happy-dom integration tests in
  [`packages/web/src/__tests__/`](/packages/web/src/__tests__/), on
  [`helpers.tsx`](/packages/web/src/__tests__/helpers.tsx) `renderPage(path, repo)`, which runs the
  server's Hono app in process over `fixtureRepo()` from
  [`test-utils.ts`](/packages/binding/test-utils.ts). Fixture data in
  [`fixtures/repo/`](/fixtures/repo/): Next holds "Claude Code runner (triggered manually)" and
  `[Git listener process](drafts/git-listener.md)`, Later holds "Nix + Docker based execution
  environments" with a nested "with a cache"; the round of `2026-10-11-web-ui` waits with Q1, Q1.B,
  Q2, and Q3 blank; the spec of `2026-10-06-recurring-tasks` waits for review. Several existing
  tests select by class (`.row`, `.option`, `.letter`): the tasks that restyle a page rewrite those
  helpers by role and label, as the checks decision requires.
- Browser tests: [`layout.test.tsx`](/packages/web/src/__browser__/layout.test.tsx), WebKit at 402 ×
  874, from [`vite.browser.config.ts`](/packages/web/vite.browser.config.ts), on the fixture mounted
  by [`setup.ts`](/packages/web/src/__browser__/setup.ts).
- Core: [`files/priorities.rs`](/crates/core/src/files/priorities.rs) `parse`, `read` (`EntryItem`),
  the private `insert(text, section, index, item)`;
  [`actions/priorities.rs`](/crates/core/src/actions/priorities.rs) `apply` checks the hash;
  [`workspace.rs`](/crates/core/src/workspace.rs) `PriorityEntry` and
  [`view.rs`](/crates/core/src/view.rs) `PriorityView`, `FeatureView`;
  [`actions/draft.rs`](/crates/core/src/actions/draft.rs) `draft_entry`;
  [`actions/start.rs`](/crates/core/src/actions/start.rs) `unwritten`, the start's refusal;
  [`slug.rs`](/crates/core/src/slug.rs) `from_text`. Core tests in
  [`crates/core/tests/`](/crates/core/tests/), CLI tests in
  [`crates/cli/tests/`](/crates/cli/tests/).
- Binding: [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs), one `#[napi]` async function
  per API call; its generated [`index.d.ts`](/packages/binding/index.d.ts) is committed.
- Server: [`fate/sources.ts`](/packages/server/src/fate/sources.ts) `each()` drops failed reads;
  [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts) one entry per mutation;
  [`files.ts`](/packages/server/src/files.ts) serves `/mockups/<path>` with
  `Content-Security-Policy: sandbox`.
- Lint: oxlint 1.85, through `vp check`, configured in [`vite.config.ts`](/vite.config.ts) `lint`.
  `react/forbid-elements` and `react/forbid-dom-props` were checked to work with this version.
- Validation: `vp run ready` runs cargo fmt, clippy, cargo tests, `ura check`, the binding build,
  `vp check`, `vp test` (happy-dom and WebKit projects), and the web build. Single runs:
  `cargo test -p uraeda-core --test <file>`, `vp test <file name>`.
- Versions on npm on 2026-10-12: `@astryxdesign/core`, `theme-neutral`, and `cli` 0.6.8
  (2026-10-10), `@stylexjs/unplugin` and `@stylexjs/eslint-plugin` 0.19.1, `@dnd-kit/react` and
  `@dnd-kit/helpers` 0.5.0, `axe-core` 4.14.0. [`pnpm-workspace.yaml`](/pnpm-workspace.yaml) holds a
  `minimumReleaseAgeExclude` list.

## Constitution check

| Principle                            | Complies | Notes                                                                                   |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | The decisions are active since the spec's approval; the review's comments are followed. |
| II. Git and plain text first         | yes      | Only the reading position and the theme live in the browser.                            |
| III. Asynchronous by default         | yes      | No change to how steps commit.                                                          |
| IV. Review effort matches impact     | yes      | Screenshots in `screenshots/` let the human review the looks in the pull request.       |
| V. Tools are optional                | yes      | `ura start`, `ura draft`, and the skill change together (task 1).                       |
| VI. Code is checked against the spec | yes      | Every scenario has its test; new abstractions are listed below.                         |

## Decisions

- [UI components](../decisions/ui-components.md): every page is rebuilt on Astryx and StyleX (tasks
  5 to 14), dnd-kit drags (task 11), versions pinned (task 4), lint enforced (task 14).
- [UI layout](../decisions/ui-layout.md): the theme's sizes (task 4), `useWidthClass`, `Panes`, and
  `Overlay` (task 5), panes and sheets per page (tasks 9 to 13).
- [UI behaviour](../decisions/ui-behaviour.md): scroll restoration and content kept while reloading
  (task 6), toasts with Undo (tasks 7, 9), Back closing overlays (task 5).
- [UI checks](../decisions/ui-checks.md): tests by role and label throughout, the two-size layout
  and axe checks (task 14), screenshots (task 15).
- [Stack](../decisions/stack.md): new data comes from the core through the binding (tasks 1, 3, 10).
- [CLI](../decisions/cli.md): `ura draft`, `ura start`, and the skill change together (task 1).
- [Toolchain](../decisions/toolchain.md): the new checks run in `vp run ready` (task 14).

## Complexity tracking

| Abstraction or exception                                              | Why it is needed                                                               | Simpler alternative rejected because                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `useWidthClass()` hook                                                | the layout decision requires one shared source of the width class              | `matchMedia` in each component: forbidden by the layout decision                     |
| `Panes` component                                                     | home and the priorities page both show a list with a detail beside it          | each page laying out its own panes: two copies of the same rule                      |
| `Overlay` component                                                   | every short form switches between a dialog and a sheet by width                | choosing per call site: repeated logic, and the close button and Back rule each time |
| `TopBarSlot` context                                                  | the round and home put their own controls in the shell's bar                   | rendering the bar in each page: AppShell owns the bar                                |
| `useRestoreScroll(ready)` and `navigate` saving state                 | every page restores its position on Back once drawn                            | `scrollRestoration = "auto"`: it restores before data arrives, today's bug           |
| `EditableLine` component                                              | the task view edits a line in place, with the same keys everywhere it appears  | an input inlined in the task view: kept small, but shared with the Add rows          |
| `ToastUndo` helper (`useUndoToast`)                                   | ＋ and Delete both show a 5 s toast with one Undo                              | two hand-written toasts with the same timing                                         |
| Astryx gap: the question's option is a raw `button`                   | a full-width toggle holding paragraphs and lists; no Astryx component draws it | `SelectableCard`: a card, which the reading layout forbids                           |
| Astryx gap: the review's selectable block, `role="button"` on a `div` | a tappable block of document text, not a control                               | wrapping blocks in `Button`: breaks the document's text flow                         |

## Review comments

The spec was approved with three comments ([spec-review.md](spec-review.md)). The approved spec is
not changed for them; these tasks carry them out.

- **C1, view and comment on mockups in the UI**: the feature page lists the feature's mockups, and a
  mockup page shows one inside the UI, with a Comment action while the spec waits for review. A
  comment on a mockup is a review comment on the spec's line that links it, or a general comment
  starting with "Mockup <file>: " when no line links it. Tasks 8 and 13.
- **C2, `ura start` accepts any proposal**: the `unwritten` check goes from the core, so `ura start`
  and the UI's Start start any draft, placeholders or empty sections included; the skill's refusal
  list loses that line. This replaces the spec's US5 scenario 4. Task 1.
- **C3, mockup feedback**:
  - US1 desktop: the side navigation is collapsible and resizable, 240 px by default, remembered in
    the browser; the round's index column is 240 px; at a 1200 px window with the navigation open,
    the questions get at least 600 px. Tasks 7 and 12.
  - US3: the task view has no Move up or Move down. Task 9.
  - US4: tapping a line on the priorities page opens its task view, on both widths; there is no ⋯
    menu and no editing in place on the list; the line's text is edited in the task view. This
    replaces the spec's US4 scenarios 2, 3, and 8; deleting, with its Undo, moves to the task view.
    Tasks 9 and 11.

---

## Task 1: Placeholder-free drafts, and `ura start` for any proposal

**Files:**

- Modify: `crates/core/src/actions/draft.rs` (`draft_entry`)
- Modify: `crates/core/src/actions/start.rs` (remove `PLACEHOLDERS`, `unwritten`, and its check)
- Modify: `crates/core/src/embedded.rs` (add `PROPOSAL`, `is_placeholder`, `proposal_paragraphs`,
  `proposal_hints`)
- Modify: `crates/core/src/view.rs` (add `ProposalHint`), `crates/core/src/api.rs` (add
  `proposal_hints`)
- Modify: `crates/binding/src/lib.rs` (add `proposal_hints`), `packages/binding/index.d.ts`
  (generated)
- Modify: `skills/uraeda/SKILL.md` (the Draft step, the Start step, the refusal list), `README.md`
  (the `ura start` line no longer says "written")
- Test: `crates/core/tests/actions.rs`, `crates/cli/tests/draft.rs`, `crates/cli/tests/start.rs`,
  `packages/web/src/__tests__/editor.test.tsx` (the refused start becomes a start, [R2](rulings.md))

**Interfaces:**

- Produces: `embedded::proposal_hints() -> Vec<(String, String)>`: each `##` heading of the proposal
  template with its placeholder text, without the brackets, its lines joined with a space, and the
  "Optional: " prefix kept ([R1](rulings.md)), in order:
  `("What", "What the feature does, from the user's point of view.")`,
  `("Why", "The problem it solves, and for whom.")`, `("Notes", "Optional: constraints, ...")`.
- Produces: binding `proposalHints(): Promise<Array<ProposalHint>>`, with
  `ProposalHint { heading: string; hint: string }` declared in the core's `view.rs` and served by
  `api::proposal_hints()`.
- Produces: `ura start` no longer refuses a draft for its content.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/actions.rs
#[test]
fn a_draft_holds_the_line_as_title_and_what_without_placeholders() {
    let repo = fixture_repo();
    let drafted = draft::create(&place(&repo), "next-1").unwrap();
    let text = read(&repo, &drafted.path);
    assert!(text.starts_with("---\ndiscovery: high"));
    assert!(text.contains(
        "# Claude Code runner (triggered manually)\n\n## What\n\nClaude Code runner (triggered manually)\n\n## Why\n\n## Notes\n"
    ));
    assert!(!text.contains('['));
}

#[test]
fn start_accepts_a_draft_with_placeholders_or_empty_sections() {
    // The template as is, placeholders and all, then a draft with an empty Why.
    for draft in [template("proposal.md"), "# X\n\n## What\n\nX\n\n## Why\n\n".to_string()] {
        let repo = repo_with_draft("specs/drafts/x.md", &draft);
        assert!(start::run(&place(&repo), "specs/drafts/x.md", "x").is_ok());
    }
}
```

```rust
// crates/cli/tests/draft.rs
#[test]
fn ura_draft_writes_what_the_ui_writes() {
    let (cli, ui) = (fixture_repo(), fixture_repo());
    ura(&cli, &["draft", "claude code runner"]).success();
    let path = draft::create(&place(&ui), "next-1").unwrap().path;
    assert_eq!(read(&cli, &path), read(&ui, &path));
}
```

Remove the existing tests that expect a refusal for placeholders or an empty What or Why
(`crates/cli/tests/start.rs`, and `editor.test.tsx`'s, which becomes a start that succeeds); they no
longer match the spec, as the review's C2 asks. The Rust tests have no `fixture_repo()`: the core
and CLI tests build a repository whose `PRIORITIES.md` is `fixtures/repo/main/specs/PRIORITIES.md`,
and call `start::run(&git, &workspace, draft, Some("x"), today(), false)`. A test of
`proposal_hints()`'s three pairs is added in `crates/core/tests/actions.rs`.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test actions draft` then `start_accepts`
- Expected: FAIL, the draft text contains `[What the feature does, from the user's point of view.]`;
  the start returns
  `Err(Refused("specs/drafts/x.md still holds the template's placeholders: write it first"))`.

- [x] **Step 3: Implement**

- `draft_entry`: from the template, replace `# [Feature name]` with `# <line>`, replace the
  placeholder paragraph under `## What` with the line, and drop every other line that is a bracketed
  placeholder (it starts with `[` and its paragraph ends with `]`, possibly over two lines, as in
  `## Notes`), keeping the headings and one blank line between sections.
- `start.rs`: delete `PLACEHOLDERS`, `unwritten`, and the refusal at line 171.
- `embedded::proposal_hints`, and the binding's `proposalHints`, reading the embedded template.
- `SKILL.md`: the Draft bullet reads "a line of `PRIORITIES.md` becomes a draft in
  `specs/drafts/<slug>.md`, from the proposal template with the line as its title and as the first
  paragraph of What, and no placeholder text"; delete the refusal bullet "A draft that still holds
  the proposal template's placeholders, or an empty `## What` or `## Why` section: a committed
  proposal is work for an agent, so it must be the human's." and the matching text in the start
  step, if any.
- Rebuild the binding: `vp run --filter uraeda-binding build`.

- [x] **Step 4: Run all tests**

- Run: `cargo test --workspace --exclude uraeda-binding && vp test`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates skills/uraeda/SKILL.md packages/binding/index.d.ts packages/binding/index.js
git commit -m "feat(ui-improvements): drafts without placeholders, and start any proposal"
```

## Task 2: Missing files answer "No file"

**Files:**

- Modify: `packages/server/src/fate/sources.ts` (`fileSource(fileDataView, ...)`)
- Modify: `packages/server/src/fate/views.ts` (`FileRecord` gains `missing`)
- Modify: `packages/web/src/views.ts` (select `missing`), `packages/web/src/FilePage.tsx`
- Test: `packages/web/src/__tests__/missing.test.tsx`

**Interfaces:**

- Produces: a file record `{ id, missing: true }` for an id the binding refuses with "has no". Other
  errors still drop the id, as today.

- [x] **Step 1: Write the failing test**

```tsx
// packages/web/src/__tests__/missing.test.tsx
test("a missing file says so at once", async () => {
  sent.length = 0;
  await renderPage("/f/2026-10-11-web-ui/spec.md");

  expect(
    await screen.findByText("No file spec.md in 2026-10-11-web-ui.", {}, { timeout: 2000 }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open the feature" })).toBeTruthy();
  expect(
    sent.filter((body) => body.includes("2026-10-11-web-ui/spec.md")).length,
  ).toBeLessThanOrEqual(2);
});
```

- [x] **Step 2: Run it to check it fails**

- Run: `vp test missing.test`
- Expected: FAIL, the text "No file spec.md in 2026-10-11-web-ui." is not found within 2000 ms.

- [x] **Step 3: Implement**

The source returns `{ id, missing: true }` with the view's other fields empty when the binding's
error message contains " has no "; `FilePage` shows the message and the link for a missing record.

- [x] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server/src packages/web/src
git commit -m "fix(ui-improvements): a missing file says so instead of loading forever"
```

## Task 3: Priority keys, inserting a line back, and features' mockups

**Files:**

- Modify: `crates/core/src/files/priorities.rs` (`EntryItem.key`, `pub fn keys`,
  `pub fn insert_entry`)
- Modify: `crates/core/src/workspace.rs` (`PriorityEntry.key`, `Feature.mockups`, read with the
  feature's files), `crates/core/src/view.rs` (`PriorityView.key`, `FeatureView.mockups`)
- Modify: `crates/core/src/actions/priorities.rs` (`insert`), `crates/core/src/api.rs`
  (`insert_priority`)
- Modify: `crates/binding/src/lib.rs` (`insertPriority`), `packages/binding/index.d.ts`
- Modify: `packages/server/src/fate/mutations.ts` (`priorities.insert`), `views.ts` on both sides
  (`FeatureView` selects `mockups`; the web's `DraftView` entry selects `key`)
- Test: `crates/core/tests/priorities.rs`, `crates/core/tests/api.rs`,
  `packages/server/src/__tests__/fate.test.ts` (the `priorities.insert` mutation)

**Interfaces:**

- Produces: `EntryItem.key: string` and `PriorityView.key: string`, computed by
  `priorities::keys(entries: &[Entry]) -> Vec<String>`: the slug of the linked draft's file stem
  when the entry links a file of `specs/drafts/` ([R3](rulings.md)); otherwise `slug::from_text` of
  the entry's plain text (its link text, not its target); `line` when that slug is empty; a key
  already used earlier in the file gets `-2`, `-3`, ...
- Produces:
  `actions::priorities::insert(place, section: Section, index: usize, lines: &[String], previous: &str) -> Result<String, ActionError>`,
  using the existing private `insert`; binding
  `insertPriority(repo, section, index, lines, previous): Promise<Priorities>`, through
  `api::insert_priority(repo, section_id: &str, index: u32, lines: &[String], previous: &str) -> Result<Priorities>`
  and `files::priorities::insert_entry(text, section, index, lines) -> Option<String>`; mutation
  `priorities.insert` with input `{ section, index, lines, hash }`.
- Produces: `FeatureView.mockups: Vec<String>`, the `.html` file names of `<folder>/mockups/`, from
  the worktree when there is one, else the branch's tip, sorted.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/priorities.rs
#[test]
fn keys() {
    let cases = [
        ("- Claude Code runner (triggered manually)", vec!["claude-code-runner-triggered-manually"]),
        ("- [Git listener process](drafts/git-listener.md)", vec!["git-listener"]),
        ("- [Web UI for the workflow files](/specs/2026-10-11-web-ui/proposal.md)", vec!["web-ui-for-the-workflow-files"]),
        ("- Nvim plugin\n- Nvim plugin", vec!["nvim-plugin", "nvim-plugin-2"]),
        ("- 🚀\n- …", vec!["line", "line-2"]),
    ];
    for (items, expected) in cases {
        let text = format!("# Priorities\n\n## Next\n\n{items}\n");
        let read = priorities::read(&text, None);
        let keys: Vec<&str> = read.sections[1].entries.iter().map(|e| e.key.as_str()).collect();
        assert_eq!(keys, expected, "{items}");
    }
}

#[test]
fn insert_puts_a_removed_line_back_with_its_nested_lines() {
    let repo = fixture_repo();
    let before = text(&repo);
    let read = api::read_priorities(&repo).unwrap();
    let removed = api::remove_priority(&repo, "later-1", &read.hash).unwrap();
    api::insert_priority(&repo, "later", 0,
        &["- Nix + Docker based execution environments".into(), "  - with a cache".into()],
        &removed.hash).unwrap();
    assert_eq!(text(&repo), before);
}

#[test]
fn insert_past_the_end_appends_and_a_stale_hash_is_refused() { /* index 99 lands last; "x" hash refused with the core's message */ }
```

```rust
// crates/core/tests/api.rs
#[test]
fn a_feature_lists_its_mockups() {
    let repo = fixture_repo();
    add_on_branch(&repo, "2026-10-06-recurring-tasks", "specs/2026-10-06-recurring-tasks/mockups/repeat.html", "<p>x</p>");
    assert_eq!(api::read_feature(&repo, "2026-10-06-recurring-tasks").unwrap().mockups, vec!["repeat.html"]);
}
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test priorities --test api`
- Expected: FAIL to compile, `no field key on type EntryItem`.

- [x] **Step 3: Implement** the interfaces above; `add_on_branch` is a new `TestRepo` method of
      `crates/core/tests/common/repo.rs` committing a file on another branch. The Rust tests have no
      `fixture_repo()`: the priorities tests build a repository whose `PRIORITIES.md` is the
      fixture's, and the mockup test uses `api.rs`'s `repo()` and its `2026-10-11-web-ui` branch.
      Rebuild the binding.

- [x] **Step 4: Run all tests**

- Run:
  `cargo test --workspace --exclude uraeda-binding && vp run --filter uraeda-binding build && vp test`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates packages/binding packages/server packages/web/src/views.ts
git commit -m "feat(ui-improvements): priority keys, putting a line back, and mockup lists"
```

## Task 4: Dependencies, StyleX, and the app's theme

**Files:**

- Modify: `packages/web/package.json` (and its `theme` script), `pnpm-workspace.yaml` (the CLI's
  postinstall nudge denied, like core's), `pnpm-lock.yaml`
- Modify: `packages/web/vite.config.ts` (`stylex.vite()` before `react()`), the root's
  `vite.config.ts` (the built theme left out of lint and format) and `package.json` (`ready` runs
  `astryx theme build --check`)
- Create: `packages/web/src/theme/theme.ts` (the `defineTheme` source),
  `packages/web/src/theme/built/` (output of `astryx theme build`, committed: `uraeda.css`,
  `uraeda.js`, and their declarations)
- Modify: `packages/web/src/main.tsx`, `App.tsx` (import the built theme instead of
  `@astryxdesign/theme-neutral/theme.css` and `/built`)
- Create: `packages/web/src/__browser__/helpers.tsx` (`show`, `checkPage`, `checkInsets`, moved from
  `layout.test.tsx`, importing the built theme)
- Modify: `packages/web/src/styles.css` (remove the coarse-pointer override, now in the theme),
  `packages/server/src/__tests__/stack.test.ts` (SC-005 read from the built theme)
- Test: `packages/web/src/__browser__/sizes.test.tsx` (new)

**Interfaces:**

- Produces: `uraedaTheme`, the built theme object, from `packages/web/src/theme/built/uraeda.js`,
  and its stylesheet `packages/web/src/theme/built/uraeda.css`; tokens added by the theme, as Astryx
  `localTokens`: `--text-reading-size` (17 px, 19 px from `lg`), `--text-reading-line` (1.5),
  `--size-reading-measure` (70ch), `--color-selection` and `--color-selection-edge` (Astryx's
  `--color-background-yellow` and `--color-border-yellow`: an amber tint and bar, light and dark,
  distinct from `--color-background-muted`). Adaptations, in order ([R4](rulings.md)): from
  `width: { from: "lg" }`, `typography.scale.base` and every spacing and element-size token
  multiplied by 1.2; under `pointer: coarse`, `--size-element-sm`, `md`, and `lg` at 44 px.
- Produces: StyleX compiled in dev, the build, and both test projects ([R6](rulings.md)). Components
  take Astryx's tokens from `@astryxdesign/core/theme/tokens.stylex` (`spacingVars`, `colorVars`,
  `sizeVars`, `typeScaleVars`, ...), and the theme's own as `var(--text-reading-size)` strings.
- Produces: every browser test runs at two instances of the WebKit project, `phone` (402 × 874) and
  `desktop` (1440 × 900), and reads `window.innerWidth` for what differs; `__browser__/helpers.tsx`
  exports `show(path, text)`, `checkPage()`, and `checkInsets(selector)`, phone only
  ([R7](rulings.md)).
- Produces: exact versions `@astryxdesign/core` and `theme-neutral` 0.6.8, `@astryxdesign/cli` 0.6.8
  (dev), `@stylexjs/unplugin` 0.19.1 (dev), `@stylexjs/stylex` 0.19.1, `@dnd-kit/react` and
  `@dnd-kit/helpers` 0.5.0, `axe-core` 4.14.0 (dev).

- [x] **Step 1: Write the failing test**

```tsx
// packages/web/src/__browser__/sizes.test.tsx, run at both sizes by the browser config
test("text and controls follow the width (US6 1, 2)", async () => {
  await show("/priorities", "Git listener process");
  const paragraph = parseFloat(
    getComputedStyle(document.body).getPropertyValue("--text-reading-size"),
  );
  const button = screen.getAllByRole("button")[0].getBoundingClientRect().height;
  if (window.innerWidth >= 1024) {
    expect(paragraph).toBe(19);
    expect(button).toBeGreaterThanOrEqual(38);
  } else {
    expect(paragraph).toBe(17);
  }
});
```

Move `show`, `checkPage`, and the other helpers of `layout.test.tsx` into `__browser__/helpers.tsx`,
shared by every browser test. Add a second instance to `vite.browser.config.ts`: the WebKit project
runs each browser test at `{ width: 402, height: 874 }` and `{ width: 1440, height: 900 }`, named
`phone` and `desktop`.

- [x] **Step 2: Run it to check it fails**

- Run: `vp test sizes.test`
- Expected: FAIL, `expected NaN to be 19` at desktop size (and `17` on the phone): the token does
  not exist.

- [x] **Step 3: Implement**

Add the dependencies, the StyleX plugin, the theme source extending `@astryxdesign/theme-neutral`,
and `pnpm exec astryx theme build` into `src/theme/built/`; add a `theme` script to
`packages/web/package.json` running that build (`vp run --filter uraeda-web theme`), so the theme's
source and output stay together. `App.tsx` passes `uraedaTheme` to `Theme`.

- [x] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS, both sizes.

- [x] **Step 5: Commit**

```bash
git add packages/web pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(ui-improvements): StyleX and the app's own theme, sized by width"
```

## Task 5: Width classes, panes, and the adaptive overlay

**Files:**

- Create: `packages/web/src/layout/useWidthClass.ts`, `Panes.tsx`, `Overlay.tsx`
- Modify: `packages/web/src/theme/theme.ts` (`--size-pane-min`, `--size-viewport-height`), and its
  build
- Test: `packages/web/src/__browser__/overlay.test.tsx`,
  `packages/web/src/__tests__/overlay.test.tsx`

**Interfaces:**

- Produces: `useWidthClass(): "narrow" | "wide"`, from the theme's `md` breakpoint through Astryx's
  media hook, updated live.
- Produces: `<Panes list={ReactNode} detail={ReactNode | undefined} onCloseDetail={() => void} />`:
  wide, the list and the detail side by side, the detail 40% wide and at least 400 px, with a Close
  calling `onCloseDetail`; the list scrolls with the page, the detail, sticky, on its own (R8);
  narrow, the detail alone when given, else the list.
- Produces: `<Overlay label={string} isOpen={boolean} onClose={() => void}>{children}</Overlay>`:
  wide, an Astryx `Dialog`; narrow, a `BottomSheet` of `height="tall"`; a visible "Close" button in
  both; opening pushes a history entry `{ overlay: label }`, and Back closes it.

- [x] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/overlay.test.tsx
test("Back closes an overlay", async () => {
  render(<OpenOverlay label="New priority" />); // a test-only harness in the same file
  expect(screen.getByRole("dialog", { name: "New priority" })).toBeTruthy();
  await act(async () => window.history.back());
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "New priority" })).toBeNull());
});

test("the overlay has a visible Close", async () => {
  render(<OpenOverlay label="New priority" />);
  await click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
```

```tsx
// packages/web/src/__browser__/overlay.test.tsx
test("a sheet on the phone, a dialog on the desktop", async () => {
  render(<OpenOverlay label="New priority" />);
  const box = screen.getByRole("dialog", { name: "New priority" }).getBoundingClientRect();
  if (window.innerWidth < 768) {
    expect(Math.round(box.bottom)).toBe(window.innerHeight);
  } else {
    expect(box.bottom).toBeLessThan(window.innerHeight - 40);
  }
});
```

- [x] **Step 2: Run them to check they fail**

- Run: `vp test overlay.test`
- Expected: FAIL, `Failed to resolve import "../layout/Overlay.tsx"`.

- [x] **Step 3: Implement** the three units, styled with StyleX and theme tokens only.

- [x] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web/src/layout packages/web/src/__tests__/overlay.test.tsx packages/web/src/__browser__/overlay.test.tsx
git commit -m "feat(ui-improvements): width classes, panes, and an adaptive overlay"
```

## Task 6: Back returns to the same place

**Files:**

- Modify: `packages/web/src/routes.tsx` (`navigate`, new `useRestoreScroll`, route `task`, route
  `mockup`), `packages/web/src/App.tsx`
- Test: `packages/web/src/__browser__/scroll.test.tsx`, `packages/web/src/__tests__/routes.test.ts`

**Interfaces:**

- Produces: `navigate(path: string, state?: { from?: string })`: saves `{ scroll: window.scrollY }`
  into the current entry with `replaceState` first, then pushes `{ ...state }`; scrolls to the top.
- Produces: `useRestoreScroll(ready: boolean)`: when the current entry holds `scroll` and `ready`
  turns true, scrolls there once; also saves the position on `pagehide` and at most every 500 ms
  while scrolling. `history.scrollRestoration = "manual"` at start.
- Produces: routes `{ page: "task"; key: string }` at `/priorities/<key>`, and
  `{ page: "mockup"; folder: string; name: string }` at `/f/<folder>/mockups/<name>`.
- Produces: pages keep their content while their data reloads: the route change is wrapped in
  `startTransition`, so the `Suspense` fallback shows only on a first load.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/web/src/__tests__/routes.test.ts
test.each([
  ["/priorities/git-listener", { page: "task", key: "git-listener" }],
  [
    "/f/2026-10-06-recurring-tasks/mockups/repeat.html",
    { page: "mockup", folder: "2026-10-06-recurring-tasks", name: "repeat.html" },
  ],
])("parseRoute(%s)", (path, route) => expect(parseRoute(path)).toEqual(route));
```

```tsx
// packages/web/src/__browser__/scroll.test.tsx, at both sizes
test("Back returns to the position, without Loading… (US1 8)", async () => {
  await show("/f/2026-10-06-recurring-tasks/spec.md", "Complete a repeating task");
  window.scrollTo(0, 1200);
  await click(screen.getByRole("link", { name: "discovery" }));
  await act(async () => window.history.back());
  expect(screen.queryByText("Loading…")).toBeNull();
  await expect.poll(() => Math.round(window.scrollY)).toBe(1200);
});

test("the position survives a reload, then Back (review focus 3)", async () => {
  // Arrange as above; reload by remounting the app on the same history entry; Back; same position.
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test routes.test scroll.test`
- Expected: FAIL, `expected { page: "missing", ... } to deeply equal { page: "task", ... }`.

- [ ] **Step 3: Implement** the interfaces; every page calls `useRestoreScroll(true)` once its data
      is drawn (pages without async data pass `true` at once).

- [ ] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "fix(ui-improvements): Back returns to the same place"
```

## Task 7: The shell: home link, collapsible navigation, top bar slot, ＋ and its toast

**Files:**

- Modify: `packages/web/src/Shell.tsx`, `QuickAdd.tsx`
- Create: `packages/web/src/layout/TopBarSlot.tsx`, `packages/web/src/layout/useUndoToast.ts`
- Test: `packages/web/src/__tests__/shell.test.tsx`; update `priorities.test.tsx` (＋ tests)

**Interfaces:**

- Produces: `<TopBarSlot>{controls}</TopBarSlot>`: what a page renders there appears at the end of
  the shell's header (the phone's top bar, the side navigation's header on wide screens); empty by
  default.
- Produces: `<QuickAdd />`, rendered by home and the priorities page in their `TopBarSlot`; its form
  opens in `Overlay`.
- Produces: `useUndoToast(): (message: string, undo: () => Promise<boolean>) => void`: an Astryx
  toast, `autoHideDuration` 5000, with one "Undo" action; when `undo` resolves false, the toast is
  replaced by the error text it is given by the caller.
- Shell: `SideNavHeading` with `headingHref="/"`, clicks routed through `navigate`; `SideNav` with
  `resizable={{ defaultWidth: 240, minWidth: 200, maxWidth: 360, autoSaveId: "uraeda.nav" }}` and
  `collapsible`; the theme switch stays its footer.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/shell.test.tsx
test("Uraeda goes home (US6 4)", async () => {
  await renderPage("/priorities");
  await click(screen.getAllByRole("link", { name: /Uraeda/ })[0]);
  expect(window.location.pathname).toBe("/");
});

test("＋ adds to Later with a toast and Undo, and the bar does not change (US6 5)", async () => {
  const { repo } = await renderPage("/");
  await click(screen.getByRole("button", { name: "Add a priority" }));
  await type(await screen.findByLabelText("Priority"), "Show the agent's last commit");
  await click(screen.getByRole("radio", { name: "Later" }));
  await click(screen.getByRole("button", { name: "Add" }));
  await waitFor(() =>
    expect(read(repo)).toContain("  - with a cache\n- Show the agent's last commit\n"),
  );
  expect(await screen.findByText("Added to Later, not committed")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(read(repo)).not.toContain("Show the agent's last commit"));
});

test("no ＋ on a round or a review (US6 6)", async () => {
  await renderPage("/f/2026-10-11-web-ui/clarifications-01.md");
  await screen.findByText("How does your iPhone reach the server?");
  expect(screen.queryByRole("button", { name: "Add a priority" })).toBeNull();
});
```

Move `read`, `type`, and `click` from the existing tests into `helpers.tsx`, shared.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test shell.test`
- Expected: FAIL, `Unable to find an accessible element with the role "link" and name /Uraeda/`.

- [ ] **Step 3: Implement** the interfaces. The toast's Undo of ＋ removes the line just added: the
      last entry of the section in the priorities the add returned, by its id.

- [ ] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(ui-improvements): a home link, a collapsible navigation, and ＋ with Undo"
```

## Task 8: Documents, feature and file pages, on Astryx and StyleX

**Files:**

- Modify: `packages/web/src/Blocks.tsx`, `Spans.tsx`, `DocumentPage.tsx`, `FeaturePage.tsx`,
  `FilePage.tsx`
- Modify: `packages/web/src/styles.css` (remove the classes these files no longer use)
- Test: `packages/web/src/__tests__/document.test.tsx`, `feature.test.tsx` (selectors by role)

**Interfaces:**

- Produces: `Blocks` drawn with Astryx `Heading`, `Text`, `List`, `CodeBlock`, `Table`, and StyleX
  for callouts and typed bullets, reading text at `--text-reading-size`, measure
  `--size-reading-measure`, `text-wrap: pretty`, left-aligned. Its `Selection` API is unchanged.
- Produces: `FeaturePage` and `FilePage` open with Astryx `Breadcrumbs`: Home, the feature, the
  file. `FeaturePage` lists the feature's files as `List` rows, then a "Mockups" group listing
  `feature.mockups`, each a row linking `/f/<folder>/mockups/<name>`.

- [ ] **Step 1: Write the failing tests**

```tsx
// feature.test.tsx
test("the feature page lists its mockups (C1)", async () => {
  const repo = fixtureRepo();
  addMockup(repo, "2026-10-06-recurring-tasks", "repeat.html"); // new shared helper: commits it on the branch
  await renderPage("/f/2026-10-06-recurring-tasks", repo);
  expect(await screen.findByRole("link", { name: /repeat\.html/ })).toBeTruthy();
});

test("a file page shows breadcrumbs", async () => {
  await renderPage("/f/2026-10-06-recurring-tasks/proposal.md");
  const crumbs = await screen.findByRole("navigation", { name: "Breadcrumbs" });
  expect(within(crumbs).getByRole("link", { name: "Home" })).toBeTruthy();
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test feature.test document.test`
- Expected: FAIL, no link named /repeat\.html/.

- [ ] **Step 3: Implement** the interfaces.

- [ ] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(ui-improvements): documents and feature pages on Astryx, with mockups listed"
```

## Task 9: The task view, and home on Astryx

**Files:**

- Create: `packages/web/src/TaskView.tsx`, `packages/web/src/EditableLine.tsx`
- Modify: `packages/web/src/Home.tsx`, `App.tsx` (route `task`), `data.ts` (`usePriority(key)`)
- Test: `packages/web/src/__tests__/task.test.tsx`, `packages/web/src/__browser__/task.test.tsx`,
  `home.test.tsx` (selectors by role)

**Interfaces:**

- Consumes: `EntryItem.key`, `priorities.insert` (task 3), `Panes`, `Overlay`, `useWidthClass` (task
  5), `navigate(path, { from })` (task 6), `useUndoToast` (task 7).
- Produces: `<TaskView entryKey={string} />`: the entry found by `key` in `usePriorities()`; its
  spans as an `EditableLine`; its section as a `SegmentedControl` (Now, Next, Later, Blocked) that
  moves it to the end of the chosen section; Draft when it has no link; when it has a draft, the
  draft drawn with `Blocks` from `useDraft`, with Edit (to `/edit/<draft>`) and Start the feature;
  Delete; "‹ Previous" and "Next ›" through its section, disabled at the ends. No Move up or Move
  down (C3).
- Produces:
  `<EditableLine value={string} label={string} onSave={(text) => Promise<string | undefined>} />`:
  the text, a button by role; tapped, a `TextInput`; Enter or blur saves, Escape cancels; an empty
  text is refused with "A priority cannot be empty."; `onSave` returns an error message to show
  under the field, or nothing.
- Produces: home's rows: features and priorities as `List` items, each a link; a priority opens
  `navigate("/priorities/<key>", { from: "/" })`. The `task` route renders, wide, the page named by
  `history.state.from` (home or the priorities page, the priorities page when absent) in `Panes`
  with the task view as detail; narrow, the task view alone.
- Deleting shows `Deleted "<text>"` with Undo, which calls `priorities.insert` with the entry's
  section, index, and lines (`- <text>` then its `nested`), then leaves the task view for the page
  it came from. A refused Undo shows `Could not restore "<text>": PRIORITIES.md changed on disk.`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/task.test.tsx
test("a line without a draft opens its task view (US3 1)", async () => {
  await renderPage("/");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));
  expect(window.location.pathname).toBe("/priorities/claude-code-runner-triggered-manually");
  expect(screen.getByRole("radio", { name: "Next", checked: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Draft" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Move up" })).toBeNull();
});

test("a line with a draft shows it drawn (US3 2)", async () => {
  await renderPage("/priorities/git-listener");
  expect(await screen.findByRole("heading", { name: "What" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Start the feature" })).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
});

test("editing the line in place moves the address (US3 3)", async () => {
  const { repo } = await renderPage("/priorities/claude-code-runner-triggered-manually");
  await click(await screen.findByRole("button", { name: /Claude Code runner/ }));
  await type(screen.getByRole("textbox", { name: "Line" }), "Claude Code runner{Enter}");
  await waitFor(() => expect(read(repo)).toContain("- Claude Code runner\n"));
  expect(window.location.pathname).toBe("/priorities/claude-code-runner");
});

test("Escape keeps the text, and an empty line is refused", async () => {
  /* edge cases */
});
test("the section moves the line (US3 4)", async () => {
  /* Later radio → ends Later, radio checked */
});
test("Next › walks the section, disabled on the last (US3 6)", async () => {
  /* next-1 → next-2, then disabled */
});
test("a reload shows the same line (US3 7)", async () => {
  /* render at the address twice */
});
test("a removed line says so", async () => {
  /* render /priorities/nope → "This line is no longer in PRIORITIES.md." */
});
test("a refused Undo says so", async () => {
  /* change the file between Delete and Undo so insert is refused → 'Could not restore "…": PRIORITIES.md changed on disk.' */
});
test("Delete, then Undo, puts the line and its nested line back (US4 9)", async () => {
  const { repo } = await renderPage("/priorities/nix-docker-based-execution-environments");
  const before = read(repo);
  await click(await screen.findByRole("button", { name: "Delete" }));
  expect(
    await screen.findByText('Deleted "Nix + Docker based execution environments"'),
  ).toBeTruthy();
  await click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(read(repo)).toBe(before));
});
```

```tsx
// packages/web/src/__browser__/task.test.tsx, desktop only
test("on a wide screen, the task view opens beside home (US3 5)", async () => {
  await show("/", "Claude Code runner");
  await click(screen.getByRole("link", { name: /Claude Code runner/ }));
  expect(screen.getByRole("link", { name: /Git listener process/ })).toBeTruthy(); // home stays
  expect(screen.getByRole("radio", { name: "Next", checked: true })).toBeTruthy();
  await act(async () => window.history.back());
  await waitFor(() => expect(screen.queryByRole("radio", { name: "Next" })).toBeNull());
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test task.test`
- Expected: FAIL,
  `Unable to find an accessible element with the role "link" and name /Claude Code runner/`.

- [ ] **Step 3: Implement** the interfaces; `usePriority(key)` reads `usePriorities()` and finds the
      entry, its section, and its index.

- [ ] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(ui-improvements): a task view for every priority"
```

## Task 10: The editor: drafts drawn, hints for empty sections

**Files:**

- Modify: `packages/web/src/EditorPage.tsx`, `data.ts` (`useProposalHints`), server source for the
  hints (`packages/server/src/fate/sources.ts`, a `hints` record)
- Test: `packages/web/src/__tests__/editor.test.tsx`

**Interfaces:**

- Consumes: binding `proposalHints()` (task 1).
- Produces: a written draft or proposal (any section with text besides the title) opens drawn, with
  "Edit"; a draft with only its title and What opens in the text editor. In the editor, each empty
  `## What`, `## Why`, or `## Notes` section shows its hint dimmed, from `proposalHints()`, never
  written to the file. The discovery level control stays.

- [ ] **Step 1: Write the failing tests**

```tsx
test("a new draft shows its hints, which are not in the file (US5 3)", async () => {
  const { repo } = await renderPage("/");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));
  await click(screen.getByRole("button", { name: "Draft" }));
  expect(await screen.findByText("The problem it solves, and for whom.")).toBeTruthy();
  expect(read(repo, "specs/drafts/claude-code-runner-triggered-manually.md")).not.toContain(
    "The problem it solves",
  );
});

test("a written proposal opens drawn, with Edit (US5 5)", async () => {
  await renderPage("/edit/specs/drafts/git-listener.md");
  expect(await screen.findByRole("heading", { name: "What" })).toBeTruthy();
  await click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByRole("textbox", { name: "Text" })).toBeTruthy();
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test editor.test`
- Expected: FAIL, the text "The problem it solves, and for whom." is not found.

- [ ] **Step 3: Implement** the interfaces; the hints are drawn as a StyleX overlay aligned to the
      empty section's line in the text area, or, if that proves fragile, listed under the text area
      by heading (record the choice as a ruling).

- [ ] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src packages/server/src
git commit -m "feat(ui-improvements): drafts open drawn, with hints for empty sections"
```

## Task 11: The priorities page: headings, Add rows, tap to open, dnd-kit dragging

**Files:**

- Modify: `packages/web/src/PrioritiesPage.tsx` (rewrite), `App.tsx`
- Test: `packages/web/src/__tests__/priorities.test.tsx` (rewrite), `drop.test.ts` (kept),
  `packages/web/src/__browser__/priorities.test.tsx`

**Interfaces:**

- Consumes: `TaskView`, `Panes` (tasks 5, 9), `@dnd-kit/react` `DragDropProvider`, `useSortable`,
  `@dnd-kit/helpers` `move`.
- Produces: each section a heading `<Section> · <count>`, Now larger; each line a row that opens its
  task view (`navigate("/priorities/<key>", { from: "/priorities" })`), with a drag handle; no ⋯
  menu and no edit in place (C3); each section ends with an "Add to <Section>" row, an
  `EditableLine` that adds with `priorities.add` and stays open, empty, for the next line.
- Dragging: one sortable group per section, items movable across sections; pointer sensor with no
  delay on fine pointers and a 500 ms delay with 5 px tolerance on touch; keyboard sensor; a drop
  calls `priorities.move` with `dropIndex`; a drop where it started, or Escape, writes nothing;
  reduced motion turns the items' transition off. While a drag is active, live updates to the list
  wait, and apply when it ends (review focus 4).

- [ ] **Step 1: Write the failing tests**

```tsx
// priorities.test.tsx
test("sections show their counts, and end with an Add row (US4 1)", async () => {
  await renderPage("/priorities");
  expect(await screen.findByRole("heading", { name: "Now · 4" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Next · 2" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add to Later" })).toBeTruthy();
});

test("tapping a line opens its task view (C3)", async () => {
  await renderPage("/priorities");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));
  expect(window.location.pathname).toBe("/priorities/claude-code-runner-triggered-manually");
});

test("an Add row adds and stays ready (US4 4)", async () => {
  const { repo } = await renderPage("/priorities");
  await click(await screen.findByRole("button", { name: "Add to Later" }));
  await type(screen.getByRole("textbox", { name: "Add to Later" }), "Ship a TUI{Enter}");
  await waitFor(() => expect(read(repo)).toContain("  - with a cache\n- Ship a TUI\n"));
  expect(screen.getByRole("textbox", { name: "Add to Later" })).toHaveProperty("value", "");
});
```

```tsx
// packages/web/src/__browser__/priorities.test.tsx
test("dragging with a mouse makes room and moves the line (US4 5)", async () => {
  /* drag "Git listener process" handle above "Claude Code runner"; mid-drag, the other row's box moved down; file order swapped */
});
test("a touch press of 500 ms lifts, a quick swipe scrolls (US4 6)", async () => {
  /* phone only */
});
test("Space, ↓, ↓, Space moves a line two places, announced (US4 7)", async () => {
  /* desktop; live region text names the new position */
});
test("Escape cancels a drag, and nothing is written", async () => {
  /* file unchanged */
});
test("committing closes the page's toasts", async () => {
  /* add via an Add row is visible, so delete from a task view then Commit on the list: no Undo button left */
});
test("a live update during a drag waits for its end (review focus 4)", async () => {
  /* write the file mid-drag; rows unchanged until drop */
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test priorities.test`
- Expected: FAIL, `Unable to find an accessible element with the role "heading" and name "Now · 4"`.

- [ ] **Step 3: Implement** the interfaces.

- [ ] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(ui-improvements): the priorities page, opened by tap and dragged with dnd-kit"
```

## Task 12: The round's navigation

**Files:**

- Create: `packages/web/src/RoundNav.tsx`, `packages/web/src/useRoundPosition.ts`
- Modify: `packages/web/src/RoundPage.tsx`, `Question.tsx` (restyled in StyleX; the option stays a
  raw `button`, an Astryx gap, with its suppression)
- Test: `packages/web/src/__tests__/round.test.tsx` (helpers by role),
  `packages/web/src/__browser__/round.test.tsx`

**Interfaces:**

- Produces: `RoundNav({ questions, blank, onJump })`: narrow, in `TopBarSlot`, a "<n>/<total>"
  button that opens the index in an `Overlay` labelled "Questions", and "Next" (or "Submit" when
  nothing is blank); wide, a sticky column, 240 px, with "<n> of <total> answered", Next or Submit,
  and Astryx `Outline` of the applicable questions, follow-ups at level 2, each label prefixed ✓ or
  ○, the question at the top marked current.
- Produces: `jumpTo(id)`: scrolls the question to the top below the bar (`scroll-margin-top`), and
  focuses its title (`tabIndex={-1}`); instant under reduced motion. Next goes to the first blank
  question after the one at the top, wrapping to the first blank; Submit scrolls to the end.
- Produces: `n` and `p` through Astryx `useHotkeys`, wide only, ignored while a text field has the
  focus; no blank question in that direction does nothing.
- Produces: `useRoundPosition(folder, file)`: saves the id of the question at the top in
  `localStorage` `uraeda.round.<folder>/<file>`, at most once a second; on opening without a Back
  entry, jumps to it when it is still an applicable question, else to the first blank question, else
  stays at the top; storage errors fall back silently.

- [ ] **Step 1: Write the failing tests**

```tsx
// round.test.tsx, on the fixture round: Q1, Q1.B, Q2, Q3; Q1.B applies once Q1 names no letter
test("the bar counts and offers Next, without ＋ (US1 1)", async () => {
  await renderPage(PAGE, answered({ Q1: "A" }));
  expect(await screen.findByRole("button", { name: "1/3" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add a priority" })).toBeNull();
});

test("Next goes to the first blank question after the one at the top, and focuses it (US1 2, 3)", async () => {
  await renderPage(PAGE, answered({ Q1: "A" }));
  await click(await screen.findByRole("button", { name: "Next" }));
  expect(document.activeElement?.textContent).toContain("How does your iPhone reach the server?");
});

test("with nothing blank, Next becomes Submit (US1 4)", async () => {
  /* answered Q1 A, Q2 A, Q3 A → "3/3", "Submit" */
});
test("the index lists the questions with their state, and jumps (US1 5)", async () => {
  /* click "1/3" → dialog "Questions" lists Q1 ✓, Q2 ○, Q3 ○; click Q3 → closed, Q3 focused */
});
test("the round reopens where it was left (US1 9)", async () => {
  /* localStorage Q3 → opening focuses Q3's title */
});
test("a new browser opens at the first blank question (US1 10)", async () => {
  /* answered Q1 → Q2 focused */
});
test("a saved position on a question that no longer applies falls back", async () => {
  /* Q1.B saved, Q1 answered "A" → Q2 */
});
test("without storage, the round opens at the first blank question", async () => {
  /* localStorage throws */
});
```

```tsx
// packages/web/src/__browser__/round.test.tsx, desktop
test("the index is a column beside the questions, and n and p jump (US1 6, 7)", async () => {
  /* Outline nav visible, sticky after scrolling; n → Q2 at the top; p → back; n in a comment field types n */
});
test("at 1200 px with the navigation open, the questions get at least 600 px (C3)", async () => {
  /* set viewport 1200 × 900 */
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test round.test`
- Expected: FAIL, `Unable to find an accessible element with the role "button" and name "1/3"`.

- [ ] **Step 3: Implement** the interfaces.

- [ ] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(ui-improvements): navigate a round from its bar or its index"
```

## Task 13: Commenting in view, and mockups in the UI

**Files:**

- Modify: `packages/web/src/ReviewPage.tsx`, `Blocks.tsx` (selection tint from `--color-selection`)
- Create: `packages/web/src/MockupPage.tsx`, `packages/web/src/CommentForm.tsx`
- Modify: `packages/web/src/App.tsx` (route `mockup`)
- Test: `packages/web/src/__tests__/review.test.tsx`,
  `packages/web/src/__browser__/review.test.tsx`, `packages/web/src/__tests__/mockup.test.tsx`

**Interfaces:**

- Consumes: `FeatureView.mockups` (task 3), `Overlay` (task 5), `review.comment` (exists).
- Produces: `<CommentForm anchor={string} quote={string} onSubmit onCancel />`, shared by the review
  and the mockup page.
- Review, narrow: a tap selects the block (tinted with `--color-selection` and a bar of
  `--color-selection-edge`), opens a `BottomSheet` of `height="tall"` with `CommentForm`, quoting
  the selection's first line under its anchor, and scrolls the last selected block's bottom just
  above the sheet, its top at least under the bar when it is too tall. Wide: `CommentForm` drawn in
  the page, under the last selected block, no overlay. Cancel clears the selection.
- `MockupPage`: Breadcrumbs (Home, feature, the mockup's name); the mockup in an `iframe` with
  `sandbox="allow-scripts"`, its source `/mockups/specs/<folder>/mockups/<name>`, the page's full
  width and the screen's height below the header; "Open in a new tab"; while the spec waits for
  review, "Comment" opens `CommentForm` in an `Overlay`. The comment goes on the lines of the spec's
  block that links `mockups/<name>`, the first one in document order; with no such block, it is a
  general comment whose text starts "Mockup <name>: ".

- [ ] **Step 1: Write the failing tests**

```tsx
// review.test.tsx (happy-dom has no layout: the wide branch is forced with a test width provider)
test("on a wide screen, the comment field opens under the block (US2 3, 4)", async () => {
  await renderWide(PAGE, repo()); // new helper: renders with useWidthClass() returning "wide"
  await click(await blockOf("Given a weekly task"));
  const form = screen.getByRole("form", { name: "Comment" });
  expect(screen.queryByRole("dialog")).toBeNull();
  await click(within(form).getByRole("button", { name: "Cancel" }));
  expect((await blockOf("Given a weekly task")).getAttribute("aria-selected")).toBe("false");
});
```

```tsx
// mockup.test.tsx
test("a mockup shows in the UI, and a comment lands on the line that links it (C1)", async () => {
  const repo = specWithMockup(); // recurring-tasks spec with "- [Repeat](mockups/repeat.html): the menu" under ### Mockups, and the file, committed
  await renderPage("/f/2026-10-06-recurring-tasks/mockups/repeat.html", repo);
  expect((await screen.findByTitle("repeat.html")).getAttribute("src")).toBe(
    "/mockups/specs/2026-10-06-recurring-tasks/mockups/repeat.html",
  );
  await click(screen.getByRole("button", { name: "Comment" }));
  await type(
    screen.getByRole("textbox", { name: "Comment text" }),
    "The menu needs a Never option",
  );
  await click(screen.getByRole("button", { name: "Add comment" }));
  await waitFor(() =>
    expect(review(repo)).toMatch(
      /## C1: Line \d+, under "Mockups"\n\n> - \[Repeat\]\(mockups\/repeat\.html\)/,
    ),
  );
});

test("a mockup no line links gets a general comment (review focus 5)", async () => {
  /* review(repo) contains "Mockup extra.html: Too dense" under "## C1: General" */
});
test("no Comment once the spec is approved", async () => {
  /* approved spec → no Comment button */
});
```

```tsx
// packages/web/src/__browser__/review.test.tsx, phone
test("the selected block stays visible above the sheet, quoted (US2 1, 2)", async () => {
  await show("/f/2026-10-06-recurring-tasks/spec.md", "Complete a repeating task");
  const block = blockOf("Given a weekly task");
  block.scrollIntoView({ block: "end" });
  await click(block);
  const sheet = screen.getByRole("dialog", { name: "Comment" }).getBoundingClientRect();
  expect(block.getBoundingClientRect().bottom).toBeLessThanOrEqual(sheet.top);
  expect(within(screen.getByRole("dialog")).getByText(/^Lines \d+–\d+, under "US2/)).toBeTruthy();
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test review.test mockup.test`
- Expected: FAIL, `Unable to find role="form" and name "Comment"`.

- [ ] **Step 3: Implement** the interfaces.

- [ ] **Step 4: Run all tests**

- Run: `vp test`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src fixtures
git commit -m "feat(ui-improvements): comment with the block in view, and on mockups"
```

## Task 14: No global stylesheet, the lint rules, and the checks at both sizes

**Files:**

- Delete: `packages/web/src/styles.css`, its imports in `main.tsx` and the browser helpers
- Modify: `vite.config.ts` (`lint.plugins` add `react`; rules; `jsPlugins` add
  `@stylexjs/eslint-plugin`), `packages/web/package.json` (`@stylexjs/eslint-plugin` 0.19.1, dev)
- Modify: `packages/web/src/__browser__/layout.test.tsx` (both sizes, axe, both themes)
- Create: `packages/web/src/__lint__/` fixtures, one file per banned pattern, excluded from the
  normal lint and linted by a test
- Test: `packages/web/src/__tests__/lint.test.ts`

**Interfaces:**

- Lint rules, scoped to `packages/web/src/**`: `react/forbid-elements` for `button` ("use Astryx
  Button"), `input` ("use Astryx TextInput"), `textarea` ("use Astryx TextArea"), `select` ("use
  Astryx Selector"), `dialog` ("use Astryx Dialog or BottomSheet"); `react/forbid-dom-props` for
  `style`; `react/forbid-component-props` for `style` and `className` on components imported from
  `@astryxdesign/core`; `@stylexjs/valid-styles` with `propLimits` allowing only `var(--…)`, `0`,
  percentages, `auto`, and keywords for colour, spacing, size, radius, border, and font properties.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/web/src/__tests__/lint.test.ts
test.each([
  ["raw-button.tsx", "react(forbid-elements)"],
  ["style-prop.tsx", "react(forbid-dom-props)"],
  ["raw-color.tsx", "valid-styles"],
])("lint refuses %s (SC-002)", (file, rule) => {
  expect(lintOutput(`src/__lint__/${file}`)).toContain(rule); // runs `vp lint` on the file with the repo's config
});

test("a suppression with its reason passes", () => {
  expect(lintOutput("src/__lint__/suppressed.tsx")).not.toContain("error");
});

test("no stylesheet but Astryx's is imported (SC-001)", () => {
  // every import of a .css file under packages/web/src is one of the three Astryx stylesheets or the built theme
});
```

```tsx
// layout.test.tsx, at both sizes and in both themes, on home, a round, a spec review, a task view,
// and the priorities: today's checks (no text cut, no sideways scroll), plus:
//   paragraph text 17 px narrow, 19 px from 1024 px (SC-004);
//   every control at least 44 px tall under a touch pointer (phone instance with hasTouch);
//   no paragraph wider than 75 characters of its font (US6 3);
//   axe-core with tags wcag2a, wcag2aa, wcag21a, wcag21aa: no violations (SC-003);
// and: a comment being typed at 800 px keeps its text and focus when the viewport becomes 700 px (US7 2);
// a task view open at 1440 px stays at its address and becomes a page at 700 px (edge case).
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test lint.test layout.test`
- Expected: FAIL, `expected "" to contain "react(forbid-elements)"`.

- [ ] **Step 3: Implement** the lint configuration, delete `styles.css`, and fix what the lint and
      the checks report.

- [ ] **Step 4: Run all checks**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts packages/web
git commit -m "feat(ui-improvements): lint the UI decisions, check both sizes, drop styles.css"
```

## Task 15: Screenshots for review

**Files:**

- Create: `specs/2026-10-12-ui-improvements/screenshots/<view>-<phone|desktop>-<light|dark>.png`
- Create: `packages/web/scripts/screenshots.ts` (a Playwright script over the fixture repository,
  run with `vp run --filter uraeda-web screenshots`)

**Interfaces:**

- The views: home, home with a task view (desktop), a task view with a draft, the priorities page, a
  drag in progress, ＋ open, a round with its index open, a round on desktop, a review with the
  comment open, a mockup page, the editor with hints, a missing file.

- [ ] **Step 1: Write the screenshot script**, at 402 × 874 and 1440 × 900, light and dark, on the
      fixture repository served by the server in process.
- [ ] **Step 2: Take the screenshots, and review each** against the four UI decisions and
      [the mockups](mockups/ui-improvements.html); list what differs.
- [ ] **Step 3: Fix what the review found**, each fix in the task its view belongs to, with its test
      when a rule names it.
- [ ] **Step 4: Run all checks**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add specs/2026-10-12-ui-improvements/screenshots packages/web/scripts packages/web/package.json
git commit -m "docs(ui-improvements): screenshots of every changed view"
```
