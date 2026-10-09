# Discovery, round 01: Benchmarks

## Summary

Benchmarking a coding workflow end to end needs five parts:

- **Tasks** with a hidden, objective grader.
- **A runner** that drives the agent in an isolated environment.
- **A stand-in for the human**, for interactive flows.
- **Metrics and baselines**, so a result means something.
- **A results record** detailed enough to reproduce the run.

Most coding benchmarks fix bugs from clear issue texts, and leave nothing to clarify. A few recent
ones are built for the case Uraeda targets: feature-sized work, from an input that leaves decisions
open, graded by hidden tests. Interactive benchmarks give the simulated user a hidden brief to
answer from. Their known failure is a simulated user who is too cooperative.

The [proposal](proposal.md) asks for a first pass on 5 real cases:

- run with Claude Code in headless mode, with Opus 5.5 everywhere;
- Claude role-playing the human, following written guidelines;
- a loose dependency on Claude Code;
- results saved in the repository with the skill's SHA, the models, and the harness versions.

It leaves open what a run measures, whether anything is compared against, what the simulated human
knows, and what is committed.

The repository has no code yet. It holds the skill, its templates, and a TypeScript toolchain
([Vite+](/package.json)). Two things in the way:

- The installed skill is a symlink to this working tree, so a run would use whatever is checked out.
- Each workflow step assumes a `specs/` folder, a constitution written by a human, and a remote to
  push to. A benchmark repository has none of them.

## How other products do it

These are benchmarks and evaluation tools rather than products: they are what the feature's runner,
cases, and simulated human would reuse or follow. Most pages were read through a fetcher that
summarizes them. Facts marked "(snippet only)" were seen only in search results.

### Feature-sized benchmarks with an underspecified input

- **SWE-bench Pro** ([paper](https://arxiv.org/html/2509.16941),
  [repo](https://github.com/scaleapi/SWE-bench_Pro-os),
  [dataset](https://huggingface.co/datasets/ScaleAI/SWE-bench_Pro), Scale AI).
  - **Tasks:** Go, Python, and JavaScript repositories. Reference patches average 107 lines across 4
    files.
  - **Input:** each task has a `problem_statement`, plus two fields that humans added to remove
    ambiguity. `requirements` lists the expected behaviours, and `interface` gives the names the
    tests call. Without those two fields, GPT-5 drops from 25.9% to 8.4% resolved, and Opus 4.1 from
    22.7% to 8.2%.
  - **V2, released 2026-09-22:** 642 tasks. 529 problem statements were rewritten so that every
    graded assertion traces back to the text. It has prebuilt images on GHCR and runs through
    Harbor.
  - **v1 grader:** an audit by [Datacurve](https://deepswe.datacurve.ai/blog/deepswe) found it
    wrongly rejects about 24% of correct patches. It also found that agents read the gold commit
    from the container's git history.
- **DeepSWE** ([blog](https://deepswe.datacurve.ai/blog/deepswe),
  [repo](https://github.com/datacurve-ai/deep-swe), Apache-2.0, May 2026).
  - **Tasks:** 113 original tasks across 91 repositories, in TypeScript, Go, Python, JavaScript, and
    Rust.
  - **Input:** prompts are deliberately underspecified, about 2,158 characters on average.
  - **Solutions:** written from scratch and never merged upstream, so the answer is not online. They
    average 668 added lines across 7 files.
  - **Grading:** hand-written verifiers test observable behaviour through public APIs, so any valid
    design passes. The verifier disagreed with an independent analysis on 1.4% of trials.
  - **Running:** Harbor format, with a shallow clone. It is young, from a single vendor, and its
    verifiers were not audited by anyone else.
- **FeatBench** ([paper](https://arxiv.org/html/2509.22237),
  [repo](https://github.com/TsinghuaISE/FeatBench), MIT).
  - **Tasks:** 157 Python tasks, each a first-person request ("I want to…") with no code hints.
  - **Size and grading:** the median patch is 18 lines, and the median number of failing tests to
    fix is 1.
  - **Failures:** 73.6% are regressions from agents implementing more than asked.
- **Doc2Feat-Bench**, formerly NoCode-bench ([paper](https://arxiv.org/html/2507.18130),
  [repo](https://github.com/Doc2Feat-bench/Doc2Feat-bench), MIT).
  - **Tasks:** the input is the documentation change that describes a feature. Changes average about
    179 lines.
  - **Data quality:** use the Verified set, 114 Python tasks. The full set is noisy: about half the
    sampled candidates failed verification.
- **LoLBench** ([paper](https://arxiv.org/html/2609.37143v1), September 2026).
  - **Tasks:** 100 tasks built from enhancement proposals of about 5,000 words, in systems like
    CPython, OpenJDK, and Kubernetes. It is framed as "derive a specification, then implement".
  - **Size and cost:** reference changes average 5,500 lines. One Claude Code run takes about 58
    minutes and costs about $15.30 per task.

### Benchmarks that fit less

- **Bug-sized issues with clear texts:**
  - SWE-bench Verified
    ([dataset](https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified)). Its issues were
    filtered to be clear, and OpenAI stopped reporting it in February 2026 because of contamination
    (snippet only).
  - SWE-bench Multimodal, Multilingual (median patch of 10 lines), and Live.
  - Multi-SWE-bench and SWE-PolyBench.
- **The interface is given upfront**, which leaves little to clarify:
  [FeatureBench](https://arxiv.org/html/2602.10975) and
  [FEA-Bench](https://arxiv.org/html/2503.06680).
- **Synthetic or built from scratch:** SWE-Dev, Commit0, DevBench, and
  [METR's public tasks](https://github.com/METR/public-tasks).
- **Too large for 5 cheap runs:** [RoadmapBench](https://arxiv.org/html/2605.15846), with a median
  of about 3,700 lines, and [SWE-EVO](https://arxiv.org/html/2512.18470v5).
- **SWE-Lancer** ([paper](https://arxiv.org/html/2502.12115)): one repository, and images of about
  14 GB each. Its authors list "models cannot ask clarifying questions" as a limitation.
- **[Terminal-Bench 2.0](https://arxiv.org/html/2601.11868):** mostly terminal and system tasks, not
  features in an existing repository.

### Interactive benchmarks with a simulated user

Most of these benchmarks create ambiguity artificially, by summarizing clear SWE-bench Verified
issues.

- **[Ambig-SWE](https://arxiv.org/html/2502.13069v2)** and
  **[Ask or Assume?](https://arxiv.org/html/2603.26233)**: the simulated user holds the full
  original issue. It answers only from it, briefly, and says "I don't have that information"
  otherwise. After early runs leaked guidance, they had to add guardrails, such as not encouraging
  the agent to edit tests. In Ask or Assume, an interactive agent recovers most of the score lost to
  the underspecification: 70.4%, against 54.8% with the hidden issue and 70.8% with the full one.
- **[SWE-Interact](https://arxiv.org/html/2606.30573)** (Scale AI, June 2026):
  - The simulated user has a persona, such as a "busy colleague", and never sees the tests.
  - It can read the agent's workspace, read only, and checks the repository before approving.
  - It raises one missing requirement at a time.
  - Only the original verifier decides success.
  - Interactive runs scored about half of single-turn ones, 26.7% against 50.7% for Opus 4.8. Most
    failures were forgotten requirements and over-engineering, not failures to ask.
  - Interactive runs cost $6 to $12 each, against $2.5 to $5 for single-turn runs.
- **[SWE-Together](https://arxiv.org/html/2606.29957)**: the simulated user is built from real
  recorded sessions. Each turn, it either does nothing (the default) or asks, redirects, or adds a
  requirement. The gold patch is used only to grade.
- **[AppWorld-UL](https://arxiv.org/html/2607.20536v1)**: the simulated user holds a list of
  question and answer pairs, matches each question to one, and declines otherwise ("Please decide it
  yourself"). It answered wrongly 1.3% of the time. The list also measures which needed questions
  were asked.
- **[UserBench](https://arxiv.org/html/2507.22034v1)**: a preference is revealed only for a concrete
  question, or after 3 turns without one.

### Evaluation runners

- **[Harbor](https://docs.harborframework.com/)** is the framework behind Terminal-Bench.
  - **Agents:** about 40 built in, including `claude-code`, `codex`, and `pi`.
  - **Containers:** each task runs in its own Docker container, or one of about 27 remote sandbox
    providers.
  - **Skills:** `--skill` injects one and records its commit and SHA-256 in a lock file.
  - **Trajectories:** written in the ATIF format, with tokens and cost.
  - **Simulated user:** `--user-agent` and `--user-persona-path` give it one, which talks to the
    agent through a chat bridge (ACP)
    ([docs](https://docs.harborframework.com/jobs/simulate-a-user)).
  - **Multi-step tasks:** each step is declared upfront in `task.toml`, keeps the files of the
    previous one, and starts a fresh conversation
    ([docs](https://docs.harborframework.com/tasks/multi-step)).
- **[Inspect AI](https://inspect.aisi.org.uk/agents.html)** with
  **[inspect_swe](https://meridianlabs-ai.github.io/inspect_swe/claude_code.html)** runs
  `claude_code()` and `codex_cli()` inside a Docker sandbox. Every model call goes through Inspect,
  which logs it. A version of Claude Code can be pinned, and skills can be passed in.
- **[`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals)** is built into Claude
  Code. It runs each case 3 times, plus a baseline without the plugin, and grades with regexes, file
  checks, or an LLM. Each case is a single prompt, so there is no loop of steps and gates.
- **Anthropic's
  [skill-creator](https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md)**
  compares paired runs with and without a skill. It reports the pass rate, time, and tokens as a
  mean ± standard deviation.

### What they have in common

Capabilities a workflow benchmark is expected to have, whether or not the proposal mentions them:

- Hidden, objective grading, run after the agent is done, on the final state of the code
- A comparison against a baseline on the same tasks, and several runs per task when variance matters
- A simulated user with a hidden brief, rules against leaking the solution, and a record of what it
  said
- Isolation: a container per task, no access to the solution or its history, and an explicit network
  policy
- Cost, tokens, and time per role, with caps that stop a run that goes wrong
- A pinned and recorded version of everything: agent, harness, model, skill, task, and image
- Kept trajectories, so failures can be read and classified

## Standards and libraries

### Claude Code in headless mode

Version 2.1.295 is installed locally (`claude --version`).

- **Running:** `claude -p` runs one prompt without a person, and `--output-format json` returns the
  result with `session_id`, `total_cost_usd`, `usage`, and per-model `modelUsage`
  ([headless](https://code.claude.com/docs/en/headless)).
- **Cost fields:** they are client-side estimates, not billing data. `usage` leaves out subagents,
  while `total_cost_usd` and `modelUsage` include them. A resumed session reports the cumulative
  total, so adding up resumed runs counts twice
  ([cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)).
- **Loading the skill:**
  - Starting the prompt with `/skill-name` forces the skill to run.
  - It can be loaded as a project skill (`.claude/skills/`), as a skill of the configuration folder,
    with `--add-dir`, or as a plugin with `--plugin-dir`, where it is then named `/<plugin>:uraeda`
    ([skills](https://code.claude.com/docs/en/skills)).
- **Your own configuration leaks in.** A default run loads `~/.claude`: settings, `CLAUDE.md`,
  skills, plugins, auto memory, and claude.ai connectors. On this machine, that includes the
  `agent-protocols` and `engineering` plugins.
  - `--setting-sources project,local` drops the user layer, but not auto memory or connectors.
  - `CLAUDE_CONFIG_DIR` pointed at a fresh folder moves all of it. Authentication then comes from
    `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`
    ([settings](https://code.claude.com/docs/en/settings),
    [env vars](https://code.claude.com/docs/en/env-vars)).
  - `--bare` strips everything, including the project's `CLAUDE.md` and the list of skills, and
    needs an API key.
- **Permissions:**
  - With no mode set, a `-p` run starts in Manual and denies anything that would need a prompt. With
    telemetry turned off, it starts in `auto` instead (v2.1.285+), so the mode must be set
    explicitly.
  - `bypassPermissions` is for "isolated containers and VMs only", and refuses to run as root.
  - Writes to `.git` and `.claude` are protected in every other mode
    ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- **The agent cannot ask in chat.** `AskUserQuestion` can never be answered in `-p` mode, and
  `--permission-prompts none` removes it ([headless](https://code.claude.com/docs/en/headless)).
  Uraeda never relies on it: its questions are files.
- **The model:**
  - `--model claude-opus-5-5` pins Opus 5.5. Its default effort is `medium`, and
    `CLAUDE_CODE_EFFORT_LEVEL` overrides `--effort`.
  - Requests flagged for biology or cybersecurity re-run on Opus 5 or Opus 4.8, and the session
    stays on that model. `modelUsage` shows it
    ([model config](https://code.claude.com/docs/en/model-config)).
- **Pinning the version:** `DISABLE_AUTOUPDATER=1` stops updates during a run. Transcripts are
  deleted after 30 days by default.
- **Caps:** `--max-turns` and `--max-budget-usd` stop a run with an error, though spending can
  overshoot the budget ([CLI reference](https://code.claude.com/docs/en/cli-reference)).
- **Telemetry:** OpenTelemetry exports cost and token metrics, plus `api_request`, `tool_result`,
  and `skill_activated` events ([monitoring](https://code.claude.com/docs/en/monitoring-usage)).

### Other harnesses

- **Codex** (`codex exec`, version 0.161.0 installed locally,
  [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)):
  - `--json` streams events with token counts, but no cost.
  - Relevant flags: `-m`, `--sandbox`, `--ignore-user-config`, and `--ephemeral`.
  - It reads skills in the Agent Skills format from `.agents/skills`
    ([skills](https://learn.chatgpt.com/docs/build-skills)).
  - Running Uraeda on Codex later is a change of command line and skill folder, not of workflow.
- **pi:** Harbor already has an adapter for it.

### Measuring a few tasks reliably

- **Variance:** a single run's pass rate varies by 2.2 to 6 points, and temperature 0 is not
  deterministic ([On Randomness in Agentic Evals](https://arxiv.org/html/2602.07150)).
- **Infrastructure:** resource settings alone moved a benchmark by 6 points.
  [Anthropic](https://www.anthropic.com/engineering/infrastructure-noise) advises distrusting gaps
  under 3 points, and comparing paired results on the same tasks
  ([statistics](https://www.anthropic.com/research/statistical-approach-to-model-evals)).
- **Judgement:** with 5 tasks, only per-task comparisons carry meaning. They can be paired with a
  baseline, and repeated to measure reliability (pass^k).

### Simulated users

- **They are too cooperative.** On τ-bench, compared against 451 real people
  ([Mind the Sim2Real Gap](https://arxiv.org/html/2603.11245v1)):
  - GPT-4o as the user goes along with the agent in 19.1% of turns, against 8.4% for humans.
  - Only 1% of its turns are short, against 29% for humans.
  - Most simulated users raise the agent's success above the human baseline, up to 77.8% against
    63.6%.
  - A more capable model is not a more faithful user.
- **The choice of model matters.** Swapping only the simulated user's model moved agent success by
  up to 9 points ([Lost in Simulation](https://arxiv.org/html/2601.17087v2)).
- **They leak.** Volunteering information before it is asked for appears in 24.4% of successful
  episodes ([UserProxyBench](https://arxiv.org/abs/2609.38043), read through its abstract and a
  summary).
- **They rubber-stamp.** τ-bench's user approves an agent's recommendation without checking it
  ([τ-bench](https://arxiv.org/html/2406.12045)).
- **Real users push back often.** In about 18,000 real sessions, 69% of them in Claude Code, users
  push back on about 46% of prompts. That rate is per chat turn, not per written question
  ([SWE-chat](https://arxiv.org/html/2604.20779)).
- **No published target** for how often a simulated user should accept recommendations was found.
- **Leak guards:**
  - Answer only from a hidden brief, and never see the tests (SWE-Interact).
  - Use an answer key with a fixed fallback (AppWorld-UL).
  - Layer prompt rules, string matching, and an LLM leak check, with regeneration
    ([arXiv 2607.00597](https://arxiv.org/html/2607.00597v2)).

### LLM judges

- **Position and self-preference:** GPT-4 judged consistently across swapped orders in 65% of cases,
  and favoured its own answers by about 10% ([MT-Bench](https://arxiv.org/html/2306.05685)).
  Self-preference grows with how well a model recognizes its own text
  ([Panickssery et al.](https://arxiv.org/abs/2404.13076)).
- **Mitigations:** a judge from another model family, judging against a reference, and spot checks
  against human labels.
- **Stage judging against reference information:** SWE-RPG checks each reference point and blames
  the earliest stage that went wrong. Its judge matched humans in 92 to 96% of 50 samples
  ([SWE-RPG](https://arxiv.org/html/2608.09072)).
- **No benchmark measures questions the agent could have answered itself.** A judge with access to
  the repository would have to label them.

### Recording results

[SWE-bench experiments](https://github.com/SWE-bench/experiments),
[Inspect logs](https://inspect.aisi.org.uk/eval-logs.html), Harbor jobs, and
[HELM](https://crfm-helm.readthedocs.io/en/latest/tutorial/) share these fields:

- the model id and its generation settings
- the agent and harness versions
- the code commit, with a dirty flag
- the task id and version, and the attempt number
- timestamps
- tokens and cost per role
- the full trajectory, and per-task and aggregate scores

SWE-bench also requires keeping every run, and forbids hints or looking up solutions on the web.

## The code

### Important reads

- [`skills/uraeda/SKILL.md`](/skills/uraeda/SKILL.md): the entry point finds the next step from the
  repository alone, and stops at human gates marked by `status: awaiting-human`. The gates are:
  - answering clarifications;
  - approving the spec, or requesting changes, with a risk tier;
  - reviewing the plan, for `high` risk or when asked;
  - reviewing the pull request.

  Starting a feature is a human action: number it, add it to `PRIORITIES.md`, create the branch, and
  write `proposal.md`.

- [`references/implementation.md`](/skills/uraeda/references/implementation.md): the last step
  pushes the branch and opens a pull request. Without one, it puts the description in the last
  commit, but it still pushes.
- [`references/discovery.md`](/skills/uraeda/references/discovery.md): discovery reads "the code,
  the documentation, and online sources". It needs web access, which is also a way to find a task's
  published solution.
- [`specs/CONSTITUTION.md`](/specs/CONSTITUTION.md): every step reads the project's constitution. It
  is the human's, written with help from the agent.
- `~/.claude/skills/uraeda` is a symlink to [`skills/uraeda`](/skills/uraeda/) in this working tree.
  The skill a run uses is whatever is checked out, edits included.
- [`package.json`](/package.json) and [`vite.config.ts`](/vite.config.ts): a TypeScript toolchain
  (Vite+), with no code yet. [`src/`](/src/) is empty.
- [`.vite-hooks/pre-commit`](/.vite-hooks/pre-commit): runs `vp check --fix` on every staged file.
  It would reformat committed results.
- [`specs/PRIORITIES.md`](/specs/PRIORITIES.md): two related items.
  - "Technical stack decision" is in **Now**, still undecided.
  - "Claude Code runner (triggered manually)" is in **Next**. A benchmark runner drives the same
    loop: run a step, detect a gate, continue.
- There is no `LICENSE` file in the repository.
- No other feature branch is open.

### The proposal's path and existing actions

The path of one case through the full flow:

1. **Preparing the repository**: the task's repository at its base commit, in its environment.
   Uraeda needs a `specs/` folder there, with a README, a constitution, and priorities. Some
   repositories may already have a `specs/` folder of their own.
2. **Starting the feature**: a human action. The task's text becomes `proposal.md`, on the branch
   `NNN-<slug>`.
3. **Discovery**: an agent session with the skill writes the discovery and the questions. It reads
   the web, and stops at `awaiting-human`.
4. **The human answers**: the simulated human reads the questions and answers them. It sets
   `answered` and commits, as the future web UI would.
5. **The spec**: written, then approved or sent back by the simulated human, who also confirms the
   risk tier. A new round of questions can come back at any step.
6. **The plan**: auto-approved for `low` risk, or for `medium` without plan review. Otherwise the
   simulated human reviews it.
7. **Implementation**: one commit per task, a final review, then a push and a pull request. With no
   remote, the push fails. With no pull request host, the description goes in the last commit.
8. **Grading**: the benchmark's hidden tests run on the final state of the branch.

Points where the flow meets the benchmark:

- **Sessions:** each run of the skill can start a fresh session, which the workflow supports by
  design (principle III). A resumed session would count its cost twice.
- **Statuses:** the skill sets a human status only when a human asks in the session. The simulated
  human edits the files itself, as a human without tools would.
- **Leaks:** the task's repository may contain its future history, which held the solution in
  SWE-bench Pro v1.

### Likely changes

Under every option:

- `benchmarks/README.md`, new: what the benchmark measures, how to run it, and how to read the
  results.
- `benchmarks/human.md`, new: the simulated human's guidelines, written as part of the test, as the
  proposal asks.
- `benchmarks/cases/`, new: the 5 cases, each with its task reference, the proposal text, and the
  simulated human's brief.
- `benchmarks/results/`, new: one folder per run, with its metadata and scores.
- [`AGENTS.md`](/AGENTS.md): the repository layout gains `benchmarks/`.
- [`specs/PRIORITIES.md`](/specs/PRIORITIES.md): the entry is removed at the end, as the
  implementation step does.

Depending on the options:

- `benchmarks/runner/`, new: the loop of steps and gates, with a Claude Code adapter (A or C of
  [running and isolating](#running-and-isolating-the-agents)). With B, Harbor configuration instead.
- `benchmarks/constitution.md`, new: the constitution given to each case's repository, with A of
  [a constitution for each case](#a-constitution-for-each-case).
- [`package.json`](/package.json): runtime dependencies for the runner, with TypeScript in
  [runner language](#runner-language).
- [`.gitignore`](/.gitignore): raw transcripts, with A of [what is committed](#what-is-committed).

## The proposal

### "Not completely stupid" has no measure

The proposal wants to validate the workflow, but does not say what result would count as a pass or a
failure. Benchmarks measure either an outcome (hidden tests) or the quality of each stage, against a
baseline or alone. Without a target, 5 runs give numbers nobody can read.

### Real issues are mostly too clear, or too small

The proposal asks for "real software issues where the full flow could apply". The widely used
benchmarks are bug fixes with clear texts. With them, the questions step has nothing to ask, and the
spec has little to design. The benchmarks that fit are a handful from 2025 and 2026, and the
simulated human needs the information the input leaves out: see
[feature-sized benchmarks](#feature-sized-benchmarks-with-an-underspecified-input).

### The simulated human needs something to know

The proposal says Claude should role-play the human, with guidelines on behaviour. A human answers
from what they want, which a benchmark task does not hold, apart from its hidden tests and solution.
Without a brief, the simulated human can only accept the agent's recommendations. Studies show it
already does this too often: see [simulated users](#simulated-users).

### Opus 5.5 everywhere

Using the same model for the agent and the simulated human, and for any judge, is simple. It is also
where the documented biases sit: an agent and a simulated user from the same model share blind spots
and agree too readily, and a judge favours its own text. See [simulated users](#simulated-users) and
[LLM judges](#llm-judges). The proposal decided it for the agent and the human. A judge is not
mentioned.

### Each case's repository is not set up for Uraeda

Every step reads the project's constitution, a human's document, and the implementation step pushes
to a remote. Benchmark repositories have neither, so the benchmark must supply both: see
[the proposal's path](#the-proposals-path-and-existing-actions).

### Web access and solutions

The discovery step needs the web. For tasks built from merged pull requests, the solution may be
online, on the upstream repository. SWE-bench forbids looking up solutions on the web. The proposal
does not say how runs should handle this.

### Cost and the number of runs

The proposal sets 5 cases, but no number of runs and no budget. Rough judgement:

- **A full Uraeda run** reads widely, writes four documents, and implements with reviews. It likely
  costs several times a single-turn run, which is $2.5 to $5 in SWE-Interact and about $15 on
  LoLBench's much larger tasks.
- **Variance** needs repeated runs: see [measuring a few tasks](#measuring-a-few-tasks-reliably).

### Runner language and the stack decision

The proposal does not say how the runner is built. "Technical stack decision" is still open in
[`PRIORITIES.md`](/specs/PRIORITIES.md), and the runner is the project's first code. Its language
either follows the toolchain already set up, or waits for that decision.

## Approaches

Criteria come from:

- **The proposal:** real issues, 5 cases, Claude Code headless, a simulated human with guidelines, a
  loose dependency on Claude Code, and results in the repository with versions.
- **[The constitution](/specs/CONSTITUTION.md):**
  - II: plain text in git.
  - III: work resumable by another session.
  - V: tools are optional, so the workflow works with any agent.
  - VI: code checked against tests.
- **No active decision** applies yet: `specs/decisions/` does not exist.

### What a run measures

What result tells whether the workflow is "not completely stupid". Relies on
["not completely stupid"](#not-completely-stupid-has-no-measure) and
[measuring a few tasks](#measuring-a-few-tasks-reliably).

| Option                                                                                                                                      | What it tells                                                                       | Cost to build                                       | Reliability at 5 cases                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| A. Hidden tests, plus process metrics (cost, time, questions, rounds), plus one judged check: how many hidden requirements reached the spec | Whether the code works, what it cost, and whether the questions found what mattered | Low: tests come with the tasks, one judge prompt    | Tests are objective; the judged check is one number per case |
| B. Hidden tests and process metrics only                                                                                                    | Whether the code works, and what it cost                                            | Lowest                                              | Objective, but a failure cannot be traced to a stage         |
| C. A, plus judged quality of every artifact: discovery, questions, spec, plan                                                               | Where the workflow is weak, stage by stage                                          | High: one rubric per artifact, and judge validation | Judge noise and bias on every number                         |

### Baselines

What each Uraeda run is compared against, on the same tasks. Relies on
[evaluation runners](#evaluation-runners). B can come on top of A.

| Option                                                                                                     | What it isolates                                                        | Extra cost                   |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| A. Plain Claude Code, same model, given the same proposal text in one prompt, without the skill or a human | What the whole workflow adds over asking the agent directly             | One single-turn run per case |
| B. Plain Claude Code given the proposal plus the hidden brief, the fully specified task                    | The ceiling: how much of the missing information the workflow recovered | One single-turn run per case |
| C. None                                                                                                    | Nothing: the scores stand alone                                         | None                         |

### Where the cases come from

Which benchmark the 5 cases are taken from. Relies on
[feature-sized benchmarks](#feature-sized-benchmarks-with-an-underspecified-input).

| Option                                                                                                                   | Feature-sized                            | Something to clarify                                       | A brief for the human                              | Grading                                                       | Languages              |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- | ---------------------- |
| A. SWE-bench Pro V2: the problem statement and interface as the proposal, the hidden `requirements` as the human's brief | About 107 lines, 4 files                 | Yes: the requirements carry real decisions (25.9% to 8.4%) | Ready: the `requirements` field, written by humans | Tests, with false rejections on v1 (about 24%), revised in V2 | Go, Python, JavaScript |
| B. DeepSWE: the underspecified prompt as the proposal                                                                    | About 668 lines, 7 files                 | Yes, by design                                             | None: only the reference code, which would leak    | Behaviour verifiers, any valid design passes                  | TS, Go, Python, Rust   |
| C. A mix: 3 from SWE-bench Pro V2, 2 from DeepSWE                                                                        | Both                                     | Both                                                       | Only for the Pro cases                             | Two graders to integrate                                      | All                    |
| D. FeatBench or Doc2Feat-Bench                                                                                           | Small on median (18 lines for FeatBench) | Yes                                                        | The original pull request description              | Few failing tests per task                                    | Python only            |

### What the simulated human knows

The information the simulated human answers from. Relies on [simulated users](#simulated-users) and
[the simulated human needs something to know](#the-simulated-human-needs-something-to-know).

| Option                                                                                                                       | Realism                                                  | Leak risk                          | Measurable                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| A. A brief: the hidden requirements, in a human's words, plus read access to the repository; never the tests or the solution | A technical owner who knows what they want, not the code | Low: nothing to leak beyond intent | The requirements double as the reference for the judged check |
| B. The brief, plus the reference solution                                                                                    | An owner who already built it                            | High: the human can dictate code   | Same                                                          |
| C. A fixed answer key matched to questions, with a fallback ("decide yourself"), like AppWorld-UL                            | Rigid                                                    | Lowest                             | Highest, but costly to write per case                         |

### How the simulated human behaves

What the simulated human does at each gate, which the guidelines will spell out. Relies on
[simulated users](#simulated-users) and [the code](#important-reads).

| Option                                                                                                                                                                          | Realism                                     | Risk of "easy mode"               | Run length          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------- | ------------------- |
| A. A busy technical owner: answers from the brief, tersely; accepts the recommendation when the brief is silent; requests changes when the spec contradicts or misses the brief | Close to the intended user                  | Medium                            | Bounded by caps     |
| B. Accepts every recommendation and approves everything                                                                                                                         | Low                                         | Maximum: measures the agent alone | Shortest            |
| C. A demanding reviewer: challenges recommendations, asks for alternatives                                                                                                      | Matches the 46% pushback of real chat users | Low                               | Longer, more rounds |

### Web access during runs

How the network is handled, given that discovery reads the web and solutions may be online. Relies
on [web access and solutions](#web-access-and-solutions).

| Option                                                                                               | Fidelity to the workflow           | Leak risk                                      | Effort                                         |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| A. Web allowed, with the task's upstream repository blocked and every fetched URL logged and audited | Full discovery                     | Low: blocked at the source, checked after      | A deny rule per case, plus an audit at the end |
| B. No web                                                                                            | Discovery without its outside half | None                                           | Lowest                                         |
| C. Web allowed, no restriction                                                                       | Full                               | High for tasks built from merged pull requests | None                                           |

### A constitution for each case

What constitution each case's repository gets. Every step reads one. Relies on
[each case's repository](#each-cases-repository-is-not-set-up-for-uraeda).

| Option                                                                                                                      | Effort        | Comparable across cases | Faithful to Uraeda                   |
| --------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------- | ------------------------------------ |
| A. One short, generic constitution for all cases: follow the repository's conventions, test every behaviour, keep it simple | Write it once | Yes                     | Written by the human once            |
| B. One per repository, written by the simulated human from the repository's contributing guide                              | Per case      | No                      | An agent writes the human's document |
| C. None                                                                                                                     | None          | Yes                     | No: every step expects one           |

### Running and isolating the agents

Where the agents run, and what drives the loop of steps and gates. Relies on
[Claude Code in headless mode](#claude-code-in-headless-mode) and
[evaluation runners](#evaluation-runners).

| Option                                                                                                                                                                   | Control over gates                                                                              | Loose coupling to Claude Code                  | Isolation                                                                 | Effort                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| A. A small runner of our own: it starts each task's container, runs `claude -p` inside it for each step and each gate, and reads `status` fields to choose the next role | Full: the loop is Uraeda's own                                                                  | An adapter per harness, a few dozen lines each | A container per case, from the task's image                               | Medium: the loop, an adapter, and metadata capture        |
| B. Harbor, with Uraeda's loop expressed in its multi-step tasks and simulated user                                                                                       | Partial: steps are fixed upfront, and the simulated user talks through a chat bridge, not files | Built in: about 40 agents                      | Built in                                                                  | Medium to high: fitting a dynamic loop into a fixed model |
| C. Option A on the host, with each task's repository checked out locally                                                                                                 | Full                                                                                            | Same as A                                      | None: one machine for all, and each task's dependencies installed by hand | Low to start, high per case                               |

### Runner language

Only with A or C of [running and isolating](#running-and-isolating-the-agents). Relies on
[runner language and the stack decision](#runner-language-and-the-stack-decision).

| Option                    | Fit with the repository               | Fit with benchmark tooling                                    |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| A. TypeScript, on Node 24 | The Vite+ toolchain is already set up | Datasets are JSON or Parquet. Reading Parquet needs a library |
| B. Python                 | A second toolchain                    | Most benchmark harnesses and datasets are in Python           |
| C. Shell scripts          | No toolchain                          | Fragile for JSON and metadata                                 |

### Runs and budget

How many runs, and what spending is acceptable. Relies on
[cost and the number of runs](#cost-and-the-number-of-runs).

| Option                                                                   | What it shows                     | Cost, judgement |
| ------------------------------------------------------------------------ | --------------------------------- | --------------- |
| A. One Uraeda run per case, plus the baselines, with a hard cap per case | A first reading, outcome per case | Lowest          |
| B. Three Uraeda runs per case, plus the baselines                        | Reliability per case (pass^k)     | About 3 times A |
| C. One run now; repeated runs only on cases whose result is unclear      | A first reading, then targeted    | Between A and B |

### Credentials

Which account pays for the runs. A fresh configuration folder needs one of two credentials:
`ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN`, a subscription token from `claude setup-token`.
Relies on [Claude Code in headless mode](#claude-code-in-headless-mode).

| Option                  | Cost                    | Limits                                         |
| ----------------------- | ----------------------- | ---------------------------------------------- |
| A. A subscription token | Within the subscription | Subscription rate limits; `--bare` unavailable |
| B. An API key           | Billed per token        | API rate limits                                |

### What is committed

What lands in the repository, beyond the metadata the proposal requires. Relies on
[recording results](#recording-results).

| Option                                                                                                                                      | Reproducibility                                         | Repository size            | Licensing                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| A. Metadata, scores, the `specs/` files each run produced, and its final diff. Raw transcripts stay out of git, with their SHA-256 recorded | The artifacts and the outcome; transcripts kept locally | Small (artifacts are text) | Diffs of third-party code, some under GPL, in an unlicensed repository |
| B. A, plus compressed transcripts                                                                                                           | Complete                                                | Megabytes per run          | Same                                                                   |
| C. Metadata and scores only                                                                                                                 | Numbers only                                            | Minimal                    | None                                                                   |

### Judge model

Only with A or C of [what a run measures](#what-a-run-measures). Relies on
[LLM judges](#llm-judges).

| Option                                                                                            | Bias                                                                                        | Setup                        |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| A. Opus 5.5, checking coverage of each hidden requirement, with the requirement list as reference | Self-preference matters less for a coverage check against a reference than for a preference | None beyond the prompt       |
| B. A model from another family, through Codex                                                     | Avoids self-preference                                                                      | A second harness and account |

### Needs no choice

- **Hidden, objective grading**: every benchmark considered ships its tests or verifiers. They run
  after the flow, on the final branch.
- **Versions pinned and recorded**: the proposal already asks for this. The fields come from
  [recording results](#recording-results).
- **Caps**: every runner documents them. Their values follow the budget.
- **Kept trajectories**: they are covered by [what is committed](#what-is-committed).
- **A fresh session per step**: the workflow is designed for it (principle III), and it avoids
  counting resumed costs twice.
- **Bug flow**: the proposal asks for the full flow, so only features are benchmarked. The
  [bug](/skills/uraeda/references/bug.md) flow stays out.

## Not checked

- OpenAI's pages on SWE-bench Verified, including why it stopped reporting it: HTTP 403. Those facts
  are snippet only.
- Whether SWE-bench Pro V2 images still contain each repository's future git history.
- An independent audit of DeepSWE's verifiers: none found.
- How Harbor installs and pins Claude Code, and its `result.json` layout. They are not in the
  documentation pages read.
- Inspect's cost logging, and whether `inspect_swe` supports multi-turn runs.
- Codex's `AGENTS.md` page returned 404. Its loading order is snippet only.
- Whether `git commit` through Bash counts as a write to the protected `.git` path in Claude Code's
  permission modes: the documentation does not say.
- The full texts of UserProxyBench, τ²-bench's appendix on simulated user errors, and SWE-Interact's
  persona prompts: read only in part.
- Every page was read through a fetcher that returns a summary, so quoted wording may be
  paraphrased.
