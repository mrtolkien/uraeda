---
status: awaiting-human
---

# Clarifications, round 01: Benchmarks

> [!IMPORTANT]
>
> 11 questions and 2 follow-ups on the benchmark, about 45 minutes.
>
> - Verdict: worth building, with changes: what a run measures, and what it is compared against, are
>   what turn "not completely stupid" into a result you can read. Everything else follows from them.
> - Where the cases come from, and what the simulated human knows, work together: the recommended
>   source ships a human-written list of requirements that becomes the simulated human's brief.
> - Opus 5.5 playing both the agent and the human is the setup most prone to an "easy mode"
>   benchmark, which studies of simulated users document. How the simulated human behaves at the
>   gates is where you can push back against it.
> - The runner is the project's first code, written before the open technical stack decision. Its
>   language would be a lasting choice.
> - Web access during runs is a fairness question: discovery needs the web, and some tasks'
>   solutions are online.
> - The budget is open in the proposal, and a full Uraeda run is several times the cost of a
>   one-prompt run.
> - 12 points are settled without you, at the end: check them.

## Context

### Goal

The [proposal](proposal.md) asks for a first benchmark of the full Uraeda flow on 5 real software
cases, to check that the workflow holds up:

- Claude Code in headless mode, with Opus 5.5 everywhere;
- Claude role-playing the human at each gate, following written guidelines;
- a loose dependency on Claude Code, since Codex and pi-durable come later;
- results saved in the repository, with the skill's SHA, the models, and the harness versions.

### Today

The repository holds the [skill](/skills/uraeda/SKILL.md) and a TypeScript toolchain, with no code.
Each step of the workflow expects a `specs/` folder, a constitution, and a remote to push to, which
a benchmark repository does not have. Most well-known benchmarks are small bug fixes with clear
texts. A handful of recent ones are feature-sized and leave decisions open.

### Scope

The benchmark's cases, its runner, the simulated human at each gate, and how results are recorded.
Codex and pi-durable come later.

### Sources

- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: What should a run measure?

Benchmarks measure either an outcome, with hidden tests, or the quality of each stage, with judges.
Five cases are too few for small differences to mean anything: one run's score varies by 2 to 6
points even on hundreds of tasks. What is compared against is Q2. More in
[discovery](discovery-01.md#what-a-run-measures).

Why it matters: this defines what "not completely stupid" means, and how much the runner has to
grade.

- **A (recommended). Each case gets three kinds of result:**
  - **the benchmark's hidden tests, pass or fail;**
  - **process metrics: cost, time, number of questions, rounds, and revisions;**
  - **one judged check: how many of the task's hidden requirements made it into the approved spec.**
  - [pro] it says whether the code works, what it cost, and whether the questions found what
    mattered, which is Uraeda's claim.
  - [con] the judged check is one LLM-graded number per case.
  - Why recommended: it traces a failure to either the questions or the implementation, for one
    judge prompt.
- **B. Hidden tests and process metrics only.**
  - [pro] fully objective, the least to build.
  - [con] a failed case cannot be traced to a stage.
- **C. A, plus a judged quality score for every artifact: discovery, questions, spec, and plan.**
  - [pro] shows where the workflow is weak, stage by stage.
  - [con] a rubric per artifact, and judge noise and bias on every number.

**Answer:** A

### Q1.A: Which model judges?

Only if you picked A or C in Q1. A judge favours text written by its own model, by about 10% for
GPT-4 in MT-Bench. The effect is weaker when it checks coverage against a reference list than when
it states a preference. More in [discovery](discovery-01.md#judge-model).

- **A (recommended). Opus 5.5, checking each hidden requirement against the spec, one by one.**
  - [pro] no second harness or account, and it matches "Opus 5.5 everywhere".
  - [con] some self-preference risk remains.
  - Why recommended: a requirement-by-requirement coverage check is the case where self-preference
    matters least.
- **B. A model from another family, through Codex.**
  - [pro] no self-preference.
  - [con] a second harness and account to set up before the first benchmark.

**Answer:** A, let's keep it simple for the moment. Also we're checking artifacts, not arguments.

## Q2: What is each Uraeda run compared against?

Anthropic's skill-creator compares paired runs with and without a skill. SWE-bench Pro shows how
much hidden requirements matter: without them, scores drop from about 26% to 8%. B can come on top
of A. More in [discovery](discovery-01.md#baselines).

Why it matters: without a baseline, a score of "3 out of 5" cannot say whether Uraeda helped.

- **A (recommended). Plain Claude Code, same model, given the same proposal text in a single prompt,
  without the skill or a human.**
  - [pro] shows what the whole workflow adds over asking the agent directly.
  - [con] one more run per case.
  - Why recommended: A, with B on top. A answers "is it worth it", B shows how much of the missing
    information the questions recovered, and both are cheap single-prompt runs.
- **B. Plain Claude Code given the proposal plus the hidden requirements: the fully specified
  task.**
  - [pro] gives the ceiling, what a perfect clarification round would reach.
  - [con] one more run per case. With DeepSWE cases in Q3, it is only possible for the cases that
    have a written brief.
- **C. No baseline.**
  - [pro] the cheapest.
  - [con] the scores stand alone.

**Answer:** C, but if we're looking at an established benchmarks there should be results already,
no?

## Q3: Which benchmark do the 5 cases come from?

Each candidate source has something to clarify and objective grading. They differ in what the
simulated human can be given to answer from, which Q4 decides.

- **SWE-bench Pro V2** (September 2026) ships, with each task, the requirements that humans added to
  remove ambiguity.
- **DeepSWE** (May 2026) has prompts that are underspecified by design, and verifiers that accept
  any valid design.

More in [discovery](discovery-01.md#where-the-cases-come-from).

Why it matters: it decides how big the cases are, which languages they cover, and whether the
simulated human has a real brief.

- **A (recommended). 5 tasks from SWE-bench Pro V2: the problem statement and the expected interface
  become the proposal, and the hidden `requirements` become the simulated human's brief.**
  - [pro] the brief is ready, written by humans, and shown to carry real decisions. Go, Python, and
    JavaScript repositories, with prebuilt images.
  - [con] tasks of about 100 lines across 4 files, at the small end of a feature. Its v1 grader
    wrongly rejected about 24% of correct patches, which V2 set out to fix.
  - Why recommended: it is the only source where the simulated human knows what it wants without
    knowing the code.
- **B. 5 tasks from DeepSWE: its underspecified prompt becomes the proposal.**
  - [pro] larger features (about 670 lines across 7 files), solutions never published, and graders
    that accept any valid design.
  - [con] no brief: the simulated human would only have the reference code, which leaks the
    solution, or nothing beyond the prompt.
- **C. 3 tasks from SWE-bench Pro V2 and 2 from DeepSWE.**
  - [pro] both sizes, more languages.
  - [con] two graders to integrate, and two kinds of brief to compare.
- **D. 5 tasks from FeatBench or Doc2Feat-Bench, built from real feature requests.**
  - [pro] inputs written as requests, like a proposal.
  - [con] Python only, and small: FeatBench's median patch is 18 lines, with one failing test.

**Answer:** A

## Q4: What does the simulated human know?

Benchmarks with a simulated user give it a hidden brief, and tell it to answer only from it. They
never let it see the tests, because simulated users volunteer information before it is asked for, in
about a quarter of successful episodes in one study. Its brief depends on Q3. How it behaves is Q5.
More in [discovery](discovery-01.md#what-the-simulated-human-knows).

Why it matters: it decides whether the questions are tested against real intent, or only accepted.

- **A (recommended). A brief with the task's hidden requirements, written as the owner's intent,
  plus read access to the repository. Never the tests or the reference solution.**
  - [pro] a technical owner who knows what they want, not the code. The same requirements serve as
    the reference for the judged check in Q1.
  - [con] when the brief is silent, the simulated human falls back on the agent's recommendation.
  - Why recommended: it matches Uraeda's human, and leaves nothing to leak beyond intent.
- **B. The brief, plus the reference solution.**
  - [pro] every question has an answer.
  - [con] the simulated human can dictate the code, and the benchmark measures the leak.
- **C. A fixed list of questions and answers per case. A question is matched to one, and anything
  else gets "decide yourself".**
  - [pro] reproducible, and measures exactly which needed questions were asked.
  - [con] a list to write per case, and rigid answers that no real owner would give.

**Answer:** A

## Q5: How does the simulated human behave at the gates?

Simulated users are measurably too easy:

- they go along with the agent more than twice as often as people do;
- their answers are rarely short;
- they inflate success rates above those reached with real people.

Real users of coding agents push back on about 46% of their prompts. The guidelines will spell out
the chosen behaviour, as the proposal asks. More in
[discovery](discovery-01.md#how-the-simulated-human-behaves).

Why it matters: a human who approves everything turns the benchmark into a measure of the agent
alone.

- **A (recommended). A busy technical owner, with a turn of its own at each gate:**
  - **Questions:** it answers from its brief, in a few words. When the brief is silent, it takes the
    recommended answer.
  - **Spec:** it requests changes when the spec contradicts or misses its brief, at most twice. It
    confirms the risk tier unless its brief makes the change riskier.
  - **Plan:** it reviews the plan only when the workflow requires it.
  - **Pull request:** a run ends when the branch is pushed with its description. The pull request
    review is not simulated.
  - [pro] close to the intended user, and runs stay bounded.
  - [con] accepting the recommendation when the brief is silent is still lenient.
  - Why recommended: it tests whether the spec matches intent without inventing preferences the
    brief does not hold.
- **B. It accepts every recommendation and approves everything.**
  - [pro] the shortest runs.
  - [con] the "easy mode" that studies of simulated users warn about.
- **C. A demanding reviewer, who challenges recommendations and asks for alternatives.**
  - [pro] closest to the pushback rate of real users.
  - [con] more rounds and cost, and preferences invented beyond the brief.

**Answer:** A, maybe we could use the ponytail skill: https://github.com/DietrichGebert/ponytail

## Q6: Can the agents use the web during runs?

Discovery reads online sources by design. SWE-bench Pro tasks come from merged changes, so their
solution may be on the upstream repository, and SWE-bench's rules forbid looking up solutions. More
in [discovery](discovery-01.md#web-access-during-runs).

Why it matters: without the web, discovery loses half its research; with it, a run can find the
answer.

- **A (recommended). Web allowed, with each task's upstream repository blocked. Every fetched URL is
  logged and checked after the run.**
  - [pro] the workflow runs as designed, and a leak is caught.
  - [con] a deny rule per case, and a check at the end.
  - Why recommended: it keeps the workflow intact at a small cost.
- **B. No web.**
  - [pro] no leak possible.
  - [con] discovery without its outside research, which is not Uraeda as designed.
- **C. Web allowed, with no restriction.**
  - [pro] nothing to set up.
  - [con] results can come from the published solution.

**Answer:** A

## Q7: What constitution does each case's repository get?

Every step reads the project's constitution, which in Uraeda is written by the human. Benchmark
repositories have none. More in [discovery](discovery-01.md#a-constitution-for-each-case).

Why it matters: the constitution steers every step, and a constitution that differs per case makes
results harder to compare.

- **A (recommended). One short, generic constitution for every case: follow the repository's
  existing conventions, cover every behaviour with tests, keep changes simple. I draft it in the
  spec, for you to edit.**
  - [pro] written once, and the same for every case.
  - [con] not tailored to each repository.
  - Why recommended: it keeps cases comparable, and a human still owns it.
- **B. One per repository, written by the simulated human from the repository's contributing
  guide.**
  - [pro] tailored to each repository.
  - [con] an agent writes the human's document, and cases differ.
- **C. No constitution.**
  - [pro] nothing to write.
  - [con] every step expects one.

**Answer:** A

## Q8: How are the agents run and isolated?

Uraeda's loop has a variable number of steps:

- an agent runs one step;
- the step may stop at a gate, a file with `status: awaiting-human`;
- the simulated human answers;
- and so on.

Harbor, the framework behind Terminal-Bench, runs about 40 agents in containers, including Claude
Code, Codex, and pi. But its steps are fixed upfront, and its simulated user talks through a chat,
not through files. Claude Code also loads your own configuration, plugins, and memory unless it is
given a fresh configuration folder. Where the runner is written is Q8.A. More in
[discovery](discovery-01.md#running-and-isolating-the-agents).

Why it matters: this is most of the work, and it sets how easily Codex or pi can be added later.

- **A (recommended). A small runner of our own:**
  - **it starts each task's Docker image;**
  - **it runs `claude -p` inside it, with a fresh configuration folder, for each step and each human
    turn;**
  - **it reads the `status` fields to choose who runs next.**
  - **Claude Code is reached through an adapter of a few dozen lines, so Codex or pi is one more
    adapter.**
  - [pro] the loop is Uraeda's own, isolation is complete, and the adapter keeps the dependency
    loose.
  - [con] we capture the metadata ourselves, and the Docker daemon must run on this machine (it is
    installed, but not started).
  - Why recommended: it fits Uraeda's file-based gates, and is a first version of the "Claude Code
    runner" in your priorities.
- **B. Harbor, with Uraeda's steps written as its multi-step tasks and its simulated user.**
  - [pro] containers, adapters, skill pinning, and trajectories built in.
  - [con] Uraeda's dynamic loop and file-based gates have to be forced into fixed steps and a chat
    bridge.
- **C. Like A, but on this machine without containers, each task's repository checked out locally.**
  - [pro] the fastest start.
  - [con] each task's dependencies installed by hand, and the agents can reach your files.

**Answer:**

### Q8.A: What language is the runner written in?

Only if you picked A or C in Q8. "Technical stack decision" is still open in your
[priorities](/specs/PRIORITIES.md), and this is the project's first code. The repository already has
a TypeScript toolchain (Vite+). More in [discovery](discovery-01.md#runner-language).

- **A (recommended). TypeScript, on Node 24, with the existing Vite+ toolchain.**
  - [pro] no second toolchain, and a likely base for the future runner and CLI.
  - [con] made before the stack decision, which it partly anticipates.
  - Why recommended: the toolchain is already there, and a runner is mostly process and file
    handling.
- **B. Python.**
  - [pro] the language of most benchmark tooling.
  - [con] a second toolchain in the repository.
- **C. Shell scripts.**
  - [pro] no toolchain.
  - [con] fragile for JSON and metadata.

**Answer:**

## Q9: How many runs, and what budget?

My estimate is that a full Uraeda run on one case costs several times a single-prompt run. A
single-prompt run is $2.5 to $5 on comparable tasks, and interactive runs cost $6 to $12 in one
study. Repeated runs show reliability, but multiply the cost. More in
[discovery](discovery-01.md#runs-and-budget).

Why it matters: it sets the total cost, and whether a result can be told apart from luck.

- **A (recommended). One Uraeda run per case, plus the baselines of Q2, with a hard cap of $60 per
  Uraeda run, after which the case counts as failed.**
  - [pro] the cheapest first reading, with no run going unbounded.
  - [con] one run per case cannot tell a lucky pass from a reliable one.
  - Why recommended: this first pass is a sanity check, and its results show which cases are worth
    repeating.
- **B. Three Uraeda runs per case, plus the baselines, with the same cap.**
  - [pro] reliability per case.
  - [con] about three times the cost.
- **C. One run per case now, and two more only for cases whose result is unclear.**
  - [pro] repeats only where it matters.
  - [con] a second session of work, decided after the first.

**Answer:**

## Q10: Which account pays for the runs?

A fresh configuration folder needs its own credential. It is either a subscription token, from
`claude setup-token`, or an API key, which is billed per token. More in
[discovery](discovery-01.md#credentials).

- **A (recommended). A subscription token.**
  - [pro] no extra bill.
  - [con] subscription rate limits.
  - Why recommended: the first pass is small, and the costs Claude Code reports are estimates either
    way.
- **B. An API key.**
  - [pro] exact billing, and API rate limits.
  - [con] billed per token.

**Answer:**

## Q11: What is committed to the repository?

Benchmarks keep the model, versions, scores, and full trajectories of every run. A full Uraeda run's
transcripts can weigh megabytes. The tasks' code is third-party, some of it under GPL, and this
repository has no license yet. More in [discovery](discovery-01.md#what-is-committed).

Why it matters: it decides what a later reader can check without rerunning, and how fast the
repository grows.

- **A (recommended). For each run: the metadata, the scores, the `specs/` files it produced, and its
  final diff. Raw transcripts stay on this machine, outside git, with their SHA-256 recorded.**
  - [pro] the workflow's artifacts, which show what Uraeda produced, can be read on GitHub.
  - [con] transcripts are lost if this machine is.
  - Why recommended: the artifacts are what you will read to judge the workflow, and they are small.
- **B. A, plus compressed transcripts.**
  - [pro] complete.
  - [con] megabytes per run in git history.
- **C. Metadata and scores only.**
  - [pro] the smallest.
  - [con] nobody can read what the workflow produced.

**Answer:**

## Settled without the human

### Check these

- **Only the feature flow is benchmarked.** The bug flow stays out, since the proposal asks for the
  full flow. See [discovery](discovery-01.md#needs-no-choice).
- **The 5 cases are picked in the spec, against fixed criteria:**
  - a reference change of at least 100 lines across 3 files;
  - at least 3 failing tests to fix;
  - 5 different repositories, across the source's languages;
  - no `specs/` folder of their own;
  - no future git history in the image.

  See [discovery](discovery-01.md#where-the-cases-come-from).

- **Opus 5.5 plays the human too**, as the proposal decided. Studies show the simulated user's model
  shifts scores by up to 9 points: the results will say so. See
  [discovery](discovery-01.md#opus-55-everywhere).

### Behaviour

- **The proposal of each case is the task's own text, verbatim.** The runner commits it as
  `proposal.md`, playing the human who starts the feature, so the baselines get exactly the same
  input. With A in Q3, the expected interface is included, since the tests call those exact names.
  See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The simulated human edits files and commits, as a human without tools would.** It sets
  `answered` or `approved` itself, rather than asking the agent to, and turns the `> [!IMPORTANT]`
  block into a record. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Each case has a local bare repository as its remote**, so the implementation step's push
  succeeds. With no pull request host, the step puts the description in the last commit, as the
  skill already says, and the run ends there. See [discovery](discovery-01.md#important-reads).
- **The task's grader runs once the flow ends**, on the pushed branch, in a fresh container. A run
  stopped by a cap is graded on what it pushed, and counts as a failure if nothing was pushed. See
  [discovery](discovery-01.md#needs-no-choice).

### Under the hood

- **The benchmark lives in a new `benchmarks/` folder** at the repository's root, with:
  - its README;
  - the simulated human's guidelines;
  - the cases;
  - the runner;
  - the results.

  The repository layout in [`AGENTS.md`](/AGENTS.md) gains it. See
  [discovery](discovery-01.md#likely-changes).

- **Each step and each human turn is a fresh session, never a resumed one.** The workflow is built
  for it, and resumed sessions count their cost twice. The agent's prompt starts with `/uraeda` and
  "continue the feature". See [discovery](discovery-01.md#claude-code-in-headless-mode).
- **The skill comes from git, not from the working tree.** Each run copies `skills/uraeda` from a
  named commit into its configuration folder, and records the commit and whether the tree was clean.
  Today, the installed skill is a symlink to the working tree. See
  [discovery](discovery-01.md#important-reads).
- **Claude Code is isolated and pinned:**
  - a fresh configuration folder, with no user settings, plugins, memory, or connectors;
  - auto-updates off;
  - `--model claude-opus-5-5`, at its default effort, `medium`, recorded;
  - an explicit permission mode: `bypassPermissions` as a non-root user inside the container, and
    the same mode on the host with C in Q8.

  If Opus 5.5 hands a request to another model, `modelUsage` shows it, and it is recorded. See
  [discovery](discovery-01.md#claude-code-in-headless-mode).

- **Each run records the fields benchmarks share:**
  - the commit of this repository and of the skill, each with a dirty flag;
  - the harness name and version;
  - the models actually used, and the effort;
  - the task id, dataset version, and image digest;
  - start and end times;
  - cost and tokens per role (agent, human, judge), and the number of sessions;
  - the outcome of each grader.

  See [discovery](discovery-01.md#recording-results).

**Notes:**
