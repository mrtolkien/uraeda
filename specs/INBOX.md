# Inbox

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
