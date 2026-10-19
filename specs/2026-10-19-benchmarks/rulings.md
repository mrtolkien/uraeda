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

## R2: Two of the probe's checks are not verified yet

- **Decision**: `CLAUDE_CODE_OAUTH_TOKEN` is not set on this machine, so the probe skipped the two
  checks that need it: a session in a fresh folder answering as `claude-sonnet-5-5` with the model
  and effort in `settings.json`, and `auto` mode running tests and editing a file without a block.
  They are unverified, not passed: the probe exits 2. The build stops after Task 1 until they pass.
- **Rationale**: the plan's Task 1 and the spec's "Not verified" line.
- **Alternatives considered**: copying `~/.claude`'s credentials into the folder: the agents
  decision forbids tools from touching the agent's credentials.
- **If wrong**: nothing is built on it yet.
- **Where**: task 1, step 5.
