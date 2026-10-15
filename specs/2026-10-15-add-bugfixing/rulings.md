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
