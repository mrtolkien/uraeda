---
kind: feature
finished: 2026-10-15
pull-request: https://github.com/mrtolkien/uraeda/pull/19
---

# Record: Add a bugfixing/low impact change flow

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-15, finished on
> 2026-10-15, in [its pull request](https://github.com/mrtolkien/uraeda/pull/19). Its full files are
> in git: `git log -- specs/2026-10-15-add-bugfixing/`.

## What and why

A light flow for bug fixes and small changes, shorter than the feature flow but with the same code
quality: no questions or spec by default, and an offer to upgrade a change that turns out too big.
With the full flow, any small change took an hour or more with an agent, so about 24 small changes
went straight to `main` in five days with no record, tests, or review, and the agent-written bug
flow was never used. The human wanted it to "look and feel like a chat with a light structure on
top: a file as input for context, optional clarifications rounds, and then implementation and a PR".
The visual UI iteration flow the proposal also floated became its own draft,
[UI iteration flow](/specs/drafts/ui-iteration.md).

## Behaviour

- **Bugs become changes.** A change lives in `specs/changes/YYYY-MM-DD-<slug>/` on the branch
  `change/YYYY-MM-DD-<slug>`, finished into a record with `kind: change`. `specs/bugs/`, `fix/`
  branches, `report.md`, `assessment.md`, the bug templates, `bug.md`, and assessment reviews in the
  core, the CLI, the LSP, and Neovim are gone. A change's folder holds only `proposal.md`,
  `clarifications-NN.md`, `rulings.md`, `images/`, and `screenshots/`: `ura check` reports any other
  file or folder, naming those. A `specs/bugs/` folder gets "specs/bugs/ is no longer used: bugs are
  changes. Move its folders to specs/changes/, and delete it if empty." A `specs/changes/` folder
  without its `change/` branch, or a branch without its folder, is not an item.
- **Starting a change (US1).** "＋ New change", a sidebar row after "Priorities", opens
  `/changes/new`: the chat's composer with its images and Enter, a slug field under it, and "Start
  the change". The first line typed is the title, its heading marks dropped (`## Fix x` gives
  `Fix x`, `#123 crashes` stays whole) and cut at 80 characters, kept whole in the text below. The
  proposal is `# <title>`, the text, and the images as `![Image N](images/image-N.webp)`, re-encoded
  by the core. The core proposes the slug from the whole text with the drafts' rule (`centre-x` for
  "Centre the x in failure circles"); an empty slug field lets the core propose its own. One press
  creates the branch, its worktree at `.worktrees/<folder>/`, the **Now** entry, and opens
  `/f/<folder>` with its agent running; without an agent, the page opens with the message unsent. A
  taken name is refused under the slug field, and the text and images stay. The text and slug are
  kept in the browser across visits, with no "Leave page?" or restore notice; a start answered after
  the human left opens nothing and clears only the text and slug it sent. The draft editor still
  starts features only: a draft starts as a change with `ura start <draft> --slug <slug> --change`,
  which refuses a postponed feature's folder holding files a change has no place for.
- **The agent's flow (US1, US2).** It investigates (a bug: reproduce with a failing test, find the
  root cause, one hypothesis at a time; a change: the code, decisions, and dependencies' docs, the
  `low` discovery effort), makes one commit per item with a test that fails first and a body stating
  the root cause or approach and what stays unchanged, catches up with the default branch, has one
  fresh reviewer check the whole diff, and finishes as a feature does. It stops only for a round,
  `clarifications-NN.md` alone with no discovery file: intent the human would notice that the
  proposal leaves open, or a change to an active decision, proposed in a `## Proposed change`
  section and approved in the round before any pull request.
- **Upgrading (US3).** For a new decision, data users already have, a public interface, approved
  behaviour beyond the proposal, a new view, a constitution exception or new lint marker, or three
  failed fixes, the agent asks "Make this change a feature?". On "A", one commit reverts the code
  and applied decisions, the folder moves to `specs/drafts/<slug>/`, the branch merges into the
  default branch, and the agent removes its worktree and branch by hand, since `ura clean` cannot
  find it. The started feature begins with a new discovery round. One item of a batch can be split
  out as a draft instead. Size is never a reason to stop.
- **A change's page (US4).** `/f/<folder>` and `/f/<folder>/session` are its session page, headed by
  its title, with no crumbs. The column shows the step first: "Answer questions" with the round its
  step gates on ("Questions, round 01", "1 question"), "Pull request" with "Pull request #N" from
  the record's `pull-request`, or "The agent is working."; then "Sub-agents", "Changed on the
  branch", and "Files", or the record once finished; no plan and no feature page. On the phone, the
  progress line reads "Answer questions · 1 question". In the sidebar, a "Change" badge sits beside
  the row's link, whose accessible name is "<slug>, <title>, change, <status>".
- **Chats (US5).** The skill tells a chat on the main checkout to offer a code change as a change,
  with the draft's title, text, and slug, and to change no file before the human's yes. Typos,
  formatting, and comments stay in the chat.
- **Steps.** A change's table: a gate on an uncommitted `proposal.md`, the record's rows, a gate on
  any `awaiting-human` file, then `change` until the draft pull request, `finish`, and the pull
  request's gates. Without `gh`, an unknown pull request reads as none, so a fresh change is at
  `change`. A round answered after the folder came back for changes on the pull request is told
  apart only by `git log`: the skill's tables send it to make the change before finishing, and the
  core names `finish`.
- Every link text written into `PRIORITIES.md`, by `ura draft`, a start's move to **Now**, or a
  typed change, escapes `[`, `]`, and `\`.

## Design

A change is a second kind of item next to the feature, sharing proposals, rounds, the session, the
pull request's steps, the finish step, records, and `ura clean`. It differs in its folder, its
branch prefix, its step table, its reference, and its page. The agent's rules live in the skill's
[`change.md`](/skills/uraeda/references/change.md); the core owns the mechanics, and the web UI
draws what the core says. Two core files at their limits were split first.

- The kind, from the branch, the folder, and the record:
  [`workspace.rs`](/crates/core/src/workspace.rs), with
  [`workspace/paths.rs`](/crates/core/src/workspace/paths.rs) (`folder_path`, `path_folder`, the one
  home of the folder rule) and [`workspace/read.rs`](/crates/core/src/workspace/read.rs).
- `change_step` in [`steps.rs`](/crates/core/src/steps.rs).
- [`check/names.rs`](/crates/core/src/check/names.rs): `change_holds`, the files a change's folder
  may hold, read by `ura check` and by the start.
- [`actions/start/`](/crates/core/src/actions/start/): one plan for both starts
  ([`plan.rs`](/crates/core/src/actions/start/plan.rs)), the typed text's title and proposal
  ([`typed.rs`](/crates/core/src/actions/start/typed.rs)), and the commits; the API's
  `start_feature`, `start_change`, and `propose_slug` in
  [`api/start.rs`](/crates/core/src/api/start.rs); `markdown::link_text` for the escaping.
- The item's view, with its `kind`, `path`, and the record's pull request:
  [`view/feature.rs`](/crates/core/src/view/feature.rs); the binding's
  `startFeature(draft, slug, kind)`, `startChange`, `proposeSlug`, and `pathFolder` in
  [`crates/binding`](/crates/binding/src/lib.rs); `ura start --change` in
  [`crates/cli/src/start.rs`](/crates/cli/src/start.rs).
- The server: the change's run message and chat opening in
  [`message.ts`](/packages/server/src/runner/message.ts); the `change.start` mutation in
  [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts), which starts the change and sends
  its first run through `Sessions.send`, answering with the change's record even when the run fails;
  `changeImages` in [`fate/chat-images.ts`](/packages/server/src/fate/chat-images.ts); the
  `SlugProposal` read.
- The web UI: [`NewChangePage.tsx`](/packages/web/src/NewChangePage.tsx) on
  [`Composer.tsx`](/packages/web/src/Composer.tsx)'s `onSend` and `sendLabel`;
  [`ChangeAside.tsx`](/packages/web/src/ChangeAside.tsx), the change's column, dispatched from
  [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx);
  [`SessionNavRows.tsx`](/packages/web/src/SessionNavRows.tsx), the rows, badge, and "New" rows;
  [`ProgressLine.tsx`](/packages/web/src/ProgressLine.tsx); and `pathLink` in
  [`routes.tsx`](/packages/web/src/routes.tsx), the one TypeScript copy of the folder rule.
- The skill: [`change.md`](/skills/uraeda/references/change.md), 293 lines against 1,484 for the
  discovery, spec, plan, and implementation references it replaces for a change; and
  [`SKILL.md`](/skills/uraeda/SKILL.md),
  [`conventions.md`](/skills/uraeda/references/conventions.md),
  [`projects.md`](/skills/uraeda/references/projects.md),
  [`finish.md`](/skills/uraeda/references/finish.md), and the templates and example, whose bug
  became the change `2026-10-14-tasks-reappear`.

## Questions

### Round 01

#### Q1: Which flows does this feature build?

**Answer:** A: one light flow for bugs and small changes now, small UI changes included; the visual
UI iteration flow becomes its own draft on `main`, started in parallel.

#### Q2: Do bugs and small changes share one flow?

**Answer:** A: one light flow for both, since "the bug flow was never used and just a placeholder so
far".

#### Q2.A: What are the light flow's folder and branch called?

**Answer:** A: `specs/changes/YYYY-MM-DD-<slug>/` on `change/YYYY-MM-DD-<slug>`, with records of
`kind: change`; `specs/bugs/` and `fix/` go away.

#### Q3: Does the agent stop for you before writing code?

**Answer:** A: no stop unless the agent has a question or escalates, "make sure the agent still
works in a worktree every time".

#### Q4: When is a change too big for the light flow?

**Answer:** A: the risk criteria, not a size; but "small decision changes should be ok for this flow
_but_ require human approval before going through and making the PR", and "decisions are OK to
change, they are here to store human intent".

#### Q5: What happens when you accept an upgrade to a feature?

**Answer:** A: the agent postpones it into a draft folder in **Now**, merged into the default
branch, and the human starts it as a feature.

#### Q6: How does a small UI change meet the UI decisions?

**Answer:** A: the UI decisions accept a change's proposal for a spec and its screenshots for
mockups, a new view stays a feature; the human doubted it conflicts much, and UI layout needed no
change.

#### Q7: How much review does a light change get before its pull request?

**Answer:** A: one fresh reviewer on the whole diff, important findings fixed with a test, minor
ones listed in the pull request.

#### Q8: Can one request hold several small changes?

**Answer:** A: a few related changes in one request, one commit and test each, in one pull request;
"most rows in the look and feel draft could indeed be a small feature as described here".

#### Q9: How much tooling does this feature build?

**Answer:** A and C: the skill, the core's table, `ura start`, a start in the web UI, and a
dedicated view "that should focus on the session attached", differing from a feature's session only
in its sidebar.

#### Notes

The light flow is "a small structure for the files" on top of the session: a file as input, optional
rounds, then the code and a pull request; normal chats stay, aware of the flow. A change's rounds
reuse the clarifications view, linked from the session's right column.

## Decisions

- [UI checks](../decisions/ui-checks.md), changed: a UI test may guard the expected behaviour of a
  change's proposal, and a change's screenshots, reviewed against its proposal, go in its folder.
- [Attachments](../decisions/attachments.md), changed: "a change's folder" where it said "a bug's".
- [CLI](../decisions/cli.md), changed: commands act on "a feature, a change, a draft, or a workflow
  file", and default to the current branch's feature or change.

## Changes after approval

- The slug proposed for "Centre the x in failure circles" is `centre-x`, by the drafts' rule, not
  the spec's `centred-x` (R1); it is proposed from the whole typed text (R14).
- Without `gh`, a change with only its proposal is at its `change` step, not `pull-request` (R7).
- A typed title drops its heading marks, and every link text written into `PRIORITIES.md` escapes
  `[`, `]`, and `\` (R11).
- `change.start` answers with the started change's record even when its first run fails, which is
  logged and left unsent (R12); a change's images do not depend on the agent's image capability
  (R15).
- The "Change" badge sits beside the sidebar row's link, not inside it, to keep the spec's
  accessible name (R13).
- New change shows its refusal under the slug field, needs text but not the agent, and keeps its
  text and slug without asking before leaving (R17); it restores silently, and a start answered
  after leaving opens nothing and clears only what it sent (R19).
- A change's round is the gate its step names (R16).
- Changes requested on a change's pull request go into the record, or, when the folder comes back,
  into `rulings.md`; a round answered after that is routed by the skill's tables, since the core
  cannot tell (R20).
- An upgraded change's feature starts with a new discovery round (R21); the upgrade reverts applied
  decisions, and a split-out item is its own entry in **Now** (R22); the upgraded branch and
  worktree are removed by hand, not by `ura clean` (R24).
- A folder's path comes from the core, and `pathLink` keeps the one TypeScript copy of the rule
  (R25).
- `ura start --change` refuses a postponed feature's folder holding files a change cannot hold
  (R26).
- Screenshots are WebP, re-encoded by the core (R23).

## Follow-ups

- The slug wraps next to the "Change" badge in the 1440 px sidebar.
- A change with a ready pull request shows "Needs attention" under "Agents at work": the web UI
  never asks `gh` for a pull request's state, as for features after their last task.
- The "＋" glyph is missing in the screenshots' font.
- `startFeature`'s new `kind` argument has no TypeScript caller.
- `SlugProposal` is keyed by the whole text: one request per pause in typing.
- A typed change's images are encoded twice, as chat images, then by the core.
- A retry after a typed start that failed after its first commit adds a second **Now** entry.
- An old `kind: bug` record gets "kind is not one of feature, change" with no rename hint, and the
  release notes group it under Features.
- `ura start` prints a fixed "Next:" line instead of reading the core's step.
- A change's branch reached without a worktree gets `.worktrees/change/<folder>`, which the git
  decision allows, while `ura start` uses `.worktrees/<folder>`.
- A file nested deeper in a change's folder, like `notes/a.md`, is reported only when its folder is
  checked.
