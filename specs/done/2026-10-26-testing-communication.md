---
kind: feature
finished: 2026-10-26
pull-request: https://github.com/mrtolkien/uraeda/pull/62
supersedes: [2026-10-12-ui-improvements, 2026-10-14-testing-review, 2026-10-19-fix-testing]
---

# Record: Testing strategy review

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-26, finished on
> 2026-10-26, in [its pull request](https://github.com/mrtolkien/uraeda/pull/62). Its full files are
> in git: `git log -- specs/2026-10-26-testing-communication/`.

## What and why

Agents bent code to keep old tests green, because nothing said what to do with a test whose
behaviour the approved spec replaced, and the suite grew heavy, above all in the web UI, with tests
pinning pixel sizes. The human asked for short, generic testing guidance that scales with the
project's stage, decisions that state intent rather than values, every existing test rewritten to
match in one pass, and records that are their pull request's text and point to the records that
replace them. The wording was to be tried on runs of Claude Code with Sonnet before it shipped.

## Behaviour

- **Tests give way to the approved spec, the decisions, and the human's requests.** A spec lists the
  behaviour it replaces, with the tests that guard it, in an optional `## Replaced behaviour`
  section between the stories and the architecture, and its approval covers removing them. A test
  the spec replaces but did not list goes with a one-line ruling; a failing test nothing replaces
  means the code is wrong; a test that breaks on a change keeping what callers observe goes with a
  ruling. Code never bends to keep a test.
- **Few tests, by the project's stage.** The Testing decision names the stage, `early` here: tests
  cover stored formats, git, security, contracts between the core, the CLI, the binding, and the
  server, pure logic with many cases, and each bug fixed. The spec's key scenarios and high edge
  cases set the ceiling, one test at most each; a rarer case joins one of those tests or has none,
  and the plan's test map says why. Existing tests come first: before each new test, the agent asks
  which existing, planned, or rewritten test would already fail, and adds nothing when one would.
  One test per rule, through the layer that runs all of it; a new test asserts only what the task
  adds, picked out of the results, and leaves an old result a scenario says still holds to the test
  that owns it; data an existing test moves out of a new rule's way stays off the rule's edge. A
  test asserts what a caller or a user observes, never how the code does it.
- **The web UI is checked by using it.** A web UI test stays only for behaviour that is costly to
  lose and that using the app would not show. Twelve files are kept: the composer's refused send,
  the editor's commit and conflict, the round's and the review's saves, leaving with unsaved text, a
  late start, a sign-out, a hostile diagram, a diagram that fails to draw, the notifier, the preview
  frames' sandbox, and the writes store's status after a failed write. The human reviews the rest in
  the sandbox, when they choose, with one screenshot of each new view in the pull request, never in
  the repository. There is no browser runner any more.
- **Decisions state intent.** UI layout, UI look, UI behaviour, UI checks, Problems, Settings, and
  Preview lost their pixel values and end "Checked by review", but WCAG contrast, a font file of the
  built app, and contracts, which keep their tests.
- **A pull request is its record.** Its body is an opening block, "Pull request to review, about N
  minutes", with the points needing attention, then the record's text with its links absolute at the
  finishing commit, and a screenshot of each new view, attached with `gh pr edit --attach` and never
  committed. A record may hold **Replaced behaviour** and **Gotchas**, and names the records it
  supersedes; each older record gains `superseded-by` and a line in its opening note, the only edit
  a merged record takes besides fixing a link. `ura check` warns about a supersession without its
  pair, or naming no record.
- **Rulings are cheaper.** A ruling needs a decision, a rationale, and where; its alternatives and
  what it costs if wrong are optional.

## Design

The skill keeps one home for testing, the
[testing section](/skills/uraeda/references/code-quality.md#testing) of `code-quality.md`, which
names no language, runner, or library; the plan, implementation, spec, change, and discovery steps
link to it. Discovery asks once for a testing decision, from
[its template](/skills/uraeda/assets/templates/specs/decisions/testing.md). The
[finish step](/skills/uraeda/references/finish.md) writes the record, then the pull request's body
from it, and the supersession on both sides.

- The record's `supersedes` and `superseded-by`, a YAML list read by
  [`frontmatter.rs`](/crates/core/src/files/frontmatter.rs), and their pairing in
  `check_supersession` of [`values.rs`](/crates/core/src/check/values.rs): each record reports only
  its own unmatched field, so a check of one file keeps it.
- The spec and record templates' new sections, which the core embeds as the sections `ura check`
  allows; the spec page draws the replaced behaviour as its own group, in
  [`SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx).
- The logic only UI tests guarded, extracted into pure functions with unit tests before those tests
  went, among them `stepPage` in [`tail.tsx`](/packages/web/src/tail.tsx), `cutsOff` in
  [`settings/hosts.ts`](/packages/web/src/settings/hosts.ts),
  [`lists/destination.ts`](/packages/web/src/lists/destination.ts), and
  [`frameMessages.ts`](/packages/web/src/frameMessages.ts).
- `ready` and CI without browser groups, in [`vite.tasks.ts`](/vite.tasks.ts) and
  [`ci.yml`](/.github/workflows/ci.yml); the theme's contrast helpers in
  [`theme/contrast.ts`](/packages/web/src/theme/contrast.ts); Playwright stays for the screenshot
  scripts.
- The evaluation: twelve runs of Claude Code with Sonnet in throwaway clones at the branch's start,
  two with the old wording and ten with the new, building a small spec of the core that adds a
  warning and replaces a behaviour an existing test pinned. Added tests are counted as the test
  runner counts them; a run fails SC-003 when either of two fresh reviewers, or the OpenCode
  reviewer, finds two tests repeating each other's coverage, in either direction, a new test that
  makes an existing one redundant included. The ceiling of SC-003 is 5.

  | Run   | Wording    | Tests added             | Repeats found                                            | SC-002 | SC-003 | SC-004 |
  | ----- | ---------- | ----------------------- | -------------------------------------------------------- | ------ | ------ | ------ |
  | old 1 | start      | 7                       | a row of an existing test                                | ✅     | ❌     | ✅     |
  | old 2 | start      | 10                      | rows of existing tests                                   | ✅     | ❌     | ✅     |
  | 1     | revision 0 | 6                       | a rarer scenario and a review-focus item tested apart    | ✅     | ❌     | ✅     |
  | 2     | revision 1 | 2                       | three rows repeating existing ones                       | ✅     | ❌     | ✅     |
  | 3     | revision 2 | 3                       | the kind tested in the check and in the view built on it | ✅     | ❌     | ✅     |
  | 4     | revision 2 | 3                       | the same                                                 | ✅     | ❌     | ✅     |
  | 5     | revision 3 | 2                       | two existing rows made redundant, by one reviewer        | ✅     | ❌     | ✅     |
  | 6     | revision 3 | 2                       | two existing rows made redundant                         | ✅     | ❌     | ✅     |
  | 7     | revision 3 | 3                       | the same                                                 | ✅     | ❌     | ✅     |
  | 8     | revision 4 | 3                       | the same                                                 | ✅     | ❌     | ✅     |
  | 9     | revision 4 | 5, 2 a split of a table | none                                                     | ✅     | ✅     | ✅     |
  | 10    | revision 4 | 2                       | two existing rows made redundant                         | ✅     | ❌     | ✅     |

  Every run rewrote the replaced test rather than bend the code (SC-002), and the added tests took
  0.1 to 0.3 seconds (SC-004). After the first revision, the new wording cut the tests added from 7
  and 10 to 2 or 3, but for run 9's 5, 2 of them from splitting an existing table, and none asserted
  how the code works. Only run 9 passed SC-003. Each revision answered the last runs' failure: 1,
  the key scenarios and high edge cases set the ceiling; 2, the existing tests first, a row per case
  and not per value; 3, one test per rule, through the layer that runs all of it; 4, a new test that
  proves all an old one proves replaces it. The failure left is the fourth: a stricter new row kept
  beside an existing row that only checks a message is present. The runs stopped at the 12 the spec
  approved, after four revisions, before three passing runs in a row (SC-008).

  At the human's request, the evaluation went on past those caps with Claude Code and Haiku, a
  weaker model, to force clearer wording, until three runs in a row passed or the gain stopped. A
  pair of tests that each own a different key scenario of the spec no longer counted as a repeat, at
  the human's choice, and runs that kept the same trap already flagged were scored without the
  reviewers. On the old wording, Haiku added 10 tests. On the new, by revision:

  | Wording     | Runs | Tests added | Passing SC-003    | The failures                                                               |
  | ----------- | ---- | ----------- | ----------------- | -------------------------------------------------------------------------- |
  | revision 4  | 3    | 2 to 8      | 1                 | a test per row of the test map; old errors asserted again                  |
  | revision 5  | 3    | 3 to 4      | 0                 | whole lists compared; a fixture moved onto the rule's edge                 |
  | revision 6  | 3    | 2 to 5      | 1                 | the same, and a check and its view tested apart                            |
  | revision 7  | 6    | 2 to 5      | 2, 1 not reviewed | the same, and fixtures on the edge                                         |
  | revision 8  | 3    | 2 to 5      | 0                 | old errors asserted again; the valid path tested again                     |
  | revision 9  | 3    | 3 to 4      | 2                 | the valid path tested again                                                |
  | revision 10 | 3    | 4           | 0                 | old errors asserted again; fixtures on the edge                            |
  | revision 11 | 3    | 3 to 5      | 1                 | old errors asserted again                                                  |
  | revision 12 | 3    | 3 to 4      | 1                 | old errors asserted again                                                  |
  | revision 13 | 3    | 3           | 1                 | old errors asserted again; one OpenCode pair overruled, as different facts |
  | revision 14 | 3    | 1 to 5      | 1                 | old errors asserted again; fixtures on the edge                            |

  Every Haiku run rewrote the replaced test (SC-002), and the added tests took under 0.5 seconds
  (SC-004). Revisions 5 to 14 counted the tests at the ceiling, asserted only what a task adds,
  moved existing data clear of a new rule, counted rewritten tests as owners, and put each rule
  where Haiku plans and writes tests, in the plan's test map, test step, and template. Three
  examples that echoed the evaluation's own spec were replaced by neutral ones in revision 10. The
  pass rate held at about one run in three over the last six revisions, so the human shipped
  revision 14. The 36 Haiku runs used about 63 US dollars at API prices, and the Sonnet runs
  about 37.

## Replaced behaviour

- **Most automated tests of the web UI**, with the browser runner, axe, the `ready` browser groups,
  and their two CI jobs. Deleted whole, in `packages/web/src/__browser__/` (64 files):
  `attach.test.tsx`, `blocks.test.tsx`, `card-drag.test.tsx`, `card-menu.test.tsx`,
  `change.test.tsx`, `column-session.test.tsx`, `decisions.test.tsx`, `detail-overlay.test.tsx`,
  `diagram.test.tsx`, `document-column.test.tsx`, `document-lists.test.tsx`, `feature.test.tsx`,
  `fields.test.tsx`, `home.test.tsx`, `inbox-panes.test.tsx`, `inbox.test.tsx`, `layout.test.tsx`,
  `leave.test.tsx`, `ledger.test.tsx`, `list-keys.test.tsx`, `lists.test.tsx`,
  `live-window.test.tsx`, `new-cards.test.tsx`, `new-change.test.tsx`, `offer-card.test.tsx`,
  `offline.test.tsx`, `overlay.test.tsx`, `palette-check.test.tsx`, `plan.test.tsx`,
  `priorities-columns.test.tsx`, `priorities.test.tsx`, `prose-font.test.tsx`,
  `reading-place.test.tsx`, `repositories.test.tsx`, `review.test.tsx`, `round-cards.test.tsx`,
  `round-column.test.tsx`, `round-parts.test.tsx`, `round.test.tsx`, `sandbox-pick.test.tsx`,
  `scroll-target.test.tsx`, `scroll.test.tsx`, `session-column.test.tsx`, `session-look.test.tsx`,
  `session-tail.test.tsx`, `session.test.tsx`, `shell-checks.test.tsx`, `shell.test.tsx`,
  `sidebar.test.tsx`, `sign-in.test.tsx`, `sizes-helper.test.tsx`, `sizes.test.tsx`,
  `spec-column.test.tsx`, `spec-parts.test.tsx`, `spec.test.tsx`, `status-line-room.test.tsx`,
  `status-line.test.tsx`, `story-chat.test.tsx`, `story-comments.test.tsx`, `story-embed.test.tsx`,
  `story-variants.test.tsx`, `task.test.tsx`, `titled-pane.test.tsx`, `usage.test.tsx`. In
  `packages/web/src/__tests__/` (80 files): `add-repository.test.tsx`, `change.test.tsx`,
  `comment-draft-place.test.tsx`, `commit-actions.test.tsx`, `compiler.test.tsx`,
  `composer-images.test.tsx`, `confirm.test.tsx`, `decision-rules.test.tsx`,
  `decisions-check.test.tsx`, `decisions.test.tsx`, `diagram-links.test.tsx`,
  `document-ask.test.tsx`, `document.test.tsx`, `feature-done.test.tsx`, `feature-menu.test.tsx`,
  `feature-next.test.tsx`, `feature-page.test.tsx`, `feature-sessions.test.tsx`,
  `feature-settings.test.tsx`, `fresh-default.test.tsx`, `harness-mark.test.tsx`, `home.test.tsx`,
  `inbox.test.tsx`, `ledger.test.tsx`, `missing.test.tsx`, `mockup.test.tsx`, `notes.test.tsx`,
  `offer.test.tsx`, `overlay.test.tsx`, `palette.test.tsx`, `pane.test.tsx`, `plan-page.test.tsx`,
  `priorities.test.tsx`, `question-card.test.tsx`, `quick-add.test.tsx`, `rail.test.tsx`,
  `recap-join.test.tsx`, `recommended.test.tsx`, `repositories.test.tsx`,
  `repository-menu.test.tsx`, `round-column.test.tsx`, `round-outline.test.tsx`,
  `round-parts.test.tsx`, `selectAfterDraw.test.tsx`, `session-actions.test.tsx`,
  `session-activity.test.tsx`, `session-column.test.tsx`, `session-cost.test.tsx`,
  `session-recap.test.tsx`, `session-stretch-address.test.tsx`, `session-subagents.test.tsx`,
  `session-tail.test.tsx`, `session-turns.test.tsx`, `session.test.tsx`, `settings.test.tsx`,
  `settled.test.tsx`, `shell.test.tsx`, `sidebar.test.tsx`, `since-marks.test.tsx`,
  `since-review.test.tsx`, `spec-asking.test.tsx`, `spec-column-phone.test.tsx`,
  `spec-column.test.tsx`, `spec-decisions.test.tsx`, `spec-page.test.tsx`, `spec-panes.test.tsx`,
  `spec-parts.test.tsx`, `spec-review-tab.test.tsx`, `spec-stories.test.tsx`,
  `status-hints.test.tsx`, `status-line.test.tsx`, `stories.test.tsx`, `story-page.test.tsx`,
  `storybook-mode.test.tsx`, `theme.test.tsx`, `titled-pane.test.tsx`, `triage.test.tsx`,
  `usage.test.tsx`, `width-class.test.tsx`, `writes.test.tsx`.
- **Tests cut from the web UI's kept files, its helpers, and its logic tests judged one by one**:
  - `packages/web/samples/__tests__/projects.test.ts`: empty is a project just set up.
  - `packages/web/samples/__tests__/storybook-states.test.ts`: Storybook's fixture holds the same
    features at the same steps.
  - `packages/web/src/__browser__/helpers.tsx`, `setup.ts`, `forwarding-proxy.ts`, `colours.ts`: the
    browser tests' helpers (`contrast` and `luminance` moved to
    `packages/web/src/theme/contrast.ts`).
  - `packages/web/src/__focused__/composer.test.tsx`: a custom send stays pending once, keeps a
    refused draft, and clears only images on success; an upload in progress blocks Send and
    Ctrl+Enter until it is saved; a workflow's message is sent without the draft's images, which
    stay for the next one; a thumbnail removed while saved stays removed, and its saved file is
    deleted.
  - `packages/web/src/__focused__/helpers.tsx`: the export of `agentRecord`.
  - `packages/web/src/__tests__/build.test.ts`: the main bundle holds no pele, which chunks of their
    own hold.
  - `packages/web/src/__tests__/columnWidth.test.ts`: the four clamping rows, old and new key.
  - `packages/web/src/__tests__/decision-icons.test.ts`: a decision's icon is its own when
    registered, else the default one.
  - `packages/web/src/__tests__/document-column.test.ts`: the width before a drag is a third of the
    window, between 400 and 600 px; the session column is narrower than the documents' at semi-wide
    (C2); a session's dragged width reads as itself in Session, and as 400 px in the documents'; a
    stored width is clamped.
  - `packages/web/src/__tests__/editor.test.tsx`: Draft turns a line into a draft, linked, and opens
    its editor; Draft is refused once the priorities changed elsewhere; a new draft shows its hints,
    which are not in the file (US5 3); a written proposal opens drawn, with Edit (US5 5); a draft is
    saved as typed, byte for byte; the discovery effort is set in the proposal's frontmatter; quick
    discovery changes and Commit all land, in order; the text box starts at the proposal's title,
    and saving keeps its frontmatter; an unsaved text kept with its frontmatter shows without it,
    and saves once; the discovery control sets the frontmatter, and the text box keeps its text; a
    save over a change made elsewhere is refused, its frontmatter joined back; a draft is committed
    with the priorities it changed; a draft changed elsewhere shows when the page reads again; the
    text changed is not saved as time passes, and says so (US2 3); Save and Ctrl+Enter save the
    text, and Save waits for a change; the editor's unsaved text is restored after a reload, with
    the notice; the slug typed is restored after a reload, and on the line's page; Start turns a
    draft into a feature in its own worktree; a draft with the template's placeholders starts; Load
    the new version loads it; a draft that gets an image opens at its folder's proposal; a file over
    20 MB is refused before it is uploaded; a file changed elsewhere during an upload is a conflict,
    not overwritten; images added during an upload to a single-file draft all go to its new folder;
    the editor keeps its draft while the images upload, though it moved; an upload that ends after
    the page was left saves its link, where it moved; a draft with a frontmatter that gets an image
    keeps it, and its box starts at the title; an upload ending after the page was left keeps the
    moved draft's frontmatter; typing during an upload shows saving, and leaving the page asks; an
    image saves the text typed with it, and leaves nothing unsaved; an image is refused while the
    text is not saved, and added once reloaded; an upload that gets %s says so under the field; an
    upload the server does not answer in time says so under the field; an image added while the
    feature's agent works is refused under the field; a feature's committed proposal is edited and
    committed in its worktree; the draft's text typed in the pane opens on the editor page.
  - `packages/web/src/__tests__/helpers.tsx`: `addRun`, `holding`, `listOf`, `temporaryHome`,
    `repoAt`, `record`, `homeHidden`, `read`, `addMockup`, `sent`, and the exports `Binding`,
    `Fake`, `atWidth`.
  - `packages/web/src/__tests__/leave.test.tsx`: a page opened by navigate asks the same; with
    nothing unsaved, a link, Back, and a reload do not ask; a reload with unsaved text gets the
    browser's prompt, until it is saved; Back closing a sheet with an unsaved comment does not ask,
    nor does the page after; the editor's redirect after a move does not ask.
  - `packages/web/src/__tests__/links.test.ts`: a change's round links its decision with the change
    marked; every link of %s starts with its repository's prefix.
  - `packages/web/src/__tests__/new-page.test.tsx`: US5.1: New without a kind picks Session, its
    composer under the cards; US5.2: picking Feature marks it, puts it in the address, and shows its
    form; US5.3: each card says what it ends with and what waits on you; each card's sentence and
    facts are its radio's description; each card has its sentence and its example; US5 more 2: the
    arrow keys move the pick, and Space picks, as in a group of radio buttons; an arrow with a
    modifier is the browser's, as Alt+Right is Forward: the pick stays; SC-005: a reload keeps the
    picked kind; the kind picked is in the address; a change from an inbox note; a change from a
    note that cannot start keeps the note; a change from a priority line; a feature from a title; a
    feature from a title whose draft cannot be written leaves Now as it was; a start whose read
    fails shows why; a feature from a priority line; without the agent, the change's page opens with
    its message unsent; with the agent, the change's session opens, where its agent works; a start
    that answers after the human left opens nothing, and shows progress until then.
  - `packages/web/src/__tests__/review.test.tsx`: a spec under review shows each story's more
    scenarios folded; opening a story's scenarios lets the human comment on one; a pending comment
    opens its fold; closing a fold keeps the draft; a fold's trigger opens it and selects no block;
    a tapped block takes a comment on its lines; a second tap extends the selection; a pending
    comment is edited, then removed with its review file; approving with a higher tier leaves the
    plan's review off; Request changes waits for a comment; a new version under pending comments is
    said; a comment on a decision is listed in your review, not under the spec's lines; a spec
    without stories still takes comments; the verdict waits while the spec has changes not
    committed; a general comment is edited, then removed; a table row takes a comment on its line;
    on a wide screen, the comment field opens under the block (US2 3, 4); on a wide screen, the text
    typed follows the field to the next block (US2 2, 3); a general comment being typed is kept when
    a block is tapped; a nested item's comment field takes taps without selecting its parent; US6.1:
    Ask the agent opens the session with the selected lines quoted; Ask the agent on one line names
    that line; without the agent, a selection offers no Ask the agent; taps in a block's image,
    opened full screen, do not select the block; a verdict with an open comment of no text goes
    through; a verdict after a comment with an image was cancelled deletes the image; after a
    comment with an image is added, a verdict with the next one empty goes through; after a comment
    with an image is added, an image on the next one adds its link alone; at %i px, the verdict's
    refusal is in the comment form: %s; on the phone, a new comment left in its closed sheet does
    not make leaving ask; on the phone, a verdict during the upload of a cancelled comment is
    refused on the page; the verdict's refusal goes once the comment is cancelled; an image picked
    for a comment does not go into a comment edited during its upload; typing a comment renders none
    of the document's blocks (US3 1, SC-002); the comment typed on line 40 follows the field to line
    52 (US3 2); a comment added shows under its block at once, saving… until written (US3 3); a
    comment refused as it is added comes back in its form, with the error; Ctrl+Enter in a review
    comment adds it, and does nothing while it is empty; Cancel on a review comment typed asks first
    (US5 7); Cancel on an empty review comment closes it without asking (US5 8); a review comment
    typed is restored after a reload, with its lines; an edit of a review comment removed elsewhere
    is not restored onto the next one; the summary typed while Approve is sent is kept; the summary
    typed is restored after a reload.
  - `packages/web/src/__tests__/round.test.tsx`: a tapped option is saved as the answer; several
    options are written B and C, then A, B and C; a comment follows the letters; a comment alone is
    the answer; an answer read back selects its letters and fills its comment; a follow-up shows as
    a card of its own after its parent's once it applies; tapping B again removes the follow-up's
    card, and the outline lists Q1 alone; a parent answered A and B shows both follow-ups after it,
    in letter order; B changed to C removes the follow-up's card, and keeps its answer on disk; an
    answered round's options cannot be tapped; the comment field says a comment alone answers; a
    comment alone closes its follow-ups; the end of the page lists the questions left, and Submit
    waits for them; a question left blank on disk with its comment typed is not left, and Submit
    saves it; submitting commits the round and shows its record; the notes are saved as the last
    line; every question and option shows in full; an option's checkbox is named by its letter and
    its sentence; quick saves of one answer follow each other; a refused answer keeps its text, and
    says why; a hook's refusal keeps the answers, and Try again commits them; an answer changed
    elsewhere shows when the page reads again; Submit waits for the notes being typed; notes changed
    elsewhere show when the page reads again; Submit saves a comment whose save was refused, once
    the page read the file again; the bar counts and offers Next, with no ＋ in the bar (US1 1);
    Next goes to the first blank question after the one at the top, and focuses it (US1 2, 3); with
    nothing blank, Next becomes Submit (US1 4); the outline's sheet lists the questions with their
    state, and jumps (US1 5); on the phone, the round starts with its questions, before its context,
    and jumps; on wide screens, the round has one index, its column's outline; the round reopens
    where it was left (US1 9); a new browser opens at the first blank question (US1 10); a position
    saved in another repository does not apply; a new browser opens a round not started at its top,
    on its intro; a saved position on a question that no longer applies falls back; without storage,
    the round opens at the first blank question; US6.2: a question's Ask the agent quotes its title;
    without the agent, a question offers no Ask the agent; an option's image is part of the option's
    toggle; each Add image names its field, and shows Add image; Add image on an answer links the
    image in its comment, saved at once; Add image on the notes links the image at their end, saved;
    Submit during an answer's upload commits the round with the image; Submit waits for the image of
    a follow-up that stopped applying during its upload; Submit does not save again an answer saved
    for its image; the bar's Submit focuses Submit answers; a tap saves the letters with the comment
    as saved, and Save comment the comment typed; Submit saves a comment, the notes, and a settled
    point's comment typed, then submits; Submit adds no comment for a settled point's form left
    blank; Submit during a settled point's Add comment adds the comment once; Submit keeps a settled
    point's comment typed while it was saving it; Submit does not write the edit of a comment
    removed into the next one; Submit does not write an edit into another comment after a removal
    made elsewhere; Submit stops at the edit of a comment changed elsewhere since it began; a
    question's comment typed is restored after a reload; an unsaved comment of a round answered
    elsewhere stays, with the notice; the round opens with its block, then the Context's parts in
    their panes; a later round shows Since the last round above Goal; Why it matters shows in a pane
    after the context, not within it; a table and a quote in a question's context show in its card;
    on the phone, the in-page index sits after the block, before the context; on the phone, the
    in-page index is announced as Questions once; on the phone, an answered round has no in-page
    index; a comment starting with a letter warns when no letter is picked.
  - `packages/web/src/__tests__/routes.test.ts`: old addresses redirect: %s lands on %s%s%s; a new
    session's first message opens /sessions/<id>; Back before the next page draws returns the page
    left to its position.
  - `packages/web/src/__tests__/sign-in.test.tsx`: a browser without a session sees the sign-in
    screen; the key signs in, and the page shows; a wrong key says so, and keeps the text; an
    unreachable server says so; a sign-in answered %i says the server failed; the repository menu
    holds no sign-out item; Sign out ends this session; Sign out everywhere asks first; %s with the
    server stopped says so in Sign-in, and the page stays; a live stream that closes on a sign-out
    elsewhere shows the sign-in screen; an upload without a session shows the sign-in screen.
  - `packages/web/src/__tests__/stretches.test.ts`: the stretch's address.
  - `packages/web/src/__tests__/theme-tokens.test.ts`: at $width px with a $pointer pointer, text is
    120% and corners square; the fonts are JetBrains Mono, and Inter for reading; the breakpoints
    are named at 768 and 1280 px.
  - `packages/web/vite.browser.config.ts`, `vite.browser.color-scheme.ts`: the browser project
    (`phone` and `desktop`) and its colour-scheme plugin.
- **Tests judged one by one** in `crates/`, `packages/server`, and `scripts/`:
  - `crates/cli/src/install.rs`: `answer_lines`.
  - `crates/cli/src/picker.rs`: `nothing_checked_warns_until_space`; `draws_the_scope_picker`;
    `draws_the_folder_picker`; `draws_nothing_checked`; `draws_the_init_question`;
    `the_cursor_reads_without_colour`.
  - `crates/cli/src/upgrade.rs`: `the_latest_release_installs_nothing`.
  - `crates/cli/tests/review.rs`: `comments_add_up`.
  - `crates/cli/tests/status.rs`: `a_finished_branch_waits_for_its_pull_request`.
  - `crates/core/tests/check.rs`: `the_rounds_template_has_no_problems`;
    `an_awaiting_triage_has_no_problems`; `each_rule` row "edge case importance"; `each_rule` row
    "spec length"; `each_rule` row "spec block items"; `each_rule` row "decision rules"; `each_rule`
    row "decision order".
  - `crates/core/tests/decision_change.rs`: `a_renamed_decision_is_one_removed_and_one_new`.
  - `crates/core/tests/settings.rs`: `removes_the_first_of_two_names`.
  - `crates/core/tests/steps.rs`: `implementation_names_the_first_unchecked_task`.
  - `crates/core/tests/watch.rs`: `a_burst_of_writes_is_reported_together`.
  - `crates/lsp/tests/diagnostics.rs`: `a_changed_risk_tier_gives_one_diagnostic`.
  - `packages/server/src/__tests__/attach.test.ts`: refuses an upload while the feature's agent
    works.
  - `packages/server/src/__tests__/decisions-check.test.ts`: both messages name the reference and a
    waiting stop.
  - `packages/server/src/__tests__/env.test.ts`: --no-open, --new-key, --help, and --version.
  - `packages/server/src/__tests__/guard.test.ts`: a host name added or removed applies to the next
    check.
  - `packages/server/src/__tests__/inbox.test.ts`: a delete's removed text is the file as it was.
  - `packages/server/src/__tests__/live.test.ts`: a repository is watched once, until it leaves the
    list; review focus 10: a cleanup that fails is logged, and the server starts all the same.
  - `packages/server/src/__tests__/main.test.ts`: a second start hands its repository to the running
    server and exits 0; the help names --new-key.
  - `packages/server/src/__tests__/preview.test.ts`: a view gives the runner the commit with the
    stamp taken before it was read.
  - `packages/server/src/__tests__/repositories.test.ts`: a missing repository's host starts without
    a watch; an invalid list keeps the hosts, with its problem.
  - `packages/server/src/__tests__/server.test.ts`: stopping closes the hosts and the session
    manager; the server sweeps its Storybooks every minute; the server ends unused sessions every
    minute.
  - `packages/server/src/__tests__/settings-fate.test.ts`: a change sends one update on the global
    bus and the repository's.
  - `packages/server/src/__tests__/settings-watch.test.ts`: a burst of writes is read once.
  - `packages/server/src/__tests__/settings.test.ts`: the host names keep their array while a read
    changes nothing.
  - `packages/server/src/__tests__/stack.test.ts`: under a coarse pointer, Astryx's elements are 44
    px tall.
  - `packages/server/src/__tests__/toolchain.test.ts`: the browser projects are the browser config's
    instances; the rows "a browser task without the lock" and "a browser config on Vitest's port",
    with `unlockedBrowsers`, `defaultBrowserPort`, `browserProjects`; the `browser:phone` and
    `browser:desktop` rows of "%s invalidates on native binding changes"; a project added to
    test.projects is run by a task selecting the others by exclusion.
  - `packages/server/src/preview/__tests__/runner.test.ts`: a state change is told.
  - `packages/server/src/runner/__tests__/cache.test.ts`: a chat has no folder, and many are
    allowed.
  - `packages/server/src/runner/__tests__/claude.test.ts`: Claude Code declares what it can do; a
    result line's cost and models reach the result event; a result with no cost or models keeps both
    fields absent.
  - `packages/server/src/runner/__tests__/fake.test.ts`: capabilities, availability, and the allow
    rule; a message sent after the exit plays no fallback; awaited steps leave no listener on the
    signal they were given.
  - `packages/server/src/runner/__tests__/message.test.ts`: the message does not say what the human
    did.
  - `packages/server/src/runner/__tests__/moves.test.ts`: the opening tells to merge by hand.
  - `packages/server/src/runner/__tests__/sessions.test.ts`: a turn's messages are forgotten once it
    ended and none waits to be read; US1.6: a feature's writes are refused while its turn runs; a
    session is forgotten once its process exited with nothing left to run; US3 more 3: the rules end
    with their process.
  - `scripts/__tests__/fast-check.test.ts`: fast's own checks wait for a heavy slot.
  - `scripts/__tests__/fast-selection.test.ts`: "browser phone/desktop" in the deferred checks'
    assertion.

## Gotchas

- **Vitest bounds a hook by its own default, 10 seconds**, even when the tests have a longer
  `testTimeout`: the web tests' setup, which builds a repository through the binding, timed out
  under load until [`vite.transforms.ts`](/packages/web/vite.transforms.ts) gave hooks the same
  bound.

## Questions

### Round 01

#### Q1: Does this feature also rewrite the existing tests?

**Answer:** B: everything in a single pass, "I'll let you work for 10+ hours".

#### Q2: What happens to a test that guards behaviour the approved spec replaces?

**Answer:** B: the spec lists the replaced behaviour and its tests, and the human removed principle
VI from the constitution, "a bad principle and not really related to the project at hand".

#### Q3: Does testing effort scale with the project's stage?

**Answer:** A: a testing decision names the project's stage, `early`, `growing`, or `stable`.

#### Q4: How should the web UI be tested?

**Answer:** B: logic and contract tests only, "I'd rather review actual behaviour with the sandbox",
with at most one screenshot per new view in the pull request and none in the repository.

#### Q5: Do decisions state structure and never specifics?

**Answer:** A: a rule states intent, its numbers live in the code, "behaviour is encoded IN THE
CODE".

#### Q5.A: Which existing decisions does this feature rewrite?

**Answer:** A: the decisions with specifics the audit found.

#### Q6: Is the pull request body the record?

**Answer:** A, with small changes allowed for the body, such as screenshots, which stay out of the
record and the repository.

#### Q7: May an agent edit an old record to link to its successor?

**Answer:** A: `superseded-by` and a line in the old record, `supersedes` in the new, paired by
`ura check`.

#### Q8: Should records keep the issues faced during implementation?

**Answer:** A: an optional **Gotchas** section.

#### Q9: What happens to rulings?

**Answer:** A: Decision, Rationale, and Where, with the other two fields optional.

#### Q10: How is the new wording evaluated?

**Answer:** A, judged by the agent itself, with fresh subagents and the human's OpenCode with
DeepSeek: "Iterate on the skill's wording until we get small, efficient, useful, focused tests. But
keep the skill's wording generic."

#### Notes

- **A UI test needs no test-first step**: UI is "usually even judged by generated code and running
  the live application".

## Decisions

- [Testing](../decisions/testing.md), new: tests follow the spec and the decisions, by the project's
  stage, and a web UI test is kept only when extremely useful.
- [UI checks](../decisions/ui-checks.md), changed: the human checks UI work by using the app, with
  one screenshot of each new view in the pull request.
- [UI layout](../decisions/ui-layout.md), [UI look](../decisions/ui-look.md),
  [UI behaviour](../decisions/ui-behaviour.md), [Problems](../decisions/problems.md),
  [Settings](../decisions/settings.md), and [Preview](../decisions/preview.md), changed: rules keep
  their intent and end "Checked by review", but contrast; stories do not run as tests.

## Changes after approval

- UI behaviour's rule on growing views ended "Checked by the UI tests, which count what draws"; it
  now ends "Checked by review", as the approved spec says of all its rules. The decision was edited
  after the spec's approval, and this pull request asks for it.
- The browser runner went with every browser test: its two weakest candidates, a picked element's
  comment and a variant's comment, kept their logic as unit tests.
- Kept beyond the plan's first list, because a decision names them or they guard a write: the
  preview frames' sandbox, the writes store's status, the diagram's fallback, the notifier, and the
  figure rows' cases.
- The theme's test keeps only its WCAG contrast; its text sizes, fonts, and breakpoints went, as no
  decision states them now. The columns' stored widths keep their format but not their chosen
  limits.
- The web tests' setup has the same time bound as their tests, after a security test's setup timed
  out under load.
- The toolchain test's comment stripping keeps strings whole, after a retry setting between two glob
  strings escaped it.
- The evaluation stopped on its run cap with Sonnet, then went on with Haiku at the human's request,
  past SC-008's five revisions and twelve runs, to revision 14, without three passing runs in a row.

## Follow-ups

- The draft "Use Storybook for UI tests" is moot under the Testing decision, since stories no longer
  run as tests: dropping it is the human's call.
- The fast check's `ui` family does not run the new web unit tests; only `ready` does.
- The evaluation's remaining failures with Haiku: an old result a scenario says still holds,
  asserted again beside its test, and fixtures moved onto a new rule's edge, despite the wording.
- The editor offers `supersedes` and `superseded-by` as text fields, though they are lists.
