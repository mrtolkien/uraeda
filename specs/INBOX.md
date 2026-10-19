# Inbox

## Quickfixes

- Fix " ├╴ Link to non-existent document '/specs/2026-10-13-image-attachments/proposal.md' Marksman
  (2)"
  - Happens when there's a feature in a worktree: we should not link from main to worktree-only
    files
  - There's no simple fix atm, because the file is only in the worktree: we should likely change the
    commit/worktree flow a bit

## Prompts

- The implement step creates WAY TOO MANY inbox notes: inbox notes should be _meaningful_ issues
  that require human attention. If it's random bullshit why is it here, if it's important why isn't
  it done.

- The PR texts suck: I often work on 3+ features in parallel and when a PR drops I'm lacking
  context. It talks about "Approach" and "What stays unchanged" but ffs start with some good context
  about what was _done_.

## UI

- In sessions the middle column is too wide
- In clarifications of inbox triage, most notes were cut -> very hard to read
- In clarifications the card with two columns + questions on the right felt a bit cramped, the card
  should be a bit wider + the left part should be bigger + the right column should be right-aligned
- The sidebar view of running stuff needs a few changes:
  - Click in most of the border should go to the page (feature/change)
  - The agent pill should go to the session
  - If it's a warning sign for answers it should go to the question page
  - The diff needs colors (green/red)
  - We need ~+2px bottom border I think, sometimes text and pills looked like they had not enough
    space (don't have an example on hand)
- "Why it matters" should be a question callout

## Changes

- Inbox needs to be able to have screenshots like other pages
- Questions need examples + the text has become too long with the new prompt
  - The question could present the example and the answers the outcome
- "drafting a priority" is ass btw. It should be "Turn a priority into a draft".

## Deferred fixes

- [agent] storybook-fixes: validate-storybook.ts starts Vite and lists the repository outside its
  `try`, so a failure there leaks its two temporary folders, and `storybookPage` and
  `checkoutFolder` copy the core's page-route and branch-to-folder rules
- [agent] [redesign-feature] Feature page: a decision a done feature renamed shows as new, its old
  name untouched: the diff's rename keeps only the new path
- [agent] [redesign-feature] Problems: a blank answer blocks a feature only when its branch is
  checked out; a branch without a checkout never shows "Fix"
- [agent] [redesign-feature] Feature page: Back after a reload can land too high: "Next", the
  agent's card, and the record draw after the scroll is restored
- [agent] [redesign-feature] Feature page: a change's blocking banner reads "This feature cannot go
  on"
- [agent] [redesign-feature] Code quality: structure.rs still allows workspace.rs 742 lines, though
  it is 659 now: lower the budget so it cannot grow back
- [agent] [redesign-feature] Runner: a workflow message queued on a feature merged before it starts
  fails with "This feature has no branch left"
- [agent] [redesign-feature] Runner: the steps whose run starts a fresh agent session are listed
  twice, in HandOver.tsx and runner/sessions.ts
- [agent] [redesign-feature] Tokens: agent session starts are found by their system line's words:
  rewording a line loses the markers already stored
- [agent] [redesign-feature] Tokens: a late report from a closing process can count for the next
  turn; the session's total stays right
- [agent] [redesign-feature] Feature page: the stages' walk stops at the folder's date minus a day:
  commits made earlier, or reachable only through an older-dated commit, are missed
- [agent] [redesign-feature] Feature page: a feature fast-forwarded into main locally is timed as
  merged at its finish, not at the merge
- [agent] [redesign-feature] Feature page: a done item read from its folder, with no record, walks
  the default branch from its tip to the folder's date
- [agent] [decision-review-fixes] Decision comparison: a `###` heading, or a second `#`, is dropped,
  so a change only there shows no card; a loose item's continuation paragraph has no strength; a
  parent item's lines cover its nested items; callout titles and HTML blocks are untested
- [agent] [decision-review-fixes] Decision fields: a change inside a multi-line frontmatter value
  (`>`, `|`, a list) shows no field, and ` #` cuts a value, as `frontmatter::raw` reads one line
- [agent] [decision-review-fixes] Check: `ura check specs/decisions` reports no
  `decision.unapproved`, though each file checked alone does; features under `specs/changes/` are
  never checked for it
- [agent] [decision-review-fixes] Decision comparison: nothing tests that an unchanged unlisted
  decision skips its parse; the SC-003 bench is the only guard
- [agent] [decision-review-fixes] Watch: each burst reads every decision of every branch to hash it,
  about 40 blob reads per feature: measure it, and hash blob ids instead of texts
- [agent] [decision-review-fixes] Decision comparison: a check whose "Checked" or "by" is the
  changed word spans two runs, so it shows inline in the rule's text
- [agent] [spec-page-fixes] Spec page: storedBody's field test reads a Markdown heading (#) as a
  frontmatter comment, so a stored body of break, heading, break loses its middle; and lines with a
  digit-first key, a spaced key, or a bare - are rejected. A marker in the stored entry would settle
  both (R11).
- [agent] [spec-page-fixes] Spec page: the web recomputes which Review and Decisions items the core
  read (unreadItems), while ura check has the core's unread_items, and a duplicate decision item
  shows as a raw block without a check problem; KNOWN_PARTS is a fourth copy of the spec's part
  titles. Send both from the core.
- [agent] [spec-page-fixes] Git: api/answered.rs reads the review at the oldest run of commits
  reading the revision in topo order, which can stop at a conflict-resolving merge when two branches
  both change spec.md.
- [agent] [spec-page-fixes] Spec page: useCommentDraft is 99 lines against the 100-line limit; the
  fixtures cli-tuis and plan-review list decisions without links, so ura check reports
  decisions.item on them; comment-draft-place.test.tsx mocks scrollBy as a no-op, so it cannot tell
  a double correction from a single one.
- [agent] [redesign-feature] Sidebar: a card's "+N −N" draws uncoloured: Text's success and error
  colours are not defined by the theme
- [agent] [redesign-feature] Feature page: a record from before typed commits reads "Not found on
  the default branch", a squash merge's words, though nothing was squashed
- [agent] [redesign-feature] Feature page: the stages stay a column after a live update shortens
  their lines, until the window widens
- [agent] [redesign-feature] Feature page: a done feature's figures start one thread per diff and
  per decision on every read, about 20 for a feature that rewrote every decision
- [agent] [redesign-feature] Feature page: a done feature's "Next" names its pull request without
  linking it; only "Lines changed" leads there
- [agent] [redesign-feature] Recommended message: no test checks end to end that a merged feature's
  session recommends nothing; the unit test builds its step by hand
- [agent] [redesign-feature] Feature page: history::read is at the 100-line limit: the next figure
  must split it first
- [agent] [redesign-feature] Sidebar: on origin/main, the browser test "the sidebar with sessions,
  searched for “”" fails on desktop: the chat row "Tag v0.3.0 and push the tag." overflows its row
  (243 > 214 px)
- [agent] [round-fixes] ura check reports a #### heading in a clarifications round's Context or
  settled section but not in the triage's, whose Context parts() also drops silently; and check_file
  parses the triage tree even when the triage is not waiting
- [agent] [round-fixes] readLetters.ts is a hand copy of the core's letters rule, tied only by
  copied test rows: share the rows through fixtures/ so they cannot drift; the letter warning also
  says it opens follow-ups on questions that have none
- [agent] [benchmarks] Benchmarks: a human's uncommitted edits outside the feature's folder are not
  caught: only its commits are checked (human.ts).
- [agent] [benchmarks] Benchmarks: a retry session after an auto block records no blocks of its own
  and can pass the session cap (loop.ts).
- [agent] [benchmarks] Benchmarks: the leak audit sees only http(s) addresses: gh repo clone, gh
  api, and ssh remotes pass (session.ts).
- [agent] [benchmarks] Benchmarks: the record's repository commit is read at the end of a run, not
  the start (run-common.ts).
- [agent] [benchmarks] Benchmarks: process.env.CLAUDE_CONFIG_DIR is set for the whole process and
  never restored (real-deps.ts).
- [agent] [decisions-pass] Rules drawn on the decisions page lose the links of their text: the
  core's comparison keeps plain words, so a rule linking another decision is no longer a link
- [agent] [decisions-pass] ura check on one candidate file skips the candidate name rules:
  specs/decisions-check/q1-a/CONSTITUTION.md passes alone and fails with its folder
- [agent] [decisions-pass] A decisions check's stale-option skip looks only at the default branch,
  not at decisions proposed on open branches; and /decisions/check shadows a decision named check.md
- [agent] [decisions-pass] The ledger read now reads every candidate of a waiting check, and an
  inbox note edit refetches the ledger: add a decisions-check change flag to the watcher
- [agent] [decisions-pass] An option of a decisions check that removes a decision (half of a merge)
  is drawn with no candidate card; SKILL.md has 5 characters of margin under its 20,000 limit
- [agent] [fix-testing] Skill template: skills/uraeda/assets/templates/specs/CONSTITUTION.md rule VI
  still says "tests covering the spec's acceptance scenarios", so a new project's constitution
  forbids what the testing rules now ask: needs the human's wording
- [agent] [fix-testing] Server error page: "Try again" on "Could not reach the Uraeda server" does
  not recover once the server is back, since the fate client keeps the failed read; only a reload
  does
- [agent] [fix-testing] Priorities list: after Enter on a row, focus goes to the page body while the
  inbox keeps it on the row, so the two lists do not share one keyboard behaviour; a click on a row
  on a wide screen drops focus the same way
