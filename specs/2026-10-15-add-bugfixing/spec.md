---
status: approved
revision: 2
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Add a bugfixing/low impact change flow

> [!NOTE]
>
> Approved on 2026-10-15.
>
> - **C1: done.** A "New change" row in the sidebar opens a composer page, `/changes/new`, like "New
>   chat". There is no draft and no line in the priorities first. What you type becomes the change's
>   proposal. "Start the change" creates its branch and worktree, opens its page, and sends the
>   agent its first run in one press.
> - **C2: done.** The draft editor's "Start as" choice is gone. The composer is the change's start,
>   on a page as small as a new chat's. A draft still starts as a change with `ura start --change`,
>   which is how a chat's agent starts one.
> - **Your question: the fastest first message in today's UI.** It reuses the new chat's page: the
>   same composer, with its images, Enter to send, and a slug field under it, filled from the first
>   line. The agent runs at once, since you wrote the request yourself. A feature's hand-over
>   instead leaves its message unsent for review.
> - **A new view.** The composer page is mocked up at both widths, as the UI layout decision asks.

> [!NOTE]
>
> Changes requested on 2026-10-15: Evaluate my comments: what's the best way to type this first
> message in a way that feels smooth and fast, in the current UI?
>
> - **A chat with a light structure on top**, as your notes ask. A change is a proposal, optional
>   rounds of questions, then the code and a pull request, all in one session. There is no spec,
>   plan, or assessment, and no file of the agent's own: its investigation goes in its commits, its
>   pull request, and its record.
> - **Bugs become changes.** `specs/bugs/`, `fix/` branches, `report.md`, `assessment.md`, and
>   `bug.md` go away, replaced by `specs/changes/`, `change/` branches, and a `change.md` reference.
>   A project that has a `specs/bugs/` folder from `ura init` gets a `ura check` problem that says
>   how to rename it.
> - **Decision changes inside a change.** As your Q4 answer asks, a change may change an active
>   decision. The agent writes the proposed change, and you approve it in a round before the pull
>   request. A brand-new decision still means an upgrade. On your question: the skill says decisions
>   "change over time", but not that changing one is normal work. `change.md` now says so.
> - **The upgrade.** I read Q5's answer as postponing. Before the merge, the agent reverts the code
>   the change has committed, so the default branch gets only the folder. If only one item of a
>   batch must upgrade, it is split out into a new draft instead.
> - **Three decisions change, in wording only.** UI checks lets a UI test guard a change's proposal.
>   Attachments and CLI say "change" where they said "bug". Your Q6 answer was right: UI layout
>   needs no change.
> - **A dedicated view.** I read "the sidebar" in your Q9 answer as the session's right column, the
>   one your notes call "the right sidebar". A change's page is its session. The column shows its
>   step, its round or pull request, the changed files, and its files. The left sidebar only adds a
>   "Change" tag.
> - **The UI iteration draft.** It is on `main` as you asked (`84ebda6`), in Now, after this
>   feature.
> - **Risk tier `medium`.** It renames a folder kind that users' projects may hold, and changes
>   `ura start`, the core's step table, and the web UI. The plan does not wait for your review.

A change is the light flow for bug fixes and small changes. The human types the request in a "New
change" composer, and starts it. In the change's own worktree, the agent investigates, asks only
what the human must decide, makes the change with tests that fail first, has a fresh reviewer check
it, and opens a pull request. A change that turns out too big is offered as a feature. It replaces
the unused bug flow, and gives the small changes that went straight to `main` a light path with a
record, tests, and a review. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## User stories

### US1: Type a change, and get a pull request (P1)

From the sidebar's "New change", the human types the bug or the change in a composer, as they would
start a chat, and starts it. In the change's worktree, the agent investigates, makes the change with
its tests, has the diff reviewed, and opens the pull request, without stopping when it has nothing
to ask.

Why this priority: it is the light flow itself, and replaces both the unused bug flow and the direct
commits to `main`.

Acceptance scenarios:

1. **Given** the web UI at 1440 × 900 on 2026-10-16, **When** the human presses "New change" in the
   sidebar, types "Centre the x in failure circles", a blank line, and "In failures the x sits low
   in its circle.", keeps the slug `centred-x` proposed under the composer, and presses "Start the
   change", **Then**:
   - the branch `change/2026-10-16-centred-x` exists, checked out at
     `.worktrees/2026-10-16-centred-x/`;
   - it holds `specs/changes/2026-10-16-centred-x/proposal.md`, reading
     `# Centre the x in failure circles`, a blank line, and "In failures the x sits low in its
     circle.";
   - Now's entry reads
     `[Centre the x in failure circles](/specs/changes/2026-10-16-centred-x/proposal.md)`;
   - `/f/2026-10-16-centred-x` opens, its agent running with the message "/uraeda:uraeda Continue
     the change specs/changes/2026-10-16-centred-x/ on branch change/2026-10-16-centred-x:
     Investigate it, then make the change, starting with skills/uraeda/references/change.md. Stop
     when the pull request is ready for review, and earlier only if you need a decision from me."
2. **Given** the composer holding two pasted screenshots, **When** the human starts the change,
   **Then** the proposal ends with links to both, `![Image 1](images/image-1.webp)` and
   `![Image 2](images/image-2.webp)`, committed in the change's `images/` folder.
3. **Given** the draft `specs/drafts/centred-x.md`, **When** the human or an agent runs
   `ura start centred-x --slug centred-x --change`, **Then** the same branch, worktree, and entry
   exist, with the draft moved unchanged as the proposal, and `ura` prints `Next: change`.
4. **Given** a started change whose proposal leaves nothing for the human to decide, **When** its
   agent runs, **Then** no file of the change has `status: awaiting-human` before its draft pull
   request exists, and its folder holds no `spec.md`, `plan.md`, or `discovery-01.md`.
5. **Given** a change that fixes a bug, **When** the agent commits the fix, **Then** the commit
   holds a test that fails on the commit before it. The commit's body states the root cause and the
   behaviour that stays unchanged.
6. **Given** a proposal listing three related tweaks to the sidebar, **When** the agent makes them,
   **Then** the branch has one commit per tweak, each with its own test, and one pull request.
7. **Given** every item is committed, **When** the agent finishes, **Then** it has caught up with
   the default branch, a fresh reviewer has reviewed the whole diff, and
   `specs/done/2026-10-16-centred-x.md` has `kind: change`. The pull request is marked ready, and
   its description opens with "Pull request to review, about 5 minutes." It lists the points the
   agent settled, the size of each function and file it grew, and the minor findings left.
8. **Given** a change session stopped halfway, after two of three items were committed, **When**
   another session runs `ura next centred-x`, **Then** it prints the step `change`, and the agent
   continues from the commits on the branch.

### US2: Answer the questions a change needs (P1)

When the proposal leaves open something the human would notice in the result, or the change needs a
change to an active decision, the agent asks in a round of questions. The human answers it as they
answer any round, and the agent continues.

Why this priority: without it, the light flow would either guess or stop being light.

Acceptance scenarios:

1. **Given** the change `header-logo`, whose proposal does not say what the header drops at 402 px,
   **When** its agent finds there is no room, **Then** it commits
   `specs/changes/2026-10-16-header-logo/clarifications-01.md` with `status: awaiting-human` and one
   question, with a recommended answer. It commits no `discovery-01.md`, and `ura next header-logo`
   names the human gate on that file.
2. **Given** that round answered, **When** the agent runs again, **Then** the step is `change`, and
   the agent continues from the answer.
3. **Given** a change that needs one rule of the [UI behaviour](/specs/decisions/ui-behaviour.md)
   decision changed, **When** the agent finds it, **Then** the same commit adds a
   `## Proposed change (2026-10-16-header-logo)` section to that decision and a round question
   asking to approve it, with "A (recommended). Approve the change" first, before any pull request.
4. **Given** that question answered "A", **When** the agent runs, **Then** it replaces the
   decision's text with the proposed change, sets `approved-by` to the human, and commits with
   `decision(header-logo): apply ui-behaviour`. Then it continues.
5. **Given** that question answered "B", which keeps the decision, **When** the agent runs, **Then**
   it removes the proposed change section and makes the change within the decision as it is.

### US3: Upgrade a change that turns out too big (P2)

When a change needs more than the light flow allows, its agent stops and offers to make it a
feature. Accepting makes it a draft folder in Now, which the human starts as a feature.

Why this priority: the light flow can only stay light if the big cases can leave it.

Acceptance scenarios:

1. **Given** the change `tasks-export`, which needs a new field in a file format users already have,
   **When** its agent finds it, **Then** it commits `clarifications-01.md` with
   `status: awaiting-human` and the question "Make this change a feature?", whose option A is the
   upgrade, and names the reason: "It changes the format of `PRIORITIES.md`, which every project
   has".
2. **Given** that question answered "A", and no code committed on the branch, **When** the agent
   runs, **Then** the branch's last commit moves the folder to `specs/drafts/tasks-export/`, with
   `proposal.md` and `clarifications-01.md` unchanged. It relinks Now's entry to
   `drafts/tasks-export/proposal.md`, and is committed as
   `chore(tasks-export): upgrade to a feature`. The branch is merged into the default branch, and
   `ura status` no longer lists the change.
3. **Given** the same answer, with two code commits on the branch, **When** the agent runs, **Then**
   one commit reverts them before the move, and the default branch's code is the same after the
   merge as before it.
4. **Given** a batch of three tweaks where the second needs a new view, **When** the agent finds it,
   **Then** the round offers to split it out. On "A", the agent writes `specs/drafts/<slug>.md` on
   the default branch from the tweak's text, adds it under the change's entry in Now, and makes the
   other two tweaks.
5. **Given** three fixes that each failed the reproduction test, **When** the third fails, **Then**
   the agent stops and asks the upgrade question, naming what it tried.

### US4: Follow a change on its own page (P2)

A change's page is its session: the transcript in the middle, and a column beside it with the
change's step, its round or pull request, the files changed on its branch, and its files. In the
left sidebar, a change's row carries a "Change" tag.

Why this priority: the web UI is where the human runs agents, and a change is mostly a session.

Acceptance scenarios:

1. **Given** the change `centred-x`, its agent working, at 1440 × 900, **When** the human opens
   `/f/2026-10-16-centred-x`, **Then** its session page shows, with the heading "Centre the x in
   failure circles". The column shows these sections, in order:
   - "Change", with "The agent is working.";
   - "Changed on the branch";
   - "Files", listing `proposal.md`.

   The column shows no plan and no "Feature page".

2. **Given** `header-logo` waiting on `clarifications-01.md` with one question, **When** its page
   opens, **Then** the column's first section is "Answer questions". It holds a row "Questions,
   round 01" with "1 question", which opens the round in the existing clarifications view at
   `/f/2026-10-16-header-logo/clarifications-01.md`.
3. **Given** `centred-x` finished, with the pull request `#31` marked ready, **When** its page
   opens, **Then** the column's first section is "Pull request", holding "Pull request #31", linked
   to the pull request. "Files" lists the record `2026-10-16-centred-x.md`.
4. **Given** the sidebar at 1440 px wide, **When** it lists `centred-x` among "Agents at work",
   **Then** its row reads `centred-x` with a "Change" tag. Its accessible name is "centred-x, Centre
   the x in failure circles, change, Working", and it opens `/f/2026-10-16-centred-x`.
5. **Given** a phone, 402 × 874, **When** `header-logo`'s page opens, **Then** the progress line
   reads "Answer questions · 1 question" above the transcript. Pressed, it opens the column's
   content in place.
6. **Given** `/f/2026-10-16-centred-x/session`, **When** it opens, **Then** it shows the same page
   as `/f/2026-10-16-centred-x`.

### US5: Chats know about changes (P3)

In a chat on the main checkout, when the human asks for a code change, the agent offers to start it
as a change rather than committing to the default branch. Typos, formatting, and comments stay in
the chat.

Why this priority: chats are how the human made small changes so far; the light flow should catch
them without taking the chat away.

Acceptance scenarios:

1. **Given** a chat on the main checkout, **When** the human writes "the x in failure circles is not
   centred, fix it", **Then** the agent answers with what it would start: the draft's title, its
   text in the human's words, and the slug. It asks whether to start it as a change, and changes no
   file before the human says yes.
2. **Given** the human says yes, **When** the agent acts, **Then** it commits the draft on the
   default branch and starts it with `ura start <draft> --slug <slug> --change`, or by hand. Then it
   says to open `/f/<folder>`, where the change's own session runs.
3. **Given** a chat asking to fix a typo in `README.md`, **When** the agent acts, **Then** it fixes
   it in the chat, as today.

## Edge cases

- **A draft with only its title.** It starts as a change like any draft. The agent asks what it
  needs in a round.
- **A bug that does not reproduce.** The agent asks in a round, saying what it tried and what it
  needs, as `bug.md` did.
- **A proposal asking for new behaviour that a spec or record contradicts.** That is a change of
  approved behaviour beyond the proposal, so the agent offers the upgrade (US3).
- **A proposal edited by the human between two runs.** The agent reads it as it is at its next run.
- **A change growing a function or file past a limit of the
  [code-quality](/specs/decisions/code-quality.md) decision.** A structural commit splits it first,
  as in a feature. A new lint marker is a reason to upgrade.
- **A change that needs a constitution exception.** The agent offers the upgrade, since only a plan
  can carry its approval.
- **A change touching what the constitution says to benchmark.** It records a baseline before the
  change, and compares after it, in its pull request.
- **Changes requested on the pull request.** Handled as for a feature, by the shared steps.
- **An upgrade question answered with another option.** The agent keeps the change within that
  answer, or stops if the answer leaves nothing to do, saying so in the session.
- **A project with a `specs/bugs/` folder.** `ura check` reports "specs/bugs/ is no longer used:
  bugs are changes. Move its folders to specs/changes/, and delete it if empty." The core ignores
  the folder.
- **A branch `fix/<folder>` or `change/<folder>` without its folder or record.** It is not a change,
  as today for branches without a folder. The old remote `fix/` branches no longer show anywhere.
- **Starting a change when the folder or branch name is taken.** The same refusal as for a feature,
  under the slug field, and the composer keeps its text.
- **An empty composer.** "Start the change" is disabled until it holds text.
- **No agent on this machine.** "Start the change" starts it, and its page opens with the workflow's
  message in its composer, unsent, as a feature's hand-over does.
- **Leaving the composer page before starting.** Its text is kept as a new chat's is, and comes back
  when "New change" opens again.
- **A change's session opened from a chat.** The chat stays a chat. The change has its own session,
  since an item has one session.
- **A file in a change's folder that the light flow does not use**, like `spec.md`, `plan.md`,
  `discovery-01.md`, `report.md`, or `assessment.md`. `ura check` reports it, naming the files a
  change's folder holds.

## Success criteria

- **SC-001**: A change whose proposal leaves nothing to ask goes from its start to a ready pull
  request with one human action left: the review of the pull request. Checked by the core's step
  sequence over the change's states in a test.
- **SC-002**: Starting a change with its agent takes two clicks and the typing, from any page: "New
  change", then "Start the change", or Enter in the composer on wide screens.
- **SC-003**: A change's folder holds only `proposal.md`, `clarifications-NN.md`, `rulings.md`,
  `images/`, and `screenshots/`. Checked by `ura check`.
- **SC-004**: The skill's change reference, `change.md`, is shorter than the
  [feature flow's references](/skills/uraeda/references/) it replaces for a change: discovery, spec,
  plan, and implementation together.

## Architecture

The light flow is a second kind of item next to the feature, sharing everything but its first steps:

- a proposal from a draft;
- rounds of questions;
- a session;
- the pull request's steps, the finish step, records, and `ura clean`.

The light flow adds no file of its own. A change differs from a feature in its folder
(`specs/changes/`), its branch prefix (`change/`), its step table, its reference (`change.md`), and
how the web UI shows it ([one flow or two](discovery-01.md#one-flow-or-two),
[names](discovery-01.md#names-of-the-light-flow)).

**Where each rule lives**:

- **The skill**, `skills/uraeda/references/change.md` (new, replacing `bug.md`), owns the flow's
  rules:
  - what a change is;
  - when the agent asks;
  - when it offers an upgrade, and how;
  - tests, the review, and the pull request.

  The [CLI decision](/specs/decisions/cli.md) requires the skill to carry every rule the tools
  follow.

- **The core** owns the mechanics:
  - the item's kind, from its branch and folder, in `workspace.rs`;
  - the step table, in `steps.rs`, with `change_step` replacing `bug_step`;
  - which files a change's folder may hold, in `check/`;
  - starting a change from a typed text or a draft, in `actions/start.rs`.

  The first file of every item is now `proposal.md`, which removes the three places that chose
  between `proposal.md` and `report.md`.

- **The server** owns the change's message to its agent, in
  [`message.ts`](/packages/server/src/runner/message.ts).
- **The web UI** only draws what the core says: the "Change" tag, the change's column, the "Start
  as" choice, and the route that makes a change's page its session.

**Why no file of the agent's own.** Your notes ask for "a chat with a light structure on top".

- **What carries the investigation.** It lives in the commits: the body of each code commit states
  the root cause or approach, and what stays unchanged. A resumed agent reads them with `git log`,
  which is how [principle III](/specs/CONSTITUTION.md#iii-asynchronous-by-default) is met.
- **What the human reads.** The pull request's description and the record.
- **When a file waits on the human.** Only when there is something to decide: a round of questions.

**Tradeoffs:**

- Without an assessment file, a wrong reading of the proposal shows only at the pull request. The
  description lists the points the agent settled, so it is checked there
  ([Q3](clarifications-01.md#q3-does-the-agent-stop-for-you-before-writing-code)).
- Renaming bugs to changes breaks `specs/bugs/` folders in users' projects, which hold only a
  `.gitkeep` from `ura init`, since no real bug ever used the flow. `ura check` names the fix.
- `read_feature` in [`workspace.rs`](/crates/core/src/workspace.rs) and
  [`actions/start.rs`](/crates/core/src/actions/start.rs) are at their limits. Each gets a
  structural split before it grows
  ([extract, don't grow](/skills/uraeda/references/code-quality.md#extract-dont-grow)).

## Mockups

All views are in one page, [change-session.html](mockups/change-session.html), each with its
caption:

1. A change's page at 1440 × 900, with its agent at work: the "Change" tag in the sidebar, and the
   column's sections.
2. The column while a round waits on the human: "Answer questions", and its round's row.
3. The column once the pull request is ready: "Pull request", and the record.
4. The phone, 402 × 874: the progress line over the transcript.
5. The "New change" page at 1440 × 900: the composer, the slug field, and "Start the change".
6. The same page on the phone, 402 × 874.

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- **The investigation.** It follows the old bug flow's rules for a bug: reproduce, a failing test,
  the root cause, one hypothesis at a time. For a change, it reads the code, the decisions, and the
  dependencies' docs, without comparing products online. This is the `low` discovery effort,
  whatever the proposal's `discovery` field says. That field matters again if the change is
  upgraded.
- **What stays unchanged.** Tests check it, and each commit's body states it.
- **Tests.** A test fails first for the bug or the new behaviour, and checks of preserved behaviour
  keep passing. The proposal's expected behaviour stands for the acceptance scenarios of
  [principle VI](/specs/CONSTITUTION.md#vi-code-is-checked-and-stays-maintainable).
- **Questions.** They go in rounds, `clarifications-NN.md`, shown in the existing clarifications
  view. Your note asks for a link in the right column, which US4 gives.
- **Code quality.** The code-quality decision applies as it is. A new marker or a constitution
  exception means an upgrade.
- **Before the review.** The agent catches up with the default branch.
- **Rulings.** They go in `rulings.md`.
- **The record and the entry.** A short record is written with `kind: change`, and the change's
  entry is removed from `PRIORITIES.md`.
- **Now.** A change gets its entry there, like a feature.
- **Just-do-it edits.** Typos, formatting, and comments stay outside any flow.
- **The scratchpad** owns capture and triage. A note is started as a change through a draft.
- **Images.** They attach to a change's folder.
- **The UI iteration research.** It stays in [discovery](discovery-01.md#visual-iteration-on-ui),
  for the draft written on `main`.

Settled while writing this spec:

- **The proposal, not a request template.** A change starts from a draft, so its first file is the
  draft moved unchanged as `proposal.md`, as for a feature. The clarifications settled on one
  request template instead. With the same file name, there is one rule for both kinds, and one place
  to write a draft. For a bug, `change.md` lists what the agent needs, what happens, what should
  happen, and how to see it, and asks in a round for what is missing.
- **Rounds without a discovery file.** A change's round writes `clarifications-NN.md` alone. Its
  Context section carries what the agent found, so the human reads one file.
- **No gate for the agent's investigation.** Per Q3's answer, the agent stops only for a round. The
  worktree is always used
  ([Q3](clarifications-01.md#q3-does-the-agent-stop-for-you-before-writing-code)): the change's
  session works in `.worktrees/<folder>/`, as a feature's does under the
  [agents](/specs/decisions/agents.md) decision.
- **What makes the agent stop.** From
  [Q4](clarifications-01.md#q4-when-is-a-change-too-big-for-the-light-flow)'s answer, it asks in a
  round for:
  - intent the human would notice that the proposal leaves open;
  - a change to an active decision, to approve.

  It offers the upgrade for:
  - a new decision;
  - data users already have;
  - a public interface, such as a CLI flag, a file format, or the API;
  - approved behaviour changed beyond what the proposal names;
  - a new view;
  - a constitution exception, or a new lint marker;
  - three failed fixes.

  The size goes in the pull request, never as a stop.

- **Decisions are the human's intent, and they change.** `change.md` says so, in its section on
  decisions. A change to an active decision is normal work, approved in a round
  ([Q4](clarifications-01.md#q4-when-is-a-change-too-big-for-the-light-flow)'s note).
- **The upgrade.** It postpones the folder, as
  [Q5](clarifications-01.md#q5-what-happens-when-you-accept-an-upgrade-to-a-feature) answers.
  - Committed code is reverted first, so the merge brings only the folder.
  - A batch splits out the one item that must upgrade, as a draft on the default branch.
  - The [git](/specs/decisions/git.md) decision says drafts are written on the default branch.
- **The review.** It is one fresh reviewer on the whole diff, with no per-item reviews
  ([Q7](clarifications-01.md#q7-how-much-review-does-a-light-change-get-before-its-pull-request)).
- **The change's page.** `/f/<folder>` is its session page, and `/f/<folder>/session` opens the same
  page. Its heading is the change's title, with no crumbs, since it has no other page to go back to.
- **The "Change" tag** is the only mark in the left sidebar. The groups stay as they are, so what
  waits on the human comes first, whatever its kind.
- **"New change"** is a row of the sidebar, after "Priorities", outside a search. It opens
  `/changes/new`, a page shaped like a new chat's: the heading "New change", the line "Describe the
  bug or the change. The first line is its title.", the chat's composer with its images, and a slug
  field under it. The core proposes the slug from the first line, as `ura start` does from a draft's
  name, until the human edits it. The page reads best as one column: it holds one field to type in,
  like a new chat, at both widths.
- **The first line is the title.** The proposal is `# <first line>`, then the rest of the text as
  typed, then the images, each `![Image N](images/image-N.webp)`, re-encoded by the core into the
  change's `images/` folder, as the [attachments](/specs/decisions/attachments.md) decision
  requires. A first line longer than 80 characters is cut there for the title, and kept whole in the
  text below it.
- **The agent runs at once.** The human wrote the request, so the change's first run is sent, not
  left in the composer for review as a feature's hand-over is.
- **Drafts in the UI stay features.** The draft editor and the priorities' task view keep "Start the
  feature" alone. A draft becomes a change with `ura start --change`, or by asking an agent.
- **The CLI** gets `ura start --change`, and no command of its own. Editors reach changes through
  the core only: the LSP's start command still starts features
  ([Q9](clarifications-01.md#q9-how-much-tooling-does-this-feature-build)).
- **Chats** learn about changes from the skill, which every session loads. No new message is needed.
- **The example.** The skill's example bug becomes the example change
  `assets/example/specs/changes/2026-10-14-tasks-reappear/proposal.md`, made from its report. It
  waits on its agent.
- **Removals.** The bug templates, `assessment-review.md`, and assessment reviews in the core, the
  CLI, the LSP, and Neovim are removed.

## Decisions

Changed, applied when this spec is approved:

- [UI checks](../decisions/ui-checks.md): a UI test may guard the expected behaviour of a change's
  proposal, and a change's screenshots go in its folder. See its
  [proposed change](../decisions/ui-checks.md#proposed-change-2026-10-15-add-bugfixing).
- [Attachments](../decisions/attachments.md): "a change's folder" where it said "a bug's". See its
  [proposed change](../decisions/attachments.md#proposed-change-2026-10-15-add-bugfixing).
- [CLI](../decisions/cli.md): commands act on "a feature, a change, a draft, or a workflow file".
  See its [proposed change](../decisions/cli.md#proposed-change-2026-10-15-add-bugfixing).

Relied on:

- [Agents](../decisions/agents.md): a change has one session, working in its worktree, and each run
  carries its step and reference.
- [Git](../decisions/git.md): `ura start --change` writes through a worktree at
  `.worktrees/<folder>/`. Drafts are written on the default branch. Branches are deleted only by
  `ura clean`, after the merge.
- [Code quality](../decisions/code-quality.md): the structural splits come first, and no marker is
  added.
- [UI layout](../decisions/ui-layout.md): the change's page is a page the human follows, with its
  foldable column at both widths. A new view is an upgrade, so a change never needs a view's spec.
- [UI components](../decisions/ui-components.md): the tag, the choice, and the column are Astryx's
  components.
- [Stack](../decisions/stack.md): the core owns every rule, and the web UI only draws them.

## Constitution check

| Principle                                  | Complies | Notes                                                                                            |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| I. Humans stay in control                  | yes      | The proposal is the approved scope. Decision changes and upgrades wait for the human's answer.   |
| II. Git and plain text first               | yes      | Proposals, rounds, commits, and records, all in git.                                             |
| III. Asynchronous by default               | yes      | Every step ends with a commit, and commit bodies carry the investigation for a resumed agent.    |
| IV. Review effort matches impact           | yes      | One review, the pull request, unless the agent has a question.                                   |
| V. Tools are optional                      | yes      | `change.md` describes every step by hand. The tools follow it.                                   |
| VI. Code is checked and stays maintainable | yes      | Tests that fail first, a fresh reviewer, and the limits. Exceptions and markers mean an upgrade. |

## Risk tier

**Medium**: it renames a folder kind that users' projects may hold, and changes `ura start`, the
core's step table, and the web UI, with no data to convert.

## Details

### Data

- **`Kind`**, in the core: `Feature` or `Change`, replacing `Bug`.
  - From a branch: `change/<folder>` is a change, and a dated name alone is a feature.
  - From a folder: `specs/changes/<folder>/` or `specs/<folder>/`.
  - From a record: `kind: change` or `kind: feature`.

  The binding's `FeatureView.kind` is `"feature"` or `"change"`.

- **A change's folder** holds `proposal.md`, `clarifications-NN.md`, `rulings.md`, `images/`, and
  `screenshots/`. Its rounds follow the clarifications template, with no discovery file. Anything
  else is a `ura check` problem.
- **`StepName`** drops `assess`, `assess-revision`, and `fix`, and gains `change`, with its
  reference `skills/uraeda/references/change.md`. `FileKind` drops `Report` and `Assessment`.
- **The change's step table**, first match:
  1. `proposal.md` is not committed: a human gate.
  2. The record and the pull request: the shared rows, as for a feature.
  3. A file has `status: awaiting-human`: a human gate on it.
  4. Otherwise, the shared tail: `change` until the draft pull request exists, then `finish`, then
     the pull request's gates.
- **`ura start <draft> --change`**:
  - it starts the draft as `change/YYYY-MM-DD-<slug>`, in `.worktrees/YYYY-MM-DD-<slug>/`;
  - the folder is `specs/changes/YYYY-MM-DD-<slug>/`;
  - the commits are those of a feature: `chore(<slug>): start <name>` on the default branch, and
    `chore(<slug>): proposal` on the change's branch;
  - the `--json` read of `ura status` gains no version, since `"change"` is a new value.
- **The record** of a change uses the record template:
  - `kind: change`;
  - What and why;
  - Behaviour: what was fixed or changed;
  - Design: the root cause or approach, and the code it touched;
  - its questions, when it had rounds.
- **The pull request's description**, in this order:
  1. its first line, with the time to review it;
  2. the root cause or approach;
  3. what stays unchanged, and the test of each item;
  4. the points the agent settled;
  5. the size of each function and file it grew;
  6. the screenshots of a UI change;
  7. the rulings;
  8. the minor findings.

### Components

- **The change reference** (`skills/uraeda/references/change.md`, new, replacing `bug.md`). Its
  sections:
  - What a change is: a bug, or a small change to behaviour or UI.
  - Starting one: from a draft, by hand or with `ura start --change`; from a chat, with the human's
    yes.
  - The step table.
  - Investigating: a bug against a change.
  - When to ask, and when to offer the upgrade, with the criteria above.
  - Decisions: the human's intent, changed through an approved round.
  - Making the change: tests first, one commit per item, and each commit's body.
  - The review.
  - The pull request and the finish step.
  - The upgrade.
  - Rulings.
- **Updates to the rest of the skill**:
  - [`SKILL.md`](/skills/uraeda/SKILL.md): its layout, its table's link to `change.md`, and a rule
    for chats: offer a change for a code change, keep just-do-it edits.
  - [`conventions.md`](/skills/uraeda/references/conventions.md): its status table, branches, and
    commit types. `assessment:` goes, and `decision(<slug>):` is used by changes too.
  - [`projects.md`](/skills/uraeda/references/projects.md): `ura init` creates `changes/`, and
    starting a draft as a change.
  - [`finish.md`](/skills/uraeda/references/finish.md): the `change` kind.
  - [`implementation.md`](/skills/uraeda/references/implementation.md): its link to the root cause
    rules, now in `change.md`.
  - [`cli.md`](/skills/uraeda/references/cli.md): `ura start --change`, and the line on bugs goes.
  - [`README.md`](/README.md) and both `specs/README.md` files, the project's and the template's:
    the layout, and the light flow in a paragraph.
- **The templates**: `assets/templates/specs/bugs/` is removed, and the record template's `kind`
  reads `[feature | change]`. The example's bug becomes the example change, and the example's
  `PRIORITIES.md` links it.
- **The core** ([`crates/core`](/crates/core/)):
  - [`workspace.rs`](/crates/core/src/workspace.rs): the kinds, the branches, the folders, and the
    first file. `read_feature` is split first.
  - [`steps.rs`](/crates/core/src/steps.rs): `change_step`.
  - [`check/`](/crates/core/src/check/): a change's folder files, the `specs/bugs/` message, and no
    assessment template.
  - [`actions/start.rs`](/crates/core/src/actions/start.rs), after a structural split: the kind to
    start a draft as, and starting a change from a typed text and its images, with the slug proposed
    from its first line.
  - [`actions/init.rs`](/crates/core/src/actions/init.rs): `changes/`.
  - [`actions/clean.rs`](/crates/core/src/actions/clean.rs): the `change/` branch.
  - [`actions/review.rs`](/crates/core/src/actions/review.rs): no assessment.
  - [`api.rs`](/crates/core/src/api.rs): a kind for starting, and no report.
  - [`view.rs`](/crates/core/src/view.rs): `kind`.
- **The CLI** ([`crates/cli`](/crates/cli/)): `start --change`, and `status` showing
  `change/<folder>`.
- **The binding**: `startFeature(draft, slug, kind)`, `startChange(text, images, slug)`, and
  `proposeSlug(title)`.
- **The LSP and Neovim**: `bugs/` becomes `changes/`, and the assessment's verdict and the report's
  commit go.
- **The server** ([`packages/server`](/packages/server/)):
  - [`message.ts`](/packages/server/src/runner/message.ts): the subject "change
    specs/changes/<folder>/"; the step `change`, whose work is "Investigate it, then make the
    change" and whose stop is "the pull request is ready for review"; and the chat's opening, "about
    the change ...".
  - A `change.start` mutation: it starts the change from the composer's text and images, then sends
    its first run through the runner, as the composer's send does, and returns the change's folder.
  - [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts): `specs/changes/` paths.
- **The web UI** ([`packages/web`](/packages/web/)):
  - **The routes**: a change's `/f/<folder>` draws its session page, and
    `specs/changes/<folder>/x.md` links open `/f/<folder>/x.md`.
  - **[`SessionAside.tsx`](/packages/web/src/SessionAside.tsx)**: for a change, its first section is
    the step's title:
    - with its round's row, "Questions, round NN" and "N question(s)";
    - with its pull request's row, "Pull request #N", from the record's `pull-request`;
    - or "The agent is working." while the step waits on the agent, and nothing otherwise.

    Then come "Sub-agents", "Changed on the branch", with "Nothing outside the change's folder
    yet.", and "Files": the folder's files, or the record once finished.

  - **[`SessionNav.tsx`](/packages/web/src/SessionNav.tsx)**: Astryx's badge, "Change", on a
    change's row. Its accessible name is "<slug>, <title>, change, <status>".
  - **[`ProgressLine.tsx`](/packages/web/src/ProgressLine.tsx)**: for a change, the step's title,
    with "N question(s)" on a round.
  - **`NewChangePage.tsx`** (new): the "New change" page, at `/changes/new`, built from the chat's
    [`Composer.tsx`](/packages/web/src/Composer.tsx) and
    [`SlugField.tsx`](/packages/web/src/SlugField.tsx). Its send button reads "Start the change".
    Under it, the line "Creates its branch and worktree, and adds it to Now. The agent asks only
    what it must, then opens a pull request." Once started, it navigates to `/f/<folder>`.
  - **[`SessionNav.tsx`](/packages/web/src/SessionNav.tsx)**, again: the "＋ New change" row.
  - **[`labels.ts`](/packages/web/src/labels.ts)**: the step label "Change", and no assessment or
    report.

### Error handling

- **Starting a change fails** because its folder or branch exists, or the default branch has moved.
  The page shows the same messages as starting a feature, under the slug field, and keeps the text.
- **An image the core refuses**, by its type or size. The composer shows the attachments decision's
  refusal, as it does for a chat, before the change starts.
- **The upgrade's merge into the default branch conflicts.** The agent stops and asks in the
  session, as postponing a feature would. It never forces the merge.
- **The pull request's number cannot be read** before the record exists. The column shows the step's
  title alone.
- **A `specs/bugs/` folder**: `ura check`'s message, as in [Edge cases](#edge-cases).

### Testing

The Rust tests run the core on fixture repositories with branches and worktrees, as the feature
flow's tests do. The CLI tests run `ura` on them. The server tests use the fake agent adapter. The
web UI's browser tests drive the app in WebKit at both sizes, on a fixture repository holding a
change in each state.

| What                                              | Test                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| US1.1, SC-002, the composer's edge cases          | Browser test: type a change and start it, counting clicks, on the fake agent                         |
| US1.2, an image refused                           | Browser test: a change started with two images, and one refused                                      |
| US1.3                                             | CLI test: `ura start --change` on a fixture draft                                                    |
| US1.4, US1.8, US2.1, US2.2, SC-001                | Core steps test: the change table over every state of a fixture change                               |
| US1.5–US1.7, US2.3–US2.5, US3.1–US3.5, US5        | Checked by review of `change.md` and of the example, the agent's own behaviour                       |
| US1.1's message                                   | Server test: `runMessage` and `chatOpening` for a change, and `change.start` sending it              |
| The proposal from a typed text                    | Core start test, table-driven: one row per text, title, and slug proposed                            |
| US4.1–US4.6                                       | Browser tests: the change's page, column, sidebar row, phone line, and routes, in each fixture state |
| SC-003, the folder's extra files                  | Core check test, table-driven: one row per file a change's folder may or may not hold                |
| `specs/bugs/`, branches without their folder      | Core workspace and check tests                                                                       |
| The kinds of records and `ura clean` on `change/` | Core record and clean tests                                                                          |
| SC-004                                            | Checked by review: the line counts in the pull request                                               |
| Layout and axe checks                             | The UI checks decision's runs, with the change's page added                                          |
