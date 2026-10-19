# Rulings: Benchmarks

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The agent in the container has no `ura`, and the token checks wait

- **Decision**: Task 1's probe ran against the `ansible` image of the plan's first candidate, with
  local Docker. The host's `claude` (2.1.303, dynamically linked) runs inside the image, beside its
  `git`, and a fresh configuration folder answers "Not logged in". The host's `ura` does not run
  there: it needs glibc 2.39, and the image has an older one. The sandbox therefore mounts `claude`
  only. The agent works without `ura`, which the skill allows, and `ura` and git run on the host, as
  the spec's architecture says.
- **Rationale**: [spec](spec.md#architecture), the sandbox's paragraph; the probe's output.
- **Alternatives considered**: building `ura` statically, or installing Claude Code in a layer built
  on the image: more work, with no need while the host's `claude` runs.
- **If wrong**: another image with an older glibc may not run the host's `claude`: the sandbox then
  installs Claude Code in a layer on that image.
- **Where**: task 1, `packages/benchmarks/scripts/probe.ts`.

## R2: The token checks passed, on a lighter test than the plan's

- **Decision**: With the token from the owner's `.env`, the probe's two other checks passed: a
  session in a fresh folder answered with `claude-sonnet-5-5` named in its output, with the model
  and effort set in `settings.json`, and a session in `auto` mode ran a command and created a file
  in `/app` with no blocked action. The probe ran one such session, not ten, so how often `auto`
  blocks a real task's commands is still unknown: Task 7 records every block, and allows it once.
- **Rationale**: the plan's Task 1; the spec's "Not verified" line.
- **Alternatives considered**: ten sessions: about ten times the usage for a rate the run records
  anyway.
- **If wrong**: a task whose commands `auto` blocks often fails its run on the repeat rule: the
  record shows it, and the owner decides.
- **Where**: task 1, `packages/benchmarks/scripts/probe.ts`.

## R3: Claude Code's helper models count as models that answered

- **Decision**: a recorded result (`result-usage.jsonl`) lists `claude-haiku-4-5` in `modelUsage`
  beside the main model, so the result event's `models` names every model Claude Code used, helpers
  included. The run's configuration folder (Task 5) therefore sets the small-and-fast model to
  Sonnet 5.5 as well, and the model rule of the decision stays as written: any other name fails the
  run.
- **Rationale**: the decision's rule, and the fixture's `modelUsage`.
- **Alternatives considered**: allowing helper models in the rule: it would change a decision.
- **If wrong**: a run fails on a helper model Claude Code picks anyway: the record names it and the
  owner decides whether to amend the decision.
- **Where**: task 2, and task 5's `makeConfigDir`.

## R4: The suite's ignore file lives in `benchmarks/`, and the schema is a few functions

- **Decision**: `benchmarks/.gitignore` holds the transcripts and `report.html` rules, not the root
  `.gitignore`, so the rules sit with the files they describe. The record's schema is checked by
  small functions in `schema.ts`, and the TOML files are read with `smol-toml`, the one new
  dependency.
- **Rationale**: [data model](data-model.md); the workspace has no TOML reader.
- **Alternatives considered**: a schema library, a hand-written TOML reader: more code to carry.
- **If wrong**: swap `smol-toml` for another reader in `suite.ts`, its one caller.
- **Where**: task 3.
