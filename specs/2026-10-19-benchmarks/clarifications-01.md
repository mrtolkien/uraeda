---
status: awaiting-human
---

# Clarifications, round 01: Benchmarks

> [!IMPORTANT]
>
> 11 questions, about 25 minutes.
>
> - Verdict: worth building as proposed. The runner, the adapter, and `ura next --json` now exist,
>   so the loop is small. Only the choices below stay open.
> - What a run measures and what it is compared against make "not completely stupid" readable. Five
>   cases cannot prove anything: only a gross failure or a large gain will show.
> - The way agents are reached is the one lasting choice. It decides whether Codex and pi-durable
>   later mean a new adapter or a second integration.
> - What the simulated human knows and how it behaves work together. Studies show simulated users
>   approve too easily, and no study isolates the same model playing both roles.
> - Web access, the account, and the budget are open. A full flow likely costs $12 to $25 a case.
> - Ponytail is not a role-play tool, so the human's guidelines are written from scratch.
> - 15 points are settled without you, at the end: check them.

## Context

### Goal

The [proposal](proposal.md) asks for a first benchmark of the full Uraeda flow on at least 5 real
software cases, to check that it holds up. Claude Code runs it, with Opus 5.5 as the agent and as
the human, who follows written guidelines. The Claude Code dependency stays loose, so Codex and
pi-durable can follow. Results go in a `benchmarks` folder, with the skill's SHA, models, and
harness versions.

### Today

This replaces an earlier round, from before the repository held code. Now:

- The server's [adapter](/packages/server/src/runner/adapter.ts) opens an agent in a folder and
  exchanges messages with it. It passes no model or effort.
- `ura next --json` tells who is up, the agent or the human, and `ura answer` and `ura review` are
  the human's commands.
- The [agents decision](/specs/decisions/agents.md) names benchmarks in its scope. It requires the
  adapter, and forbids tools from touching the model or the effort.
- The skill a run loads is whatever the working tree holds.
- Published results for Claude are aggregates of one pass of a scaffold: no per-task scores, no Opus
  5.5. No benchmark of a spec-driven flow exists.

### Scope

The cases, the runner, the simulated human, how a run is compared, and how results are recorded.
Codex and pi-durable come later. The bug-and-small-change flow stays out.

### Sources

- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.
- The [agents decision](/specs/decisions/agents.md), and the runner's code in
  [`packages/server/src/runner/`](/packages/server/src/runner/).

## Q1: Which benchmark do the 5 cases come from?

The flow needs feature-sized work with something to clarify, hidden tests, and an image that does
not contain the solution.

- **SWE-bench Pro V2** has 642 tasks, and a hard subset of 51. Each task has a pull request
  description, a list of requirements, and the interface the tests call. Images carry no solution.
- **DeepSWE** has 113 original tasks with complete specs. Patches average 668 lines in 7 files.
- Both ship hidden tests, and neither has a per-task Claude score to compare with.

A research agent read five hard Pro V2 tasks, and none was run yet. They are an `ansible` multipart
helper, two `openlibrary` author-name tasks, a `qutebrowser` cleanup, and a `navidrome` password
change. Their images weigh 0.7 to 1.3 GB. More in
[discovery](discovery-01.md#where-the-cases-come-from).

Why it matters: it decides how much there is to ask, the cost of a case, and what the human can
know.

- **A (recommended). Five tasks from the hard subset of SWE-bench Pro V2, chosen across repositories
  with small images.**
  - [pro] images and hidden tests are verified, and the requirements list becomes the human's brief.
  - [con] the requirements are explicit, so there is less to ask than on a real proposal.
  - Why recommended: it is the cheapest source with a ready brief, and it was your earlier choice.
- **B. Five tasks from DeepSWE.**
  - [pro] original tasks, so nobody has seen them, and a complete spec to hold as the brief.
  - [con] about five times the code a task needs, and a higher cost for each of them.
- **C. Three from SWE-bench Pro V2 and two from DeepSWE.**
  - [pro] two kinds of task and grader.
  - [con] two graders to integrate for five cases.

**Answer:**

## Q2: What should a run measure?

Five cases are too few for a score to mean anything. One task flipping is 20 points. One run varies
by 2 to 6 points on its own. What a run is compared against is Q3. More in
[discovery](discovery-01.md#what-a-run-measures).

Why it matters: it sets what "not completely stupid" means, and how much the runner must grade.

- **A (recommended). Each case gets the benchmark's hidden tests, pass or fail, and the process
  metrics. It gets one judged check: how many hidden requirements reached the approved spec.**
  - [pro] it says whether the code works, what it cost, and whether the questions found what
    mattered.
  - [con] the judged check is one model-graded number per case.
  - Why recommended: a failure traces to the questions or to the build, for one judge prompt.
- **B. The hidden tests and the process metrics only.**
  - [pro] fully objective, and the least to build.
  - [con] a failed case cannot be traced to a stage.
- **C. A, plus a judged quality score for each artifact: discovery, questions, spec, and plan.**
  - [pro] shows where the flow is weak, stage by stage.
  - [con] a rubric per artifact, and judge noise on every number.

**Answer:**

## Q3: What is each run compared against?

The earlier answer was that established benchmarks should already have results. They do not for
this: only aggregates exist, from other scaffolds and other models, and none for Opus 5.5. A plain
Claude Code run on the same task, image, model, and effort is the one fair comparison. More in
[discovery](discovery-01.md#what-it-is-compared-against).

Why it matters: without a baseline, a pass can come from the model alone, and a failure from a hard
task.

B can come on top of A.

- **A (recommended). Plain Claude Code, given the proposal text in one prompt, without the skill or
  a human.**
  - [pro] shows what the whole flow adds, at $5 to $12 a case.
  - [con] one more run to pay and to grade for each case.
  - Why recommended: it is the only comparison with the same model, image, and tests.
- **B. A, plus plain Claude Code given the proposal and the human's brief.**
  - [pro] shows how much of the missing information the flow recovered.
  - [con] a third run per case, and a comparison that is not about the workflow's own claim.
- **C. No baseline: the scores stand alone, with the published aggregates as a loose anchor.**
  - [pro] nothing more to run.
  - [con] nothing says whether the flow helped.

**Answer:**

## Q4: How does the benchmark reach the agents?

The loop is short: ask `ura next --json` who is up, run the agent or the human, repeat. What it
calls to run them is the choice. The server already has an adapter for Claude Code, a fake one for
tests, and the one text of the workflow's message. The agents decision requires every agent to go
through the adapter, and forbids tools from touching the model or the effort. A fresh configuration
folder for the benchmark can pin Opus 5.5 and its effort in its own settings, which the adapter then
reads. More in [discovery](discovery-01.md#how-agents-are-reached).

Why it matters: it decides whether Codex and pi-durable later mean a new adapter or a second
integration, and whether a decision changes.

- **A (recommended). Use the server's adapter and Claude adapter, the workflow's message from the
  server, and `ura next --json`. A benchmark-only configuration folder pins the model and the
  effort.**
  - [pro] one home for each rule, no decision to change, and a fake adapter for the runner's own
    tests.
  - [con] the server package must export what the runner needs, and `auto` mode stays on.
  - Why recommended: it follows the agents decision, and a new agent is only a new adapter.
- **B. The benchmark makes its own `claude -p` calls, with its own flags.**
  - [pro] free to use `bypassPermissions` in a container.
  - [con] a second parser of events and cost, and the adapter rule would need narrowing.
- **C. Harbor, with the flow written as multi-step tasks and its simulated user.**
  - [pro] about 40 agents built in, and results in a standard format.
  - [con] steps are fixed upfront, and its user talks in a chat, not by editing files.

**Answer:**

## Q5: What does the simulated human know?

A human answers from what they want. A benchmark task holds that only as its hidden requirements.
The agent gets the proposal, which is the task's title and description. The human gets more. Where
Q1 chooses SWE-bench Pro V2, that is the requirements list. More in
[discovery](discovery-01.md#what-the-simulated-human-knows).

Why it matters: without a brief, the human can only accept recommendations. With too much, it
dictates the solution.

- **A (recommended). A brief of the hidden requirements, in a human's words. The human also gets the
  files a human would open: the proposal, the questions, the spec, the plan, and the code. Never the
  tests or the solution.**
  - [pro] an owner who knows what they want, not the code, and the list is the reference for Q2's
    judged check.
  - [con] a brief written for each case.
  - Why recommended: it was your earlier choice, and it leaves nothing to leak beyond intent.
- **B. The brief, plus the reference solution.**
  - [pro] the human can tell good code from bad.
  - [con] it can dictate code, and the agent's own design is no longer tested.
- **C. A fixed list of questions and answers per case, with "decide yourself" otherwise.**
  - [pro] reproducible, and it measures which questions were asked.
  - [con] a list to write per case, and answers no real owner would give.

**Answer:**

## Q6: How does the simulated human behave at the gates?

Simulated users are measurably too easy. Against real people, GPT-4o's turns are short 1% of the
time against 29%, and simulators give more positive feedback. Real users push back on about 46% of
their prompts. SWE-Interact's "busy colleague" persona is public, and fits this: terse, answering
from the brief, "your call" when it has none. Ponytail is not a persona: it is a "write less code"
prompt for the agent under test. More in
[discovery](discovery-01.md#how-the-simulated-human-behaves).

Why it matters: a human who approves everything turns the benchmark into a measure of the agent
alone.

- **A (recommended). A busy technical owner, written in `benchmarks/human.md`:**
  - **Questions:** it answers from the brief in a few words, and says "your call" when the brief is
    silent.
  - **Spec:** it approves only when the brief's requirements appear in it with nothing added, asks
    for changes at most twice, and confirms the risk tier.
  - **Plan:** it reviews only when the workflow asks.
  - **End:** a run ends when the branch is pushed with its description.
  - [pro] close to the intended user, and runs stay bounded.
  - [con] taking "your call" is still lenient.
  - Why recommended: it tests whether the spec matches intent without inventing preferences.
- **B. It takes every recommendation and approves everything.**
  - [pro] the shortest runs.
  - [con] the "easy mode" that studies of simulated users warn about.
- **C. A demanding reviewer, who challenges recommendations and asks for alternatives.**
  - [pro] closest to real users' pushback.
  - [con] more rounds and cost, and preferences invented beyond the brief.

**Answer:**

## Q7: Where does the agent run?

The agent runs tests while it implements, and a case's dependencies live in its image. Running
`claude` on the host in a copy of the repository cannot run them. The adapter's `command` can be
another program, such as a wrapper that runs `claude` inside the container. That is not tried yet,
and the first task of the plan would check it. More in
[discovery](discovery-01.md#where-the-agent-runs).

Why it matters: it decides whether the agent can test its work, and the effort per case.

- **A (recommended). In the case's own image, through a wrapper given to the adapter as its command,
  with the hidden tests run later in a fresh container.**
  - [pro] the agent can run tests, and each case is isolated.
  - [con] Claude Code, the plugin, and the configuration folder must work inside the image.
  - Why recommended: it is the only option where the agent works as it would on a real project.
- **B. On the host, in a copy of the repository.**
  - [pro] the least to build.
  - [con] no dependencies, so no tests, and no isolation between cases.
- **C. A Nix dev shell or a container built per case.**
  - [pro] full control of the environment.
  - [con] an environment to write for each case.

**Answer:**

## Q8: Can the agents use the web during runs?

Discovery reads the web by design. The solution of a task built from a merged pull request may be on
its upstream repository. SWE-bench's rules forbid looking up solutions, and the locked Pro V2 agent
blocks `WebFetch` and `WebSearch` altogether. More in
[discovery](discovery-01.md#web-access-during-runs).

Why it matters: without the web, discovery loses half its research. With it unrestricted, a run can
find the answer.

- **A (recommended). Web allowed, with each task's upstream repository blocked, and every fetched
  address logged and checked after the run.**
  - [pro] the flow runs as designed, and a leak is caught.
  - [con] a deny rule per case, and a check at the end.
  - Why recommended: it keeps discovery intact at a small cost.
- **B. No web.**
  - [pro] no leak is possible, and it matches the locked Pro V2 protocol.
  - [con] discovery without its outside research is not the flow as designed.
- **C. Web allowed, with no restriction.**
  - [pro] nothing to set up.
  - [con] a result can come from the published solution.

**Answer:**

## Q9: How many runs, and with what budget?

Published costs suggest about $12 to $25 for a full flow on a case, and $5 to $12 for a plain run.
For five cases, one run of each arm is about $85 to $185, and three runs of each about $255 to
$555.
Those are estimates from other benchmarks' costs, not measured here. More in
[discovery](discovery-01.md#runs-and-budget).

Why it matters: it sets what a failed run costs, and whether per-case reliability can be read.

- **A (recommended). One run per case and arm, with a cap of $50 on a full run and $20 on a plain
  one.**
  - [pro] the lowest cost, and every failure can be read in full.
  - [con] no reliability reading, and a run lost to a tooling failure is rerun by hand.
  - Why recommended: five cases give a smoke test, and trace reading is its value.
- **B. Three runs per case and arm.**
  - [pro] reliability per case, with pass-all and pass-any.
  - [con] about three times the cost.
- **C. One run now, and repeats only for cases whose result is unclear.**
  - [pro] money goes where the signal is weak.
  - [con] a rule for "unclear" to write, and uneven numbers per case.

**Answer:**

## Q10: Which account pays for the runs?

A fresh configuration folder needs a credential. An API key is billed per token and gives a cost
readout. A subscription token works too, but Anthropic's
[terms](https://code.claude.com/docs/en/legal-and-compliance) speak of "ordinary use", and name
neither a personal batch run nor a ban. A change to the credits of `claude -p` was announced and
paused. More in [discovery](discovery-01.md#which-account-pays).

Why it matters: it sets the rate limits, the terms the runs rely on, and whether cost is visible.

- **A (recommended). An API key.**
  - [pro] clear terms, API rate limits, and a cost per run.
  - [con] real money from the first run.
  - Why recommended: a benchmark needs a predictable budget and a clear right to run.
- **B. Your subscription, signed in locally.**
  - [pro] within what you already pay.
  - [con] subscription rate limits, and terms that could change after the results exist.

**Answer:**

## Q11: What is committed to the repository?

Beyond the metadata the proposal asks for, a run produces the specs files the agent wrote, a final
diff, and a transcript of megabytes. The diff is third-party code, some of it under GPL. This
repository has no license file at its root. More in [discovery](discovery-01.md#what-is-committed).

Why it matters: it decides what a later reader can reproduce, how the repository grows over months,
and what code lands in it.

- **A (recommended). The record, the scores, each run's `specs/` files and its final diff. Raw
  transcripts stay out of git, with their SHA-256 recorded.**
  - [pro] the artifacts and the outcome are in git, and the size stays small.
  - [con] third-party diffs in a repository with no license file, and transcripts kept locally.
  - Why recommended: the spec files are what the flow produced, and plain text in git is the
    project's principle.
- **B. A, plus compressed transcripts.**
  - [pro] complete.
  - [con] megabytes per run, and the same licensing point.
- **C. The record and the scores only.**
  - [pro] minimal, and no third-party code.
  - [con] numbers only: a failure cannot be read afterwards.

**Answer:**

## Settled without the human

### Check these

- **Opus 5.5 judges** the requirement check, one hidden requirement at a time against the approved
  spec. A judge from another family would avoid self-preference, but needs a second harness. See
  [discovery](discovery-01.md#llm-judges).
- **The human is a separate session** of Opus 5.5, with no shared context, as the proposal decided.
  It sees only what a human would open, and the human's model is recorded with each run. See
  [discovery](discovery-01.md#simulated-users).
- **Every case's repository gets one short, generic constitution:** follow the repository's
  conventions, cover every behaviour with tests, keep changes simple. It is written once, in the
  spec, for you to edit. It keeps cases comparable. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Only the feature flow is benchmarked.** The proposal asks for the full flow, so the change flow
  stays for a later benchmark. See [discovery](discovery-01.md#needs-no-choice).
- **The numbers are a smoke test, not a score.** Results show a table of paired outcomes per case,
  with cost and time, never a significance claim. See
  [discovery](discovery-01.md#measuring-with-five-cases).

### Behaviour

- **The proposal of each case is the task's own text, verbatim.** The runner commits it, as the
  human who starts the feature. The plain baseline gets the same text. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The simulated human uses `ura answer` and `ura review`,** as the web UI does, so statuses and
  records are set the same way. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Each case has a local bare repository as its remote,** so the final push succeeds. With no pull
  request host, the description stays in the last commit, and the run ends there.
- **An action `auto` mode blocks is allowed once with the adapter's narrow rule,** like "Allow and
  continue". It is counted in the run's record. A second block of the same action fails the run.
- **A flagged request is an error, not a silent fallback.** The fallback to another model is turned
  off, and `modelUsage` must name only Opus 5.5. See
  [discovery](discovery-01.md#claude-code-in-headless-mode).

### Under the hood

- **The benchmark lives in `benchmarks/`,** with its README, `human.md`, cases, runner, and runs.
  Each run has a folder under a date and suite, so months of runs sit side by side. The layout in
  [`AGENTS.md`](/AGENTS.md) gains it.
- **The skill comes from a named commit, not the working tree.** Each run builds its plugin folder
  from `git archive`, and records the commit and whether the tree was clean. See
  [discovery](discovery-01.md#important-reads).
- **Each step and each human turn is a fresh session,** since a resumed session's cost is
  cumulative.
- **The runner is TypeScript on Node,** with the stack decision, and its checks join `vp run ready`.
  See [discovery](discovery-01.md#rules-and-their-owners).
- **A run records** what the proposal asks, and more:
  - the commits of this repository and the skill, with a dirty flag;
  - the harness and its version, the models asked for and answered, and the effort;
  - the task and image digest, and the human's model and persona version;
  - cost per role, and each step's time and gate outcome.

  See [discovery](discovery-01.md#needs-no-choice).

**Notes:**
