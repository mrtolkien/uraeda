---
kind: feature
finished: 2026-10-19
pull-request: https://github.com/mrtolkien/uraeda/pull/46
---

# Record: Benchmarks

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, in [its pull request](https://github.com/mrtolkien/uraeda/pull/46). Its full files are
> in git: `git log -- specs/2026-10-19-benchmarks/`.

## What and why

The project's owner wanted to check the whole workflow holds up on real software tasks, not only on
the project's own work. Five SWE-bench Pro V2 cases run through the flow, with Claude Code as the
agent and as the human at each gate, each beside a plain Claude Code run, and every result is saved
in the repository with the versions that produced it.

## Behaviour

- **Run a case**: one command,
  `node packages/benchmarks/src/cli.ts run <suite> <case> --approved-by <name>`, starts the feature
  from the case's proposal (the task's text, word for word) and runs a fresh session for each step
  that waits on the agent or the human, as `ura next --json` says, until the branch is pushed. The
  run ends `stalled` at 30 sessions, `usage-limit` when the subscription's limit is reached,
  `failed` on a session that errs or names another model, and `invalid` when the human breaks a
  rule. Nothing starts without an approval, and the record names who gave it.
- **The simulated human**: a fresh session at each gate that follows `benchmarks/human.md` and knows
  only the proposal. It answers with `ura answer` and reviews with `ura review`, requests changes at
  most twice, and is invalid when its commit touches a file outside the feature's folder.
- **The plain arm**: one session with the proposal as its prompt, no skill, no human, in the same
  image, model, and effort. It screens candidate cases (the plain arm's failures become the suite)
  and is each case's baseline, kept for later flow runs of the same task, image, model, and effort.
- **Grading**: the task's hidden tests run on the final diff, without `specs/`, in a fresh container
  of the image, and a judge session scores each requirement of the proposal against the approved
  spec as covered, partial, or missing.
- **Records**: `benchmarks/runs/<date>-<suite>/<case>--<arm>--<n>/` holds `record.json`,
  `scores.json`, the feature's `specs/` files, and `final.diff`. Raw transcripts stay local, with
  their SHA-256 in the record. The skill is loaded from a named commit, never the working tree.
- **The results page**: `vp run benchmarks:report` writes `benchmarks/report.html`, newest suite
  first, and opens it. Each case shows its flow run beside its baseline; invalid and leak-suspected
  runs show their flag and leave the comparison.
- **First suite**: from 31 screened candidates, plain Sonnet 5.5 failed seven; the suite takes five
  from four repositories. The flow resolved four of the five (the plain arm none, by selection), and
  kept 4 of 8 tests on the fifth, like the plain run. Each flow run took six sessions and about
  $1
  to $2.50 of usage, against under $0.40 for a plain run.

## Design

The runner is a small TypeScript loop in [`packages/benchmarks/`](/packages/benchmarks/) over what
exists: it asks `ura next --json` who is up, runs the server's Claude adapter
([`claude.ts`](/packages/server/src/runner/claude.ts)) for the agent or the human, and starts each
session with the server's `runMessage`. The server's adapter events gained the session's cost and
the models that answered, so the runner parses nothing itself.

- [`loop.ts`](/packages/benchmarks/src/loop.ts) owns the order of sessions and when a run ends;
  [`session.ts`](/packages/benchmarks/src/session.ts) one session, with the audit of fetched
  addresses; [`human.ts`](/packages/benchmarks/src/human.ts) the human's turns and their checks.
- [`sandbox.ts`](/packages/benchmarks/src/sandbox.ts) copies the repository out of the case's image,
  adds `specs/`, a constitution, and a bare `origin`, and makes the wrapper that runs Claude Code in
  the image; [`config-dir.ts`](/packages/benchmarks/src/config-dir.ts) makes the run's configuration
  folder, the one place that sets the model, the effort, no fallback, and the denied hosts. Only
  `claude` is mounted into the image: `ura` runs on the host.
- [`skill.ts`](/packages/benchmarks/src/skill.ts) builds the plugin from `git archive` of a commit.
- [`grader.ts`](/packages/benchmarks/src/grader.ts) runs the task's verifier, fetched after the flow
  into a folder no session sees; [`judge.ts`](/packages/benchmarks/src/judge.ts) judges the
  requirements; [`feature-folder.ts`](/packages/benchmarks/src/feature-folder.ts) reads the spec
  from before the finish step replaced the folder.
- [`record.ts`](/packages/benchmarks/src/record.ts) and
  [`recorder.ts`](/packages/benchmarks/src/recorder.ts) own the files;
  [`report.ts`](/packages/benchmarks/src/report.ts) the page;
  [`screen.ts`](/packages/benchmarks/src/screen.ts) the choice of cases.
- [`benchmarks/`](/benchmarks/) holds the suites, cases, the human's guidelines, the constitution
  every case's project gets, and the runs. Its [README](/benchmarks/README.md) says how to run.

## Questions

### Round 01

#### Q1: Which benchmark do the 5 cases come from?

**Answer:** A: five tasks from the hard subset of SWE-bench Pro V2, across repositories.

#### Q2: What should a run measure?

**Answer:** A: the hidden tests, the process numbers, and one judged check of how many requirements
reached the approved spec.

#### Q3: What is each run compared against?

**Answer:** A: plain Claude Code on the same task, image, model, and effort. The review later made
it one baseline per case, reused by later runs, and the cases are those where plain Claude Code
failed.

#### Q4: How does the benchmark reach the agents?

**Answer:** A: the server's adapter and Claude adapter, the server's message, and `ura next --json`.

#### Q5: What does the simulated human know?

**Answer:** "Having information built from the hidden requirements breaks the benchmarks, right? The
questions of the workflow should naturally push towards fulfilling hidden requirements." The spec
then gave the human only the proposal, which holds the task's whole text.

#### Q6: How does the simulated human behave at the gates?

**Answer:** A: a busy technical owner, terse, with "your call" when its proposal is silent, who
requests changes at most twice.

#### Q7: Where does the agent run?

**Answer:** A: in the case's own image, through a wrapper given to the adapter as its command.

#### Q8: Can the agents use the web during runs?

**Answer:** A: the web allowed, the task's upstream repository denied, every fetched address logged
and audited.

#### Q9: How many runs, and with what budget?

**Answer:** A, with no caps: "benchmarks are only run on clear human approval (you have my approval
to run them for this feature)".

#### Q10: Which account pays for the runs?

**Answer:** B: the subscription: "our existing uraeda stack is a wrapper around claude code".

#### Q11: What is committed to the repository?

**Answer:** A: the record, the scores, each run's `specs/` files and its final diff, with the raw
transcripts out of git and their SHA-256 recorded.

#### Notes

- **The model**: "Let's actually use Sonnet 5.5 as the model for everything. It's what I set in the
  CLI, it's enough for us and it'll make it less likely we hit limits."

## Decisions

- [Benchmarks](../decisions/benchmarks.md): a run starts only with a human's approval, loads the
  skill from a commit, and records every version it used.

## Changes after approval

- The suite's cases are not the five first read from the dataset: the plain arm's screening of 31
  candidates chose them.
- The record gained two optional fields, `flags` (`leak-suspected`) and `reason`.
- A command counts as fetching an address only when it names a network tool, and an `auto` block no
  narrow rule allows is recorded and the run goes on, instead of ending.
- The dataset's own repository and Hugging Face hosts are denied and flagged, as the upstream is.
- A process that stays up after its result is ended after 10 seconds, then killed, as the server
  does.
- Cases whose image is Alpine (the `vuls` task) cannot run the host's `claude`: a screening session
  that did not finish is reported as not run, never counted as a failure.

## Follow-ups

- The human's and the judge's sessions run on the host with the whole machine readable: only the
  hidden tests' absence and the audit keep them from the task's answer.
- Five minor findings of the final review are in the inbox: uncommitted edits by the human, blocks
  in a retry session, non-http addresses in the audit, the repository commit read at the end of a
  run, and the process-wide `CLAUDE_CONFIG_DIR`.
- Not run: a second reviewer's pass.
