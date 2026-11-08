---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Nix / Docker based execution environments

> [!IMPORTANT]
>
> Spec to review, about 25 minutes.
>
> - You approve a per-repository switch that runs agents, previews, and Uraeda's commits in Docker
>   Sandboxes. Each feature gets a microVM, its own clone, and an environment built from the flake.
>   Agents skip permissions inside.
> - A new decision, Agent sandboxes, and a changed one, Agents: inside a sandbox the agent is
>   Docker's copy of Claude Code, signed in by you, and it may skip permissions.
> - Your machine cannot start a sandbox yet. Its kernel log says "SVM disabled (by BIOS)": turning
>   on SVM in the firmware fixes it. Until then, the settings page says so.
> - Unverified, checked by the plan's first task: one Claude login serving every sandbox, a built
>   environment saved as a template, and Storybook reached through a published port. If logins turn
>   out per sandbox, each new sandbox asks for `/login` once.
> - Three readings of your answers: logins live in Docker Sandboxes' own store, a host you allow
>   opens for every sandbox, and a chat is sandboxed only when you turn it on.
> - Relaxed guards: a misled agent can delete its branch's uncommitted work, or push to any branch
>   your GitHub token reaches. A host you allow stays open to every sandbox.
> - Risk tier `high`: a security boundary, a new outside tool, and a second kind of checkout. The
>   plan does not wait for your review.

A repository the human sandboxes runs each feature's and change's agent in a Docker Sandboxes
microVM, which holds only that feature's clone and an environment built from the project's Nix
flake. The agent skips its permissions there, so unattended runs stop only at human gates. Previews
and Uraeda's own commits run inside too, so nothing of the branch runs on the human's machine. See
the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Decisions

Postponing this feature reverted the two decisions it proposed: a new one, Agent sandboxes, and a
change to [Agents](/specs/decisions/agents.md). Their proposed text is in commit `86d8d1d8`, and
comes back with the feature.

Relied on:

| Decision                                           | What it means for this spec                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| [Git](/specs/decisions/git.md)                     | hooks still run, inside the sandbox; clones are removed only when asked |
| [Settings](/specs/decisions/settings.md)           | the sandboxed repositories are a table of `config.toml`                 |
| [Run lifecycle](/specs/decisions/run-lifecycle.md) | a continued run resumes from transcripts kept outside the sandbox       |
| [Stack](/specs/decisions/stack.md)                 | the server stops the Storybook it started in a sandbox when it stops    |
| [Distribution](/specs/decisions/distribution.md)   | the package downloads nothing: environments build inside sandboxes      |
| [Preview](/specs/decisions/preview.md)             | the mockups are stories, and Storybook runs from the decision's command |

## User stories

### US1: Turn sandboxing on for a repository (P1)

In Settings, a Sandboxes section shows whether Docker Sandboxes can run here, the two commands that
sign the sandboxes in, and a switch per repository. A change applies to the next session.

[Settings, ready](/packages/web/src/SandboxMockups.stories.tsx#SettingsReady)

[Settings, no sandbox possible](/packages/web/src/SandboxMockups.stories.tsx#SettingsUnavailable)

Key scenarios:

1. **Given** `sbx` 0.51.0 is installed and signed in, **when** the human opens Settings, **then**
   Sandboxes reads "sbx 0.51.0 · signed in to Docker" and lists uraeda and todo-app, both off.
2. **Given** the human turns uraeda on, **then** `config.toml` holds
   `[sandbox] repositories = ["uraeda"]`, and the next session of an uraeda feature runs sandboxed.
3. **Given** `sbx diagnose` reports no hypervisor, **when** the human opens Settings, **then** the
   section reads "Docker Sandboxes cannot start a sandbox on this machine: virtualization is off in
   its firmware (SVM disabled by BIOS).", and every switch is disabled.

More scenarios:

1. **Given** `sbx` is not installed, **then** the section reads "Docker Sandboxes is not installed."
   with a link to its install page, and every switch is disabled.

### US2: A feature's agent works in its sandbox (P1)

Starting a feature in a sandboxed repository makes its branch and a clone, builds the environment of
its flake lock when none exists yet, starts its sandbox, then the agent. Each commit the agent makes
reaches the repository's branch at once.

[First start, environment building](/packages/web/src/SandboxMockups.stories.tsx#FirstStart)

Key scenarios:

1. **Given** uraeda is sandboxed and no environment matches its `flake.lock`, **when** the human
   starts the feature dark-mode, **then** the steps read "Make the branch 2026-11-08-dark-mode and
   its clone", "Build the environment from flake.lock: the first time takes a few minutes", "Start
   its sandbox", and "Start the agent with your message".
2. **Given** that environment exists, **when** the human starts a second feature, **then** no build
   step shows, and the agent starts with Node 24, pnpm, and Rust 1.96 on its path.
3. **Given** the agent runs `cat ~/.ssh/id_ed25519` in its sandbox, **then** the file does not
   exist, and nothing outside the clone, the plugin, and the chat images is mounted.
4. **Given** the agent commits on 2026-11-08-dark-mode in its clone, **then** within 2 seconds the
   repository's branch points at that commit, and the feature page shows it.

More scenarios:

1. **Given** the agent changed `flake.lock` and committed, **when** the next session starts,
   **then** the new lock's environment builds, and the sandbox is made again from it, the clone
   kept.
2. **Given** a sandbox was stopped by Docker Sandboxes after its last session, **when** the human
   sends a message, **then** the sandbox starts again, and the agent resumes its conversation.

### US3: Previews and commits stay inside (P1)

The feature's Storybook runs in its sandbox, and the human's commits of the branch, from the Git
page, run there with the branch's hooks.

Key scenarios:

1. **Given** a sandboxed feature's spec embeds a story, **when** the human opens the spec, **then**
   Storybook starts inside the sandbox, and the story shows through the existing preview proxy.
2. **Given** the human edits the feature's plan and commits it on the Git page, **then** the commit
   runs `.vite-hooks/pre-commit` inside the sandbox, and its output shows as it does today.

### US4: Allow a host the sandbox blocked (P2)

When the sandbox blocks a host the agent asked for, the session shows it, with one button that
allows it and asks the agent to try again.

[Blocked host](/packages/web/src/SandboxMockups.stories.tsx#BlockedHost)

Key scenarios:

1. **Given** the agent fetches `https://vite.dev/config/`, **then** the session shows "Blocked by
   the sandbox: vite.dev", with "Allowing it opens vite.dev to every sandbox on this machine."
2. **Given** the human presses "Allow and retry", **then** vite.dev is allowed for every sandbox,
   and the agent is asked to retry in a turn of its own, as "Allow and retry" does today.
3. **Given** the agent blocked on vite.dev and api.example.com, **then** "Allow all (2)" sits beside
   Send, and allows both in one retry.

### US5: A sandboxed session never runs outside (P2)

A session that cannot start its sandbox fails with the reason. A feature started before its
repository was sandboxed moves to a sandbox only when the human asks.

[Refused](/packages/web/src/SandboxMockups.stories.tsx#Refused)

[Started before sandboxing](/packages/web/src/SandboxMockups.stories.tsx#MoveToSandbox)

Key scenarios:

1. **Given** uraeda is sandboxed and its sandbox cannot start, **when** the human sends a message,
   **then** the session fails with `sbx`'s reason, and no agent starts on the host.
2. **Given** recurring-tasks has a worktree from before sandboxing, **when** its session would
   start, **then** it shows "This feature started before its repository ran agents in sandboxes."
   with "Move to a sandbox".
3. **Given** the worktree has no uncommitted change, **when** the human presses "Move to a sandbox",
   **then** a clone replaces the worktree, and the session starts in its sandbox.

More scenarios:

1. **Given** the worktree has uncommitted changes, **when** the human presses "Move to a sandbox",
   **then** it refuses with "Commit or discard this worktree's changes first.", and nothing moves.

### US6: A sandboxed chat (P3)

A new chat on the main checkout runs as today, unless the human turns on its Sandboxed switch, which
gives it a clone of the default branch and a sandbox.

[New chat](/packages/web/src/SandboxMockups.stories.tsx#NewChatChoice)

Key scenarios:

1. **Given** uraeda is sandboxed, **when** the human starts a chat with Sandboxed off, **then** it
   runs on the main checkout in `auto` mode, as today.
2. **Given** Sandboxed is on, **when** the agent commits an inbox triage, **then** the default
   branch fast-forwards to it, and the main checkout's files follow.

More scenarios:

1. **Given** the main checkout has uncommitted changes the fast-forward would overwrite, **then**
   the chat shows "The chat's commits wait in its clone: commit or stash your changes on main.", and
   retries once the checkout is clean.

### US7: Cleaning removes the sandbox (P2)

Cleaning a merged feature, or dropping one, removes its sandbox, its clone, and its state folder. An
environment no sandbox uses anymore goes with them.

Key scenarios:

1. **Given** dark-mode is merged, **when** the human runs `ura clean`, **then** its sandbox, clone,
   and state folder are removed, once the repository holds every commit of its branch.
2. **Given** dark-mode was the last sandbox built from an older lock, **then** that environment's
   template is removed too.

## Architecture

Docker Sandboxes runs each checkout in a microVM with its own kernel, on Linux and macOS, with a
host proxy for the network and for logins: see [Docker Sandboxes](discovery-01.md#docker-sandboxes).
Uraeda drives it only through the `sbx` command. Each sandbox mounts a clone with its own git
folder, so nothing it writes is run by the host: see
[the shared `.git` folder](discovery-01.md#git-and-the-shared-git-folder). Docker's own `--clone`
mode keeps the clone inside the VM, where the core cannot read or watch it, so Uraeda makes the
clone on disk instead.

- **The sandbox runner**, in the server, is the only code that runs `sbx`. It makes, starts, stops,
  and removes a checkout's sandbox, runs a command in it with its input and output streamed, and
  publishes a port. It owns the sandbox's name and its mounts: the clone read-write, and read-only
  the main repository's git folder, the skill's plugin, and the chat images. Transcripts live in the
  state folder, mounted at Claude Code's.
- **Environments** build one template per flake lock. A builder sandbox installs Nix, runs the
  flake's dev shell, writes its variables where the agent's shell reads them, and is saved as a
  template. It owns the lock's hash and the template's name. Only the builder may reach
  `cache.nixos.org` and `releases.nixos.org`.
- **Checkouts**, in the core, know two kinds: a worktree, and a clone for a sandboxed repository.
  They own making a clone, listing and watching it beside worktrees, fetching its branch into the
  repository, and removing it. They own the rule that a clone's branch is the repository's branch,
  rewrites included.
- **Sandboxed writes**: the core's git module, the one place that writes git, runs its commands for
  a clone through a launcher the server gives, which runs them in the sandbox. Uraeda's file writes
  to a clone go the same way. Host-side reads never follow a link out of the clone.
- **The agent in its sandbox**: the Claude Code adapter starts `claude` through the sandbox runner,
  with its permissions skipped. It checks transcripts in the state folder. Outside a sandbox,
  nothing changes.
- **Previews in the sandbox**: the preview runner starts the preview decision's command through the
  sandbox runner. A small relay in the sandbox exposes Storybook's port, which is published on the
  host's loopback, where the proxy already forwards.
- **Blocked hosts**: while a turn runs, the runner reads Docker Sandboxes' pending approvals for its
  sandbox, and records each as a blocked action of the turn. Allowing goes through today's allow
  path: a rule for every sandbox, the approval dismissed, and a retry turn.
- **Settings**: the core reads and writes `[sandbox]` in `config.toml`. The settings page's
  Sandboxes section shows `sbx`'s state from `sbx version` and `sbx diagnose`.

Tradeoffs:

- Docker Sandboxes is proprietary, needs a Docker account and hardware virtualization, and supports
  Ubuntu 24.04+ officially. Your CachyOS works with its packages, without support.
- Each flake lock's environment holds its whole closure, about 4.7 GB for this repository, and its
  first build takes minutes.
- Discoveries read only the documentation sites allowed so far, one press each.
- The core keeps two kinds of checkout, and every feature touching worktrees must handle both.

## Edge cases

| Importance | Situation                                                    | What happens                                                                                      |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| High       | The sandbox cannot start, or `sbx` is missing                | the session fails with the reason; no agent starts on the host                                    |
| High       | The agent plants `core.fsmonitor` or a hook in its clone     | nothing runs: the host only reads the clone, and fetches from it                                  |
| High       | The agent makes a file in its clone a link to `~/.bashrc`    | the human's edit is written inside the sandbox, so the link reaches nothing of the host           |
| High       | The agent rewrites its branch, as a rebase does              | the repository's branch follows the clone's, its old head kept in the reflog                      |
| High       | The clone is to be removed with commits the repository lacks | Uraeda fetches first; if the fetch fails, it keeps the clone and says why                         |
| Normal     | The environment's build fails                                | the start step shows Nix's last lines, and no sandbox starts                                      |
| Normal     | Claude Code is not signed in inside the sandbox              | the session fails with "Claude Code is not signed in for sandboxes." and the login command        |
| Normal     | The branch's preview command listens on 127.0.0.1 only       | the relay forwards to it, so the command needs no change                                          |
| Normal     | A server restart cuts a sandboxed run                        | the run continues, as the run lifecycle says, resuming from the transcripts in the state folder   |
| High       | The human turns sandboxing off for a repository              | existing clones keep running in their sandboxes until cleaned; only new features get worktrees    |
| Niche      | A sandboxed chat's fast-forward of `main` is refused         | its commits wait in its clone, with the message of US6, and it retries when the checkout is clean |
| Niche      | The repository's name is renamed by hand                     | its sandboxes keep their old names, until cleaned                                                 |

## Success criteria

- **SC-001** (no host files): a sandboxed agent finds no file of the host's home folder, in a test
  through the real `sbx`.
- **SC-002** (nothing runs on the host): with a fake `sbx`, every agent, preview, and git write of a
  sandboxed checkout goes through it, and none starts on the host.
- **SC-003** (planted git config): a `core.fsmonitor`, a hook, and a filter planted in a clone never
  run during Uraeda's reads, fetches, and listings.
- **SC-004** (commits reach the branch): a commit in a clone reaches the repository's branch within
  2 seconds.
- **SC-005** (one environment per lock): a second feature with the same `flake.lock` starts without
  downloading from `cache.nixos.org`.
- **SC-006** (one press): a blocked host is allowed, and the agent asked to retry, in one press.

## Assumptions

The points settled in [Check these](clarifications-01.md#check-these) and
[Settled without the human](clarifications-01.md#settled-without-the-human) hold as written, except
these, which an answer or a note changed:

- **Chats on the main checkout** are sandboxed only when the human turns on the chat's switch, as
  your note asked. The switch starts off for each new chat.
- **The base image** is Docker's Claude Code template, with Nix and the flake's environment added by
  Uraeda, not an image `ura sandbox setup` builds.
- **The logins** live in Docker Sandboxes' store, which its proxy injects. The settings page shows
  the two `sbx` commands to run, in place of a `ura sandbox login` command.
- **Memory and CPU caps** are `sbx`'s defaults: half the host's memory per sandbox, and every CPU.
  Settings for them can come later.
- **An idle sandbox** stops when Docker Sandboxes stops it, shortly after its last command ends. A
  running Storybook keeps it up until its 30 minutes without a view.
- **The container runs as your user** becomes: the sandbox's own `agent` user, in its own VM.
- **Mounts keep their host paths**, as Docker Sandboxes mounts every folder at its own path.

Settled while writing this spec:

- **The clone borrows the repository's objects** through git's alternates, read-only in the sandbox,
  so it costs no copy of the 892 MB of history.
- **The default branch reaches the clone** as the remote `host`, the main git folder mounted
  read-only. Pushing into the clone would run its hooks on the host.
- **Your Claude settings and `CLAUDE.md`** are mounted read-only as single files, and your skills
  through Docker Sandboxes' read-only skills sharing. Single-file mounts are undocumented: without
  them, the two files are left out.
- **The clone's git identity** copies your global `user.name` and `user.email` at its creation.
- **`ura` is not installed in the sandbox**: the agent follows the skill without it.
- **A new clone's `target/` is seeded** from the main checkout's on Linux, as worktrees are today,
  and not on macOS, whose builds are of another platform.
- **The distribution decision** forbids the package downloading at run time. Environments download
  inside sandboxes, through Docker Sandboxes, as an agent's `pnpm install` does today.
- **Sandbox names** are `uraeda-<repository>-<slug>`, and `uraeda-<repository>-chat-<ID>` for a
  chat.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

`high`: it sets a security boundary, adds an outside tool the server drives, and gives the core a
second kind of checkout.
