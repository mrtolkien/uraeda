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

## R32: Changes made while a place is kept join that place, and only that place

- **Decision**: `keepPlace` keeps each place on its own, by its reader. A change made before the
  place being kept is put back joins it when it keeps the same place, read with the same function:
  the first place read is put back once, two frames after the last change. `topOf` and `bottomOf`
  give the same reader for the same element. A place read with another reader is kept on its own,
  from where it is read then; each correction reads the page after the corrections run before it. A
  place that read NaN when kept is not joined: the new change keeps its own.
- **Rationale**: each call measured its place before its own change and put it back two frames
  later, so a second change drawn meanwhile was corrected twice: a story frame above the screen
  reporting 560, 700, then 720 px left the text 140 px off. The first fix joined any change to the
  place kept, whatever its place: a comment tap while a story frame's size was being kept put the
  frame's place back, not the tapped block's, which the review's fixes found.
- **Alternatives considered**: each call keeping its own place, its measure shifted by the
  corrections still pending: the pending changes' moves at another place are not known. A keep for
  another place replacing the pending one: the replaced place's own change would never be corrected.
- **If wrong**: `keepPlace` in `packages/web/src/keepPlace.ts`.
- **Where**: the review's fixes

## R40: `decision.order` warns on the first rule stronger than the rule before it

- **Decision**: `decision.order` is reported once per decision, on the first top-level rule of
  `## Rules` whose strength ranks above the last rule before it that has a keyword, naming both
  keywords: "a MUST NOT rule after a SHOULD NOT one: put the strongest first". A rule without an RFC
  2119 keyword is skipped. The plan's text said "the first rule weaker than the one before it": its
  own message and the data model's ("a rule weaker than the one after it", on the MUST's line) say
  the opposite, and the plan's task now says what was built.
- **Rationale**: the warning sits on the rule to move up, which is what the spec's message names.
  One warning per decision is enough to make the agent reorder the whole list.
- **Alternatives considered**: a warning on each rule out of order: one move often fixes several.
- **If wrong**: `check_decision` in `crates/core/src/check/decision.rs`.
- **Where**: task 6

## R41: What a spec's reviewed part counts

- **Decision**: `reviewed_words` counts the words of every heading, paragraph, list item, and table
  cell after the title, through `writing.rs`'s `measured_text`, so links' text and code spans count
  nothing, as in a round's sentences. It leaves out the block, code and HTML blocks, each story's
  "More scenarios" list (its "More scenarios:" paragraph stays), and `## History` with its heading.
  `spec.length` has no line: it is the whole file's. The example spec counts 1,028 words.
- **Rationale**: the plan names `measured_text`; the fold's label stays visible on the page, its
  list does not.
- **Alternatives considered**: counting link text: the plan shares the round's measure instead.
- **If wrong**: `reviewed_words` in `crates/core/src/check/spec.rs`.
- **Where**: task 6

## R42: SC-002 counts the 18 decisions the spec lists

- **Decision**: `every_decision_of_the_repository_holds_at_most_10_rules` reads the decisions from
  this feature's `spec.md` `## Decisions` items, 18 as the spec says, not the plan's 17, and counts
  their words after the frontmatter, split on white space: 9,324, under 9,400.
- **Rationale**: the spec's SC-002 names 18; reading the list keeps the test right if it changes.
- **Alternatives considered**: a fixed list of names in the test.
- **If wrong**: the test in `crates/core/tests/check.rs`.
- **Where**: task 6

## R45: An unlisted decision shows only when one of its parts changed

- **Decision**: `FileView.decision_changes` holds every listed decision found on either side, and
  every unlisted one that is new, removed, uncompared, or has a part that is not `kept`. A decision
  whose text differs only by a rewrap, its frontmatter, or its `# ` title shows only when listed. A
  listed decision found on neither side has no change: the page draws it from `SpecItems.decisions`.
- **Rationale**: the data model says "a rewrap is no change", and the approval step's edit of
  `status` and `approved-by` is no change either (review focus 1). An unlisted card with every part
  kept would say "Not listed in the spec" over nothing to read.
- **Alternatives considered**: keeping every decision whose text differs: rewraps and status edits
  would draw empty unlisted cards.
- **If wrong**: `differs` in `crates/core/src/decisions/branch.rs`.
- **Where**: task 7

## R46: A decision without its merge base's version is new, uncompared

- **Decision**: without a merge base, without a default branch, or when the merge base's file is not
  UTF-8 text or git fails to read it, the change has `compared: false`, every part of the branch's
  text `added`, and the kind `new`; `removed`, without parts, when the branch has no such file.
  Without a merge base, every decision of the branch shows, since none can be told unchanged. The
  branch's side is read as lossy UTF-8. A feature without a branch, merged, has no changes.
- **Rationale**: the plan asks for the branch's text as added parts; `compare` names such a change
  `new`, and the page says "Could not compare with the default branch" from `compared`, not from the
  kind.
- **Alternatives considered**: kind `changed` for an unreadable old version: it would claim a change
  the core could not see.
- **If wrong**: `BranchSides::change` in `crates/core/src/decisions/branch.rs`.
- **Where**: task 7

## R47: A branch's decision is the fate type `BranchDecision`, by `<folder>/<name>`

- **Decision**: the server's `branchDecisionDataView` (`fate/views.ts`, type `BranchDecision`, list
  `branchDecisions`) serves `binding.readDecision` by the id `<folder>/<name>`, split at the first
  `/`. A decision the branch does not have, or a name with `/`, `\`, `:`, or a leading `.`, is
  refused by the core as `<folder> has no decision <name>`, which the source answers as a record
  marked `missing`, as a missing file is. Its document's links resolve from `specs/decisions`. As
  `FileView`'s items, the changes' nested optional fields, `strength`, `before`, and `after`, are
  sent as the binding gives them, not as null: `decisionChanges` and `change` are selected whole and
  replaced whole. A test in `packages/server/src/__tests__/fate.test.ts`, outside the plan's list,
  checks the field and the source.
- **Rationale**: Task 13's decision page reads one decision by the link it was opened from, and
  waits for no answer that never comes.
- **Alternatives considered**: a file of its own: the plan names `views.ts`, which stays under 500
  lines.
- **If wrong**: `branchDecision` in `fate/sources.ts`, `sentBranchDecision` in `fate/views.ts`.
- **Where**: task 7

## R48: SC-003's benchmark times `readFile` alone, against a measured baseline

- **Decision**: `packages/server/src/__tests__/spec.bench.ts` opens the recurring tasks spec through
  `binding.readFile`, on a branch rewording a rule of each of the fixture's 5 decisions, and fails
  past the baseline measured before the change, 20.6 ms, plus 200 ms. It checks first that the 5
  changes are read. The baseline and the result were taken with
  `vp test bench --run packages/server/src/__tests__/spec.bench.ts`, twice each, keeping the lower
  mean; `vp run bench` runs it with the other benchmarks.
- **Rationale**: `vp run bench` also builds the UI and times the installed package, which says
  nothing of this change; the machine is shared, so the lower of two runs is the fairer mean.
- **Alternatives considered**: timing the fate endpoint: the server adds the same cost before and
  after.
- **If wrong**: `BASELINE_MS` in the benchmark.
- **Where**: task 7

## R50: A comment on a decision changed since the pending review is refused

- **Decision**: a pending review is kept for a decision comment by the spec's freshness rule, as the
  plan says, and the comment is refused when the decision's file differs between the review's
  `commit` and the branch's tip: "task-storage.md changed since the pending review's commit: start
  over to comment on it". A comment on a removed part is never refused this way: its lines are the
  merge base's.
- **Rationale**: the lines are read at the tip, and the data model says they are those of the
  decision at the review's `commit`. With the spec unchanged and the decision changed, keeping the
  review writes lines of another version; replacing it would drop the human's comments on the spec
  without the page saying so, since its stale banner follows the spec only.
- **Alternatives considered**: keeping the review, the quote showing what was meant; replacing it.
- **If wrong**: `decision::unchanged_since` in `crates/core/src/actions/review/decision.rs`.
- **Where**: task 8

## R51: A decision comment quotes its lines once, and names a decision of the branch

- **Decision**: the quote is the decision's lines under one `> `, as a spec line comment's is, not
  the data model example's `> > `, which quotes a rule that is a list item, not a quote. A removed
  part's lines are read at the merge base of the branch's tip and the default branch's, the version
  the comparison shows, which the data model calls "the default branch's lines". A decision comment
  is refused on a plan, without lines, past the decision's end, on a decision the branch (or the
  merge base, for a removed part) does not hold, and on a name with a space or a comma, which the
  heading could not hold. `ura review --comment` takes no decision.
- **Rationale**: the plan's **Produces**; the review file parses back what it writes.
- **Alternatives considered**: none.
- **If wrong**: `crates/core/src/actions/review/decision.rs`.
- **Where**: task 8

## R52: A comment on a decision is not placed on the spec's lines until task 13

- **Decision**: `CommentItem` gains `decision` (the decision's name) and `removed`. Its lines stay
  in `startLine` and `endLine`, `general` false. The web leaves it out of `usePlacedComments` and
  lists it in "Your review" as `C1 · decision git, lines 15–16`, with ` removed` after a removed
  part's lines, without Edit and Remove there; task 13 places it on its card. `ura lsp` sends it
  without lines in `uraeda/comments` and leaves it out of `uraeda/items`, so the Neovim plugin
  neither draws it nor jumps to it. `reviews.quote` applies to it. The existing calls of
  `review::comment` and `api::add_comment` in the tests take `None`, their new argument.
- **Rationale**: its lines are a decision's: placed by them, it would show under an unrelated block
  of the spec.
- **Alternatives considered**: sending it as a general comment from the core: its decision would be
  lost for task 13, and its label would say "general".
- **If wrong**: `usePlacedComments` and `where` in `packages/web/src/ReviewComments.tsx`,
  `on_the_file` in `crates/lsp/src/requests.rs`.
- **Where**: task 8

## R55: A spec approved before the branch has no approval commit on it

- **Decision**: `Git::approval_commit` returns `None` when the spec at the merge base reads
  `status: approved` already: the branch did not approve it, so `decision.unapproved` reports
  nothing for it.
- **Rationale**: the data model's approval commit is "the branch's commit whose spec first reads
  `status: approved`". Taking the first commit of the branch that touches an already approved spec,
  like the example's spec rewritten by task 2, would date an approval the branch never made, and
  warn on every later edit of the example's decisions.
- **Alternatives considered**: the merge base as the approval commit: every decision the branch
  changes would warn.
- **If wrong**: drop the first check of `approval_commit` in `crates/core/src/git/log.rs`.
- **Where**: task 9

## R56: A decision the branch had not touched at the approval, and reads as the default branch's, is not the branch's change

- **Decision**: `decision.unapproved` reports a decision whose checkout text differs from its text
  at the approval commit, beyond `status` and `approved-by`, except when the branch had not touched
  it at the approval (its text at the approval commit equals its text where the approval commit left
  the default branch) and the checkout's text equals the current merge base's.
- **Rationale**: merging the default branch after the approval brings its decisions in. On this
  branch, the merge of `main` brought `compatibility.md` and `diagrams.md` as they are on `main`:
  comparing with the approval commit alone warned on both, though the branch does not change them.
  `stack.md`, which the merge folded a rule into (R1), still warns, as the plan expects. The first
  version of this ruling skipped any decision the same as at the merge base: it missed a branch that
  changed a decision, had it approved, then put it back to the default branch's text, or deleted a
  decision it had added and had approved. The review's fixes replaced that reasoning.
- **Alternatives considered**: the approval commit alone, as the plan said: it warns on the default
  branch's own changes. A decision different from both the approval commit and the merge base: it
  misses a change back to the default branch's text.
- **If wrong**: `changed_decisions` in `check/unapproved.rs`.
- **Where**: task 9, the review's fixes

## R60: The page reads the branch's decision changes once the file view carries them

- **Decision**: `SpecPage` reads `decisionChanges` from the file when it has the field, and passes
  `[]` otherwise; "Contents" lists the listed decisions, then the changes not listed. Task 10's
  contents test lists the fixture's three listed decisions only. When task 7's `decisionChanges`
  joins the `FileView` selection, the test's expected list gains "Due dates" after "Task history",
  and `changesOf` in `spec/SpecPage.tsx` reads `file.decisionChanges` directly.
- **Rationale**: tasks 7 and 10 run in the same wave: the field does not exist on task 10's branch,
  and the test cannot expect an entry the server does not send yet.
- **Alternatives considered**: a test that skips the decisions' entries: it would not catch a
  decision missing from "Contents".
- **If wrong**: drop `changesOf`'s guard and add the entry to the test's list at the merge.
- **Where**: task 10, `spec/SpecPage.tsx`, `__tests__/spec-page.test.tsx`

## R61: The placeholders take the page's context, and the data part takes its tree

- **Decision**: every part takes `PartProps` from `spec/parts.ts`: the spec's `document`, the
  review's `selection` (none once the spec waits no more), `wide`, the `folder`, the pending
  `comments`, and the `folds` the review opens. `StoryCard` adds `story` and its `mockup` link,
  `BuiltParts` the spec's `items`, `DecisionCards` the listed `items`, the branch's `changes`, and
  the `## Decisions` `part`. `DataPart` takes `data-model.md`'s `document`, with `folder` and
  `wide`, not the folder alone: the page reads the data model to know whether "Contents" lists
  "Data", and draws no data part without it.
- **Rationale**: one place reads the data model, and the three tasks of the next wave rewrite their
  file without changing `SpecPage`.
- **Alternatives considered**: `DataPart({ folder })` reading the file itself: "Contents" would read
  it a second time to know whether the part exists.
- **If wrong**: `DataPart` reads the file, and `SpecPage` keeps its own read for "Contents".
- **Where**: task 10, `packages/web/src/spec/`

## R62: An answer is drawn whole beside its badge, and "Contents" is a list of links

- **Decision**: an answer of `## Your review` is drawn as its whole item, "**C2** (undo too short):
  done. The undo…", after a "done" or "declined" badge, and the comment it answers is named "C2 ·
  undo too short" from the core's `number` and `summary`. "Contents" is an Astryx `List` of link
  rows, each a tap jumping to its part as the round's index does, its pending comments a badge
  inside the link, read "2 comments". Astryx's `Outline` is not used.
- **Rationale**: the core sends the answer's number, summary, and verdict, not the answer's text
  apart: cutting the item's text in the web would parse markdown, which the stack decision forbids.
  `Outline` takes text labels only, so no count, and pushes a history entry that would drop the open
  folds kept in the current one.
- **Alternatives considered**: an `answer` field of `ReviewAnswer` in the core: a change to task 2's
  types, for a repetition of a few words.
- **If wrong**: add the field in `files/spec/parts.rs` and draw it in `spec/ReviewAnswers.tsx`.
- **Where**: task 10, `spec/ReviewAnswers.tsx`, `spec/SpecContents.tsx`

## R63: The spec page takes the review's machinery as one hook, and the page's inset as a variable

- **Decision**: `review/useReview.tsx` holds the hooks of step 1 together, with `ReviewHost`,
  `ReviewIntro`, and `ReviewEnd`, which the plan's review page and the spec page both draw.
  `YourReview` takes `hasVerdict`, and `YourVerdict` draws the verdict in "Contents". `Page` takes
  `isTight`, the phone's 12 px inset, and sets `--page-inset` and `--page-bleed`, which bands,
  sticky heads, and a story's embed on the phone read to reach the screen's edges, 16 px outside a
  page. The column's shown state is `useStoredShown(key)`, out of `SessionAside`'s own. "Contents"
  is 440 px wide at first, 420 px at least (`SideColumn`'s new `sizes`): the verdict's longest
  button, "Request changes and start the agent", shows uncut.
- **Rationale**: the plan asks for the comment machinery shared, not copied, and the bands written
  for a 16 px inset would overflow a 12 px one.
- **Alternatives considered**: the spec page calling the four hooks itself: a second copy of the
  review page's wiring.
- **If wrong**: the hooks stay apart in `review/`; only `ReviewPage` and `SpecPage` call them.
- **Where**: task 10, `packages/web/src/review/`, `layout/Page.tsx`, `layout/useStoredShown.ts`,
  `layout/SideColumn.tsx`, `StoryEmbed.tsx`

## R64: The tests of the mockup buttons go with them, and the embed tests scroll to the story

- **Decision**: the two review tests of the "Mockups" region and the four browser tests of the "Open
  the mockup" button are deleted, and the screenshot script no longer takes `spec-mockups`; its
  story locators read the cards' titles. The browser tests that open the test feature's spec and
  wait for its story's frames scroll the embed into view first (`showSpec` in
  `story-embed.test.tsx`, `readyEmbed` in `story-comments.test.tsx`, the layout test of a spec with
  a story, and `openThroughHost`), all but the test of an embed below the window.
- **Rationale**: the plan deletes `ReviewMockups.tsx`: each story embeds its mockup in its card,
  which task 11 tests. A frame loads once on screen, and the spec page now opens with what you
  approve and the decisions, which push US1's embed below a 900 px window.
- **Alternatives considered**: none: the behaviour is gone.
- **If wrong**: the tests are in git before task 10's commit.
- **Where**: task 10, `__tests__/review.test.tsx`, `__browser__/story-comments.test.tsx`,
  `__browser__/story-embed.test.tsx`, `__browser__/layout.test.tsx`, `vite.browser.config.ts`,
  `scripts/shots.ts`

## R65: The workspace reads skip the checks that walk the branch's history

- **Decision**: `check::check` runs every rule, `decision.unapproved` included, and `ura check`
  calls it. `check::check_files` runs the rules on the files alone; the API's `checked()`, run for
  every feature on every workspace or feature read, calls it.
- **Rationale**: `decision.unapproved` walks the branch's first-parent history and reads old
  decisions, on every read, for warnings `checked()` drops: it keeps errors only (R1).
- **Alternatives considered**: an option argument on `check`: every caller would pass it, and the
  existing tests call `check` as `ura check` does.
- **If wrong**: `check_with` in `crates/core/src/check/mod.rs`, and `checked` in
  `crates/core/src/api.rs`.
- **Where**: the review's fixes

## R66: The answers quote the review the revision answered, read from the history

- **Decision**: `FileView.answered`, for `spec.md` at revision 2 or later, is `spec-review.md` as it
  stood at the first commit, on the branch's first-parent history from its tip (the default branch's
  without a branch), whose spec reads the current revision, kept only when its verdict is
  `changes-requested`. "Your review, answered" takes its quotes and words from it, never from the
  review file as it is now. Review focus 9 changes: an approved revision quotes the review it
  answered. Task 10's test of focus 9 is renamed, and builds the approval as a commit after the
  revision; the test "an answer whose comment is gone" drops C2 in the commit that starts a revision
  3, since a C2 removed later from the file no longer matters.
- **Rationale**: once you comment on the revision, `spec-review.md` is a new pending review, and
  after approval it is the approval's: the answers lost their quotes while you still read them. The
  core reads the history, the web draws (the stack decision).
- **Alternatives considered**: the review file while its verdict is `changes-requested`, as before:
  the quotes vanish at the first comment on the revision.
- **If wrong**: `crates/core/src/api/answered.rs`, and `answeredComments` in
  `packages/web/src/spec/ReviewAnswers.tsx`.
- **Where**: the review's fixes

## R70: A story's more scenarios fold behind an Astryx disclosure, and the tests find it by story

- **Decision**: a story's more scenarios sit in an Astryx `Collapsible` whose trigger reads "N more
  scenarios" ("1 more scenario" for one) closed and "Fold the other scenarios" open. Its state is
  the spec's fold keyed by the story's id (`Folds`), so the history entry keeps it, and a pending
  comment, the selection, or a hash still open it. The existing tests that found the fold by the old
  label "More scenarios (n)" find it now in its story's card by the new labels:
  `__tests__/review.test.tsx`, `__tests__/document.test.tsx`, `__browser__/review.test.tsx`,
  `__browser__/attach.test.tsx`, `__browser__/layout.test.tsx`, and the screenshot scripts. Their
  assertions are unchanged.
- **Rationale**: the spec renames the button (US3 1, 2); with the open label shared by every open
  story, a test can only tell the folds apart by their card. A disclosure keeps the folded scenarios
  in the page, hidden, as the fold did, which the comment placement and the existing tests rely on;
  the UI components decision asks for Astryx's component over the mockup's button.
- **Alternatives considered**: the mockup's ghost `Button`, the scenarios drawn only when open: a
  hand-made disclosure, without `aria-expanded`, and a pending comment's field unmounted on fold.
- **If wrong**: `MoreScenarios` and `useMoreOpen` in `packages/web/src/spec/StoryCard.tsx`.
- **Where**: task 11

## R71: A scenario's rows come from its bold step words; the mockup draws through the story's blocks

- **Decision**: a scenario's Given, When, and Then rows are cut at its bold spans reading `Given`,
  `When`, or `Then`, from the core's tree, each row keeping its text as written, its trailing comma
  included; spans before the first step word make a row without a word. The story's other blocks
  (journey, mockup, "Why this priority") draw in the file's order through `Blocks`: a story link
  embeds its story live, an HTML mockup is its paragraph's link. `StoryCardProps.mockup` is left
  unused. The paragraphs "Key scenarios:" and "More scenarios:" are not drawn; what follows them in
  a review, like a pending comment, shows before their scenarios.
- **Rationale**: the stack decision: no parsing of markdown, only the tree's spans. Keeping the
  commas keeps each scenario's accessible name its sentence, which the review tests read. `Blocks`
  already embeds a story link with its comments, so the card needs no second path for it.
- **Alternatives considered**: the step words split by the core: a new item for drawing alone;
  drawing the mockup from `mockup`: a second copy of the story embed's wiring.
- **If wrong**: `stepsOf` and `StoryCard` in `packages/web/src/spec/StoryCard.tsx`; task 14 may drop
  `mockup` from the props in `SpecPage.tsx`.
- **Where**: task 11

## R75: A criterion's sentence is cut by the core, after its id and measure

- **Decision**: `Criterion` carries `sentence`, the item's spans after the bold id, and after the
  measure and the `):` ending it, or the `:` after an id without one, the blanks after them trimmed;
  `criteria()` in `crates/core/src/files/spec.rs` cuts it where it reads the measure. The page draws
  the id and measure as pills, then `criterion.sentence` with `Spans`, and cuts nothing. The cut
  keeps the spans' marks, so code and links in the sentence stay drawn. Edited in place by the
  review fixes: the page first cut the sentence itself, with a copy of the core's rule.
- **Rationale**: the plan asks for the measure as a pill, out of the sentence; the core reads the
  file's formats (the stack decision), and a second copy of its rule in the web would drift from it.
- **Alternatives considered**: the web cutting the plain text of the spans, as first built: two
  places to change for one format. Drawing the whole item after its pills, as the answers are: the
  id and measure would show twice, which the plan's test refuses.
- **If wrong**: `criteria` and `spans_after` in `crates/core/src/files/spec.rs`, and `Criterion` in
  `packages/web/src/spec/BuiltParts.tsx`.
- **Where**: task 12, then the review fixes, `crates/core/src/files/spec.rs`,
  `crates/core/src/files/items/spec.rs`, `packages/web/src/spec/BuiltParts.tsx`

## R76: How the parts after the stories draw what the plan leaves open

- **Decision**: the niche edge cases fold behind an Astryx `Collapsible`, "N niche cases" ("1 niche
  case"), open while a pending comment or the selection is on one of them, and closable then; its
  state is the component's, not the history entry's. An importance other than high, normal, or
  niche, which `ura check` refuses, shows its cell's text, between the normal and the niche ones.
  The edge cases' "What happens" is drawn as written, not capitalized as in the mockup: a cell
  starting with code would change its code. The units are a grid of `min(n, 3)` columns on a wide
  screen, one on the phone; the paragraph "Tradeoffs:" is not drawn, the "Cost" pills name them.
  Blocks of a part outside its items, like the architecture's diagram, draw in their order as the
  spec's blocks, each taking a comment. "Data" draws each level-2 section of `data-model.md` as a
  part named by its heading, id `data-<anchor>`, after the text before the first; a "Change" cell
  reading another text than New, Changed, or Removed is drawn as written. A data table's columns are
  equal, and scroll in their own region on the phone, as a document's tables do.
- **Rationale**: a comment on a folded row must show; the spec's folds (`useSpecFolds`) exist only
  for a spec whose stories have more scenarios. Astryx's narrowest columns at 402 px cut the
  meanings' words in the middle ("complete d").
- **Alternatives considered**: a niche fold in the history entry, as a story's: no folds list to
  hold it without the stories'. A phone layout of each field as a row of its own: a second drawing
  of the table, which the mockup did not ask for.
- **If wrong**: `EdgeList`, `Architecture` in `spec/BuiltParts.tsx`; `DataTable` in
  `spec/DataPart.tsx`.
- **Where**: task 12, `packages/web/src/spec/`

## R77: The data model's colours, and the parts' layout, are checked in WebKit

- **Decision**: `__browser__/spec-parts.test.tsx` checks at 1440 × 900 that the units are three
  cards side by side, and that "New", "Changed", and "Removed" have each their own background,
  green, yellow, and red, apart from the table's; at both sizes, the parts' text and boxes (the
  layout helpers on each part's region) and axe on the page. The unit test of the data model checks
  each cell's change, and the browser test its colour.
- **Rationale**: happy-dom draws no colour, and a pill and plain text read the same by role and
  text, so the plan's break, "the change cell drawn as plain text", is caught only where the colour
  is drawn. `checkControlHeights` reads the whole page, whose stories and history are other tasks'.
- **Alternatives considered**: an icon in each pill to tell it by its label: a second cue the mockup
  did not ask for, read twice by screen readers.
- **If wrong**: the colour test is the second of `__browser__/spec-parts.test.tsx`.
- **Where**: task 12, `packages/web/src/__browser__/spec-parts.test.tsx`

## R80: A rule's check is cut from its words in the web, at "Checked by"

- **Decision**: the card draws a rule's runs up to the first run holding the words "Checked by", cut
  inside that run if needed, then the rest on a muted line (`splitCheck` in `spec/RuleLine.tsx`).
  The core's runs stay one list per part.
- **Rationale**: the runs are plain text from the core (R20): cutting them at two fixed words reads
  no markdown, and decides nothing the core decides. Splitting the runs in the core would change
  every run of task 3's table of cases, which compare a rule and its check in one list.
- **Alternatives considered**: a `check` list of runs on `PartChange`: a change of task 3's type and
  its expected values, for a line of layout.
- **If wrong**: add the split to `part_change` in `crates/core/src/decisions/change.rs`, and draw
  its two lists.
- **Where**: task 13, `packages/web/src/spec/RuleLine.tsx`

## R81: A strength's icon and colour come from the core's name for it

- **Decision**: the five icons are registered in `theme/icons.ts` as `uraeda:strength-<name>`, by
  `Strength::as_str`'s names, and drawn only for a part whose `strength` the core gives: a rule
  without a keyword draws none, never a MAY dot. Colours (review comment C1): MUST
  `--color-icon-green`, MUST NOT `--color-icon-red`, MAY `--color-icon-secondary`; SHOULD and SHOULD
  NOT the hard colour at 75% over `--color-background-card`, a `color-mix` of tokens: softer in both
  themes. The colour adds to the chevrons' shape and the icon's name, which say the strength alone.
  The colours are tested in the browser, by each icon's accessible name and its computed colour,
  with the side bar and any strike: happy-dom computes no StyleX colour.
- **Rationale**: the plan's break, "a strength read again in the web"; the UI components decision's
  tokens.
- **Alternatives considered**: a lighter green token: none sits between `--color-icon-green` and the
  tints in both themes.
- **If wrong**: `colours` in `spec/RuleLine.tsx`.
- **Where**: task 13, `theme/icons.ts`, `spec/RuleLine.tsx`, `__browser__/spec.test.tsx`

## R82: A card's measure is 75ch of its reading text, as the round's

- **Decision**: a card's text sits at the reading size in a column of `--size-round-measure`, 75ch
  of that text's "0". The browser test checks each line of each part, the note and the intent
  included, against 75 widths of a rule's "0", with "Contents" hidden so the card is wide enough for
  the measure to bind, and fails with the page's 90ch.
- **Rationale**: the plan names the page's measure "the 90-character measure", 90ch, so a 75ch
  column is the spec's "75 characters". `checkMeasure` counts average characters, about 1.2 to a
  `ch`, so it could not tell 75ch from 90ch at the card's sizes.
- **Alternatives considered**: a new theme token for cards: a theme rebuild shared with the tasks of
  the same wave, for the round's value.
- **If wrong**: `measure` in `spec/DecisionCard.tsx`.
- **Where**: task 13, `spec/DecisionCard.tsx`, `__browser__/spec.test.tsx`

## R83: What a decision card shows, by its change

- **Decision**: a card holds its title, a link to the decision's page on the branch unless removed,
  a control's height under a touch pointer, its kind's pill, "Not listed in the spec" when unlisted,
  the spec item's sentence (its spans after the bold lead, a reading paragraph you comment on as the
  spec's line), then: for a decision new, removed, or not compared, its intent and its rules whole,
  a removed one's parts on a red tint, not folded, and "Could not compare with the default branch."
  first when not compared; for a changed one, its intent whole, then each section with a part not
  kept, a run of kept parts behind "N unchanged", added and changed parts each under a "New" or
  "Changed" pill, removed parts behind "N removed" at the section's end; for a changed one with
  every part kept, "No change against the default branch". A listed decision found on neither side
  shows its sentence alone. The branch's decision page shows every section, its kept parts unfolded.
  The intent is a lead at the spec opening's lead size, drawn as a block of text rather than a
  paragraph, which the layout check holds to the body size; the check under a rule is supporting
  text. Added and removed words are `insertion` and `deletion` roles on spans, never `del`.
- **Rationale**: the mockup the human reviewed, with review comment C1; a pill names a part's kind,
  so new and removed decisions take none per part.
- **Alternatives considered**: the item drawn whole: its bold lead repeats the title and the pill.
- **If wrong**: `shownSections` and `sectionRows` in `spec/DecisionCard.tsx`, `noteOf` in
  `spec/DecisionCards.tsx`.
- **Where**: task 13, `packages/web/src/spec/`

## R84: A comment on a decision's part goes through the review's own selection

- **Decision**: a selection's `Range` takes an optional `decision`, `{ name, removed }`, and the
  last tapped element is a block's id or a decision's part, by its decision and last line.
  `Selection.parts` gives the cards their taps, their selected state, and what follows a part: its
  pending comments, with Edit and Remove, the comment being added, and the form on wide screens. A
  tap on another file's lines starts a new selection. The form names the place as the review does,
  `Decision task-storage, lines 16–17 removed, under "Rules"`, without a quote or "Ask the agent",
  which read the spec's lines. `placeOf` names the decision, so an unsaved edit of a decision
  comment is never restored on a spec comment of the same lines. "Your review" still lists every
  comment on lines, those on decisions too, without Edit and Remove, as before. A fold holding a
  pending comment or the selection stays open.
- **Rationale**: one comment machinery for the spec's blocks and the decisions' parts (the plan's
  complexity tracking), and task 8's notes.
- **Alternatives considered**: a second comment form for decisions: two machineries to keep in step.
- **If wrong**: `partSelection` in `review/useReviewSelection.tsx`, `select` in
  `useCommentDraft.ts`.
- **Where**: task 13, `useCommentDraft.ts`, `Selection.tsx`, `review/`, `reviewField.ts`,
  `ReviewCommentForm.tsx`, `useReviewActions.ts`

## R85: "From an item's file" is a feature's page; without a branch decision, the decisions page

- **Decision**: a decision link opens `/f/<folder>/decisions/<name>` when drawn inside a feature's
  stories context, `StoryContext.folder`, which a feature's files and its session set, not a draft;
  elsewhere, the decisions page as before. A link to a feature's file keeps its anchor too, now that
  `SpanLink.anchor` carries it. The branch's decision page redirects to the decisions page when the
  core answers the decision missing: a feature without a branch, or a branch without the decision.
  The existing test "a spec's link to a decision opens it on the decisions page" waits for that
  redirect instead of reading the address at once.
- **Rationale**: the context already says which feature a document is drawn for; a proposal on the
  default branch has no branch to read the decision from.
- **Alternatives considered**: a context of its own set by each file page: a second provider at each
  place the stories' one is.
- **If wrong**: `from` in `Spans.tsx`, and the redirect in `decisions/BranchDecision.tsx`.
- **Where**: task 13, `Spans.tsx`, `links.tsx`, `routes.tsx`, `decisions/BranchDecision.tsx`,
  `__tests__/decisions.test.tsx`

## R86: A decision card's folds are kept in the history entry, beside the spec's

- **Decision**: each fold of a decision card, "N unchanged" or "N removed", keeps its open state in
  the history entry through `useOpenKeys`, keyed `decision:<name>:<section's heading>:<kind>`, the
  kind `removed` or `kept-<n>` for the n-th row of its section. It still opens while it holds a
  pending comment or the selection, without writing that to the entry. `useOpenKeys` now starts each
  change from the entry's keys, not from its own copy, so the folds of every card and the spec's own
  folds, each with a hook of its own, keep each other's keys.
- **Rationale**: the ui-behaviour decision says Back restores the items opened; the spec's other
  folds already did. A hook per fold needs no prop through the spec's parts down to the cards.
- **Alternatives considered**: passing the spec's `useSpecFolds` keys down to each card: a prop
  through `SpecPage`, `DecisionCards`, `DecisionCard`, and `Section`, and a second source on the
  branch decision's page.
- **If wrong**: `Fold` and `foldKeyOf` in `spec/DecisionCard.tsx`, `onOpenChange` in
  `useOpenKeys.ts`.
- **Where**: review fixes, `spec/DecisionCard.tsx`, `useOpenKeys.ts`,
  `__tests__/spec-decisions.test.tsx`

## R87: What the built parts do not classify is drawn in place, as the spec's blocks

- **Decision**: in the architecture's units list, an item without a bold name is drawn where it
  stands, as the spec's other items are, tappable, and the units around it form a row of cards each,
  so the file's order holds. In the criteria's list, an item without an `SC-` id is a row of its
  own, drawn the same way. A unit, a tradeoff, and a criterion draw their nested blocks under their
  text, as a story's scenario does. A unit's name is the run of bold spans it starts with, drawn
  with its marks, so `**The \`ura\` CLI**` reads whole.
- **Rationale**: the constitution's page shows what the file says; the core classifies items, it
  does not decide what the human reads.
- **Alternatives considered**: one row of every unit, then the other items after it: the page would
  reorder the file's items, and a comment's line would land away from its neighbours.
- **If wrong**: `runsOf`, `Leftover`, `Nested`, and `Unit` in
  `packages/web/src/spec/BuiltParts.tsx`.
- **Where**: review fixes, `spec/BuiltParts.tsx`, `__tests__/spec-parts.test.tsx`

## R88: A removed decision's sentence leaves out its file's name

- **Decision**: a removed item's file name, ``(`name.md`)`` after its bold lead, is part of the
  lead: its card's sentence starts at the reason, "Repeating tasks keep no history…", not at
  "(task-history.md).".
- **Rationale**: the screenshots of task 14: the card's sentence opened on a parenthesis and a file
  name the card's title already names as a decision.
- **Alternatives considered**: the file name kept: a sentence that starts mid-punctuation.
- **If wrong**: `noteOf` in `packages/web/src/spec/DecisionCards.tsx`.
- **Where**: task 14, `spec/DecisionCards.tsx`, `__tests__/spec-decisions.test.tsx`
