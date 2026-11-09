# Discovery, round 01: Agents catch up open pull requests with main

## Summary

Tools that keep pull requests current with their base branch follow one of two policies: update a
pull request only once it conflicts (Renovate's default without automerge, Dependabot), or whenever
it falls behind (Kodiak's `update.always`, Mergify's `update`, strict status checks). The second
costs up to N(N-1)/2 updates for N open pull requests. Updates of a pull request under review mostly
merge the base in rather than rebase. Agents that resolve conflicts (Copilot, CodeRabbit) verify the
build and tests, and give up loudly: no commit, and a comment naming the files.

The proposal asks for the update to start by itself when the human pulls main after a merge, for
features at the pull request step, with an agent stopping only on hard conflicts, behind a setting.

Uraeda already has most parts. The skill has a catch-up, a rebase on `origin/<default>` with
conflict rules, run at the final review and again before a pull request is marked ready. The server
fetches `origin` every 5 minutes, reads open pull requests through `gh` every minute, and continues
stopped runs by itself behind switches in `[runs]`. Missing are any notion of a branch behind or
conflicting with the default branch, a "main moved" signal for the server's own code, and an
automatic run that starts from a human gate rather than continuing a stopped turn.

Code read on `main` at `e1770083`: this branch starts before the Codex runtime merged, so it lacks
the models decision and the runtime picks the notes below mention.

## How other products do it

### GitHub

- "Update branch" is offered only when the branch is behind and has no conflicts. It merges the base
  in by default, and "Update with rebase" is an option.
  [Keeping your pull request in sync](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/keeping-your-pull-request-in-sync-with-the-base-branch)
- Strict status checks require a branch up to date before merging, at the cost of "more builds".
  Loose checks warn that checks "may fail after you merge your branch if there are incompatible
  changes with the base branch". Updating a branch can dismiss stale approvals.
  [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- The merge queue tests each pull request on the latest base plus those ahead of it, so authors need
  not keep branches current. A conflicting or failing one leaves the queue.
  [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- No webhook fires when the base moves or a pull request starts conflicting: clients poll the
  `mergeable` field, computed by a background job.
  [Webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads),
  [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)
- Copilot resolves conflicts on request ("@copilot Merge in main and resolve the conflicts"), then
  checks the build and tests and pushes.
  [Changelog, 2026-03-26](https://github.blog/changelog/2026-03-26-ask-copilot-to-resolve-merge-conflicts-on-pull-requests/)
- Copilot's Agent Merge watches a pull request and starts by itself when a blocker it was asked to
  fix appears, "Resolve merge conflicts" among them. It is turned on per pull request, or for every
  pull request one creates, and stopped by unassigning Copilot. Its docs do not say whether it
  merges or rebases, or what it does on failure.
  [Changelog, 2026-10-28](https://github.blog/changelog/2026-10-28-agent-merge-watches-and-fixes-pull-requests-in-the-cloud),
  [Get pull requests ready to merge](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/get-pull-requests-ready-to-merge)

### GitLab

- A merge request can be rebased from a button or `/rebase` only when the rebase is conflict-free.
  "Rebase without pipeline" saves CI.
  [Merge methods](https://docs.gitlab.com/user/project/merge_requests/methods/)
- Merge trains test each request on the target plus those ahead. A failing one leaves the train with
  a note, naming up to 10 conflicting files.
  [Merge trains](https://docs.gitlab.com/ci/pipelines/merge_trains/)

### Renovate

- `rebaseWhen` defaults to `auto`: `behind-base-branch` with automerge or required up-to-date
  branches, `conflicted` otherwise. It warns that `conflicted` with automerge lets two untested
  updates land together.
  [Configuration options](https://docs.renovatebot.com/configuration-options/)
- A `stop-updating` label opts one pull request out, and a human's commit stops updates of that
  branch. Lock file conflicts are regenerated, never resolved by hand.
  [Updating and rebasing](https://docs.renovatebot.com/updating-rebasing/)
- Lock files "greatly increase the chance that merging one PR will result in a second PR becoming
  conflicted", and each rebase triggers another round of CI.
  [Noise reduction](https://docs.renovatebot.com/noise-reduction/)

### Dependabot

- Rebases by default to resolve conflicts, triggered when a pull request "is in conflict after a
  recent push to the target branch". It stops once someone else pushed to the branch, and after 30
  days. `rebase-strategy: disabled` turns it off.
  [Managing pull requests](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/managing-pull-requests-for-dependency-updates),
  [Options reference](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)

### Mergify

- The `update` action merges the base into a pull request that is behind, open, and not conflicting:
  conflicting ones are skipped. The docs advise limiting it to labelled, non-draft pull requests to
  spare CI. `rebase` exists too, not for forks.
  [Update](https://docs.mergify.com/workflow/actions/update/),
  [Rebase](https://docs.mergify.com/workflow/actions/rebase/)

### Kodiak, bulldozer, and the autoupdate action

- Kodiak's `update.always`, off by default, updates every pull request that falls behind: N open
  pull requests cost "at least N(N-1)/2 updates". On conflict it comments and removes its label.
  [Kodiak config](https://kodiakhq.com/docs/config-reference)
- bulldozer merges the target in on a new target commit, opt-in, with a "Do Not Update" label.
  [bulldozer](https://github.com/palantir/bulldozer)
- The autoupdate action runs on a push to the base, and by default fails each pull request that
  conflicts. [autoupdate](https://github.com/chinthakagodawita/autoupdate)

### Graphite

- `gt sync` pulls trunk, then restacks every branch it can without input. Conflicting branches are
  skipped and listed for `gt restack`. Branches checked out in another worktree are left alone.
  [Sync with a remote](https://graphite.com/docs/sync-with-a-remote-repo)

### CodeRabbit

- Resolves on request with a merge commit. It declines security-critical code and mutually exclusive
  business logic, and a decline in any file aborts the whole attempt: no commit, and a comment with
  the file and why. It checks for conflict markers, builds and lints, and aborts if the branch moves
  while it works.
  [Resolve merge conflict](https://docs.coderabbit.ai/finishing-touches/resolve-merge-conflict)

### Cursor and Claude Code

- Cursor's agent offers to resolve a conflict in chat, and its background agents surface conflicts
  as follow-ups. [Changelog 1.2](https://cursor.com/en/changelog/1-2)
- Claude Code's cloud auto-fix pushes clear fixes and asks before ambiguous ones. It cannot react to
  conflicts, for lack of a webhook.
  [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)

### What they have in common

- **A trigger policy**: only on conflict, or whenever behind. Several scope it by label.
- **Merge rather than rebase** for a pull request under review, rebase as an option.
- **An opt-out per pull request**, and hands off once a human pushed to the branch.
- **Giving up loudly and whole**: no partial commit, a comment or a list naming the files.
- **Verifying after resolving**: build, tests, lint. A clean textual merge is not trusted.
- **Caps** on updates and builds running at once.
- **Aborting on a race**: the branch moved while resolving.
- **Regenerating lock files** rather than merging them.
- **A manual retry**, like `@dependabot rebase` or Renovate's label.

## Standards and libraries

### Accuracy of automated conflict resolution

- Merge-Bench: the best models resolve "less than 60%" of 7,938 conflict hunks.
  [arXiv 2605.25890](https://arxiv.org/abs/2605.25890), abstract read
- A Java study: LLMs match the developer's resolution on about 55% of 292 cases, and an LLM judge
  accepted 4 of 5 structurally invalid merges. [arXiv 2607.27674](https://arxiv.org/abs/2607.27674)
- SWE-Git-Bench: best whole-file exact match 26.5%, and half the near-misses likely unsafe to
  commit. [NeurIPS 2026 poster](https://neurips.cc/virtual/2026/poster/139812)
- Agent pull requests: 79.4% overlap in time with another agent's, and replayed merges conflict in
  41.7% across agents. [arXiv 2607.04697](https://arxiv.org/abs/2607.04697)
- Semantic conflicts merge cleanly and break: "We can't automatically resolve semantic conflicts",
  and tests catch most of them.
  [Martin Fowler, Semantic conflict](https://martinfowler.com/bliki/SemanticConflict.html)
- These benchmarks score a single resolution with no build or tests to check it; the skill's
  catch-up runs the project's complete validation after resolving. Judgement: real accuracy with
  validation is higher, but unmeasured.

### git

- `git merge-tree --write-tree` merges two commits without touching a worktree or the index: exit 0
  when clean, 1 on conflicts. [git-merge-tree](https://git-scm.com/docs/git-merge-tree)
- Rebasing a published branch forces anyone downstream to fix their history.
  [git-rebase](https://git-scm.com/docs/git-rebase) A force-push shows on GitHub as a timeline
  event. [Changelog](https://github.blog/changelog/2018-11-15-force-push-timeline-event/)
- `post-merge` fires on `git pull` fast-forwards and merges, `post-rewrite` on a rebasing pull with
  local commits, and `reference-transaction` on every ref update, fetches included.
  [githooks](https://git-scm.com/docs/githooks). Checked by an experiment with git 2.56.0.
- Git 3.0 makes reftable the default ref format, so watching ref files breaks there.
  [Breaking changes](https://git-scm.com/docs/BreakingChanges)
- pnpm resolves `pnpm-lock.yaml` conflicts with `pnpm install`. [pnpm and git](https://pnpm.io/git)

### gix

- gix 0.89, the version the core uses ([`Cargo.toml`](/Cargo.toml)), has `merge_commits` behind its
  `merge` feature, and `with_object_memory` keeps the merge's objects in memory. Checked by an
  experiment outside the repository: on this repository, `origin/main` against three branches took 3
  to 9 ms, and found the one conflict `git merge-tree` found, writing nothing.

## The code

### Important reads

- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): the skill's step table in code. A
  finished feature's open pull request is `pull-request`, waiting on the human; one lacking the
  branch's latest commit is `push`, waiting on the agent. Nothing looks at the default branch.
- [`crates/core/src/pulls.rs`](/crates/core/src/pulls.rs): open pull requests from
  `gh pr list --json headRefName,headRefOid,number,url,isDraft,reviewDecision`, a snapshot kept 10
  minutes when `gh` fails. `mergeable` is not read.
- [`packages/server/src/pulls.ts`](/packages/server/src/pulls.ts): refreshes them at start, after
  each branch move, and every minute while a branch is past its last task.
- [`packages/server/src/git-fetch.ts`](/packages/server/src/git-fetch.ts): fetches `origin` at
  start, when the Git page opens, and every 5 minutes, silently. The server never pulls on its own.
- [`crates/core/src/watch.rs`](/crates/core/src/watch.rs): the watcher. A move of the local default
  branch lists every feature with a branch as changed, since each feature's hash holds the default
  tip. A fetch only changes the `git` field. No change says from which commit to which.
- [`crates/core/src/git.rs`](/crates/core/src/git.rs): `tip` prefers `refs/heads/<b>` over
  `refs/remotes/origin/<b>`, so a fetch alone does not move the default tip the watcher reads.
- [`packages/server/src/repositories.ts`](/packages/server/src/repositories.ts): starts the fetcher,
  the pull request refresher, and the watcher per repository; its `changed` callback, wired in
  [`server.ts`](/packages/server/src/server.ts) to the extensions only, is where a trigger fits.
- [`packages/server/src/runner/continuer.ts`](/packages/server/src/runner/continuer.ts): automatic
  continues after a restart or a limit, their cap, and their switches. 486 lines, near the 500-line
  limit: a new kind of automatic run belongs in its own module.
- [`packages/server/src/fate/continue-all.ts`](/packages/server/src/fate/continue-all.ts): the
  closest model of "send each feature its step's message", collecting refusals per feature.
- [`packages/server/src/runner/message.ts`](/packages/server/src/runner/message.ts): each step's
  work and stop line, and the rule sending a workflow message at a human gate as a chat ("Sent as a
  message: the feature now waits on you."). A catch-up message at `pull-request` would be sent as a
  chat today.
- [`packages/server/src/runner/send.ts`](/packages/server/src/runner/send.ts) and
  [`live-sessions.ts`](/packages/server/src/runner/live-sessions.ts): one session works per worktree
  at a time; a message to a running session is queued after its turn.
- [`packages/server/src/fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts): a turn ending
  at `pull-request` notifies "Pull request #N is ready for review" again, since the key holds the
  turn.
- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs): `[runs]` holds
  `continue_after_restart`, `continue_after_limit`, `automatic_continues`, and
  `build_in_fresh_session`. [`RunSettings.tsx`](/packages/web/src/settings/RunSettings.tsx) shows
  them. [`views.ts`](/packages/web/src/views.ts) is at 489 lines.
- [`packages/server/src/extensions/events.ts`](/packages/server/src/extensions/events.ts) and
  [`extension-api.ts`](/packages/server/src/extension-api.ts): extensions get `commit-landed`, the
  main checkout's `HEAD` moving, but cannot send a message or start a run.
- [`crates/core/src/git/resolve.rs`](/crates/core/src/git/resolve.rs): the Git page's merge, and its
  conflict resolution by sides, for the main checkout only.

### The proposal's path and existing actions

1. The human merges a pull request on GitHub, usually as a rebase merge, as the finish step advises;
   the repository deletes the head branch on merge (`gh repo view`).
2. The human pulls main, from the Git page or a terminal. Today the watcher sees the local default
   branch move, every feature republishes, and pull requests refresh: the merged one turns `done`.
3. Nothing happens to the other open pull requests. On GitHub, one may show a conflict. Pull request
   #107 shows the cost: force-pushed at 22:12 on 2026-11-07, after #108 merged at 22:03, then merged
   at 22:15.
4. With the feature, each other open pull request needing it would get an agent turn in its
   worktree, which rebases, resolves, validates, and pushes, then stops at the pull request again.

Existing actions the feature meets:

- **A session already working on the branch**: a message would queue after its turn; the catch-up
  should wait for it.
- **Changes requested, or a draft**: their own steps run an agent, and the finish step catches up
  before marking ready.
- **`gh` unavailable**: the step is `pull-request-unknown`; nothing can be checked.
- **A human pushing to the branch meanwhile**: the skill's `--force-with-lease` refuses to overwrite
  it.
- **Stopping or dismissing the run**: the run-lifecycle rules say it must not continue by itself.
- **Merging several pull requests in a row**: each move of main could start a catch-up of every
  other one.
- **Cleaning a merged feature** (`ura clean`): unrelated; the merged branch is `done` and skipped.

### Rules and their owners

- **When a branch's step is `push`**: [`pulls.rs`](/crates/core/src/pulls.rs) `PullRequests::state`,
  copied in prose in the skill's step table and `cli.md`.
- **Automatic runs and their switches**: [`continuer.ts`](/packages/server/src/runner/continuer.ts),
  under the [run lifecycle](/specs/decisions/run-lifecycle.md) decision.
- **The catch-up's conflict rules**: the skill's
  [implementation reference](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch)
  alone.

### Likely changes

- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs) and
  [`pulls.rs`](/crates/core/src/pulls.rs): a `catch-up` step, with a branch-conflicts or
  branch-behind check against `origin/<default>`, with option A of
  [where the rule lives](#where-the-rule-lives).
- `crates/core/src/git/`: the check, through gix's `merge_commits` in memory, and the `merge`
  feature in [`Cargo.toml`](/Cargo.toml), under every option.
- A new server module watching the default branch's remote tip per repository, hooked at
  [`repositories.ts`](/packages/server/src/repositories.ts)' `changed`, under every option.
- [`runner/message.ts`](/packages/server/src/runner/message.ts),
  [`runner/events.ts`](/packages/server/src/runner/events.ts): a `catch-up` trigger, its work line,
  and its session line.
- [`settings.rs`](/crates/core/src/settings.rs), the binding, `settings.ts`,
  [`RunSettings.tsx`](/packages/web/src/settings/RunSettings.tsx): one switch in `[runs]`.
- [`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts): no new "ready for review" after a
  catch-up that ended where it started.
- The skill: [`SKILL.md`](/skills/uraeda/SKILL.md)'s step table, a catch-up section after the push
  in [`implementation.md`](/skills/uraeda/references/implementation.md), `cli.md`, and the change
  reference, with option A of [where the rule lives](#where-the-rule-lives).
- Docs: `docs/web-ui.md` for the setting.
- Tests guarding changed behaviour: `pull_request_rows` and `finishing_rows` in
  `crates/core/tests/steps.rs`, `an_open_pull_request_and_the_implementation_keep_their_steps` in
  `crates/core/tests/pulls.rs`, and "US5: Continue all sends each stopped run its step's message,
  and none to a gate" in `packages/server/src/__tests__/continue-all.test.ts`.

## The proposal

### "Outside /specs" misses decisions and records

The proposal suggests catching up when main changes files outside `specs/`. Decisions live in
`specs/decisions/`, and the catch-up reads them to stop on a new rule that conflicts with the
branch. Records in `specs/done/` can conflict with a branch's link repairs. Meanwhile branches never
write `PRIORITIES.md` or `INBOX.md` ([git decision](/specs/decisions/git.md)), and proposals and
notes are written on the default branch, so those cannot conflict.

### Pulling is not needed to see a merge

The proposal triggers on the human's pull. The server already fetches `origin` every 5 minutes, and
the pull requests target `origin/main`, so a merge on GitHub shows within 5 minutes without a pull.
A local merge into main changes nothing for the pull requests until it is pushed.

### "Catch up" or "fix merge conflicts"

The title says fix merge conflicts, the body says catch up to main. A branch can be behind without
conflicting, and GitHub's rebase merge works then, untested against the new main.

### "Raise an issue"

The proposal does not say where a stopped catch-up raises its issue: a GitHub issue, a comment on
the pull request, the session, or a round of questions as the skill asks for a conflict needing a
choice.

### Merge or rebase

The skill's catch-up rebases and pushes with `--force-with-lease`; the
[git decision](/specs/decisions/git.md) says tools never force-push. Most compared tools merge the
base in for a pull request under review. The finish step needs the record to stay the branch's last
commit.

## Worth it and feasibility

- **Gain**: the human merges one pull request and finds the others ready to merge, without
  restarting agents, as the proposal's 4 overnight features need. #107 shows it happens today.
- **Cost**: a small feature on existing parts: a check in the core, a trigger module, a setting, and
  a skill section. Each catch-up costs an agent turn and a full validation per pull request: with
  every behind pull request caught up, N open pull requests cost up to N(N-1)/2 catch-ups as they
  merge one by one.
- **Outside behaviour relied on**: gix's in-memory merge, checked above. `gh` reading pull requests,
  already relied on. GitHub rebase-merging a branch that holds merge commits was not checked: it
  matters only if the catch-up merges main in.
- **Risk**: automated resolution is right about 55 to 60% of the time without validation, per the
  benchmarks above. The complete validation, and stopping on choices, are the guard.
- **Guards relaxed**: an agent would push to a pull request's branch without the human asking each
  time. It pushes only to its own branch, with the permissions it already has; nothing new is
  reachable by an attacker.

## Approaches

### Which pull requests catch up

What makes an open pull request need a catch-up. Relies on
[the trigger policies](#what-they-have-in-common) and
["outside /specs"](#outside-specs-misses-decisions-and-records). Criteria: the proposal's "fix
conflicts", agent usage, validation of what merges, and new decisions checked.

| Option                                                  | Runs per merge                | Untested merges | New decisions read               |
| ------------------------------------------------------- | ----------------------------- | --------------- | -------------------------------- |
| A. Only when it conflicts with main                     | rare                          | yes             | only on conflict                 |
| B. When behind with code, decisions, or records changed | every other open pull request | no              | always                           |
| C. When behind with files outside `specs/` changed      | most other open pull requests | no              | not when only a decision changed |

### When Uraeda looks

What moves the check. Relies on [pulling is not needed](#pulling-is-not-needed-to-see-a-merge).

- A. The remote default branch moves: a pull, a push, or the 5-minute fetch.
- B. The local default branch moves: a pull or a local merge, as proposed.

### Where the rule lives

Whether the catch-up is a step of the workflow or a server behaviour. Criteria: the
[constitution](/specs/CONSTITUTION.md)'s principle V (tools optional), the
[feature status](/specs/decisions/feature-status.md) decision, the code's
[one home per rule](/skills/uraeda/references/code-quality.md#one-home-per-rule).

- A. A step: an open pull request needing a catch-up reads as agent work in the core, the skill's
  table, and `ura next`; the server only starts it.
- B. A server behaviour: the step table is unchanged, the pull request keeps reading ready, and the
  server sends a message bypassing the chat rule.

### A conflict the agent cannot settle

Relies on [raise an issue](#raise-an-issue) and [CodeRabbit](#coderabbit).

- A. Leave the branch untouched, comment on the pull request, and ask the human; the human answers
  by requesting changes, which the comments pass handles.
- B. A new round of questions, reverting the finishing commit and turning the pull request back into
  a draft, as the skill's rule for a conflict needing a choice says today.
- C. A message in the session only.

### Rebase or merge

Relies on [merge or rebase](#merge-or-rebase).

- A. Rebase and push with `--force-with-lease`, as the skill does today.
- B. Merge main in, with a plain push.

### The switch

Where it lives and its default. Relies on the [settings](/specs/decisions/settings.md) and
[run lifecycle](/specs/decisions/run-lifecycle.md) decisions, and on the Run options feature in
flight, which plans per-feature overrides of run settings.

- A. One switch in `[runs]`, on by default.
- B. The same switch, off by default.
- C. Within Run options, once it is built.

### Needs no choice

- **Opt-out per pull request**: Run options plans per-feature overrides of run settings; until then
  stopping the run is the opt-out.
- **Verifying after resolving**: the skill's catch-up already runs the complete validation.
- **Caps**: one catch-up per branch per remote tip of main, so a run cannot loop.
- **Aborting on a race**: `--force-with-lease` refuses a push over a human's commit.
- **Regenerating lock files**: the skill's catch-up already regenerates generated files.
- **A manual retry**: Continue on the feature, or "Continue all".
- **Hands off once a human pushed**: the lease covers losing work; the session reads what is there.

## Not checked

- Copilot Agent Merge's behaviour on failure, and whether it merges or rebases: undocumented.
- Devin's, Jules's, and Codex cloud's conflict handling: no official documentation found.
- Whether GitHub's rebase merge accepts a branch holding merge commits.
- Cargo's official guidance on `Cargo.lock` conflicts: none found.
- The full papers behind the benchmarks: abstracts only.
