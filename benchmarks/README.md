# Benchmarks

Real tasks run through Uraeda's whole workflow, with Claude Code playing the agent and the human,
each beside a plain Claude Code run on the same task. Every run is saved here, with the versions
that produced it. Five cases show gross failures and large gains, never a score.

The design is in [its record](/specs/done/2026-10-19-benchmarks.md) and the
[Benchmarks decision](/specs/decisions/benchmarks.md), and the code in
[`packages/benchmarks/`](/packages/benchmarks/).

## What is here

- `suites/<suite>.toml`: what a benchmark runs: its cases, arms, model, effort, and loop guard.
- `cases/<case-id>/`: a task from SWE-bench Pro V2: `case.toml`, and `proposal.md`, the task's text
  word for word.
- `human.md`: the guidelines of the simulated human. `constitution.md`: the project constitution
  every case's repository gets.
- `runs/<date>-<suite>/<case>--<arm>--<n>/`: one run: `record.json`, `scores.json`, the feature's
  `specs/` files, and `final.diff`. The raw transcripts stay in a `transcripts/` folder that git
  ignores, with their SHA-256 in the record.
- `report.html`: the results page, generated, never committed.

## Running

A run spends your subscription's usage, so it starts only with your approval: the command refuses to
run without `--approved-by <your name>`, and the record keeps the name.

Prerequisites: Docker, Claude Code, `ura` on the `PATH`, and a subscription token from
`claude setup-token` in `CLAUDE_CODE_OAUTH_TOKEN`. `vp run benchmarks:probe` checks Claude Code in a
case's image, and the token.

```sh
# Write a case from a task of the benchmark's HARD-51 list
node packages/benchmarks/src/cli.ts prepare-case <instance-id> --id <case-id>

# Screen candidates: the plain arm runs once on each, and the ones it fails are the suite's cases
node packages/benchmarks/src/cli.ts screen <suite> <case>... --approved-by <name>

# Run one case through the flow, beside its baseline (made first when the case has none)
node packages/benchmarks/src/cli.ts run <suite> <case> --approved-by <name>

# The results page
vp run benchmarks:report
```

## Reading the results

`vp run benchmarks:report` writes `benchmarks/report.html` from every run folder, newest suite
first, and opens it in your browser (it prints the path over SSH). Each case shows its flow run
beside its baseline: hidden tests passed, requirements the approved spec keeps, sessions, cost, and
time. A run marked `invalid` or `leak-suspected` shows its flag and is left out of the comparison.
Costs are Claude Code's estimates: under a subscription they are what the tokens would cost on the
API.
