# Benchmarks

Real tasks run through Uraeda's whole workflow, with Claude Code playing the agent and the human,
each beside a plain Claude Code run on the same task. Every run is saved here, with the versions
that produced it. Five cases show gross failures and large gains, never a score.

The design is in [its record](/specs/done/2026-10-19-benchmarks.md) and the
[Benchmarks decision](/specs/decisions/benchmarks.md).

> [!WARNING]
>
> The runner is gone, and waits for a port. It was TypeScript on Node, `packages/benchmarks/`, and
> reached agents through the Node server's adapter, which the move to a Rust server removed. Every
> suite, case, and run below is kept as it was. The runner's last source is in git, at the commit
> before `feat(nsh-migration)!: remove the React UI and the Node server`: a new one drives the Rust
> server's runtimes (`crates/server/src/runtimes/`) the same way.

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

Nothing runs them until the runner is ported. What a run needs stays the same: your approval, whose
giver the record names, since a run spends your subscription's usage; Docker; Claude Code; `ura` on
the `PATH`; and a subscription token from `claude setup-token` in `CLAUDE_CODE_OAUTH_TOKEN`.

## Reading the results

The runner's report was `benchmarks/report.html`, written from every run folder, newest suite first.
Each run's `record.json` and `scores.json` hold the same numbers. Each case shows its flow run
beside its baseline: hidden tests passed, requirements the approved spec keeps, sessions, cost, and
time. A run marked `invalid` or `leak-suspected` shows its flag and is left out of the comparison.
Costs are Claude Code's estimates: under a subscription they are what the tokens would cost on the
API.
