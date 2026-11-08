---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Docker Sandboxes for agents

## What

Every agent call can run sandboxed, with no access to my local filesystem, so agents can run in YOLO
mode safely. The sandbox is [Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) (`sbx`): one
microVM per feature or change, with its own kernel.

- **Linux and macOS.** Every user but me runs macOS, so macOS is not optional. I run CachyOS, with
  `sbx` installed from the AUR.
- **Off by default**, turned on per repository. Once on, a session that cannot start its sandbox
  fails with the reason: it never silently runs unsandboxed.
- **Each sandbox holds its own clone** of the repository, never a worktree sharing the main `.git`
  folder: git config or hooks planted by the agent must never run on my machine. Uraeda fetches the
  branch from the clone into the repository.
- **Agents skip their permissions inside the sandbox**, and keep `auto` mode outside. The
  [Agents](/specs/decisions/agents.md) decision needs an exception for it.
- **The network follows Docker Sandboxes' default balanced mode.** Allowing a URL it blocked must be
  easy: one press, and the agent retries.
- **Logins**: the sandboxes share logins of their own, for Claude and for git, never mine. I log in
  once.
- **The full Claude**: my installed plugins, skills, memory, and settings work inside the sandbox,
  read-only. If that is too complex, drop the feature.
- **The environment** comes from the project's Nix flake, built the way Docker Sandboxes works best:
  one template per `flake.lock`, reused by every sandbox of that lock, rather than my Nix store
  mounted in.
- **Previews and Uraeda's own commits run inside the sandbox** too: Storybook runs there, reached
  through the preview proxy, and the branch's commit hooks run there. Nothing of the branch runs on
  my machine.
- **Chats on the main checkout** are sandboxed only when I choose it as the session starts: a
  sandbox for every quick chat would be too slow.
- **Finishing or cleaning** a feature removes its sandbox and its clone.

A remote host, to share the load of parallel test runs, is a feature of its own, proposed once this
one is merged. This one should be designed so a remote host can plug in.

## Why

- Make it _safer_ to run agents in YOLO mode: today the agent can read anything I can, `~/.ssh`
  included, behind a classifier only.
- The goal is security first, then performance. If it achieves neither, drop it.

## Notes

- Postponed on 2026-11-08, with its spec written and waiting for review: low priority for now.
- Not verified yet: one Claude login serving every sandbox, a built environment saved as a template,
  Storybook reached through a published port, and mounting single files read-only.
- My machine cannot start a sandbox yet: its kernel log says "SVM disabled (by BIOS)". Turning SVM
  on in the firmware fixes it.
- Docker Sandboxes runs its own copy of Claude Code, not my installed one, which the Agents decision
  forbids today: that decision changes with this feature.
- The earlier research, questions, answers, and spec are in git, as they were when postponed:
  `git show 573d7129:specs/proposals/nix-docker/discovery-01.md`, `clarifications-01.md`, `spec.md`,
  and `data-model.md` in the same folder. The two decisions the spec proposed are at
  `git show 86d8d1d8:specs/decisions/agent-sandboxes.md` and `specs/decisions/agents.md`. The
  mockups are in [`SandboxMockups.stories.tsx`](/packages/web/src/SandboxMockups.stories.tsx).
