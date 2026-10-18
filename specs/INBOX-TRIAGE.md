---
status: awaiting-human
---

# Inbox triage

> [!IMPORTANT]
>
> 22 questions on 67 notes, about 45 minutes.
>
> - Seven notes are done or already written in a draft: deleting them is the quick win.
> - Nine changes are offered for the 44 bug and test notes, mostly agents' deferred fixes. Answering
>   them all with a change starts nine branches: pick the ones you want now.
> - The decision fixes matter for the feature in progress: Redesign feature and change pages reuses
>   the decision comparison, and inherits its gaps.
> - Links from the default branch to a started feature's files still break Marksman and the
>   proposals' checks. Fixing it needs a design choice, so it is offered as a draft.
> - Three notes about the workflow itself go to new drafts: later rounds of questions, a review of
>   past sessions, and a decisions pass.
> - Your uncommitted note on the "What you approve" text is covered, with the layout notes.

## Context

The inbox holds 67 notes: 1 without a category, 12 under Quickfixes, 4 under Prompts, 6 under UI, 3
under Flow, and 41 under Deferred fixes. This triage covers all of them. It includes the note you
added without committing yet, "The text in the "What you approve" part of specs is too small".

For each note, I read the code it names on `main` and searched the commits since the note was
written. I read [PRIORITIES.md](PRIORITIES.md), every draft in [drafts/](drafts/), and the
[benchmarks backlog](backlog/benchmarks/proposal.md). I also read the approved spec of the one
feature in progress, Redesign feature and change pages, on its branch.

Most Deferred fixes notes bundle several findings from a feature's final review. I checked each one:
none is fixed on `main`. Questions group notes that touch the same code, so one change can carry
them. A change's slug is its folder's name without the date, as in `specs/changes/`.

## Q1: Should the five notes already fixed on main be deleted?

These notes describe problems that commits on `main` have since fixed:

- "[agent] [storybook-restart] specs/drafts/look-and-feel/proposal.md links flow-review.md…": the
  draft no longer links it (commit `d9fe3d7d`).
- "[agent] [symlinks] cargo clippy fails on main with int_plus_one…": fixed by `74b56fa9`.
- "[agent] [symlinks] The commit hook type-checks root TypeScript files alone…": `508810b8` added a
  root `tsconfig.json` and Node's types.
- "[agent] [symlinks] Under load from other worktrees, home.test.tsx…": `db9d94bc` made both tests
  wait for what loads. Nobody has run them under load since.
- "[agent] [access-storybook] Approval removes a decision's applied '## Proposed change
  (<folder>)'…": decisions are now edited in place, so approval removes no section
  ([approval.md](/skills/uraeda/references/approval.md)).

Why it matters: these notes cost reading time at every triage and fix nothing.

- **A (recommended). Delete the five notes from the inbox.**
  - [pro] The inbox keeps only open problems.
  - [con] If the two tests still fail under load, a new note is needed.
  - Why recommended: each fix is in a commit you can check.
- **B. Delete four notes, and keep the flaky tests note in the inbox until a loaded run passes.**
  - [pro] The flaky tests stay in sight.
  - [con] A note nobody acts on stays in the inbox.

**Answer:**

## Q2: Should the two notes already written in the Worker lifecycle draft be deleted?

The notes are "[redesign-specs] Auto-restart agent on rate limit hits" and "We need a "restart
stopped agents" button after a crash, that just sends "continue" in all sessions".

The [Worker lifecycle](drafts/worker-lifecycle.md) draft already says both: "A run stopped by a
limit resumes once the limit resets", and "one button that restarts every stopped agent, sending
"continue" to each (from the inbox)". Nothing in the code does either yet.

Why it matters: the draft is linked from **Next**, so deleting the notes loses nothing.

- **A (recommended). Delete both notes from the inbox.**
  - [pro] No duplicate between the inbox and the draft.
  - [con] None.
  - Why recommended: the draft already holds both, in nearly the same words.
- **B. Add both notes to the end of the What of the draft Worker lifecycle.**
  - [pro] The draft keeps your exact words.
  - [con] The draft says each point twice.

**Answer:**

## Q3: Where should "allow all the blocked by auto mode" go?

The note is "When there's multiple "blocked by auto mode", we should be able to allow them ALL at
once!".

Each blocked action has its own "Allow and retry" button in the session's transcript
([Transcript.tsx](/packages/web/src/Transcript.tsx)). There is no way to allow several at once. The
[Redesign session](drafts/redesign-session.md) draft, linked from **Now**, is the functional pass on
the session page.

Why it matters: a bulk action is a design choice for the session page, best made with its redesign.

- **A (recommended). Add the note to the end of the What of the draft Redesign session.**
  - [pro] Designed with the rest of the session page.
  - [con] Waits for that feature.
  - Why recommended: the draft is already in **Now**, and covers the same page.
- **B. Start it as a change, from a new draft "Allow every blocked action at once", with the slug
  `allow-all-blocked`.**
  - [pro] Ships sooner.
  - [con] The session redesign may move the button again.

**Answer:**

## Q4: What should become of the notes about links to a feature's branch?

The notes are "Fix " ├╴ Link to non-existent document
'/specs/2026-10-13-image-attachments/proposal.md' Marksman (2)"…", with its two sub-points, and
"[redesign-clarifications] Proposal often shows up as having errors when it's stuff like linking
files in worktrees…".

Starting a feature links its proposal from `PRIORITIES.md`, on the default branch
([projects.md](/skills/uraeda/references/projects.md#starting-postponing-and-dropping-a-feature)).
That file only exists on the feature's branch. `ura check` now skips such links in `PRIORITIES.md`
and `INBOX.md` ([links.rs](/crates/core/src/check/links.rs)). Marksman, the markdown language server
in your editor, still reports them: today on the Redesign feature and change pages entry.

A proposal linking a file in a worktree still gets a link error from `ura check`. The feature in
progress, Redesign feature and change pages, makes such errors a folded note on Home and the
sidebar. `ura check` itself will still print them as errors.

Fixing it means choosing what the default branch links to for a started feature: nothing, the
branch's file through the web UI, or a record copied to the default branch. That choice changes the
skill and the tools.

Why it matters: every started feature produces this warning, and every proposal that links a
branch's file shows an error.

- **A (recommended). Make a new draft, "Links to a feature's branch", with both notes, linked from
  the end of Now.**
  - [pro] The design choice gets its own discovery.
  - [con] One more feature before v1.0.0.
  - Why recommended: every started feature hits it, and the fix changes the skill.
- **B. The same new draft, linked from the end of Next.**
  - [pro] **Now** stays as it is.
  - [con] The warnings stay until after v1.0.0.
- **C. Delete the proposal note, which Redesign feature and change pages partly covers, and keep the
  Marksman note in the inbox.**
  - [pro] No new draft.
  - [con] Proposals still fail `ura check`.

**Answer:**

## Q5: Where should "Draft to proposal on mobile went 404" go?

The note is "Draft to proposal on mobile went 404".

I found no path specific to the phone. "Start the feature" opens the feature's session or its page
([useEditorActions.ts](/packages/web/src/useEditorActions.ts)), and no commit since the note
mentions a fix. It needs to be reproduced first. The draft
[Review the overall flow of all user stories](drafts/flow-review.md) checks the transitions from
draft to feature.

Why it matters: an unreproduced bug makes a poor change, but it fits a functional pass on the flow.

- **A (recommended). Add the note to the end of the What of the draft Review the overall flow.**
  - [pro] Checked with every other transition, on a phone too.
  - [con] Waits for that feature.
  - Why recommended: the draft is in **Now**, and covers this exact transition.
- **B. Start it as a change, from a new draft "Draft to proposal on mobile went 404", with the slug
  `mobile-start-404`.**
  - [pro] Looked at now.
  - [con] The change starts with a hunt for a repro.
- **C. Delete it.**
  - [pro] The inbox gets shorter.
  - [con] The bug may still be there.

**Answer:**

## Q6: Should the images left behind by a started draft folder be a change?

The note is "[agent] [redesign-clarifications] Starting a draft folder from its proposal.md…".

Starting `specs/drafts/<slug>/proposal.md` treats it as a file draft: only `proposal.md` moves
([plan.rs](/crates/core/src/actions/start/plan.rs), `draft_files`). Its `images/` stay behind, and
the proposal's image links break. Two of your drafts are folders with images:
[Some layout reviews](drafts/some-layout-reviews/proposal.md), in **Now**, and
[Look and feel pass](drafts/look-and-feel/proposal.md).

Why it matters: the next start of one of these drafts breaks its images.

- **A (recommended). Start it as a change, from a new draft "Start a draft folder from its
  proposal", with the slug `start-draft-folder`.**
  - [pro] A small fix in one function, before the next folder draft starts.
  - [con] One more branch to review.
  - Why recommended: Some layout reviews would hit it when it starts.
- **B. Keep it in the inbox.**
  - [pro] Nothing to review now.
  - [con] Starting a folder draft from its proposal loses its images.

**Answer:**

## Q7: Should the six worktree and toolchain notes be one change?

The notes:

- "[agent] [symlinks] In the main checkout, ts:check and specs:check read .worktrees/ as inputs…"
- "[agent] [symlinks] Without file clones (ext4), every dev shell in a new worktree retries…"
- "[agent] [symlinks] worktree-seed's publish swallows a lost rename and still reports 'seeded'…"
- "[agent] [symlinks] The dev shell's seed hook assumes the current repository is Uraeda…"
- "[agent] [symlinks] The first dev shell in a new worktree blocks about 8 s…"
- "[agent] [redesign-specs] Toolchain: scripts/test-run.ts's sweep of temporary folders races…"

All six are still present. Five are tiny or small: a missing exclusion in
[vite.tasks.ts](/vite.tasks.ts), and missing checks in
[worktree-seed.ts](/packages/server/scripts/worktree-seed.ts) and [flake.nix](/flake.nix). The
largest is the runs killed when several worktrees validate at once: it needs a lock on type checks,
like the one browser tests already share.

Why it matters: these slow down or break every agent working in a worktree, which is every feature.

- **A (recommended). Start one change, from a new draft "Worktree toolchain fixes" with the six
  notes, with the slug `worktree-toolchain`.**
  - [pro] Every later feature validates faster and more reliably.
  - [con] The ext4 and other-project fixes help contributors you may not have yet.
  - Why recommended: parallel worktrees are how this project works daily.
- **B. Keep them in the inbox.**
  - [pro] Nothing to review now.
  - [con] Cache misses and killed runs continue.

**Answer:**

## Q8: Should the five Storybook preview notes be one change?

The notes:

- "[agent] [storybook-restart] A Storybook whose first commit read failed never restarts…"
- "[agent] [storybook-restart] Two views racing a commit can restart a Storybook back to the older
  commit…"
- "[agent] [access-storybook] storybook-preview.test.ts pins neither that the helper's security
  forwards…"
- "[agent] [access-storybook] validate-storybook.ts opens Storybook's interface top-level through
  the proxy…"
- "[agent] [access-storybook] validate-storybook.ts: the 'an added export shows in the sidebar,
  without a reload' failure prints…"

All are still present. The first two are bugs in
[runner.ts](/packages/server/src/preview/runner.ts): a Storybook can show a stale commit. The other
three are gaps in tests and validation scripts, mostly tiny.

Why it matters: a stale Storybook shows mockups from the wrong commit during a spec review.

- **A (recommended). Start one change, from a new draft "Storybook preview fixes" with the five
  notes, with the slug `storybook-fixes`.**
  - [pro] The mockups you review match the commit.
  - [con] One more branch to review.
  - Why recommended: small, contained in the preview code, and it protects your reviews.
- **B. Keep them in the inbox.**
  - [pro] Nothing to review now.
  - [con] A stale Storybook stays possible.

**Answer:**

## Q9: Should the three priorities and decisions page notes be one change?

The notes:

- "[agent] [redesign-priorities] Decisions page: when the default branch is checked out nowhere…"
- "[agent] [redesign-priorities] Discard keeps a priority's draft on disk…"
- "[agent] [redesign-priorities] The decisions page runs one git log per decision…"

All are still present ([ledger.rs](/crates/core/src/api/ledger.rs),
[drafts.rs](/crates/core/src/actions/changes/drafts.rs)). The first shows a valid link as broken.
The second leaves a stray draft after a discard. The third slows the watch as decisions grow.

Why it matters: small, but a false broken link teaches you to ignore the real ones.

- **A (recommended). Start one change, from a new draft "Priorities and decisions pages fixes" with
  the three notes, with the slug `priorities-decisions-fixes`.**
  - [pro] Three small fixes in the same core module.
  - [con] One more branch to review.
  - Why recommended: each fix is small, and they share the ledger code.
- **B. Add them to the change of the next question, on decision reviews.**
  - [pro] One branch for everything about decisions.
  - [con] A larger change, slower to review.
- **C. Keep them in the inbox.**
  - [pro] Nothing to review now.
  - [con] The false broken links stay.

**Answer:**

## Q10: What should become of the four notes on decision reviews?

The notes, all from the spec redesign:

- "[agent] [redesign-specs] Decision comparison: code blocks, tables, quotes, and nested items are
  not parts…"
- "[agent] [redesign-specs] Decision comments: the anchor parser accepts names the writer refuses…"
- "[agent] [redesign-specs] Checks: the reviewed words leave out links' text…"
- "[agent] [redesign-specs] A spec's decision changes, and a branch's decision page, are not sent
  live…", under UI.

The last one is the same problem as the comparison note's "decision changes are not sent live": one
fix closes both. Every finding I sampled is still present. The comparison misses changes in code
blocks, tables, and the title ([change.rs](/crates/core/src/decisions/change.rs)). Comments are not
checked for freshness against the decisions they point into. `decision.unapproved` shows in neither
the editor nor the web UI.

The feature in progress, Redesign feature and change pages, draws a done feature's decisions with
this same comparison. It inherits these gaps unless they are fixed first.

Why it matters: a decision change that the comparison misses is one you approve without seeing.

- **A (recommended). Start one change, from a new draft "Decision review fixes" with the four notes,
  with the slug `decision-review-fixes`.**
  - [pro] Fixed before the feature in progress builds on the comparison.
  - [con] Medium in size, with core, server, and web parts.
  - Why recommended: a missed decision change undermines the review it exists for.
- **B. Make a new draft, "Decision review fixes", with the four notes, linked from the end of Now.**
  - [pro] A discovery round for a medium change.
  - [con] Slower, and the feature in progress builds on the gaps first.
- **C. Keep them in the inbox.**
  - [pro] Nothing to review now.
  - [con] Changes in code blocks, tables, and titles stay invisible in reviews.

**Answer:**

## Q11: Should the four notes on the spec page and its editor be one change?

The notes, all from the spec redesign:

- "[agent] [redesign-specs] Spec parsing: a ## Your review item that does not parse…"
- "[agent] [redesign-specs] Spec page: Given/When/Then rows and the criterion's sentence are tested
  loosely…"
- "[agent] [redesign-specs] Answered review: once merged with a merge or squash commit…"
- "[agent] [redesign-specs] Reading place and editor: keepPlace and placeAboveSheet cancel the
  user's own scroll…"

Every finding I sampled is still present. The visible ones are these. Answered reviews lose their
quotes once merged ([answered.rs](/crates/core/src/api/answered.rs)). Saving a comment can cancel
your own scroll ([keepPlace.ts](/packages/web/src/keepPlace.ts)). Spec items that do not parse
vanish without a check problem. The rest are loose tests and duplicated helpers.

Why it matters: these hit you while reviewing specs, the step you spend the most time in.

- **A (recommended). Start one change, from a new draft "Spec page fixes" with the four notes, with
  the slug `spec-page-fixes`.**
  - [pro] Your next spec reviews lose no scroll and no quotes.
  - [con] Medium in size.
  - Why recommended: the spec page is where your review time goes.
- **B. Keep them in the inbox.**
  - [pro] Nothing to review now.
  - [con] The scroll jumps and the lost quotes stay.

**Answer:**

## Q12: Should the fifteen notes on rounds of questions be one change?

Twelve notes come from the clarifications redesign and three from the questions-first change. All
are still present:

- "[agent] [redesign-clarifications] The settled fold reads "Show the 1 points"…"
- "[agent] [redesign-clarifications] block.count warns on a round sent back for blank answers…"
- "[agent] [redesign-clarifications] A comment saved with no letter picked but starting like "A:
  ..."…"
- "[agent] [redesign-clarifications] On the phone, the round page draws its band before the settled
  points…"
- "[agent] [redesign-clarifications] A #### heading in a round Context is dropped from the page…"
- "[agent] [redesign-clarifications] section() in items.rs stops at a quoted ## heading…"
- "[agent] [redesign-clarifications] Old-format rounds remain as inline test inputs…"
- "[agent] [redesign-clarifications] SettledGroup.kind is a string rather than the spec SettledKind
  enum…"
- "[agent] [redesign-clarifications] ura check parses a waiting round twice…"
- "[agent] [redesign-clarifications] settled_points still reads the settled section on its own…"
- "[agent] [redesign-clarifications] The round cards accent lines use --spacing-1…"
- "[agent] [redesign-clarifications] Round card tests leave the 5 to 6 ratio…"
- "[agent] [questions-first] On a phone, the round's in-page Questions index has no test…"
- "[agent] [questions-first] The round's in-page index is announced as Questions three times…"
- "[agent] [questions-first] RoundPage's comment on navigates names the column and the top bar…"

Two change what you see: a comment starting "A: ..." reads back as picking A, and opens its
follow-ups. A quoted `##` heading cuts the settled points after it. The rest are small: wording,
spacing, tests, and parsing a round twice or three times on each keystroke in the editor.

Why it matters: the comment misread as a letter can change which follow-ups the next step expects.

- **A (recommended). Start one change, from a new draft "Round fixes" with the fifteen notes, with
  the slug `round-fixes`.**
  - [pro] All in the round's code, in core and web.
  - [con] Fifteen items make a long review.
  - Why recommended: they share files, so one branch avoids conflicts between several.
- **B. Start the same change with only the five that change behaviour, and delete the ten test and
  internal notes.**
  - [pro] A short review.
  - [con] The old-format test inputs stay, and new tests copy them.
- **C. Keep them in the inbox.**
  - [pro] Nothing to review now.
  - [con] The misread comments stay possible.

**Answer:**

## Q13: What should become of the three notes on diagrams?

The notes:

- "[agent] [redesign-clarifications] Mermaid draws each diagram first in a temporary frame of the
  app origin…"
- "[agent] [redesign-clarifications] Diagram measures its width once…"
- "[agent] [redesign-clarifications] Diagram frames: Mermaid working id can equal a heading anchor…"

All are still present ([Diagram.tsx](/packages/web/src/Diagram.tsx)). The first is a security gap.
Mermaid runs in the app's own page, so a flaw in its sanitiser lets a diagram in a workflow file run
script with your signed-in session. The [diagrams decision](decisions/diagrams.md) promises a frame
without scripts or the app's origin. Closing it needs that decision amended and a server guard
widened.

The other two are small bugs. The worst lets a link in a diagram replace the app's tab.

Why it matters: a workflow file written by an agent, or from a pull request, can carry the diagram.

- **A (recommended). Start one change, from a new draft "Diagram frames" with the three notes, with
  the slug `diagram-frames`. Its round asks for the decision amendment.**
  - [pro] Closes the gap the decision says is closed.
  - [con] A change asking for a decision amendment may be upgraded to a feature.
  - Why recommended: the decision promises a guard the code does not give.
- **B. Make a new draft, "Diagram frames", with the three notes, linked from the end of Now.**
  - [pro] A discovery round for the security design.
  - [con] Slower.
- **C. Keep them in the inbox.**
  - [pro] Nothing to review now.
  - [con] The gap stays open.

**Answer:**

## Q14: Should the three wording notes be one change?

The notes:

- "[agent] [redesign-specs] Skill wording: references/spec.md centers the constitution table…"
- "[agent] [redesign-clarifications] conventions.md reads as if every ### heading in a round
  Context…"
- "[agent] [redesign-clarifications] specs/backlog/benchmarks/clarifications-01.md has 4 sentences
  over 25 words…"

All are still present, and touch markdown only. The skill note bundles long sentences in eight
references, a dead link in [change.md](/skills/uraeda/references/change.md), and rules out of place.
The benchmarks round also has follow-ups shared by two options, which the tools show for one letter
only.

Why it matters: agents follow the skill to the letter, so a wrong rule or a dead link misleads every
step.

- **A (recommended). Start one change, from a new draft "Skill wording fixes" with the three notes,
  with the slug `skill-wording`.**
  - [pro] Markdown only, quick to review.
  - [con] Touches the skill's references, templates, and example together.
  - Why recommended: cheap, and the dead link and misplaced rules affect every run.
- **B. Keep them in the inbox.**
  - [pro] Nothing to review now.
  - [con] Agents keep reading the misleading lines.

**Answer:**

## Q15: Should the four layout notes go to the draft Some layout reviews?

The notes:

- "The text in the "What you approve" part of specs is too small (except the first line)"
- "The folded left sidebar should keep icons for the main categories, and also unfold temporarily on
  hover"
- "[redesign-clarifications] Constitution check in specs looks pretty bad"
- "Make a coherence pass in the UI: why is the sidebar on the right in mobile? And look at Kiro Crew
  UI…"

The [Some layout reviews](drafts/some-layout-reviews/proposal.md) draft, in **Now**, already covers
auto folding and the spec page's tables and Architecture. Today the folded sidebar shows an icon for
Home only ([Sidebar.tsx](/packages/web/src/sidebar/Sidebar.tsx)). You wrote the constitution check
note before the spec redesign merged, which redrew that part: it may look better now.

Why it matters: grouped, the layout is designed once instead of in four passes.

- **A (recommended). Add the four notes to the end of the What of the draft Some layout reviews.**
  - [pro] One layout pass covers the spec page, the sidebar, and the phone.
  - [con] The draft grows.
  - Why recommended: all four are layout, and the draft is already in **Now**.
- **B. Add the four notes to the draft Look and feel pass.**
  - [pro] That draft is about how things look.
  - [con] It comes last, and the folding and phone sidebar are function, not looks.

**Answer:**

## Q16: Should "Inbox/Priorities need icons" go to the draft Look and feel pass?

The note is "Inbox/Priorities need icons".

The [Look and feel pass](drafts/look-and-feel/proposal.md) draft asks for "many more icons", the
sidebar first. If the folded sidebar note goes to Some layout reviews, that feature needs these
icons too.

Why it matters: icons are a visual identity choice, which the look and feel pass makes.

- **A (recommended). Add the note to the end of the What of the draft Look and feel pass.**
  - [pro] Every icon is chosen in one style.
  - [con] The folded sidebar may get placeholder icons first.
  - Why recommended: the draft already plans the sidebar's icons.
- **B. Delete it, since the draft already asks for sidebar icons.**
  - [pro] No duplicate.
  - [con] Inbox and Priorities are not named there.

**Answer:**

## Q17: Where should the settings page that did not show as finished go?

The note is "Settings page didn't show as "finished" in the UI after the last message -> might be
fixed by the interface review feature".

You wrote it after the interface redesign merged, so that redesign did not fix it. The feature in
progress, Redesign feature and change pages, redraws a feature's stages, and may fix it. The draft
[Review the overall flow of all user stories](drafts/flow-review.md) checks each transition from one
state to the next.

Why it matters: a feature that does not show as finished hides the next step from you.

- **A (recommended). Add the note to the end of the What of the draft Review the overall flow.**
  - [pro] Checked after the feature page redesign lands.
  - [con] Waits for that feature.
  - Why recommended: the flow review comes after the redesign, and checks exactly this.
- **B. Delete it, trusting Redesign feature and change pages.**
  - [pro] The inbox gets shorter.
  - [con] Nothing checks that it was fixed.

**Answer:**

## Q18: Where should the testing setup reference go?

The note is "We need a dedicated "testing setup" reference which covers storybook and component
testing…".

The skill's [code quality](/skills/uraeda/references/code-quality.md) reference already says how a
project sets up its checks. It has no part on Storybook or component tests. The draft
[Use Storybook for UI tests](drafts/use-storybook-for-ui-tests.md) is about this project's own
tests, and no priority links it.

Why it matters: a reference read only at setup keeps the other steps short.

- **A (recommended). Make a new draft, "Testing setup reference", with the note, linked from the end
  of Next.**
  - [pro] A skill change of its own, separate from this project's tests.
  - [con] One more draft.
  - Why recommended: the reference serves every project, the Storybook draft only this one.
- **B. Add the note to the end of the What of the draft Use Storybook for UI tests.**
  - [pro] Both are about Storybook tests.
  - [con] That draft is about this repository, and is linked from no priority.

**Answer:**

## Q19: Should later questions resume the current step?

The note is "Clarifications during implementation can resume implementation".

Today, any answered round with no spec revision for it sends the workflow back to the spec step
([SKILL.md](/skills/uraeda/SKILL.md#finding-the-next-step)). A small question asked during the
implementation sends the feature through spec, plan, and implementation again. The Prompts note on
past sessions gives a real case: a branch near its pull request was sent back to the spec.

Changing it touches the skill's step table, `ura next`, and the web UI's steps together.

Why it matters: every late question today costs a full spec and plan revision.

- **A (recommended). Make a new draft, "Later questions resume the current step", with the note,
  linked from the end of Now.**
  - [pro] Late questions stop costing a full revision, before v1.0.0.
  - [con] One more feature in **Now**.
  - Why recommended: it changes the workflow's core table, which v1.0.0 fixes in place.
- **B. The same new draft, linked from the end of Next.**
  - [pro] **Now** stays as it is.
  - [con] Late questions keep costing revisions until then.

**Answer:**

## Q20: Where should the review of past session transcripts go?

The note is "Generally we should take a look at all session transcripts so far and check if our
prompts behaved properly.", with its example.

The [Worker lifecycle](drafts/worker-lifecycle.md) draft came from such a review, focused on stalls.
This note asks for the same on the prompts: where the skill led agents astray.

Why it matters: the transcripts are the only evidence of how the skill behaves, short of the
benchmarks.

- **A (recommended). Make a new draft, "Review past sessions against the skill", with the note,
  linked from the end of Next.**
  - [pro] Evidence for skill fixes, before the benchmarks exist.
  - [con] Its findings arrive after v1.0.0.
  - Why recommended: **Now** is full, and the benchmarks in **Next** need the same groundwork.
- **B. The same new draft, linked from the end of Now.**
  - [pro] Skill fixes land before v1.0.0.
  - [con] One more item in **Now**.

**Answer:**

## Q21: Where should the idea of writing files in two passes go?

The note is "Should we split the files in two:…": the agent first writes freely, then extracts a
readable document for the human.

It is an untested idea, and it doubles the writing of every file. Only a benchmark could show
whether it helps. The benchmarks are blocked, in **Next**.

Why it matters: it would change how every step writes, so it needs evidence first.

- **A (recommended). Move the note to the end of Later.**
  - [pro] Kept, out of the way until benchmarks can test it.
  - [con] Later may get dropped.
  - Why recommended: it cannot be judged without benchmarks.
- **B. Move the note under the Benchmarks entry of Next.**
  - [pro] Tied to the work that can test it.
  - [con] That entry already holds two sub-points.
- **C. Keep it in the inbox.**
  - [pro] Stays in sight.
  - [con] The inbox does not empty.

**Answer:**

## Q22: Should the two decision notes become a decisions pass draft?

The notes are "We need a "check decisions coherence" option, like "inbox triage"…", with its
sub-point, and "Decisions are hard to read and too long, will need a pass".

The first is a new skill step, like this triage: it reads the constitution and every decision, and
raises the conflicts as questions. The second is about the decisions themselves, this project's 20
and the format the skill writes.

Why it matters: decisions bind every step, so unreadable or conflicting ones mislead every agent.

- **A (recommended). Make a new draft, "Decisions pass", with both notes, linked from the end of
  Next.**
  - [pro] The coherence check and the readability pass are designed together.
  - [con] Unreadable decisions stay until after v1.0.0.
  - Why recommended: the coherence check is a new feature, and **Now** holds v1.0.0.
- **B. The same new draft, linked from the end of Now.**
  - [pro] Readable decisions before v1.0.0.
  - [con] One more item in **Now**.

**Answer:**

**Notes:**
