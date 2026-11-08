---
status: answered
---

# Clarifications, round 01: Nix / Docker based execution environments

> [!NOTE]
>
> Answered on 2026-11-08.
>
> - Verdict: worth building, with changes. A local sandbox gives real security. Only a remote host
>   adds performance, and it is a feature of its own, built on the local one.
> - Sandboxing the agent alone is not enough: today the host runs the branch's code for previews,
>   commit hooks, and the shared `.git` folder. The git layout question decides how far the boundary
>   holds.
> - Two active decisions change: skipping permissions inside a sandbox goes against the agents
>   decision. A private clone per sandbox replaces "a session runs in its worktree".
> - Three relaxed guards: skipped permissions, an open network, and a git login inside the sandbox.
>   Each says what a misled agent could then do.
> - Isolation, environment, and platforms work together: a container from the host's Nix store works
>   on Linux only.
> - Seven points are settled under "Check these". The most important: sandboxing is off until you
>   turn it on for a repository, and then never silently falls back.

## Context

### Goal

The [proposal](proposal.md) asks for every agent to run sandboxed, with no access to your files, so
YOLO mode is safe. Each worktree gets a container built from the project's Nix flake, optionally on
another machine. Finishing a feature removes it. You may drop the feature if it brings neither
security nor performance.

### Today

Uraeda runs your installed `claude` on your machine, in the feature's worktree, in `auto` permission
mode ([`claude.ts`](/packages/server/src/runner/claude.ts)). In `auto` mode a classifier model
reviews each action. Anthropic calls it "a per-action control, not an isolation boundary". The agent
can read anything you can, `~/.ssh` included.

The host also runs the branch's code outside the agent:

- Storybook previews start on your machine, from the branch's configuration
  ([`preview/run.ts`](/packages/server/src/preview/run.ts)).
- Committing your edits on the Git page runs the branch's `.vite-hooks/pre-commit`.
- A worktree's `.git` is a file pointing into the main repository's `.git` folder. Git runs hooks
  and config from that folder.

The benchmarks already run Claude Code in Docker, with the host's binary mounted
([`docker-wrapper.ts`](/packages/benchmarks/src/docker-wrapper.ts)).

How others sandbox agents:

| Tool                     | Unit                     | Code comes out          | Logins                          |
| ------------------------ | ------------------------ | ----------------------- | ------------------------------- |
| Claude Code's sandbox    | its shell commands only  | in place                | yours                           |
| Docker Sandboxes         | a microVM per task       | live folder, or a clone | swapped in by a proxy           |
| container-use            | a container and a branch | git merge               | secrets resolved per command    |
| Anthropic's devcontainer | a container per project  | bind mount              | a login in a volume             |
| Claude Code on the web   | a VM per session         | push                    | a proxy holds your GitHub token |

### Scope

This round covers:

- what confines the agent, and what runs inside with it;
- how the sandbox's code reaches the repository;
- permissions, network, logins, and the environment;
- platforms, and whether the remote host comes now.

Making Uraeda itself a container image is left out.

### Sources

- The runner, the preview runner, the core's worktrees, and the benchmarks' Docker wrapper, linked
  above.
- Claude Code's sandboxing, permission modes, devcontainer, authentication, and terms pages.
- Docker Sandboxes, container-use, Sculptor, Dev Containers, DevPod, Codespaces, Coder, Codex, and
  Gemini CLI.
- Docker, Podman, Incus, bubblewrap, gVisor, nixpkgs' `dockerTools`, nix2container, and git's
  worktree and config documentation.
- Experiments on your machine: container start times, your `claude` in a container, the flake's
  tools from your read-only Nix store, and a sandboxed worktree's `.git`.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **Sandboxing is off by default**, turned on per repository in your settings. Once on, a session
  that cannot start its sandbox fails with the reason, rather than running unsandboxed. A silent
  fallback would defeat the point. See [discovery](discovery-01.md#worth-it-and-feasibility).
- **Storybook previews run inside the sandbox**, and the existing proxy forwards to its port. Your
  note asked whether that is possible: it is. Nothing of the branch then runs on your machine. See
  [discovery](discovery-01.md#storybook-mockups-without-a-full-local-environment).
- **Chats on the main checkout are sandboxed too**, with the same git layout as features: "all agent
  calls". See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Uraeda's own commits on a sandboxed branch run inside its sandbox.** The branch's hooks still
  run, as the git decision requires, but not on your machine. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **No Uraeda flake for the agent.** The sandbox runs your installed `claude`, mounted read-only.
  The agents decision forbids a bundled agent, and your binary runs in a container. See
  [discovery](discovery-01.md#a-flake-for-the-project-and-an-uraeda-flake-for-agentic-dependencies).
- **The base image is built by a command you run**, `ura sandbox setup`, never by the server. The
  distribution decision forbids downloading anything at run time. See
  [discovery](discovery-01.md#approaches).
- **Finishing removes the container, but not a local folder.** Locally the checkout stays on your
  disk, mounted into the container, and cleaning removes it as today. Only a remote host keeps
  nothing local. See
  [discovery](discovery-01.md#finishing-prunes-the-container-no-local-worktree-to-delete).

## Q1: Does this feature build the remote host too, or the local sandbox first?

A local container confines the agent, but it adds no capacity: your 32 cores and 31 GB stay the
same. Only the remote host gives the performance you asked for.

With a remote Docker, the checkout lives on the other machine. The core today reads and watches
every worktree in process, so it would need:

- a helper on the remote that streams changes back;
- a supervisor that keeps the agent alive when SSH drops;
- a tunnel for previews.

Its design depends on the local sandbox's image, git layout, and process API. More in
[discovery](discovery-01.md#a-remote-host-to-share-the-load).

Why it matters: building both at once designs the remote part on guesses, and roughly doubles the
feature. Dropping both keeps agents unconfined.

- **A (recommended). Build the local sandbox now, designed so a remote host can plug in. The remote
  host becomes its own feature, proposed once this one is merged.**
  - [pro] the remote host is designed on a working base; security arrives sooner.
  - [con] four parallel test runs still share your machine until then, only capped.
  - Why recommended: the split rule applies, since the local design shapes the remote one.
- **B. Build both in this feature.**
  - [pro] one feature delivers both goals.
  - [con] about twice the work, with two unknowns at once.
- **C. Drop the feature.**
  - [pro] nothing to build or maintain.
  - [con] agents keep running with your full access, behind a classifier only.

**Answer:** A

## Q2: What confines the agent?

Example: a feature's agent runs `pnpm test`, then Storybook, and reads `~/.ssh/id_ed25519` when a
web page tells it to.

| Option                  | Start, measured | Your files                        | macOS         | Remote later   |
| ----------------------- | --------------- | --------------------------------- | ------------- | -------------- |
| Docker or Podman        | 0.6 to 1.3 s    | only what is mounted              | through a VM  | Docker context |
| Anthropic's `srt`       | under 10 ms     | readable unless denied one by one | yes, natively | no             |
| Docker Sandboxes, `sbx` | not measured    | only what is mounted              | yes           | its cloud      |

Anthropic's `srt`, its sandbox runtime, wraps one process with bubblewrap or Seatbelt. It is a beta
research preview. Docker Sandboxes support Ubuntu 24.04+ only on Linux, not your CachyOS. They run
Docker's own `claude`, which the agents decision forbids. More in
[discovery](discovery-01.md#isolation).

Why it matters: it decides the boundary's strength, what a remote host can reuse, and which
platforms get a sandbox.

- **A (recommended). A container per checkout, through the Docker or Podman command you installed.
  The agent and Storybook run inside it, with only the checkout mounted.**
  - Example: the tests and Storybook run in the container; `~/.ssh` does not exist there.
  - [pro] a full boundary, CPU and memory caps, and a path to remote hosts.
  - [con] about a second per container start, and Docker's daemon runs as root.
  - Why recommended: it is the proposal's shape, and the only option that reaches a remote host.
- **B. Anthropic's `srt` around each agent and Storybook process.**
  - Example: the tests run on your machine, under bubblewrap; `~/.ssh` is hidden only if listed.
  - [pro] instant, and works on macOS without a VM.
  - [con] beta, no resource caps, and no remote path.
- **C. Docker Sandboxes, a microVM per checkout.**
  - Example: the tests run in a VM with its own kernel.
  - [pro] the strongest boundary.
  - [con] unsupported on your distribution, and it runs Docker's `claude`, not yours.

**Answer:** C: It runs, just installed it from AUR. Looks like a perfect fit?

## Q3: How does the sandbox's checkout reach the repository?

Example: the agent of "Recurring tasks" commits on its branch. Then it writes
`core.fsmonitor = ./evil.sh` into git's config, and moves `main` to a commit of its own.

A worktree shares the main repository's `.git` folder: its objects, its branches, its hooks, and its
config. Git runs commands named there, so a planted `core.fsmonitor` runs on your machine at the
next `git status`. Mounting `config` and `hooks` read-only blocked those in an experiment. Every
branch stayed writable, though, `main` included. Pillar Security escaped Cursor's sandbox through a
git folder with another name. More in [discovery](discovery-01.md#git-layout).

Why it matters: this is where the boundary holds or leaks. It also changes what Uraeda calls a
checkout, today always a worktree.

- **A (recommended). Each sandbox gets its own clone, under `.worktrees/` as today. Uraeda fetches
  the branch from it into the repository.**
  - Example: the planted config stays in the clone, and Uraeda never runs it. `main` in your
    repository does not move.
  - [pro] no way found for the agent to run code on your machine, or to move another branch.
  - [con] the core learns clones beside worktrees: listing, watching, fetching, and cleaning.
  - Why recommended: it is Docker Sandboxes' clone mode, the only layout without a known hole.
- **B. Keep the shared worktree, with `config` and `hooks` mounted read-only.**
  - Example: the config write fails, but `main` moves to the agent's commit.
  - [pro] nothing changes in the core.
  - [con] a denylist: any path it forgets, like a submodule's config, reopens the door.
- **C. Keep the shared worktree as is.**
  - Example: `./evil.sh` runs on your machine at the next `git status`.
  - [pro] nothing to build.
  - [con] the sandbox is bypassed in one line.

**Answer:** A

## Q4: Do agents skip permissions inside the sandbox?

Example: an agent runs `rm -rf node_modules && pnpm install`, then `git push --force` on its own
branch.

In `auto` mode the classifier blocks a force push and other risky commands. After 3 blocks in a row,
it falls back to asking, which an unattended run cannot answer, so the run stops. Skipping
permissions blocks nothing, and Anthropic advises it only inside a container or VM. The
[agents](/specs/decisions/agents.md) decision says: "never with its permissions skipped". More in
[discovery](discovery-01.md#claude-codes-permission-modes).

Why it matters: it is the YOLO mode you asked for, and it changes an active decision. A misled agent
could then delete the branch's uncommitted work, or push with the sandbox's git login, unstopped.

- **A (recommended). Skip permissions inside a sandbox, and keep `auto` mode outside. The agents
  decision gains the exception.**
  - Example: both commands run.
  - [pro] no run stops on a classifier block; no "Allow and retry" in sandboxed sessions.
  - [con] the sandbox is the only layer left.
  - Why recommended: it is the proposal's goal, and Anthropic's own advice for a container.
- **B. Keep `auto` mode inside the sandbox too.**
  - Example: the force push is blocked, and three blocks stop the run.
  - [pro] two layers, and the decision stays as is.
  - [con] the classifier still stops unattended runs.

**Answer:** A

## Q5: What can the sandbox reach on the network?

Example: during a discovery, the agent reads documentation on `vite.dev`, then a page tells it to
send the code to `paste.example`. It could also try to reach your router at `192.168.1.1`.

Discovery reads arbitrary documentation pages, and Claude Code fetches them from inside the sandbox.
An allowlist blocks every page not listed, as Anthropic's devcontainer firewall does. Web search
runs at Anthropic, so it works either way. More in [discovery](discovery-01.md#network).

Why it matters: with an open internet, a page the agent reads could make it leak. It could send the
branch's code and the sandbox's logins to any website.

- **A (recommended). The internet is open; your local network and your machine's ports are
  blocked.**
  - Example: `vite.dev` and `paste.example` work; `192.168.1.1` does not.
  - [pro] discovery keeps reading any page; the sandbox cannot reach your other services.
  - [con] the branch's code and the sandbox's logins can leave by any website.
  - Why recommended: discovery depth is the workflow's core, and the sandbox holds only one branch.
- **B. Only listed hosts, through a proxy: Anthropic, GitHub, and the package registries.**
  - Example: `vite.dev` and `paste.example` both fail.
  - [pro] exfiltration only to listed hosts.
  - [con] discoveries cannot read most documentation, and the list needs upkeep.
- **C. Fully open, your local network included.**
  - Example: all three work.
  - [pro] nothing to set up.
  - [con] the agent can reach anything on your network.

**Answer:** Look at the default balanced mode of docker sandboxes. It looks good to me.

Also it should be easy to allow an URL that was blocked.

## Q6: How do the agent and git log in inside the sandbox?

Example: you turn sandboxing on, and the first session starts. Claude Code needs a login, and the
implementation step pushes the branch and opens a pull request with `gh`.

Your login lives in `~/.claude/.credentials.json`, and `gh`'s in `~/.config/gh/hosts.yml`. Anything
mounted in the sandbox is readable by the agent. A mounted `~/.claude` is also writable: its
`settings.json` hooks would then run on your machine at your next `claude`. The web UI has no
terminal for an interactive login. Anthropic's terms allow your own login in a hosted sandbox. They
forbid a tool storing it for you. More in [discovery](discovery-01.md#credentials).

Why it matters: it decides what a misled agent can steal, and whether pushes and pull requests stay
in the agent's steps.

- **A (recommended). The sandboxes share their own logins, kept in Uraeda's data folder. You make
  them once with `ura sandbox login`, which runs `claude` and `gh auth login` inside a sandbox, in
  your terminal. Your Claude settings, `CLAUDE.md`, and skills are mounted read-only.**
  - Example: you log in once; each session starts logged in, with your model and memories.
  - [pro] your own logins never enter a sandbox; you pick a `gh` token scoped to one repository.
  - [con] a misled agent can still steal the sandbox logins.
  - Why recommended: it keeps your own logins out, and Uraeda never reads one.
- **B. Mount your own `~/.claude` and `gh` folders.**
  - Example: nothing to do; the first session just works.
  - [pro] no login step.
  - [con] the agent reads your logins, and can plant hooks your next `claude` runs.
- **C. Claude's login only. Uraeda pushes and opens pull requests from your machine.**
  - Example: you log in to Claude once; the agent never holds a git login.
  - [pro] no git login to steal.
  - [con] the implementation and finish steps move their pushes and `gh` calls into Uraeda.

**Answer:** A

## Q7: What gives the sandbox its tools?

Example: the sandbox of a Uraeda feature needs Node 24, pnpm, Rust 1.96, cargo-nextest, and
Playwright's browsers. A project of yours without a flake needs only Python.

Your flake's dev shell is 405 store paths and 4.7 GB. In an experiment, a plain Debian container
mounted your Nix store read-only and ran the flake's Node, cargo, and pnpm. It took about 3 s,
without Nix inside. An image built from the flake copies those 4.7 GB into Docker, per lock change.
More in [discovery](discovery-01.md#environment).

Why it matters: it decides the start time, the disk used, and which projects can be sandboxed.

- **A (recommended). The flake's dev shell, evaluated on your machine, from your Nix store mounted
  read-only. A project without a flake gets the base image only: git and a shell.**
  - Example: the Uraeda sandbox starts in about 3 s, with no extra disk; the Python project has no
    Python.
  - [pro] no copy, no image per project, and the flake you already keep.
  - [con] Linux only, and projects without a flake get little.
  - Why recommended: it is your proposal's flake, at no extra disk or build time.
- **B. An image built from the flake for each lock, with nix2container.**
  - Example: the first start builds a 4.7 GB image, then starts in about a second.
  - [pro] self-contained, so a remote host can pull it later.
  - [con] the closure is copied into Docker, again at each lock change.
- **C. The repository's `devcontainer.json` or Dockerfile, flake or not.**
  - Example: the Python project's Dockerfile installs Python.
  - [pro] any project can be sandboxed.
  - [con] a second environment file to keep beside the flake.

**Answer:** B: Review how docker sandboxes work. Also except me all users run MacOS.

## Q8: Which platforms get the sandbox?

Example: a macOS user turns sandboxing on.

A macOS Nix store holds macOS binaries, which a Linux container cannot run. Docker on macOS runs in
a VM, whose shared folders are slow enough that VS Code advises a volume for `node_modules`. With a
flake on macOS, the environment needs a Linux builder. More in
[discovery](discovery-01.md#platforms).

Why it matters: macOS doubles the platforms to build and test, for users other than you.

- **A (recommended). Linux only. On macOS, the setting says it is unavailable, and sessions run as
  today.**
  - Example: the macOS user sees "Sandboxing needs Linux".
  - [pro] one platform to build and test, the one you use.
  - [con] macOS users keep running agents unconfined.
  - Why recommended: you asked for your own use, and macOS needs a different environment.
- **B. Linux and macOS, macOS through Docker Desktop and a Linux builder.**
  - Example: the macOS user's sandbox builds its environment in a Linux VM.
  - [pro] every user gets a sandbox.
  - [con] a second environment path, and slow shared folders.

**Answer:** B: Review based on other answers.

## Settled without the human

### Behaviour

- **An idle sandbox stops** after 30 minutes without a session or a preview, like Storybook today.
  The next session starts it again, from its checkout. See
  [discovery](discovery-01.md#needs-no-choice).
- **Memory and CPU caps** are settings per repository, unset by default, as Docker's `--memory` and
  `--cpus`. See [discovery](discovery-01.md#previews-and-caches).
- **A sandboxed session says so** in its header, with the command to open a shell in its sandbox.
  The web UI has no terminal. See [discovery](discovery-01.md#needs-no-choice).
- **A changed flake applies at the next start**: Uraeda evaluates it again when `flake.nix` or
  `flake.lock` changed. See [discovery](discovery-01.md#nix-and-containers).

### Under the hood

- **The sandbox sits under the agent runtimes**, as the way any runtime's process and Storybook
  start. The extensions system's runtimes get it without code of their own. See
  [discovery](discovery-01.md#overlaps-with-features-in-flight).
- **Mounts keep their host paths**: the checkout, the plugin, the chat images, and the Claude
  configuration folder. Resume and the transcripts' paths then match. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The container runs as your user, never root**, with every capability dropped and no new
  privileges. It never gets the Docker or Nix daemon's socket. See
  [discovery](discovery-01.md#container-runtimes-and-isolation).
- **Processes are tracked by Uraeda**, since a killed `docker exec` leaves its process running. A
  small wrapper in the container records each process, which Uraeda signals through it. See
  [discovery](discovery-01.md#remote-hosts).
- **Build caches are not shared writable.** Uraeda seeds a new checkout's `target/` on your machine
  before mounting it, as today, and each sandbox keeps its own pnpm store. See
  [discovery](discovery-01.md#previews-and-caches).
- **Host-side git never runs a sandbox's config.** The plan's first task checks that the core's
  reads run no `core.fsmonitor` or hooks, along with resume and Storybook's port. See
  [discovery](discovery-01.md#worth-it-and-feasibility).
- **The benchmarks keep their Docker wrapper** for now; sharing the sandbox's code is later work.
  See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

**Notes:**

- **Chats on the main checkout are sandboxed too**: I'm scared this will slow things down too much.
  It should be an option when the session starts.
- **No Uraeda flake for the agent.**: Well I'd want the _full_ claude then. With all installed
  plugins, skills, memory, ...

  If it's too complex, maybe we'll just drop this.
