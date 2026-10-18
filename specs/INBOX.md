# Inbox

- [redesign-specs] Auto-restart agent on rate limit hits

## Quickfixes

- Fix " ├╴ Link to non-existent document '/specs/2026-10-13-image-attachments/proposal.md' Marksman
  (2)"
  - Happens when there's a feature in a worktree: we should not link from main to worktree-only
    files
  - There's no simple fix atm, because the file is only in the worktree: we should likely change the
    commit/worktree flow a bit
- Draft to proposal on mobile went 404
- When there's multiple "blocked by auto mode", we should be able to allow them ALL at once!
- We need a "restart stopped agents" button after a crash, that just sends "continue" in all
  sessions
- [redesign-clarifications] Proposal often shows up as having errors when it’s stuff like linking
  files in worktrees. Generally we don’t really care about small problems to proposal + our flow
  should not create errors.
- [agent] [redesign-clarifications] Starting a draft folder from its proposal.md
  (specs/drafts/<slug>/proposal.md) starts it as a file draft: only proposal.md moves, and its
  images/ stay behind, breaking the proposal's image links (crates/core/src/actions/start/plan.rs,
  draft_files)
- [agent] [storybook-restart] specs/drafts/look-and-feel/proposal.md links flow-review.md, which is
  ../flow-review.md: ura check specs fails on main
- [agent] [symlinks] cargo clippy fails on main with int_plus_one at
  crates/core/src/files/priorities/edits.rs:105, so vp run ready fails
- [agent] [symlinks] The commit hook type-checks root TypeScript files alone, without Node's types
  (no root tsconfig or @types/node): any commit touching vite.tasks.ts or scripts/*.ts is refused
- [agent] [symlinks] In the main checkout, ts:check and specs:check read .worktrees/ as inputs
  (their ** globs do not exclude it), so any worktree edit misses their cache there (vite.tasks.ts)
- [agent] [symlinks] Under load from other worktrees, home.test.tsx 'on a phone, the counts and the
  cards come in the same order' and shell.test.tsx '＋ adds to Later with a toast and Undo' failed
  in a full ts:test run, and passed alone
- [agent] [access-storybook] Approval removes a decision's applied '## Proposed change (<folder>)'
  section, leaving the spec's link to its anchor dead (ura check fails); approval.md should say to
  repoint it, e.g. to the decision's #rules

## Prompts

- Generally we should take a look at all session transcripts so far and check if our prompts behaved
  properly.
  - Example: the UI branch asked for a clarification that would help finish the branch and the
    auto-filled message asked to go back to spec (normal for the standard flow). But it could
    directly finish the PR without all the flow again... We need a way to shortcut the flow for
    later clarifications
- We need a dedicated "testing setup" reference which covers storybook and component testing, and
  should only be read rarely (during the flow setup or when UI work starts) -> it should then be
  made into a repository-specific decision
- Should we split the files in two:
  - A first file that the model writes with light constraints -> this way we let the model write
    what it would do "normally"
  - Then we transform the file into a second, human-readable, actionable document?
  - The idea would be let the model make a first "draft" that's extensive, _then_ extract the most
    important information, well formatted, for a human
- We need a "check decisions coherence" option, like "inbox triage"
  - It should read constitution and all decisions and raise if some of them are competing, and
    explain the options clearly (what are the 2 options to keep it clean)

## UI

- Inbox/Priorities need icons
- The folded left sidebar should keep icons for the main categories, and also unfold temporarily on
  hover
- [redesign-clarifications] Constitution check in specs looks pretty bad
- Make a coherence pass in the UI: why is the sidebar on the right in mobile? And look at Kiro Crew
  UI and see what we could use ourselves
- [agent] [redesign-specs] A spec's decision changes, and a branch's decision page, are not sent
  live when only a decision of `specs/decisions/` changes on the branch: the watch updates the
  feature, not its `spec.md` or the `BranchDecision`, and an uncommitted edit of a decision not at
  all

## Flow

- Settings page didn't show as "finished" in the UI after the last message -> might be fixed by the
  interface review feature
- Decisions are hard to read and too long, will need a pass
- Clarifications during implementation can resume implementation

## Deferred fixes

- [agent] [redesign-priorities] Decisions page: when the default branch is checked out nowhere, a
  decision's links are checked against the current checkout, not the default branch's tree, so a
  valid link can read as broken
- [agent] [redesign-priorities] Discard keeps a priority's draft on disk when the line's children
  changed since the last commit
- [agent] [redesign-priorities] The decisions page runs one git log per decision, and the watch
  reads every decision on each pass
- [agent] [storybook-restart] A Storybook whose first commit read failed never restarts on a commit
  until it idles out: a view at an unknown commit keeps it, and one at a known commit after it
  should restart once (runner.ts moved)
- [agent] [storybook-restart] Two views racing a commit can restart a Storybook back to the older
  commit, then forward again: restart only for a commit read after the Storybook started (runner.ts
  view)
- [agent] [symlinks] Without file clones (ext4), every dev shell in a new worktree retries the
  failing clone of target/, cp printing one error per file until spawnSync's 1 MB buffer kills it,
  and prints 'not seeded' until cargo creates target/: probe a one-file clone first
  (packages/server/scripts/worktree-seed.ts, seedTarget)
- [agent] [symlinks] worktree-seed's publish swallows a lost rename and still reports 'seeded'; a
  main checkout task cache with no files also reports 'seeded' and retries at every shell
  (packages/server/scripts/worktree-seed.ts)
- [agent] [symlinks] The dev shell's seed hook assumes the current repository is Uraeda: nix develop
  on this flake from another project's worktree prints a module-not-found error at every shell, and
  the hook overwrites a 'root' variable (flake.nix shellHook)
- [agent] [symlinks] The first dev shell in a new worktree blocks about 8 s while target/ is cloned,
  without saying so: print a line before the clone (packages/server/scripts/worktree-seed.ts)
- [agent] [access-storybook] storybook-preview.test.ts pins neither that the helper's security
  forwards Storybook's options to a project's preset function, nor a head preset returning undefined
  (uraeda-preview.js run callers)
- [agent] [access-storybook] validate-storybook.ts opens Storybook's interface top-level through the
  proxy, not inside Uraeda's /f/<folder>/storybook page: a regression only in the page's frame
  (pathOf's ?path= forwarding) would not show
- [agent] [access-storybook] validate-storybook.ts: the 'an added export shows in the sidebar,
  without a reload' failure prints 'got false' whether the export was never listed or the page
  reloaded
- [agent] [redesign-clarifications] Mermaid draws each diagram first in a temporary frame of the app
  origin that runs scripts, so a sanitiser bypass reaches the app despite the diagrams decision:
  running it in an opaque-origin frame needs the decision amended (strict level, as WebKit gives
  such frames no contentDocument) and the guard to allow Origin: null reads of /assets/*
- [agent] [redesign-clarifications] The settled fold reads "Show the 1 points" for a single point
  under the hood
- [agent] [redesign-clarifications] block.count warns on a round sent back for blank answers, whose
  first line names the blank questions ("2 questions still need an answer: Q3 and Q5")
- [agent] [redesign-clarifications] A comment saved with no letter picked but starting like "A: ..."
  or "B, ..." reads back as that letter picked, and opens its follow-ups: the web UI could warn
- [agent] [redesign-clarifications] On the phone, the round page draws its band before the settled
  points even when there are none, as on the triage
- [agent] [redesign-clarifications] A #### heading in a round Context is dropped from the page, and
  ura check says nothing
- [agent] [redesign-clarifications] section() in items.rs stops at a quoted ## heading, cutting the
  settled points after it
- [agent] [redesign-clarifications] Diagram measures its width once: a diagram fixed by a live edit
  after failing never gets its keyboard-scrollable region
- [agent] [redesign-clarifications] Diagram frames: Mermaid working id can equal a heading anchor
  (diagram-_r_0_); allow-top-navigation-by-user-activation lets a diagram link replace the app tab;
  viewBox not clamped; no loading state; every frame titled "Diagram"; a failed draw can leave
  Mermaid temporary frame in the page
- [agent] [redesign-clarifications] conventions.md reads as if every ### heading in a round Context
  or settled points were refused: add "that the template does not have"
- [agent] [redesign-clarifications] Old-format rounds remain as inline test inputs
  (crates/core/tests/actions.rs, crates/lsp/tests reads.rs and editing.rs, web change.test.tsx, nvim
  test_jumps.lua and test_waiting.lua): new tests will copy them
- [agent] [redesign-clarifications] SettledGroup.kind is a string rather than the spec SettledKind
  enum, so the web gets no exhaustiveness check
- [agent] [redesign-clarifications] ura check parses a waiting round twice (markdown and document
  trees), on every keystroke through ura lsp
- [agent] [redesign-clarifications] settled_points still reads the settled section on its own,
  beside the groups: two readings of one section
- [agent] [redesign-clarifications] The round cards accent lines use --spacing-1, which scales to
  about 4.8 px from 1024 px where the spec says 4 px; the split threshold is read once on mount
- [agent] [redesign-clarifications] Round card tests leave the 5 to 6 ratio, the follow-up joint and
  indent, the phone follow-up accent, and the option focus ring untested, and some find elements by
  Astryx class names
- [agent] [redesign-clarifications] specs/backlog/benchmarks/clarifications-01.md has 4 sentences
  over 25 words, and follow-ups shared by two options (Only if you picked A or C), which the core
  shows for one letter only
- [agent] [questions-first] On a phone, the round's in-page Questions index has no test that it is
  hidden on an answered round, nor that it sits after the block (round.test.tsx)
- [agent] [questions-first] The round's in-page index is announced as Questions three times, nav,
  heading, and list: label the nav by its heading and drop the list's label there (RoundNav.tsx
  RoundIndex)
- [agent] [questions-first] RoundPage's comment on navigates names the column and the top bar, not
  the phone's in-page index (RoundPage.tsx)
- [agent] [redesign-specs] Skill wording: references/spec.md centers the constitution table (against
  R14), says "You approve" in one sentence where the template says one or two, lists rule keywords
  without MAY; sentences over 25 words in README.md, change.md, plan.md, writing.md, discovery.md,
  cli.md, spec.md, conventions.md; the test-writing rules still live in spec.md's "## Tests";
  writing.md does not say how to time a revision; plan.md's review-focus items have no slot in the
  test map's template or example; change.md links implementation.md#for-each-task-in-order (gone).
- [agent] [redesign-specs] Spec parsing: a ## Your review item that does not parse (Done., non-bold
  C3) and a ## Decisions item with a wikilink or a missing decision file are dropped without a ura
  check problem, and the page draws neither; read.rs reads specs/decisions/<name>.md for a link into
  another specs/decisions/ tree; the spec template does not mark "More scenarios:" optional.
- [agent] [redesign-specs] Spec page: Given/When/Then rows and the criterion's sentence are tested
  loosely (rows untested; "N unchanged", unlisted order, a rule's own Changed pill, SHOULD vs MUST
  colours untested); Scenario steps are cut in the web on bold spans (the core could send them);
  trimmed() is defined twice; the niche fold's choice overrides a later comment; the data model's
  intro sits outside any panel; on the phone no band between "What you approve" and the answers;
  comments on the stories' intro are counted nowhere; an unknown level-2 section is not drawn;
  data-model.md is read from disk while a waiting spec shows its commit; "Contents" at 420 px leaves
  350 px for the page at 768–800 px.
- [agent] [redesign-specs] Decision comparison: code blocks, tables, quotes, and nested items are
  not parts, so a change only there shows no change; untested paths (a section only at the merge
  base, crossing pairs, duplicates, empty input); compare runs on every decision of the branch,
  changed or not, and the SC-003 bench has only 5 decisions; an unlisted change to only the title or
  another frontmatter field shows no card; "Checked by" is split in the web (R80); decision changes
  are not sent live.
