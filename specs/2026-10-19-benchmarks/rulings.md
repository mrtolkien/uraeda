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

## R5: The sandbox's pieces

- **Decision**: the project's specs come from `ura init --no-input`, with
  `benchmarks/constitution.md` as its constitution, so the template's placeholders never reach a
  case. `Sandbox` also returns `env`, the one variable (`CLAUDE_CONFIG_DIR`) the runner sets in its
  own process for the sessions it runs on the host, and the wrapper embeds the same folder for the
  container. Fake `docker` and `ura` scripts on the `PATH` make the tests hermetic: the TypeScript
  checks need neither installed.
- **Rationale**: the spec's architecture; the plan's Task 5.
- **Alternatives considered**: copying the skill's templates by hand: a second owner of what
  `ura init` creates.
- **If wrong**: a change to `ura init` shows in the sandbox test through the fake only: the first
  real run catches it.
- **Where**: task 5.

## R6: The record gains an optional `flags` field

- **Decision**: the decision says a run is "flagged `leak-suspected` in its record", and the data
  model had no field for it. The record gets `flags`, a list that may be absent, in the data model
  and the schema. The format stays version 1: an old record without it still parses.
- **Rationale**: [spec](spec.md#edge-cases), the leak row; the results page reads only run folders.
- **Alternatives considered**: a sixth `outcome`: the run did finish, and the flag is not an end.
- **If wrong**: drop the field: no record holds it before the first suite.
- **Where**: task 6, `record.ts` and the [data model](data-model.md).

## R7: What "finished" means, and the fixture of `ura next` after the push

- **Decision**: a run is `finished` when `ura next` says the step is implemented (every task of the
  plan checked) and the remote branch equals `HEAD`. With no pull request host, `ura next` keeps
  naming `final-review` (or `finish`) after the push, so the branch being pushed is what ends the
  run. The fixture `next-after-push.json` is written by hand from `after_the_last_step` in
  [`steps.rs`](/crates/core/src/steps.rs): the example project cannot reproduce it, since its branch
  counts as merged. The first real run checks it.
- **Rationale**: the plan's first review-focus item.
- **Alternatives considered**: ending at the first `final-review` step: it would stop before the
  agent's review and push.
- **If wrong**: a real run that names another step after the push stalls at 30 sessions, which the
  record shows: change `runLoop`'s one condition.
- **Where**: task 7, `loop.ts`.

## R8: Retried blocks, usage limits, and addresses in the loop

- **Decision**: an `auto` block is allowed once with `allowRule` and a resumed session
  (`retryMessage`), recorded in `blocked`; the same action blocked again, or with no rule, fails the
  run. The usage limit is read from a `usage` event at 100 percent, or an unsuccessful result whose
  errors say so. Addresses come from fetch tools' and commands' targets: `curl` is covered by the
  `execute` kind.
- **Rationale**: spec edge cases; the adapter's `allowRule`.
- **Alternatives considered**: counting blocks per run: a repeat of the same action is the sign of a
  loop.
- **If wrong**: a different phrase for the limit ends as `failed` with its text in the record.
- **Where**: task 7, `session.ts` and `loop.ts`.

## R9: The human's limits are checked after its turn, and a silent turn fails the run

- **Decision**: the simulated human's persona says it requests changes at most twice, and `human.ts`
  checks it: a third request makes the run `invalid`, like a commit outside the feature's folder. A
  human turn that makes no commit fails the run, since the same gate would come back until the cap.
  The gate is read from the subject of the commit `ura` made (`approve`, `request changes`,
  `answer`). The folder allowed is the directory of the file waiting, from `ura next`.
- **Rationale**: spec's US2 and the decision's rule on invalid runs.
- **Alternatives considered**: trusting the prompt alone: a model that ignores it would pass.
- **If wrong**: an `ura` commit subject change shows as a gate named by its subject.
- **Where**: task 8, `human.ts` and `loop.ts`.
