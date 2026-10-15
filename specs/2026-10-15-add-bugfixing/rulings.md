# Rulings: Add a bugfixing/low impact change flow

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The slug proposed for "Centre the x in failure circles" is `centre-x`

- **Decision**: the composer's slug is proposed by the core's existing rule, `slug::short` of
  `slug::from_text`, which gives `centre-x` for that title. The spec's US1.1 names the slug
  `centred-x`: its tests type `centred-x` into the slug field where the scenario needs that folder,
  and the proposal's tests expect `centre-x`.
- **Rationale**: the spec says the core proposes the slug "as `ura start` does from a draft's name",
  so one rule serves both ([`slug.rs`](/crates/core/src/slug.rs)). `centred-x` was the scenario's
  example, not a rule.
- **Alternatives considered**: a new proposal rule for typed text, which would make two rules for
  one slug.
- **If wrong**: the human edits the slug field before starting, as the spec allows.
- **Where**: tasks 5, 7, and 9.

## R2: "New change" keeps its text in the unsaved store

- **Decision**: the composer's text on "New change" is kept with `useTextField("new-change", "")`,
  so it comes back after leaving the page; images stay in memory, as a chat's do.
- **Rationale**: the spec's edge case says the text "comes back when New change opens again", while
  saying "as a new chat's is". A new chat keeps its text in memory only today
  ([`useDraft.ts`](/packages/web/src/useDraft.ts)), so the concrete behaviour wins.
- **Alternatives considered**: memory only, like a new chat, which loses the request on a misclick.
- **If wrong**: drop the key, and the page forgets like a new chat.
- **Where**: task 9.

## R3: A change's first run is sent from the server's `change.start`

- **Decision**: `change.start` starts the change and sends its first run in one mutation, with the
  workflow message the server builds for the trigger `start`.
- **Rationale**: one press of "Start the change" starts both, and the server already owns the
  workflow message (`readWorkflowMessage`); the client needs no second round trip that could fail
  between the two.
- **Alternatives considered**: the client calling `session.send` after `change.start`, which leaves
  a started change without its run when the second call fails.
- **If wrong**: split the mutation, and send from the client.
- **Where**: task 7.

## R4: read_feature's helpers live in a module of workspace

- **Decision**: splitting `read_feature` under 80 lines moves its new helpers, `read_texts`,
  `read_record`, `folder_uncommitted`, and `source_of`, into
  [`workspace/read.rs`](/crates/core/src/workspace/read.rs); `read_feature` stays in `workspace.rs`.
- **Rationale**: kept in `workspace.rs`, the helpers' signatures and doc comments grow it from 1061
  to 1097 lines, past its `LARGE` entry of 1080, which may only shrink. Moved, it is 1011 lines.
- **Alternatives considered**: all of `read_feature` in the new module, which moves more code than
  the split needs; trimming unrelated code of `workspace.rs` to make room.
- **If wrong**: move the helpers back once `workspace.rs` has room.
- **Where**: task 1, and task 2's record kind check.

## R5: Until Task 3, a change gates on its proposal, then assesses

- **Decision**: between Task 2 and Task 3, `bug_step` returns `Step::gate("proposal.md")` until a
  change's proposal is committed, then `assess`, whatever its pull request. The finishing row "bug
  fixed, draft" goes with the assessment it needed; Task 3's change table brings the pull request's
  rows back.
- **Rationale**: the plan keeps `bug_step` "with no assessment, so it only gates on the proposal".
  Adding the pull request's tail now would make `ura status` look up a pull request for every
  change, and change the CLI's `branch_with_a_slash` row twice.
- **Alternatives considered**: `after_the_last_step(pull_request, Fix, "bug")`, which is Task 3's
  table without its gates, under the old names.
- **If wrong**: Task 3 replaces the function either way.
- **Where**: task 2, `crates/core/src/steps.rs`, `crates/core/tests/steps.rs`, and the Neovim test's
  hint, `assess · waits on agent`.

## R6: Tests of the removed bug files change with them

- **Decision**: the tests that checked a report's or an assessment's behaviour change with the files
  removed:
  - `a_text_comes_with_what_its_editor_shows` reads a change's proposal, a `proposal` with its
    discovery effort;
  - `the_discovery_effort_is_set_over_the_version_read` no longer refuses a report's effort;
  - the fields test lists an assessment with no fields, and the verdicts test drops it;
  - `every_example_file_parses` expects at least 19 example files, not 20, since the example's
    `assessment.md` is deleted;
  - the CLI's `a_bug` start test becomes `a_changes_proposal_is_not_a_draft`.

  Two tests are added: `a_change_is_read_from_its_folder_on_its_branch`, and the old `fix/` branch
  checked out in its worktree. The links of `discovery-01.md` to the deleted templates and
  assessment become plain paths.

- **Rationale**: a change's proposal keeps its `discovery` field, which "matters again if the change
  is upgraded" ([spec](spec.md#assumptions)). The merged change's worktree test reads the change
  from its record, so it cannot catch a change read from the wrong folder; and an old `fix/` branch
  without a worktree shows nowhere even with a leftover prefix, since its tip has no change folder.
  `ura check specs` refuses links to missing files.
- **Alternatives considered**: keeping a report's view for a change's proposal, which hides an
  effort the upgrade needs; keeping the deleted templates until Task 10, against Task 2's files.
- **If wrong**: restore the report's view on a change's proposal in `text_view`.
- **Where**: task 2.

## R7: Without `gh`, a change with only its proposal is at its `change` step

- **Decision**: reversed from Task 3's first reading, which showed an unknown pull request as the
  `pull-request` row. `change_step` reads `PullRequest::Unknown` as no pull request: a change with
  only its proposal is at `change`, waiting on the agent with the reference `change.md`, and its
  step keeps `pull_request: Unknown`, so `next` still asks `gh`. `ura status` says
  `pull request state unknown` only on the `pull-request` row. The CLI's `branch_with_a_slash` row
  expects `["agent", "change"]`, and the Neovim test's hint `change · waits on agent`. A feature's
  tail is unchanged.
- **Rationale**: the spec's Data says a change's tail is "`change` until the draft pull request
  exists, then `finish`, then the pull request's gates". `Workspace::read` computes every step with
  an unknown pull request, and only `next` asks `gh`, so the first reading showed a fresh change as
  `pull-request` in the web UI, the LSP, and `ura status`.
- **Alternatives considered**: the feature's `pull-request` row for an unknown pull request, which
  hides the change's own step everywhere but `next`; asking `gh` in `Workspace::read`, which makes
  every read wait on the network.
- **If wrong**: a change with an open pull request and no `gh` shows `change` until `next` runs;
  `next` corrects it.
- **Where**: task 3 review, `crates/core/src/steps.rs`, `crates/core/tests/steps.rs`,
  `crates/cli/src/status.rs`, `crates/cli/tests/status.rs`, and
  `editors/nvim/tests/test_inline.lua`.

## R8: Task 4's failing run selects the `check` test binary

- **Decision**: Task 4's step 2 runs `cargo nextest run -p uraeda-core --test check`, not
  `cargo nextest run -p uraeda-core check`. The table also checks a stray folder, `notes/a.md`,
  reported as `notes`.
- **Rationale**: nextest's bare `check` filters test names, and neither new test has `check` in its
  name, so the plan's command ran 23 other tests and passed without them. A folder other than
  `images/` and `screenshots/` is a case of the rule the table did not cover.
- **Alternatives considered**: renaming the tests to hold `check`, which names them after the
  command instead of the behaviour.
- **If wrong**: the command only selects tests; the rule is unchanged.
- **Where**: task 4, `crates/core/tests/check.rs`.

## R9: A typed change's still images are WebP, and the core reads the binding's kind

- **Decision**: Task 5's images test expects `images/image-1.webp` and `images/image-2.webp`, not
  `.gif`: a still GIF is re-encoded as WebP, as every attached image is. The binding's `kind`
  argument is read by `api::start_kind`, which refuses a name other than `feature` or `change`. A
  text with no written line is refused with `a change needs a text: its first line is its title`.
  `Started` gains `folder`, since a change's branch is no longer its folder's name, and the
  attachments' `save` takes the working tree's root instead of a `Place`. The LSP's start builds its
  proposal path in one line, so `commands.rs` stays at 498 lines with its new `Kind` argument.
- **Rationale**: [`images.rs`](/crates/core/src/images.rs) keeps only animated GIFs as GIF, and
  `still.gif` became `login.webp` in the existing attach tests. Kinds are the core's, so the binding
  does not parse them. A text with no written line has no title to start from.
- **Alternatives considered**: an animated GIF fixture, which tests the encoder rather than the
  start; parsing the kind in the binding.
- **If wrong**: change the fixture or the binding; the start's behaviour is unchanged.
- **Where**: task 5, `crates/core/tests/actions.rs`, `crates/core/src/api/start.rs`,
  `crates/lsp/src/commands.rs`.

## R10: A finished item's pull request is read in its view

- **Decision**: `FeatureView::new` reads the `pull-request` field of the item's record, through
  `Feature::file(FileKind::Record)` and its text. `workspace.rs` is not modified.
- **Rationale**: `workspace.rs` is at its `LARGE` size of 967 lines and may not grow. The record's
  text is already on the `Feature`, and only the view needs the URL.
- **Alternatives considered**: a `Feature::pull_request` method or field in `workspace.rs`, which
  grows the file past its listed size.
- **If wrong**: move the reading to a module of `workspace`; the field's value is unchanged.
- **Where**: task 6, `crates/core/src/view/feature.rs`.

## R11: A typed title drops its heading marks, and link texts are escaped where Now's links are written

- **Decision**: a typed change's title line drops the marks of a heading typed as one: `## Fix x`
  gives the title `Fix x`, and a line of marks alone, `###`, is not the title. Leading `#`s are only
  marks when a space or the end of the line follows them, so `#123 crashes` stays whole. When the
  title is cut, the body keeps the whole first line without its marks. The text of every link
  `PRIORITIES.md` gains, by `ura draft`'s link, by a start's move to **Now**, or by a typed change's
  new entry, has `[`, `]`, and `\` escaped with a backslash, by `markdown::link_text`, the escaping
  image alt texts already used, moved from `attach.rs`. `add_to_now` inserts through the same
  `insert` as the other entry edits, which brings `priorities.rs` from 685 to 664 lines.
- **Rationale**: the proposal's heading is written as `# {title}`, so a typed `#` gave `# # Fix x`
  and a start subject with marks. An unbalanced bracket in a title, `Fix the ] key`, ended the link
  text early and broke the entry. An entry's text is read back as plain text, so a link written from
  it loses its escapes unless the writer escapes again.
- **Alternatives considered**: stripping every leading `#`, which loses `#123`; escaping only in the
  typed start, which leaves `ura draft` and the move of a draft's entry broken on the same text.
- **If wrong**: change `unmarked` in `typed.rs`, or `link_text` in `markdown.rs`; each is the one
  place its rule lives.
- **Where**: task 5 review, `crates/core/src/actions/start/typed.rs`,
  `crates/core/src/files/markdown.rs`, `crates/core/src/files/priorities.rs`,
  `crates/core/src/actions/attach.rs`.

## R12: `change.start` answers with the change's `Feature` record

- **Decision**: `change.start` is a mutation of type `Feature`, answering with the started change's
  record, as `feature.start` does; the client selects its `folder` and `session`, which is `null`
  when no run was sent. The run is sent only when the agent is available and the workflow message
  for `<folder>:start` has a text; otherwise the change stays started and nothing is refused. Once
  the change is started, a failure of its session or its send is logged on stderr, and the record
  answers with `session: null`, so the client hands it over unsent. The slug's proposal is the read
  `SlugProposal`, under the root `slugProposals`.
- **Rationale**: fate's mutations answer with a record of a view's type, and the `Feature` record
  already holds `folder` and `session`, so the web UI's cache gets the new change without a second
  read. A change exists once the core has started it, so a refusal after it would tell the human it
  failed when it did not; its page then offers the message unsent, as without the agent.
- **Alternatives considered**: a new `StartedChange` view of two fields, which the cache would keep
  apart from the change's record; refusing when the message is missing, after the change exists.
- **If wrong**: add the view, and select it from the web UI's "New change".
- **Where**: task 7, `packages/server/src/fate/mutations.ts`, `packages/server/src/fate/views.ts`.

## R13: A change's sidebar tag sits beside its link

- **Decision**: the "Change" badge is drawn in `SideNavItem`'s `actions`, beside the row's link, not
  in its `endContent`, inside it. The link's text stays the slug, and its accessible name is the
  spec's "centred-x, Centre the x in failure circles, change, Working". Hidden in the folded
  navigation, as `actions` are.
- **Rationale**: inside the link, the badge's text joins the link's visible text, "centred-x
  Change", which is not a run of words of the spec's name. axe's `label-content-name-mismatch` rule,
  WCAG's label in name, refuses it, and the [UI checks](../decisions/ui-checks.md) run axe on every
  page. `aria-hidden` does not help: the rule reads the text shown on screen.
- **Alternatives considered**: the name "centred-x Change, …", which changes the spec's exact text;
  the badge in `endContent`, which fails the axe check.
- **If wrong**: move the badge into `endContent`, with a name that starts with the slug and the tag.
- **Where**: task 8, `packages/web/src/SessionNavRows.tsx`.

## R14: The slug is proposed for the whole typed text

- **Decision**: `api::propose_slug`, the binding's `proposeSlug`, and the read `SlugProposal` take
  the whole typed text, not its title: the core reads the title as `start_change` does, with one
  function, `Typed::read`, and proposes its slug, empty for a text with no title. `SlugProposal`'s
  ID is the text. "New change" passes its composer's text as typed.
- **Rationale**: the title's rule, the first line holding more than spaces and heading marks, its
  marks dropped and cut at 80 characters, lives in the core
  ([`typed.rs`](/crates/core/src/actions/start/typed.rs)). Keyed by a title, the web UI would have
  to copy that rule to find it, and the two could drift: one home per rule.
- **Alternatives considered**: a title keyed by the web UI's own reading of the first line, which
  copies the rule; a `titleOf(text)` in the binding, which costs the page a second call.
- **If wrong**: key `SlugProposal` by the title again, with the binding giving the title too.
- **Where**: tasks 5, 7, and 9, `crates/core/src/actions/start/`, `crates/core/src/api/start.rs`,
  `crates/binding/src/lib.rs`, `packages/server/src/fate/sources.ts`.

## R15: A typed change's images do not depend on the agent's

- **Decision**: `change.start` checks its images with `changeImages`, not the chat's `sentImages`:
  each an object of its ID and size, at most 10, and its file there. The agent's `images` capability
  is not checked, and a file gone as its bytes are read is refused with "This image is gone: add it
  again.", not an internal error.
- **Rationale**: the core writes a change's images into its folder, in the repository; none goes to
  the agent, so an agent that reads no images cannot refuse them. The chat's check also refused a
  change's images without an agent at all.
- **Alternatives considered**: `sentImages(ctx, images, false)`, which refuses a change's images for
  an agent that reads none.
- **If wrong**: check the agent's capability in `changeImages` too.
- **Where**: task 7, `packages/server/src/fate/chat-images.ts`,
  `packages/server/src/fate/mutations.ts`.

## R16: A change's round is its step's gate

- **Decision**: the change's column and its phone line show the round the step gates on, the file
  `step.file` names, when it is of kind `clarifications`, with that file's `round`. Task 8's first
  reading took the highest `round` among the change's clarifications files.
- **Rationale**: which file the step waits on is the core's rule
  ([`steps.rs`](/crates/core/src/steps.rs)'s `waiting_gate`). Picking the latest round again in
  TypeScript copies it, and the two could drift: one home per rule.
- **Alternatives considered**: the highest round, which agrees with the core today but copies its
  rule.
- **If wrong**: the core names the gate either way; read the latest round again in `roundOf`.
- **Where**: task 8 review, `packages/web/src/ChangeAside.tsx`.

## R17: New change's refusal, its text, and its slug are the page's

- **Decision**:
  - the composer's `onSend` answers whether it was sent, a `boolean`, not a refusal's message: the
    page shows its own refusal under the slug field, and the composer keeps the text and the images
    until it is sent;
  - with `onSend`, the composer needs text, not the agent, and takes images whatever the agent
    reads;
  - the text and the slug are kept with `useTextField(…, { drawn: false })`: leaving the page keeps
    them without asking "Leave page?";
  - an empty slug is not sent: the core proposes its own, as before the page's proposal arrives;
  - "without the agent" is a jsdom test, `__tests__/new-change.test.tsx`.
- **Rationale**: the spec puts a start's refusal "under the slug field", below the composer, so the
  composer's status is the wrong place, and a message it would not show has no reason to be
  returned. The spec's "No agent on this machine" starts the change, and its images go into the
  repository (R15). A new chat's text never asks before leaving, and the spec keeps New change's "as
  a new chat's is". A Start pressed within the proposal's 200 ms sent an empty slug, which the core
  refused as `"" is not a slug`. The browser tests' server always has its fake agent.
- **Alternatives considered**: the plan's `{ ok, message }`, shown in the composer's status, above
  the slug field; a browser command that takes the agent away, for one test.
- **If wrong**: return the message, and show it in the composer's status; drop `drawn: false`.
- **Where**: task 9, `packages/web/src/Composer.tsx`, `packages/web/src/NewChangePage.tsx`.

## R18: Links to the deleted `bug.md` become plain paths, or point to `change.md`

- **Decision**: deleting `bug.md` broke seven links that Task 10's files did not list. The merged
  record `specs/done/2026-10-12-finish-feature.md` links `change.md` in its place, keeping its text,
  `bug.md`. This feature's `discovery-01.md`, `clarifications-01.md`, and `plan.md` name `bug.md` as
  a plain path, as R6 did for the deleted templates. The benchmarks backlog's `discovery-01.md`
  names it as a plain path too, `skills/uraeda/references/bug.md`: its "bug flow stays out"
  describes the flow of its day, which `change.md` does not. This edits the answered
  `clarifications-01.md`, whose only allowed edit is its block's record: it fixes a broken link
  only, as a frozen record may, and keeps its words, the lines only reflowed.
- **Rationale**: `ura check specs` refuses links to missing files. A merged record is edited only to
  fix a broken link ([finish](/skills/uraeda/references/finish.md#after-the-merge)), and `change.md`
  is what replaced the file it named, step table first. This feature's rounds describe `bug.md` as
  it was: a path keeps their words, and git keeps the file.
- **Alternatives considered**: links to `bug.md` at a past commit, which `ura check` cannot follow;
  pointing this feature's links to `change.md`, which describes another file than the one they
  discuss.
- **If wrong**: link the record's text as a plain path too.
- **Where**: task 10, `specs/done/2026-10-12-finish-feature.md`,
  `specs/2026-10-15-add-bugfixing/discovery-01.md`, `clarifications-01.md`, and `plan.md`;
  `specs/backlog/benchmarks/discovery-01.md`.

## R19: New change restores silently, and a start answered after leaving opens nothing

- **Decision**:
  - the slug field shows no restore notice on New change: `SlugField` takes `restoreNotice`, false
    there, and the draft editor keeps its notice;
  - a start that answers once the page is gone neither opens the change's page nor hands it over,
    and still clears the text and the slug, since the change started;
  - "Start the change" is Astryx's loading button while the start is pending: busy, its name kept;
  - the browser tests read the change's committed files with a command, `committedFiles`, which
    lists a worktree's files at its head.
- **Rationale**: the spec keeps New change's text "as a new chat's is", which comes back without a
  notice; "Unsaved text restored" and "The draft's name changed since" are a draft's words, in
  neither mockup. Clearing the text after a start the human left keeps them from starting the same
  change twice. The spec's US1.2 wants the images "committed in the change's `images/` folder",
  which a file on disk alone does not show.
- **Alternatives considered**: a notice of New change's own, which no mockup has; keeping the text
  of a start answered after leaving; reading the files from the worktree's disk.
- **If wrong**: pass `restoreNotice` on New change; keep the text when the page is gone.
- **Where**: review of task 9, `packages/web/src/SlugField.tsx`,
  `packages/web/src/NewChangePage.tsx`, `packages/web/src/Composer.tsx`,
  `packages/web/vite.browser.config.ts`.

## R20: Changes requested on a change's pull request

- **Decision**: `change.md`'s pull request section says what differs from a feature's:
  - a change applied directly updates the record, as for a feature; when the folder comes back for a
    round, the record's changes noted before the revert go into `rulings.md`, one ruling each;
  - a new question is a round of `clarifications-NN.md` alone; a new decision is the upgrade offer,
    and a change to an active decision is proposed in a round;
  - once that round is answered, the pull request is a draft, and `ura next` names finish: a row of
    `finish.md`'s and of `change.md`'s tables, before the draft's, sends a change whose folder came
    back, with a round answered since that is not made yet, to make the change from the answers and
    review it first. The folder came back when the branch reverts its finishing commit, and
    `git log` shows a round answered after that revert.

  `SKILL.md`'s "Going back to the human" and its rule on proposed decision changes link the change's
  exceptions, and finish's table row "the pull request is a draft" covers a reviewed change.

- **Rationale**: implementation and finish said "the spec and the plan", a discovery file, and a
  round for a new decision, which a change has none of or answers with the upgrade (spec: "Rounds
  without a discovery file", "Decisions are the human's intent"). The proposal stays the human's
  words, never rewritten ([projects](/skills/uraeda/references/projects.md)); `rulings.md` is where
  a change's choices live, and the record's **Changes after approval** lists the rulings that change
  behaviour. The core's step for a change with a draft pull request is finish: from the files alone,
  a round answered after the folder came back looks like a round answered before the first review,
  and only `git log` tells them apart, so the references' tables carry that row, and the core does
  not guess. Before the final review, the row was a note under `change.md`'s pull request section,
  which `finish.md`'s table, where `ura next` sends the agent, sent past.
- **Alternatives considered**: carrying the noted changes into the proposal, which rewrites the
  human's words; a step of its own for an answered round after the pull request, which the core does
  not have.
- **If wrong**: the core reads the finishing commit's revert, and names `change` for a round
  answered after it, in place of the tables' row.
- **Where**: review of task 10, and the final review, `skills/uraeda/references/change.md`,
  `finish.md`, `SKILL.md`.

## R21: An upgraded change's feature starts with a new discovery round

- **Decision**: an upgraded change's draft folder has answered rounds and no discovery file, so the
  started feature's step is the spec. The spec step's "Is the scope clear?" sends it to a new round,
  with its discovery file, at the proposal's discovery effort: round 02 after a change that asked
  once. `change.md`'s upgrade section and `spec.md` say so.
- **Rationale**: the change's rounds settled the change and its upgrade, not the feature's scope,
  and a spec written from them would skip the discovery the feature flow exists for. The table needs
  no new row: the spec step already starts a new round when the scope is unclear.
- **Alternatives considered**: a step-table row for a folder with no discovery file, which the core
  would need too; renaming the change's rounds, which edits answered rounds.
- **If wrong**: add the row to `SKILL.md`'s table and to the core's `feature_step`.
- **Where**: review of task 10, `skills/uraeda/references/change.md`, `spec.md`.

## R22: The upgrade reverts applied decisions, and a split-out item is its own entry

- **Decision**:
  - the upgrade's revert commit, `revert(<slug>): undo the change before its upgrade`, reverts the
    code commits, with their rulings and screenshots, and every `decision(<slug>): apply <topic>`
    commit; the upgrade commit removes the `## Proposed change` sections the revert brings back;
  - a split-out item is written on the default branch as `specs/drafts/<item-slug>.md`, committed
    `chore: draft <Name>`, with its entry on the line after the change's entry, not nested under it.
- **Rationale**: the human approved a decision's change for that change only; the feature proposes
  it again in its spec, and postponing already removes a feature's proposed sections. `revert` is a
  Conventional Commits type, and `chore: draft <Name>` is conventions' message for a draft. The
  finishing commit removes the change's entry with its nested lines, so a nested line would go with
  it; the catch-up brings the default branch's line into the branch before finishing.
- **Alternatives considered**: keeping the applied decision, which leaves a rule the merged code
  does not follow; nesting the draft under the change's entry, as the spec's "under" could read.
- **If wrong**: keep the applied decision, and drop it from the revert.
- **Where**: review of task 10, `skills/uraeda/references/change.md`.

## R23: Screenshots are WebP, re-encoded by the core

- **Decision**: the screenshot script saves each view as `<view>-<size>-<theme>.webp`, re-encoded by
  the core's `encodeImage`, as an attached image is, not as Playwright's PNG. Task 11's screenshots
  are WebP.
- **Rationale**: the attachments decision makes WebP the repository's image format, and
  near-lossless WebP takes about a quarter of a PNG's size: these 20 screenshots take 540 KB. The
  core encodes, as the decision asks of TypeScript code, so the script names no encoder.
- **Alternatives considered**: PNG, as earlier features committed, four times larger, in git history
  once the folder is finished.
- **If wrong**: `save` in `packages/web/scripts/shots.ts` writes Playwright's PNG again.
- **Where**: Task 11, `packages/web/scripts/shots.ts`.
