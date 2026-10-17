# Rulings: Redesign and reword specs

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: `main` merged in before the plan, not rebased at the end

- **Decision**: the branch merged `main` before the approval step, and resolved its two decision
  conflicts there. Access-storybook's Storybook channel rule joins the rewritten stack decision as
  one sentence of its proxy rule, a sentence of its why, and a consequence. The rewritten UI
  behaviour decision is kept: it already exempts the chat composer that `main` made grow.
- **Rationale**: the spec builds on the clarifications redesign's writing reference, warnings, and
  round page, which were on `main` only. The spec also says whichever of this feature and
  access-storybook merges second folds the other's stack rule in.
- **Alternatives considered**: rebasing the branch: it rewrites the human's approval commit, and
  replays every decision rewrite against `main`'s changes.
- **If wrong**: the final review rebases as usual, with the resolutions git recorded.
- **Where**: the merge commit, and `specs/decisions/stack.md`

## R2: The branch's decision changes sit on the file view, not in `SpecItems`

- **Decision**: `FileView.decision_changes` carries the changes; `SpecItems.decisions` carries the
  spec's `## Decisions` items. The page joins them by name.
- **Rationale**: `SpecItems` is read from a text alone, for both the committed and the current
  version, and by `ura check`. The changes need git and the branch, once per file view.
- **Alternatives considered**: filling `SpecItems.decisions` with the changes in `file_view`, as the
  spec's details named it: two versions of the items would carry the same changes, and the check
  would see an empty list.
- **If wrong**: move the field; only the API and the page read it.
- **Where**: tasks 2 and 7

## R3: This feature's own spec and plan are rewritten in the new format

- **Decision**: once the templates change, task 2 rewrites this feature's spec and plan in the new
  format. The approved text is kept word for word where it stays. The spec's Details become the
  plan's tasks and test map, and its data the data model's.
- **Rationale**: `vp run ready` runs `ura check specs`, and the compatibility decision asks an agent
  to rewrite a file that fails it because its format changed. The spec's "the last one written in
  today's format" is about how it was written.
- **Alternatives considered**: leaving the spec in the old format until the finish step replaces it:
  `ready` would fail for every task after task 2.
- **If wrong**: the spec's text is in git at the approval commit, `2f82948`.
- **Where**: task 2, step 7

## R4: The plan is written in today's plan format

- **Decision**: this plan keeps today's `## Decisions` section and full constitution table, with its
  test map under `### Test map`. Task 2 rewrites it in the new plan format.
- **Rationale**: `ura check specs` reads plans against today's template until task 2 changes it.
- **Alternatives considered**: the new plan format from the start: `ready` would fail during the
  first wave.
- **If wrong**: nothing: task 2 changes only the plan's headings.
- **Where**: `plan.md`

## R5: A decision's rule is one sentence, then its check

- **Decision**: the skill reads "one sentence each, ending 'Checked by ...'" as one sentence for the
  rule, followed by how it is checked: "Checked by review." A rule holding two ideas is two rules.
- **Rationale**: the 18 rewritten decisions, approved with the spec, write every rule this way.
  Reading the data model's wording strictly would make each of them break the rule it states.
- **Alternatives considered**: the rule and its check in one sentence, joined by a comma. The
  sentences would pass the 25-word limit, and every decision would be rewritten again.
- **If wrong**: reword `writing.md`'s "A decision" and `spec.md`'s "Writing a decision".
- **Where**: `skills/uraeda/references/writing.md`, `skills/uraeda/references/spec.md`

## R6: The README's quoted spec block gains a "You approve" line

- **Decision**: the README quotes the example spec's block as it was submitted. Task 1 adds a "You
  approve" first item to that quote, so the README shows the new block, without waiting for task 2.
- **Rationale**: the README must not show a format the skill no longer writes. Task 2 rewrites the
  example's block at the same time, in another worktree.
- **Alternatives considered**: leaving the quote unchanged until task 2 merges: the README would
  contradict the skill in between.
- **If wrong**: when merging tasks 1 and 2, copy the example's "You approve" item into the README's
  quote word for word.
- **Where**: `README.md`, "Its spec opened like this when it was submitted"

## R10: The tests of the old sections are replaced, and the tests over the fixtures follow the format

- **Decision**: the tests that read `## Details`, `## Mockups`, `Story.scenarios`, or
  `Story.details` are replaced or adapted, the behaviour they guard kept where it still exists. In
  the core, `a_spec_has_its_folds`, `a_spec_has_its_mockups`, and
  `the_mockups_section_takes_story_links_and_links_from_the_root` give way to the parts, answers,
  decisions, and `the_mockups_are_found_in_the_stories` tests, and
  `a_spec_in_the_old_layout_reports_its_moved_sections` to the order test;
  `a_spec_has_its_stories_and_criteria` and `a_spec_without_stories_has_none` read `key`, and the
  example's new lines. The CLI's approval test lists its decision as an item, and is renamed
  `approval_when_a_listed_decision_is_proposed`; the language server's comment test comments on the
  example's new lines of US2. In the web, the folds are "More scenarios (n)": the tests of the
  "Details" fold go (`a pending comment in the details opens them`, and the browser's three links to
  `#data` and `#details`), and the comments on a Details table row land on an edge case's row. The
  sidebar fixture's embed moves from line 27 to 31, under its new `## Decisions`, and the page
  SC-006 opens through a listed host name takes the desktop project's 1440 × 900, not Playwright's
  1280 × 720, so the embed is on screen and loads. The example's constitution has 3 principles, not
  the plan's 6.
- **Rationale**: the compatibility decision removes the sections with no fallback. The tests that
  remain check the same behaviour: a fold opened by a comment, kept across Back, a table row's line.
- **Alternatives considered**: keeping a Details fold for old specs: forbidden by the compatibility
  decision.
- **If wrong**: the removed tests are in git at the plan's commit, `7169351`.
- **Where**: task 2; `crates/core/tests/`, `crates/cli/tests/next.rs`,
  `crates/lsp/tests/commands.rs`, `packages/web/src/__tests__/`, `packages/web/src/__browser__/`,
  `packages/web/scripts/`, `packages/web/vite.browser.config.ts`

## R11: The fixture specs keep their stories, US2's first two scenarios folded

- **Decision**: the fixture specs keep their stories' text. US2's undo and "Wednesday the 14th"
  scenarios become its key scenarios, and its "Monday the 5th" and "Thursday the 8th" ones, which
  the review tests select together, its more scenarios. The review tests' padding goes from 17 to 4
  paragraphs, so those stay on lines 92 to 95; the long spec's paragraphs go before `## Decisions`,
  at the line `## User stories` had. The plan fixture's test map takes the lines of its removed
  `## Decisions`, so its tasks keep their lines.
- **Rationale**: dozens of review tests comment on those two scenarios, inside a fold, at those
  lines.
- **Alternatives considered**: new line numbers in every test: a larger diff, for the same checks.
- **If wrong**: reorder the fixture's scenarios and the tests' line numbers together.
- **Where**: task 2; `fixtures/repo/branches/`, `packages/web/src/__tests__/review.test.tsx`

## R12: A listed decision's link points into a `specs/decisions/` folder, wherever `specs/` is

- **Decision**: a new or changed item is listed when its link resolves to
  `<anything>specs/decisions/<name>.md`. The approval step reads `specs/decisions/<name>.md`.
- **Rationale**: the skill's example lives under `skills/uraeda/assets/example/specs/`, and its
  items must list its decisions; a repository's own are under `specs/decisions/`.
- **Alternatives considered**: passing the spec's folder to the parser: `SpecItems` is read from a
  document tree alone, which keeps no folder.
- **If wrong**: one function, `decision_name` in `files/spec/parts.rs`.
- **Where**: task 2, `crates/core/src/files/spec/parts.rs`

## R13: A spec part's blocks include its sub-headings

- **Decision**: `SpecPart.blocks` holds every top-level block of the section, its `###` headings
  included, unlike a round's parts.
- **Rationale**: a part is drawn whole: "User stories" holds its stories' headings, and an old
  spec's sub-sections would otherwise vanish from the page.
- **Alternatives considered**: dropping headings as `round.rs` does: the page would need a second
  pass to find them.
- **If wrong**: filter the headings out in `parts`.
- **Where**: task 2, `crates/core/src/files/spec/parts.rs`

## R14: Constitution tables are start-aligned

- **Decision**: the templates, the example, and the fixtures write the one-row constitution table
  with the default alignment, not centered.
- **Rationale**: until task 12 draws the principles as a strip, today's page draws the table, and
  the browser layout check requires start-aligned text. This feature's spec keeps its approved,
  centered table.
- **Alternatives considered**: centered cells, as the mockup: they fail the layout check on the
  plan's and the spec's review pages.
- **If wrong**: the alignment row of four templates and fixtures.
- **Where**: task 2, the templates, the example, and the fixtures

## R15: The fixture's HTML mockup is linked in running text

- **Decision**: the recurring tasks fixtures link `mockups/repeat.html` inside a sentence of US1,
  not alone in its paragraph; the sidebar fixture keeps a story link in a list item, for the edge
  case of a story link that does not embed.
- **Rationale**: today's review page draws a link alone in its paragraph shorter than a finger's 44
  px, which the browser layout check refuses. Task 11's story card draws the mockup in its card.
- **Alternatives considered**: a taller bare link in today's page: the page is replaced by task 10.
- **If wrong**: move the link to its own paragraph once task 11 draws it.
- **Where**: task 2, `fixtures/`

## R16: The feat commit comes before the rewrite of this feature's files

- **Decision**: the templates and the parser are committed first, then this feature's spec, data
  model, and plan, rewritten in the new format.
- **Rationale**: each of the two commits makes the other's files fail `ura check specs`: the old
  templates refuse the new spec, the new ones the old. Between the two commits, `specs:check` fails
  on this feature's spec alone.
- **Alternatives considered**: one commit for both: the plan asks for the rewrite on its own.
- **If wrong**: squash the two commits.
- **Where**: task 2, steps 7 and 9

## R20: A decision's parts compare their plain text, and reuse the document's `LineRange`

- **Decision**: a part's text, and so its runs, is the plain text of its parsed spans: code keeps
  its words without backticks, a link keeps its text without its target. `PartChange.before` and
  `after` use the document tree's `LineRange`, not a second type of the same name.
- **Rationale**: the stack decision forbids the web from parsing markdown, and runs of raw markdown
  would carry backticks and link syntax to draw. napi-rs generates one TypeScript interface per
  name, so a second `LineRange` would clash with the document's.
- **Alternatives considered**: comparing the markdown source, as the mockup's `partsOf` does: the
  web would parse it to draw code and links.
- **If wrong**: a link's target changed alone shows no change; runs would carry spans instead of
  text, a change local to `decisions/change.rs` and the card.
- **Where**: `crates/core/src/decisions/change.rs`

## R21: Where removed parts and sections sit, and which parts have a strength

- **Decision**: between two matched parts, the branch's parts come first, then the removed ones
  left; a section only the merge base has comes after the section that preceded it there. Only a
  list item has a strength. A part whose text is equal but moved within its section is `kept`. A
  decision without a `# ` heading takes its name as title.
- **Rationale**: the plan says "removed parts at the place they held" and lists the rewritten rule
  as added, then removed. Paragraphs are the intent and the reasons, never rules.
- **Alternatives considered**: removed parts first, as a line diff shows them: the reader would meet
  the old rule before the new one.
- **If wrong**: the order is set in `gap` and `section_titles`, the strength in `part_change`.
- **Where**: `crates/core/src/decisions/change.rs`

## R25: WebKit's scroll anchoring fails the check: the page keeps your place itself

- **Decision**: step 1's check failed. In the browser tests' WebKit, a 560 px block above the screen
  that grows to 700 px leaves the text read in place only on the first page a test file draws; on
  every later one, whose content replaced the earlier page's, the text moves by the full 140 px,
  even on a plain page with nothing but three elements. So the page keeps your place itself, as the
  spec allows: `keepPlace` in `packages/web/src/keepPlace.ts` reads a place before a change, and two
  frames after it, scrolls back by what it moved. Where a browser's own anchoring already kept it,
  nothing is left to move. The plain-page check is not kept as a test: it would test the browser,
  and it fails.
- **Rationale**: the app replaces a page's content at each change of page, so the browser's
  anchoring cannot be relied on in Safari.
- **Alternatives considered**: relying on anchoring, as the plan hoped: the frame and the comment
  tests fail with 140 px. Turning anchoring off with `overflow-anchor: none` and always scrolling:
  it would lose the browsers' anchoring everywhere else on the page.
- **If wrong**: a frame or a form that moves the page shows one frame at the wrong place before it
  is put back; removing `keepPlace` returns to the browser's behaviour.
- **Where**: task 4, `keepPlace.ts`, `useCommentDraft.ts`, `StoryFrames.tsx`

## R26: On the phone, a tapped block the sheet does not hide stays where it is

- **Decision**: `placeAboveSheet` scrolls the tapped block above the comment sheet only when the
  sheet or the top bar hides it; otherwise it stays where it was tapped. Before, it always moved the
  block's bottom to the sheet's top, which scrolled the page by about 140 px for a block near the
  top of the screen, and is what moved US2's heading in US7's first scenario. The breaks the tests
  name differ from the plan's, which assumed the browser's anchoring: the saving test catches the
  old placement, a desktop test catches the form moving down without its block kept, and the frame
  test catches a frame's growth not scrolled back.
- **Rationale**: the spec's scenario taps a block of US2 with its heading at the top; the block is
  then already in view above the sheet.
- **Alternatives considered**: keeping the move to the sheet's top and scrolling back once saved:
  the page would jump twice.
- **If wrong**: the existing tests of the sheet, a block scrolled to the screen's end and a block
  taller than the space, still bring it into view.
- **Where**: task 4, `useCommentDraft.ts`, `__browser__/reading-place.test.tsx`

## R28: The edit box hides the blank lines after the frontmatter too

- **Decision**: the box holds the text from the first line after the frontmatter's closing line and
  the blank lines after it, cut at the core's `document.frontmatterLines.end`. Those lines, kept
  byte for byte, are joined back before the box's text on each save.
- **Rationale**: the spec's scenario says the box "starts at its title"; the blank line after the
  frontmatter is part of what the controls own, and keeping it in the head keeps the saved file
  byte-identical when the text is unchanged.
- **Alternatives considered**: cutting exactly at the closing line: the box would start with an
  empty line.
- **If wrong**: change `cut` in `packages/web/src/pane/draftText.ts`.
- **Where**: task 5

## R29: A save joins the frontmatter last read or last written by the discovery control

- **Decision**: the frontmatter a save joins is kept in a ref, set from the draft each time the page
  draws it, and from the discovery control's result as soon as its write returns, through a new
  `written` callback of `useEditorActions`.
- **Rationale**: the save queue runs a save queued after the discovery write before React draws the
  write's result; joining the drawn draft's frontmatter would undo the control's change. The test
  "the discovery control sets the frontmatter" fails without it.
- **Alternatives considered**: reading the file again before each save: one more request per save.
- **If wrong**: only `useFrontmatter` in `pane/useDraftEditor.ts` and `setDiscovery` change.
- **Where**: task 5

## R30: An unsaved text from before is recognised by its own frontmatter

- **Decision**: when the editor opens a file that has a frontmatter, an unsaved entry whose text and
  base both open with `---` and hold a closing `---` line is rewritten in place, both cut after that
  closing line and the blank lines after it. The cut uses the stored text's own closing line, not
  the core's lines of the file.
- **Rationale**: the spec's edge case "A draft's unsaved text, kept from before this change". The
  file's frontmatter may have changed since the text was stored, so its line count may differ; an
  entry written after this change has a base without frontmatter, so it is never cut. The stored
  text is the browser's, not a workflow file the core reads, so the stack decision's "never parsing
  their markdown" is kept.
- **Alternatives considered**: cutting at the file's `frontmatterLines.end`: a frontmatter that
  gained a line since would leave a `---` in the box, and a save would write two frontmatters.
  Changing the store's key: the old entries would be lost.
- **If wrong**: drop `storedBody` and its use in `useFrontmatter` once no such entry is left (they
  are pruned after 30 days).
- **Where**: task 5, `pane/draftText.ts` and `pane/useDraftEditor.ts`

## R31: The image upload's text is the box's text too

- **Decision**: `attach/useEditorImages.ts`, outside the plan's files, changes: the unsaved text a
  draft moved into a folder brings has the box's text as its base, and an upload that ends after the
  page was left joins the moved file's frontmatter before its text. `asTyped` moves to
  `pane/draftText.ts`, which `useEditorImages` imports, so the two modules do not import each other.
- **Rationale**: both paths save or store the box's text; left as they were, a draft with a
  frontmatter that gets an image would lose it, or show "The file changed since".
- **Alternatives considered**: none that keeps the frontmatter.
- **If wrong**: nothing else depends on it.
- **Where**: task 5
