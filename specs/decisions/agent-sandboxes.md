---
status: proposed
approved-by:
icon: shield
---

# Agent sandboxes

A repository the human sandboxes runs its agents in Docker Sandboxes, a microVM per feature or
change, holding only that checkout, its environment, and nothing of the user's machine. Unattended
runs can then skip permissions safely. The boundary holds only if nothing of the branch runs on the
host, so a sandboxed session never falls back to running outside.

## Rules

- A session of a sandboxed repository MUST fail with its reason rather than run outside its sandbox.
  Checked by the runner's tests.
- The host MUST NOT run a sandboxed branch's code: its previews, its hooks, and Uraeda's writes to
  its checkout run inside its sandbox. Checked by the runner's tests.
- A sandbox MUST work in a clone of its own, which the host only fetches from, never running that
  clone's git configuration or hooks. Checked by the core's tests.
- Logins MUST stay outside the sandboxes, kept by Docker Sandboxes, where the agent never reads
  them.
- A sandboxed repository's agents MUST run in Docker Sandboxes, one sandbox per checkout, on Linux
  and macOS alike.
- A sandbox's environment MUST be built from the project's Nix flake, once per lock.
- Sandboxing MUST be turned on per repository, by the human. Checked by the core's tests.
- A host the sandbox blocks MUST be allowable from the session, in one action.
- The network SHOULD follow Docker Sandboxes' balanced policy: package registries, code hosts, and
  AI services open, the rest blocked until allowed.
- A chat on the main checkout MAY run in a sandbox, chosen when it starts.

## Why

An agent in `auto` mode can read everything the user can, and a classifier is not a boundary. A
microVM with its own kernel holds only the checkout, on Linux and on macOS, where most users are.
Anything of the branch that runs on the host, a preview, a hook, a shared git folder, reopens the
door, and so does a silent fallback. History:
[Nix / Docker based execution environments](../2026-11-08-nix-docker/spec.md).

## Alternatives considered

- A Docker or Podman container per checkout: a shared kernel, and its environment from the host's
  Nix store works on Linux only.
- Anthropic's sandbox runtime around each process: a beta, files readable unless denied one by one,
  and no resource caps.
- The shared worktree with git's config and hooks read-only: a denylist, and the agent can still
  move any branch, `main` included.

## Consequences

- Sandboxed repositories need Docker Sandboxes, a proprietary tool, signed in to a Docker account,
  with hardware virtualization on.
- Each environment costs gigabytes per flake lock, and its first build takes minutes.
- A discovery reads only the documentation sites the human has allowed so far.
- A remote host for agents, a later feature, builds on these sandboxes.

## Applies to

- [`packages/server/src/runner/`](/packages/server/src/runner/),
  [`packages/server/src/preview/`](/packages/server/src/preview/), and the sandbox code of
  [`packages/server/src/`](/packages/server/src/), and every feature that starts an agent or runs a
  branch's code
- [`crates/core/`](/crates/core/), its checkouts and settings, and every feature that makes, reads,
  writes, or removes a checkout
