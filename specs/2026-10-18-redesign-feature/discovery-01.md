# Discovery, round 01: Redesign feature and change pages

## Summary

Agent products give each task a page with a status in a small shared vocabulary (working, waiting
for you, finished, failed). A live feed shows the work, and a summary closes it: files and lines
changed, runtime, and tokens or compute units. Single-item dashboards add a timeline of milestones
with the time between each pair. Products differ on how an agent picks up pull request comments: a
mention, a button per comment, or an automatic subscription.

The proposal asks for five things:

- a summary of a done feature: milestone times, tokens, and lines changed;
- an ongoing feature page that shows its stage and sessions;
- a way to send the agent to the pull request's comments;
- one "Open session" button with a choice of pre-filled messages;
- "problems" that stop crying wolf.

The code has a feature page grown by additions since 2026-10-12 and never redesigned. A change has
no page of its own: it opens its session. A done feature shows one row, the record file.

The data is missing for most of the summary:

- tokens are dropped by the runner;
- milestones exist only as commits;
- lines changed are computed for live branches only.

The "problems" mostly come from template drift between the server's build and a branch's own
templates, and from files the agent is still writing. The "changes requested" step, the only way an
agent reaches pull request feedback today, has never fired on this repository's 32 pull requests.

## How other products do it

### GitHub Copilot coding agent

- A session's overview shows "the agent's progress, token usage, and session length", and its logs
  show the reasoning and tools used, including tests and linters run
  ([track sessions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/track-copilot-sessions)).
- The repository's Agents tab lists every session, with grouped tool calls, expandable diffs, and a
  one-click link to the pull request
  ([changelog, 2026-01-26](https://github.blog/changelog/2026-01-26-introducing-the-agents-tab-in-your-repository)).
  Sub-agent work is "collapsed by default, with a heads-up display showing what it's working on
  right now"
  ([changelog, 2026-03-19](https://github.blog/changelog/2026-03-19-more-visibility-into-copilot-coding-agent-sessions/)).
- Each commit carries an `Agent-Logs-Url` trailer, a permanent link back to the session
  ([changelog, 2026-03-20](https://github.blog/changelog/2026-03-20-trace-any-copilot-coding-agent-commit-to-its-session-logs)).
- Pull request comments: `@copilot` in a comment, or "Fix with Copilot" on one review comment, or
  "Add to batch" for several, then "Fix and commit"
  ([make changes to a PR](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/make-changes-to-an-existing-pr)).
  Copilot's reviewer "may also repeat comments you've already dismissed or resolved"
  ([code review](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review)).

### Google Jules

- A task's activity feed logs each step with mini diffs. Its completion summary gives "files
  changed, total runtime, lines added/changed/removed", the branch, and the commit message
  ([running tasks](https://jules.google/docs/running-tasks/),
  [code](https://jules.google/docs/code/)).
- Since September 2025, Jules reads and answers pull request comments by itself, marking each with
  👀. "Reactive mode" limits it to comments that mention `@Jules`
  ([changelog, 2025-09-23](https://jules.google/docs/changelog/2025-09-23)).

### Devin

- A session has a status, `working`, `waiting_for_user`, `waiting_for_approval`, or `finished`, its
  compute units (`acus_consumed`), and its pull requests with their state
  ([session API](https://docs.devin.ai/api-reference/v3/sessions/get-enterprise-session)).
- Session Insights show the compute used and a size from XS to XL. They also show a "chronological,
  color-coded" timeline of key events, and the issues detected with an impact rating
  ([session insights](https://docs.devin.ai/product-guides/session-insights)).
- Devin answers comments on the pull requests it tracks by itself. Bot comments are ignored by
  default "to prevent feedback loops", with an allowlist as the recommended alternative
  ([bot comments](https://docs.devin.ai/product-guides/bot-comment-settings)).

### Claude Code on the web

- Each session shows a diff indicator like `+42 -18`, opening a diff view with inline comments sent
  with the next message
  ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)).
- Auto-fix is a per pull request toggle. Claude follows its review comments and CI failures. It
  pushes clear fixes, asks first on ambiguous or architectural requests, and skips duplicates.
  Replies are posted under the user's account, and can trigger comment automations (same page).
- The docs read mention no per-session token count: usage counts toward the plan's limits.

### Codex, Cursor, Factory, and Linear

- Codex shows a finished task's answer and a diff of its files. `@codex review` posts a review of P0
  and P1 issues, and `@codex fix the P1 issue` starts a task that pushes to the branch
  ([cloud environment](https://learn.chatgpt.com/docs/environments/cloud-environment),
  [GitHub](https://learn.chatgpt.com/docs/third-party/github)).
- Cursor's Bugbot gives each finding "Fix in Cursor" and "Fix in Web" links, and an autofix that
  stops after 3 attempts per pull request ([Bugbot](https://cursor.com/docs/bugbot)).
- Factory renders a session's diffs beside it, with inline comments and a review state
  ([overview](https://docs.factory.com/web/getting-started/overview)).
- Linear derives an agent session's state from its last activity: `pending`, `active`, `error`,
  `awaitingInput`, `complete`, or `stale`
  ([agent interaction](https://linear.app/developers/agent-interaction)). A pull request attached to
  an issue shows each reviewer's action, and moves the issue to In Progress when opened, Done when
  merged ([GitHub integration](https://linear.app/docs/github)).

### Dashboards of a single item

- GitLab's value stream analytics measures each stage as "an event pair (start and end events)", its
  duration the end minus the start
  ([value stream analytics](https://docs.gitlab.com/user/group/value_stream_analytics/)).
- LinearB splits one branch's cycle time into coding, pickup, review, and deploy, each coloured
  against a benchmark
  ([cycle time](https://linearb.helpdocs.io/article/0vif1ihmgc-how-is-cycle-time-calculated)).
- Linear reports cycle time, from start to completion, and lead time, from creation to completion
  ([insights](https://linear.app/docs/insights)).
- DORA warns that such metrics are for trends and learning, not targets or comparisons between teams
  ([DORA metrics](https://dora.dev/guides/dora-metrics/)).

### Pre-filled messages

- Claude Code's deep links fill the prompt, which "is populated but not sent until you press Enter",
  with a visible warning that it came from a link
  ([deep links](https://code.claude.com/docs/en/deep-links)). Claude Desktop's `?q=` links behave
  the same ([help article](https://support.claude.com/en/articles/14729294)).
- ChatGPT's undocumented `?q=` sent the query without confirmation, which Tenable reported as a
  prompt injection vector ([TRA-2025-22](https://www.tenable.com/security/research/tra-2025-22)).
- NN/g: a suggestion can send at once, or "insert a longer prompt into the input field for users to
  edit before submitting"; "broad or generic prompt suggestions are rarely effective"
  ([prompt suggestions](https://www.nngroup.com/articles/designing-use-case-prompt-suggestions/)).
- Shape of AI: show 3 to 6 contextual suggestions, since "too many options leads to scanning
  fatigue" ([suggestions](https://www.shapeof.ai/patterns/suggestions)).

### What they have in common

- A status from a small vocabulary, derived from events rather than set by hand.
- A summary at the end: files and lines changed, runtime, and tokens or compute where the product
  bills by it.
- A timeline of the item's milestones, with durations between pairs, and open phases marked.
- A link from the task to its pull request, and back.
- A way to send the agent to pull request comments: a mention, a button, or a subscription. The
  automatic ones guard against bot loops and resolved or outdated comments.
- Pre-filled prompts are filled, never sent, and few, chosen for the current context.

## Standards and libraries

### Diagnostic severities

- The Language Server Protocol has four severities: Error, Warning, Information, Hint. A diagnostic
  without one should be read as an Error
  ([LSP 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)).
  VS Code defines a Warning as "something suspicious but allowed", and Information as "not a
  problem"
  ([vscode.d.ts](https://raw.githubusercontent.com/microsoft/vscode/main/src/vscode-dts/vscode.d.ts)).
- ESLint's `warn` does not change the exit code; `error` exits 1
  ([configure rules](https://eslint.org/docs/latest/use/configure/rules)). Vale has suggestion,
  warning, and error, and exits 1 only on errors ([Vale CLI](https://docs.vale.sh/topics/cli)).
  SARIF has error, warning, note, and none
  ([SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html)).
- Google's analysis platform keeps only results developers act on. "Any false positives or poor
  reporting give them a justification for inaction"
  ([Sadowski et al., 2018](https://6826.csail.mit.edu/2020/papers/google-analysis-cacm.pdf)).
- Google SRE: "Every page should be actionable"; frequent alerts get skimmed or ignored
  ([monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)).

### Claude Code's token usage

- In streaming input mode, which Uraeda's runner uses, each turn emits a `result`. Its `usage`
  covers that turn's main loop only. Its `modelUsage` carries the running total of the whole call,
  sub-agents included, by model, with input, output, cache read, and cache creation tokens
  ([cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)).
- A resumed session restores its earlier totals, so the latest result holds the session's total
  (same page).
- Per-message `output_tokens` in the transcript is "a placeholder": only the result has the real
  output count (same page).
- `total_cost_usd` is "a client-side estimate, not authoritative billing data" (same page).

### GitHub pull request reviews

- A review is Comment, Approve, or Request changes
  ([about reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews)).
  "Pull request authors cannot approve their own pull requests"
  ([required reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews)).
- `gh pr view --json` exposes `reviewDecision`, `reviews`, `latestReviews`, and `comments`
  ([gh pr view](https://cli.github.com/manual/gh_pr_view)).
- Only GraphQL's `PullRequestReviewThread` has `isResolved` and `isOutdated`
  ([GraphQL pulls](https://docs.github.com/en/graphql/reference/pulls)). REST review comments have
  no resolved state ([REST comments](https://docs.github.com/en/rest/pulls/comments)).

## The code

### Important reads

- [`FeaturePage.tsx`](/packages/web/src/FeaturePage.tsx), 235 lines. From the top, it shows:
  - the title;
  - a gate banner when the step waits on the human;
  - the [agent panel](/packages/web/src/AgentPanel.tsx);
  - a branch line, with the pull request link;
  - a banner for a left worktree;
  - the file list, with a "problem" badge;
  - the mockups;
  - a "Problems" list.
- Its layout dates from 2026-10-12 (`3152522`), with additions since: mockups, changes, Storybook,
  the pull request link (`421c7a8`).
- [`App.tsx`](/packages/web/src/App.tsx) `ItemPage` (lines 263-270): a change's `/f/<folder>`
  renders its [session page](/packages/web/src/SessionPage.tsx). Its column is
  [`ChangeAside.tsx`](/packages/web/src/ChangeAside.tsx). A done change shows a composer blocked
  with "This feature has no branch left: it is merged."
- A done feature: the core gives it one file, its record, with no branch
  ([`workspace.rs`](/crates/core/src/workspace.rs) 160-205). Its pull request is read from the
  record and always reported as `open` ([`view/feature.rs`](/crates/core/src/view/feature.rs)
  165-185). The page shows one row with a `record` badge, the proposal's "dirty link to the report"
  ([`feature.test.tsx`](/packages/web/src/__tests__/feature.test.tsx) 53-81).
- [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx), the session's column, already draws the
  tasks, sub-agents, branch changes (+/−, first 50 files), and pages. These are the parts a feature
  page can reuse.
- [`home/features.ts`](/packages/web/src/home/features.ts) 24-34: any problem moves a feature out of
  "Agents at work" into "Needs you". [`HomeHub.tsx`](/packages/web/src/home/HomeHub.tsx) 54-61 gives
  it a red "Fix" badge with the first message.
- [`api.rs`](/crates/core/src/api.rs) 150-165 `checked`: re-runs the check on a checked-out feature
  and keeps errors only. [`ProblemView`](/crates/core/src/view.rs) 26-42 has no severity.
- [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts) 340-361: the `result`
  event keeps success, errors, and denials, and drops `usage` and `modelUsage`. The cost column was
  removed on 2026-10-14 (`c67d12e`): "The session's cost, Claude Code's own estimate, is no longer
  stored or shown."
- [`runner/cache.ts`](/packages/server/src/runner/cache.ts): the SQLite schema. One session per
  feature (unique index), and turns with `kind`, `trigger`, `step`, `state`, `started_at`, and
  `ended_at`. "Build in a fresh session" replaces the session's `native_id`, so earlier agent
  sessions leave only a marker line.
- [`runner/message.ts`](/packages/server/src/runner/message.ts) 19-72: the one home of every step's
  message, keyed by step. The trigger is stored on the turn but changes nothing in the text.
- [`crates/core/src/pulls.rs`](/crates/core/src/pulls.rs):
  `gh pr list --state open --json headRefName,number,url,isDraft,reviewDecision`. It reads no
  comments, and no merged or closed state.
- [`changes.rs`](/crates/core/src/changes.rs) 44-76: lines changed, `git diff --numstat` from the
  merge base, outside the feature folder; `None` once merged.

### Size limits in the way

The [code-quality decision](/specs/decisions/code-quality.md) sets 500 lines per file.

- Over the limit, split first when touched:
  - [`runner/cache.ts`](/packages/server/src/runner/cache.ts) (633), where a token column goes;
  - [`workspace.rs`](/crates/core/src/workspace.rs) (731).
- Near it: [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts) (494),
  [`binding/src/lib.rs`](/crates/binding/src/lib.rs) (488),
  [`fate/views.ts`](/packages/server/src/fate/views.ts) (469), [`git.rs`](/crates/core/src/git.rs)
  (466), and [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) (439).
- No story covers `FeaturePage`, `AgentPanel`, `SessionAside`, `ChangeAside`, or `SessionPage`.

### The proposal's path and existing actions

- **Opening a feature.** The sidebar card leads to the feature page for a feature, and to the
  session for a change.
- **"Open the session"** ([`AgentPanel.tsx`](/packages/web/src/AgentPanel.tsx) 162-166) is a link to
  `/f/<folder>/session`. The composer is empty, and anything typed is sent as a chat.
- **"Review and start the agent"** (167-169) goes to `session?continue=manual`. The server fills the
  step's message, unsent ([`HandOver.tsx`](/packages/web/src/HandOver.tsx),
  [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) 321-363). It is offered only when:
  - the step waits on the agent;
  - no workflow turn runs or is queued;
  - the last turn did not fail.
- **"Stops sending if it's not needed."** When the step waits on the human, the server returns "The
  feature waits on you now: there is nothing to continue." The composer then disables its button:
  nothing at all can be sent from that address ([`Composer.tsx`](/packages/web/src/Composer.tsx)
  282-327). The runner refuses it again at send time
  ([`runner/sessions.ts`](/packages/server/src/runner/sessions.ts) 218-229). A feature whose step is
  `none`, because of an invalid file, gets the same "waits on you" refusal.
- **The other hand-overs** fill the same composer: "Commit and start the agent" on a round, "Approve
  and start the agent" and "Request changes and start the agent" on a review, "Start the feature and
  the agent". They keep working with any option below.
- **An open pull request.** The step waits on the human. The gate banner's button, "Pull request
  ready", links to the feature page itself ([`labels.ts`](/packages/web/src/labels.ts) 47-60): a
  dead button.
- **Pull request feedback.** Only `reviewDecision == CHANGES_REQUESTED` moves the step to
  `pull-request-changes`, which waits on the agent. Its message, "Address the changes requested on
  the pull request", is then offered.
  - On this repository, `gh pr list --state all` shows no pull request with a review decision. Every
    review is a "Comment": the Codex connector's, or the owner's own (checked 2026-10-18).
  - So the agent's only path to pull request feedback has never fired here.
- **Merged feature with a left worktree** shows "Run `ura clean`". That stays.

### Rules and their owners

- **A feature's step and status**: the core ([`steps.rs`](/crates/core/src/steps.rs)). The
  [UI behaviour decision](/specs/decisions/ui-behaviour.md) forbids the UI from guessing one.
- **Each step's message**: the server's `runMessage`, one copy. The texts are pinned in
  [`message.test.ts`](/packages/server/src/runner/__tests__/message.test.ts), with string copies in
  two web tests.
- **Whether a message may be sent**: the server, in two places, at read time
  ([`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) 337-345) and send time
  ([`runner/sessions.ts`](/packages/server/src/runner/sessions.ts) 218-229).
- **A check rule's severity**: its call site in [`crates/core/src/check/`](/crates/core/src/check/),
  with no table. The UI's filter is [`api.rs`](/crates/core/src/api.rs) 158. The warnings are listed
  again in [`cli.md`](/skills/uraeda/references/cli.md) and
  [`writing.md`](/skills/uraeda/references/writing.md).
- **What blocks a step**: only `frontmatter.status`, `.parse`, and `.kind` set the step to `none`
  ([`steps.rs`](/crates/core/src/steps.rs) 191). Every other check error only relabels the feature
  in the UI.
- **The agents decision** says "A workflow run MUST carry the step, its reference, and the trigger
  in its message" ([agents](/specs/decisions/agents.md)). `runMessage` takes no trigger: the code
  drifts from the rule.

### Problems found on features in progress

Checked with this branch's `ura` on 2026-10-18:

- Main and this worktree: 0 errors, 4 warnings.
- [`2026-10-17-redesign-specs`](/specs/PRIORITIES.md), at implementation with an agent working: 14
  errors. Checked with its own branch's binary, the same folder has 0.
- So Home shows it under "Needs you" with "Fix: missing section '## Decisions'", not under "Agents
  at work".
- Cause: templates are compiled into the binary ([`embedded.rs`](/crates/core/src/embedded.rs)), and
  that branch rewrites the spec and plan templates.

Every commit since 2026-10-17 16:48 that touched a feature folder, 72 snapshots, checked with
today's binary:

- 63 snapshots have at least one error.
- `sections.missing` 251, `settled.group` 232, `sections.order` 115, `sections.unknown` 69,
  `links.file` 16.
- Rebuilt at three commits of `access-storybook`, the binary of their own time finds 0 problems.

[Compatibility](/specs/decisions/compatibility.md) allows this: in-flight branches "MAY fail
`ura check`" until they catch up.

Files cut at each heading, as an agent writing in place leaves them, all fail `sections.missing`,
and some `links.heading`.

By kind:

- **Blocks the workflow**: `frontmatter.status`, `.parse`, `.kind`, and `answers.blank` on an
  answered round. Rare.
- **Writing drift, already warnings**: `writing.sentence`, `block.count`, `block.items`.
- **Expected in progress, or drift**: `sections.*`, `settled.group`, frontmatter placeholders, and
  links to a section not written yet or to a file on another branch. The bulk.

### Data a summary needs, and where it is

| Fact                      | Today                                      | Where it could come from                                           |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Milestone dates           | the folder's date, the record's `finished` | commits scoped `(<slug>)` and typed by step, durable in git        |
| Time the agent worked     | each turn's start and end, local SQLite    | the same, summed by step                                           |
| Time waiting on the human | nothing                                    | between a step's commit and the human's answer, approve, or merge  |
| Lines and files changed   | live branches only                         | git, over the feature's commits; or the pull request (`additions`) |
| Tokens                    | dropped                                    | each turn's `result.modelUsage`, from now on                       |
| Questions and decisions   | the record's sections                      | the record, parsed                                                 |
| Pull request dates        | not fetched                                | `gh pr view --json createdAt,mergedAt`                             |

- Commits are typed by step on the default branch: `discovery`, `spec`, `plan`, `decision`, and
  `finish`, with the slug as scope
  ([conventions](/skills/uraeda/references/conventions.md#commits)).
- 25 of the 30 records have such commits on `main`. The 5 without are records written directly or
  early changes, like `2026-10-15-claude-usage`.
- Example: `redesign-clarifications` started 10:52, its questions at 11:18, answered 12:01, spec
  12:11, approved 15:01 after one revision, plan 15:08, finished 22:03.
- Tokens for one feature, from Claude's own transcripts (`redesign-clarifications`, main session and
  42 sub-agents):
  - 2.7 k input;
  - 5.2 M cache writes;
  - 146.7 M cache reads;
  - 113 k output, a placeholder count.
- The transcripts are Claude Code's internal format, and their output counts are placeholders, so
  they cannot give past features exact totals.

### Overlap with features in flight

- `2026-10-17-redesign-specs` (72 of 77 steps built) adds to
  [`git/log.rs`](/crates/core/src/git/log.rs) reads this feature can reuse: `approval_commit`,
  `first_parent_changes`, and `last_change`.
- It rewrites all 18 decisions shorter, and the record template's "Changes after approval". It adds
  check rules and templates, so its merge makes every other in-flight spec or plan fail the check,
  as above.
- It merges before this feature's spec: the spec should cite the rewritten decisions.
- Drafts [redesign-session](/specs/drafts/redesign-session.md) and
  [worker-lifecycle](/specs/drafts/worker-lifecycle.md) touch the session page and restarting
  agents, not the feature page.

### Likely changes

Under every option:

- [`FeaturePage.tsx`](/packages/web/src/FeaturePage.tsx) and
  [`AgentPanel.tsx`](/packages/web/src/AgentPanel.tsx): the new page, with stories for its states.
- [`labels.ts`](/packages/web/src/labels.ts): the open pull request's action.
- [`home/features.ts`](/packages/web/src/home/features.ts),
  [`HomeHub.tsx`](/packages/web/src/home/HomeHub.tsx), [`view.rs`](/crates/core/src/view.rs), and
  [`api.rs`](/crates/core/src/api.rs): problems by kind.
- [`runner/message.ts`](/packages/server/src/runner/message.ts),
  [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts),
  [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts), and
  [`Composer.tsx`](/packages/web/src/Composer.tsx): the messages and their picker.
- [`implementation.md`](/skills/uraeda/references/implementation.md),
  [`finish.md`](/skills/uraeda/references/finish.md),
  [`change.md`](/skills/uraeda/references/change.md), and [`SKILL.md`](/skills/uraeda/SKILL.md): the
  pull request comments pass.

With a summary of done features:

- [`crates/core/src/git/log.rs`](/crates/core/src/git/log.rs): milestone and line reads.
- A new core view of a feature's history.
- [`pulls.rs`](/crates/core/src/pulls.rs): the pull request's dates.

With tokens:

- [`claude-events.ts`](/packages/server/src/runner/claude-events.ts) and
  [`events.ts`](/packages/server/src/runner/events.ts): a neutral usage event.
- [`cache.ts`](/packages/server/src/runner/cache.ts): a migration, after splitting the migrations
  out.

With a page for changes:

- [`App.tsx`](/packages/web/src/App.tsx) `ItemPage`,
  [`ChangeAside.tsx`](/packages/web/src/ChangeAside.tsx), and the change tests.

## The proposal

### "Tokens used" names no number

A feature's tokens are 98% cache reads: 152 M in total, of which 113 k are output. A single "tokens"
figure is either huge and meaningless, or leaves out most of the work. The human removed the cost in
dollars on 2026-10-14 because it was an estimate.

### Past features have no tokens

Nothing was recorded before. Claude's transcripts hold input and cache counts, but their output
counts are placeholders, and their format is internal.

### "Restarts the agent" for PR comments

There is no restart in the runner: a session is resumed, or started fresh. Sending a message to an
idle session resumes it. "Restart" reads as "start a run", which a pre-filled message does.

### "Changes requested" never happens here

The workflow's only pull request feedback path needs a formal "Request changes" review. The owner of
these pull requests never submits one, and GitHub's docs do not say whether an author can on their
own pull request. Comments are the feedback that exists.

### Problems are mostly not the feature's

The proposal says features "show up as having problems when they don't". The check agrees with the
branch that wrote them: the server's build disagrees. A file being written is judged before it is
finished.

### Changes have no page

The proposal asks for "the change pages". A change opens its session, and a done change opens a
composer that cannot send.

### Sessions, plural

The proposal says "sessions". A feature has one Uraeda session. Fresh runs start new agent sessions
inside it, and earlier ones are not listed.

## Worth it and feasibility

- **Worth it.** The feature page is where the human follows a feature, and four of its five parts
  fix daily friction. The "Fix" badges send the human to non-problems. The dead "Pull request ready"
  button leads nowhere. The refused "Continue" blocks sending. The feedback path has never fired.
  The summary is new value, and its data is half there, in git.
- **Cost.** The largest pieces:
  - milestone reads from git;
  - token capture in the runner, with a migration in a file over its limit;
  - the composer's message picker;
  - the change page. No new dependency.
- **Outside behaviour.**
  - `modelUsage` on each streamed `result`, a running total with sub-agents: documented. Not yet
    seen in this runner's stream: the plan checks it first.
  - `gh pr view --json comments,reviews,createdAt,mergedAt`: documented, and `reviews` checked on
    this repository.
  - GraphQL review threads with `isResolved`: documented, not tried.
- **Guards.** None relaxed. Sending any message from the composer is already possible as a chat.

## Approaches

Criteria:

- the proposal: show where a feature is, what's next, and what it produced;
- the constitution: [git first](/specs/CONSTITUTION.md#ii-git-and-plain-text-first),
  [humans in control](/specs/CONSTITUTION.md#i-humans-stay-in-control),
  [review effort](/specs/CONSTITUTION.md#iv-review-effort-matches-impact);
- the [UI layout](/specs/decisions/ui-layout.md) and
  [UI behaviour](/specs/decisions/ui-behaviour.md) decisions;
- the [agents](/specs/decisions/agents.md) decision.

### Scope

Whether the five parts ship together. See [the code](#the-code).

| Option                                      | Human cost         | Coherence                       | Time to first fix    |
| ------------------------------------------- | ------------------ | ------------------------------- | -------------------- |
| A. One feature                              | one spec to review | one page, designed once         | after the whole      |
| B. Problems as a change, the rest a feature | two reviews        | the problems list changes twice | the change, in hours |

### The ongoing page

What the page shows, in which order. See [important reads](#important-reads) and
[what they have in common](#what-they-have-in-common).

| Option                                                            | Answers "where is it" | Answers "what's next" | Work  |
| ----------------------------------------------------------------- | --------------------- | --------------------- | ----- |
| A. Stages strip, next action, agent card, what it produced, notes | at a glance           | first thing           | large |
| B. Two columns: action and files; agent and stats beside          | in the side column    | first thing           | large |
| C. Today's sections, restyled                                     | buried                | gate banner only      | small |

### The done page

What a done feature shows. See [data a summary needs](#data-a-summary-needs-and-where-it-is).

| Option                                                      | What it produced | Readable record | Work   |
| ----------------------------------------------------------- | ---------------- | --------------- | ------ |
| A. Same page: stages with dates, figures, the record inline | yes              | in place        | large  |
| B. Stages and figures, the record a link                    | yes              | one click       | medium |
| C. The record inline, no figures                            | no               | in place        | small  |

### Tokens

Which number, and from where. See [Claude Code's token usage](#claude-codes-token-usage) and
["tokens used" names no number](#tokens-used-names-no-number).

| Option                                       | Meaning                         | Measured or estimated | Past features |
| -------------------------------------------- | ------------------------------- | --------------------- | ------------- |
| A. Total tokens, and output tokens beside it | all the work, and what it wrote | measured              | none          |
| B. Estimated cost in dollars                 | comparable across models        | estimated             | none          |
| C. No tokens                                 | none                            | none                  | none          |

### Where the summary's figures live

| Option                                                  | Durable                    | Format change | Works for past features |
| ------------------------------------------------------- | -------------------------- | ------------- | ----------------------- |
| A. Computed by the core from git; tokens from the cache | git yes, tokens local only | none          | yes, but tokens         |
| B. Written into the record's frontmatter at finish      | yes                        | the record's  | no                      |

### A page for changes

See [changes have no page](#changes-have-no-page).

| Option                                                               | Consistency  | Done change | Work   |
| -------------------------------------------------------------------- | ------------ | ----------- | ------ |
| A. A change gets the feature's page, with fewer stages               | one page     | a summary   | medium |
| B. The session stays a change's page; a done change shows its record | two patterns | the record  | small  |

### Opening the session

See [the proposal's path](#the-proposals-path-and-existing-actions) and
[pre-filled messages](#pre-filled-messages).

| Option                                                              | One button | Available in the session | Sending ever refused |
| ------------------------------------------------------------------- | ---------- | ------------------------ | -------------------- |
| A. One button; the composer offers the messages that apply now      | yes        | yes                      | no                   |
| B. One button with a menu of messages, on the feature page          | yes        | no                       | no                   |
| C. One button that always fills the step's message, cleared to chat | yes        | yes                      | no                   |

### Pull request comments

See [GitHub pull request reviews](#github-pull-request-reviews) and
["changes requested" never happens here](#changes-requested-never-happens-here).

| Option                                                    | Human in control | Loop risk        | Core work         |
| --------------------------------------------------------- | ---------------- | ---------------- | ----------------- |
| A. A message the human sends while a pull request is open | yes              | none             | message only      |
| B. The core reads unresolved comments and wakes the agent | no               | bots, re-reviews | GraphQL, polling  |
| C. Only formal "Request changes", as today                | yes              | none             | none, never fires |

### What counts as a problem

See [problems found on features in progress](#problems-found-on-features-in-progress) and
[diagnostic severities](#diagnostic-severities).

| Option                                                                        | False alarms on Home | `ura check` changes | Drift visible      |
| ----------------------------------------------------------------------------- | -------------------- | ------------------- | ------------------ |
| A. Only what blocks the workflow is a problem; the rest are notes on the page | none                 | none                | as notes           |
| B. Problems only in the file waiting for the human                            | few                  | none                | at gates           |
| C. Turn format rules into warnings in the core                                | none                 | exit 0 on format    | hidden from the UI |

### Template drift at the source

Checking a branch with its own templates, when the checkout carries the skill. See
[problems found on features in progress](#problems-found-on-features-in-progress).

| Option                                      | Fixes this repository | Fixes users' upgrades    | Work   |
| ------------------------------------------- | --------------------- | ------------------------ | ------ |
| A. Leave it; the tiers above quiet drift    | quieted               | quieted                  | none   |
| B. Read templates from the checkout's skill | yes                   | only with a repo install | medium |

### Needs no choice

- **Status vocabulary**: the runner's session statuses already match the products' (working, needs
  you, attention, idle). The page reuses them.
- **Link from task to pull request and back**: the page links its pull request; the pull request's
  description links the record.
- **Live feed**: the session page is the feed; the feature page links it.
- **Bot loops and outdated comments**: only with automatic pick-up, option B of
  [pull request comments](#pull-request-comments).
- **Both widths**: the layout decision requires both, in the spec's mockups.

## Not checked

- Whether GitHub lets a pull request's author submit "Request changes" on their own pull request:
  the docs read do not say, and no search result confirmed it.
- `modelUsage` in the runner's own stream: documented, not yet captured, since the runner drops it.
- GraphQL `reviewThreads` on this repository: not queried.
- Linear's issue page agent panel, and Codex's task status labels: not described in the docs read.
