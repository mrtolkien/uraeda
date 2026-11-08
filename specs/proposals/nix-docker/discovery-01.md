# Discovery, round 01: Nix / Docker based execution environments

## Summary

Running coding agents sandboxed comes in three shapes in established tools:

- **A process sandbox around the agent.** Claude Code's built-in sandbox, Anthropic's
  `sandbox-runtime`, and Codex CLI use bubblewrap on Linux and Seatbelt on macOS.
- **A container or microVM per task.** container-use, Docker Sandboxes, devcontainers, and Gemini
  CLI's Docker mode work this way.
- **A cloud VM per session.** Claude Code on the web, Codex cloud, Cursor's cloud agents, and Coder
  work this way.

Where the tools differ:

- how code gets back out: a live bind mount, a private clone fetched by the host, or a push;
- how credentials enter: mounted, an environment token, or injected by a proxy outside;
- how the environment is described: a Dockerfile, `devcontainer.json`, a setup script, or Nix;
- whether the network is open, allow-listed, or off.

The proposal asks for the container shape, one per worktree. The environment comes from the
project's Nix flake, with the agent and its login inside. A remote host shares the load, and the
container goes when the feature finishes.

Today Uraeda runs the user's `claude` on the host, in the worktree, in `auto` permission mode
([`claude.ts`](/packages/server/src/runner/claude.ts)). The agent can read every file the user can
(`~/.ssh`, other projects), and write anywhere `auto` mode's classifier allows. The benchmarks
already run Claude Code in Docker, through a wrapper script given to the adapter as its `command`
([`docker-wrapper.ts`](/packages/benchmarks/src/docker-wrapper.ts)).

What is in the way:

- **The host also runs the branch's code.** Storybook previews, the commit hooks of `.vite-hooks/`,
  and the dev shell's `shellHook` all run outside the agent. A sandbox around the agent alone leaves
  these doors open.
- **The shared `.git` folder.** A worktree's agent needs write access to it, and with that access it
  can plant code that git later runs on the host.
- **Remote checkouts.** The core reads and watches every worktree in process, which a checkout on
  another machine breaks.

## How other products do it

### Claude Code's built-in sandbox

- Off by default. It covers the Bash, PowerShell, and Monitor tools and their child processes. It
  does not cover Read, Edit, Write, MCP servers, or hooks, which follow permission rules or run with
  full access ([sandboxing](https://code.claude.com/docs/en/sandboxing)).
- On Linux it uses bubblewrap and a separate network namespace, relayed by `socat` to a host proxy
  that filters by host name. macOS uses Seatbelt. Native Windows and WSL1 are not supported
  ([sandboxing](https://code.claude.com/docs/en/sandboxing)).
- Writes are allowed in the working directory, a temporary folder, and added directories. Some paths
  stay denied even there: `.git/hooks`, `.git/config` (including a worktree's shared `.git`),
  `.claude`, and shell startup files. Reads are allowed almost everywhere by default, `~/.ssh`
  included, unless `filesystem.denyRead` says otherwise
  ([sandboxing](https://code.claude.com/docs/en/sandboxing)).
- A failed command can be retried with `dangerouslyDisableSandbox`. In `bypassPermissions` mode the
  retry runs without asking, and in `auto` mode a classifier decides.
  `allowUnsandboxedCommands: false` disables the retry
  ([sandboxing](https://code.claude.com/docs/en/sandboxing)).
- Docker is incompatible with it, and inside an unprivileged container it needs
  `enableWeakerNestedSandbox`, which "considerably weakens security"
  ([sandboxing](https://code.claude.com/docs/en/sandboxing)).
- Anthropic's own verdict: the per-command sandbox alone "is not sufficient for fully unattended
  runs" in bypass or auto mode
  ([sandbox environments](https://code.claude.com/docs/en/sandbox-environments)). It cut permission
  prompts by 84% internally
  ([engineering blog, 2025-10-20](https://www.anthropic.com/engineering/claude-code-sandboxing)).

### Anthropic's sandbox-runtime

- `srt claude` wraps the whole process, file tools, MCP servers, and hooks included, with bubblewrap
  or Seatbelt. It is Apache-2.0 and a beta research preview
  ([sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime)).
- Network is denied unless a host is allowed, and allowed names that resolve to loopback,
  link-local, or metadata addresses are blocked. Writes are allow-only. It denies `.git/hooks`,
  `.git/config`, and `.mcp.json` at the project root, but on Linux only for repositories present at
  launch ([sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime)).
- Claude Code under `srt` needs writes to the project, `~/.claude`, `~/.claude.json`, and `/tmp`. It
  also needs `api.anthropic.com` reachable, plus `claude.ai` and `platform.claude.com` for OAuth
  ([sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime)).

### Claude Code's permission modes

- The modes are Manual, `acceptEdits`, `plan`, `auto`, `dontAsk`, and `bypassPermissions`.
  `--dangerously-skip-permissions` equals `bypassPermissions`. Deny rules apply even in bypass
  ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- `auto` mode has a classifier review each action, Sonnet 5 by default. It blocks exfiltration,
  `curl | bash`, deploys, force pushes, and `git reset --hard`. After 3 blocks in a row or 20 in
  total it falls back to asking, which print mode denies. The docs call it "a per-action control,
  not an isolation boundary" ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- Bypass is for "isolated environments like containers, VMs, or dev containers without internet
  access" ([permission modes](https://code.claude.com/docs/en/permission-modes)). It refuses to run
  as root, "except inside a recognized sandbox"
  ([sandbox environments](https://code.claude.com/docs/en/sandbox-environments)). The `IS_SANDBOX`
  variable said to lift the check appears only in a third-party post, from a search snippet.
- Since v2.1.302, print mode starts in Manual unless a mode is set. Uraeda sets `auto`, so it is
  unaffected ([permission modes](https://code.claude.com/docs/en/permission-modes)).

### Anthropic's reference devcontainer

- It is based on `node:20`, runs as the user `node`, and installs Claude Code with npm
  ([Dockerfile](https://raw.githubusercontent.com/anthropics/claude-code/main/.devcontainer/Dockerfile)).
- A named volume holds `~/.claude`, so a login survives rebuilds. The workspace is bind-mounted at
  `/workspace`
  ([devcontainer.json](https://raw.githubusercontent.com/anthropics/claude-code/main/.devcontainer/devcontainer.json)).
- An `iptables` firewall drops all traffic except DNS, SSH, GitHub's ranges, npm, the Anthropic API,
  and a few telemetry hosts. It resolves their addresses once at start, so a changed CDN address
  breaks it, and it needs `NET_ADMIN` and `NET_RAW`
  ([init-firewall.sh](https://raw.githubusercontent.com/anthropics/claude-code/main/.devcontainer/init-firewall.sh)).
- The guide warns that with skipped permissions a malicious project can exfiltrate anything in the
  container, "including the Claude Code credentials stored in ~/.claude"
  ([devcontainer](https://code.claude.com/docs/en/devcontainer)). Claude Code's required hosts are
  listed in [network config](https://code.claude.com/docs/en/network-config).

### Docker Sandboxes

- One microVM per sandbox, with its own kernel and its own Docker daemon, managed by the standalone
  `sbx` CLI, without Docker Desktop
  ([architecture](https://docs.docker.com/ai/sandboxes/architecture/)).
- Supported on macOS 14+ on Apple silicon, Windows 11, and Ubuntu 24.04+ with KVM. Other Linux
  distributions are unsupported, with manual artifacts
  ([install](https://docs.docker.com/ai/sandboxes/install/)).
- There are three workspace modes ([sandboxes](https://docs.docker.com/ai/sandboxes/)):
  - Direct mode passes the host folder through at the same path.
  - Clone mode mounts the host repository read-only, and the agent works in a private clone. The
    host fetches from it as a `sandbox-<name>` remote.
  - A mountless mode.
- Outbound TCP goes through a host proxy with a deny-by-default policy. The VM sees a placeholder
  API key, which the proxy swaps for the real one
  ([credentials](https://docs.docker.com/ai/sandboxes/configuration/credentials/)).
- `sbx run claude` runs `claude --dangerously-skip-permissions` from Docker's own image, not the
  host's `claude` ([Claude Code](https://docs.docker.com/ai/sandboxes/agents/claude-code/)).
- In direct mode it does not protect `.git/hooks`, CI files, or `package.json` scripts
  ([security](https://docs.docker.com/ai/sandboxes/security)).

### container-use

- "Each agent gets a fresh container in its own git branch", run through Dagger, and driven as an
  MCP server ([container-use](https://github.com/dagger/container-use)).
- Work comes out through git: `merge` keeps the agent's commits, `apply` stages its changes, and
  `checkout` brings the branch in. `terminal` opens a shell in the live container, and `delete`
  discards it ([environment workflow](https://container-use.com/environment-workflow)).
- `.container-use/environment.json`, committed, names a base image, setup commands, and install
  commands ([configuration](https://container-use.com/environment-configuration)).
- Secrets are references (`op://`, `env://`, `file://`), resolved into the container when a command
  runs ([secrets](https://container-use.com/secrets)).

### Sculptor

- Its marketing says "Every agent runs in its own container", with a pairing mode that syncs the
  agent's work into the local repository ([Sculptor](https://imbue.com/sculptor/)).
- Its current docs make a git worktree the default. The Docker backend is experimental, and remote
  hosts are "planned" ([workspaces](https://github.com/imbue-ai/sculptor), `docs/help/workspaces.md`
  and `docs/help/experimental/container_backend.md`).
- macOS keychain logins do not reach the container. The fix is `claude setup-token` on the host,
  forwarded as `CLAUDE_CODE_OAUTH_TOKEN` (same docs).

### Worktree-only orchestrators

- claude-squad ([README](https://github.com/smtg-ai/claude-squad)), Crystal
  ([README](https://github.com/stravu/crystal)), and Vibe Kanban
  ([README](https://github.com/BloopAI/vibe-kanban)) use plain worktrees.
- Conductor says its workspaces are "isolated for development, not for security", and its agents run
  as the Mac user ([workspaces](https://www.conductor.build/docs/concepts/workspaces-and-branches)).
- Vibe Kanban gives each workspace a dev server and a preview browser
  ([README](https://github.com/BloopAI/vibe-kanban)).

### Dev Containers and DevPod

- `devcontainer.json` holds an image or a Dockerfile, features, mounts, `forwardPorts`, and
  `hostRequirements` ([reference](https://containers.dev/implementors/json_reference/)). Its
  lifecycle hooks run in order: `initializeCommand` on the host, then `onCreateCommand`,
  `postCreateCommand`, and `postStartCommand` in the container.
- The `devcontainer` CLI has `up`, `build`, `exec`, `stop`, and `down`. It leaves port forwarding to
  the tool that attaches ([CLI](https://github.com/devcontainers/cli)).
- The Nix feature can load a `flakeUri`. It "works best with a remote URI": a local flake needs a
  manual install ([Nix feature](https://github.com/devcontainers/features/tree/main/src/nix)).
- DevPod is devcontainer-based and has no server. Its providers are machine providers (cloud VMs) or
  direct ones (Docker, SSH, Kubernetes)
  ([providers](https://devpod.sh/docs/managing-providers/what-are-providers)).
  - It injects an agent that serves SSH over the provider's tunnel, and ports forward over it
    ([how it works](https://devpod.sh/docs/how-it-works/overview)).
  - It forwards git credentials through a helper, and SSH keys through agent forwarding
    ([credentials](https://devpod.sh/docs/developing-in-workspaces/credentials)).
  - Idle workspaces stop after 5 to 10 minutes
    ([inactivity](https://devpod.sh/docs/developing-in-workspaces/inactivity-timeout)).

### Cloud agents

- **Claude Code on the web** ([web](https://code.claude.com/docs/en/claude-code-on-the-web),
  [environments](https://code.claude.com/docs/en/cloud-environments)):
  - one VM per session, about 4 vCPUs and 16 GB;
  - a setup script whose result is snapshotted for about 7 days, when it runs in under 5 minutes;
  - network set to None, Trusted, Full, or a custom allowlist;
  - a GitHub proxy that swaps a scoped credential for the user's token, so the token never enters
    the VM. It refuses branch deletions;
  - work comes out by push, pull request, or `--teleport`.
- **Codex cloud** ([environment](https://learn.chatgpt.com/docs/environments/cloud-environment)):
  - a setup script, with a cache of up to 12 hours;
  - secrets available to setup only;
  - agent internet off by default.
- **Cursor's cloud agents** ([cloud agent](https://cursor.com/docs/cloud-agent)) run in VMs. They
  use a snapshot or a Dockerfile, push a branch, and can restrict egress.
- **Coder** keeps the model's credentials in its control plane, never in the workspace
  ([Coder Agents](https://coder.com/docs/ai-coder/tasks)). It forwards ports to URLs per port and
  workspace
  ([port forwarding](https://coder.com/docs/user-guides/workspace-access/port-forwarding)).
- **GitHub Codespaces** forwards a port when the app prints a local URL, private by default. Its
  prebuilds snapshot the setup, and a codespace stops after 30 idle minutes
  ([ports](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace),
  [prebuilds](https://docs.github.com/en/codespaces/prebuilding-your-codespaces/about-github-codespaces-prebuilds)).

### Comparable CLIs

- **Codex CLI** sandboxes its commands with bubblewrap and seccomp on Linux, and Seatbelt on macOS
  ([sandboxing](https://learn.chatgpt.com/docs/sandboxing)):
  - `workspace-write` is the default mode, with the network off;
  - `.git`, `.codex`, and `.agents` stay read-only inside writable folders;
  - inside a container that blocks bubblewrap, it advises isolating the container and running with
    `danger-full-access`
    ([approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)).
- **Gemini CLI** runs in Docker, Podman, gVisor, LXC, or Seatbelt. It mounts the project at the same
  path, runs as the host's user, and takes a custom image from `.gemini/sandbox.Dockerfile`
  ([sandbox](https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/sandbox.md)).

### What they have in common

1. **One disposable unit per task**, a container or VM and a branch. Deleting the task deletes the
   unit. Branch cleanup is a separate policy.
2. **Git is how code comes out**: a merge, a fetch from a private clone, or a push. A live two-way
   sync is rare and opt-in.
3. **The environment from a file in the repository**: a Dockerfile, `devcontainer.json`, a setup
   script, or a Nix, devenv, or Flox file. It is split into a cached setup and a per-start hook.
4. **A cache of the set-up environment**, invalidated when its file changes.
5. **Credentials kept out where possible**: a proxy injecting them, references resolved per command,
   or a login in a volume of the sandbox's own.
6. **Previews through forwarded ports**, private by default.
7. **An egress policy**: off, an allowlist, or open, through a proxy.
8. **Resource limits** per unit.
9. **Idle stop, then delete**, the state kept while stopped.
10. **Remote hosts through a provider**: DevPod's providers, Coder's templates, Claude Code's
    self-hosted runners.
11. **A shell into the live sandbox**, for the human to look around.

## Standards and libraries

### Container runtimes and isolation

- **Rootful Docker** runs its daemon as root. "Only trusted users should be allowed to control your
  Docker daemon", and bind mounts are unrestricted
  ([security](https://docs.docker.com/engine/security/)). The owner's Docker 29.9.2 is rootful, with
  seccomp and cgroup namespaces, and their user is in the `docker` group, which is root-equivalent
  (`docker info`, checked in this session).
- **Rootless Docker** runs the daemon and the containers in a user namespace
  ([rootless](https://docs.docker.com/engine/security/rootless/)). **Podman** is daemonless, and its
  `:U` option chowns mounts
  ([podman run](https://docs.podman.io/en/latest/markdown/podman-run.1.html)).
- **Unprivileged Incus/LXC** containers run in a user namespace, and privileged ones "aren't root
  safe" ([security](https://linuxcontainers.org/incus/docs/main/explanation/security/)).
- **systemd-nspawn** "can easily be circumvented" without user namespaces
  ([systemd-nspawn](https://www.freedesktop.org/software/systemd/man/latest/systemd-nspawn.html)).
- **bubblewrap** starts from an empty root, where only what is mounted is visible. It is "not a
  complete, ready-made sandbox": the policy lives in its arguments. A mounted socket, D-Bus or
  Docker's, defeats it ([bubblewrap](https://github.com/containers/bubblewrap)).
- **gVisor** reimplements system calls in user space, which slows file-heavy work like cargo and
  pnpm ([gVisor](https://gvisor.dev/docs/)).
- **Kata and Firecracker** give a VM per container ([Kata](https://katacontainers.io/learn/),
  [Firecracker](https://github.com/firecracker-microvm/firecracker)). Firecracker has no virtiofs,
  which makes bind-mounting a worktree awkward. microvm.nix can share the host's `/nix/store`
  read-only with a VM ([microvm.nix](https://github.com/microvm-nix/microvm.nix)).
- **Apple's `container`** runs each Linux container in its own lightweight VM, on macOS 26 and Apple
  silicon ([container](https://github.com/apple/container),
  [containerization](https://github.com/apple/containerization)).
- **Docker Desktop on macOS** shares files through VirtioFS, or through synchronized file shares, an
  ext4 cache in its VM
  ([settings](https://docs.docker.com/desktop/settings-and-maintenance/settings/),
  [synchronized shares](https://docs.docker.com/desktop/features/synchronized-file-sharing/)). Bind
  mounts there are slow enough that VS Code advises a volume for `node_modules`
  ([performance](https://code.visualstudio.com/remote/advancedcontainers/improve-performance)).
- **Escape classes**: a mounted Docker socket is root on the host, as are `--privileged` and added
  capabilities. Shared-kernel CVEs hit everything short of gVisor or a VM. Other mounted sockets
  count too, like ssh-agent, D-Bus, or the Nix daemon. So do writable files the host later runs: see
  [git and the shared `.git` folder](#git-and-the-shared-git-folder).

Measured on the owner's machine, warm, in this session:

| Command                                                | Time            |
| ------------------------------------------------------ | --------------- |
| `docker run --rm alpine true`                          | 690 to 1,300 ms |
| same, with `--network none --cap-drop ALL --read-only` | about 580 ms    |
| `docker exec` into a running container                 | about 40 ms     |
| `bwrap --unshare-all ... true`                         | 3 to 6 ms       |
| `nix print-dev-env` of this repository, warm           | 0.25 to 0.9 s   |
| plain Debian container, host store, dev shell sourced  | about 2.8 s     |

### Nix and containers

- **Images from a flake.** `dockerTools.buildLayeredImage` and `streamLayeredImage` give about one
  layer per store path, up to 100 layers, reproducibly
  ([dockerTools](https://raw.githubusercontent.com/NixOS/nixpkgs/master/doc/build-helpers/images/dockertools.section.md)).
  nix2container skips layers already built or pushed: about 1.8 s to rebuild and push, against 7.5 s
  for `streamLayeredImage` ([nix2container](https://github.com/nlewo/nix2container)). Loading such
  an image into Docker copies the closure out of the store.
- **The host store, read-only.** Checked in this session:
  1. `nix print-dev-env` evaluates this repository's dev shell on the host.
  2. A plain `debian:stable-slim` container mounts `/nix/store` read-only and sources that script.
  3. Node 24.21, cargo 1.96, and pnpm 12.9 then run inside, without Nix in the container.
- **The dev shell's size.** Its runtime closure is 405 paths and 4.71 GB unpacked. Playwright's
  browsers take 2.2 GiB and the Rust toolchain 2.0 GiB.
- **A cold store.** It downloads about 1 GB from cache.nixos.org, plus the rust-overlay toolchain
  from Rust's servers. That is an estimate of 1 to 5 minutes, not measured.
- **Nix daemon access is unsafe.** Mounting the daemon's socket lets the container ask for any
  build. A trusted user is "essentially equivalent to giving that user root access"
  ([nix.conf](https://nix.dev/manual/nix/2.28/command-ref/conf-file.html)).
- **devenv and Flox** build containers from their environments
  ([devenv containers](https://devenv.sh/containers/),
  [Flox](https://flox.dev/docs/tutorials/sharing-environments/)). devenv needs a remote Linux
  builder on macOS.
- **Store paths are platform binaries.** A macOS host's store holds Darwin binaries, which a Linux
  container cannot run. My own inference, from how store paths are built.

### Git and the shared `.git` folder

- A linked worktree's `.git` file holds an absolute path to `<main>/.git/worktrees/<name>`. Its
  objects and refs live in the main `.git` ([git-worktree](https://git-scm.com/docs/git-worktree)).
  This feature's own worktree shows it. Git 2.48 added `--relative-paths` and
  `worktree.useRelativePaths`
  ([release notes](https://raw.githubusercontent.com/git/git/master/Documentation/RelNotes/2.48.0.adoc)).
  These turn on `extensions.relativeWorktrees`, which older git refuses.
- Git runs code named in a repository's own files: `$GIT_DIR/hooks`, `core.hooksPath`,
  `core.fsmonitor`, `core.sshCommand`, filters, and diff drivers
  ([core config](https://raw.githubusercontent.com/git/git/master/Documentation/config/core.adoc)).
  Only `safe.directory` and `safe.bareRepository` are restricted to protected configuration
  ([safe](https://raw.githubusercontent.com/git/git/master/Documentation/config/safe.adoc)).
- Pillar Security escaped Cursor's sandbox by planting `core.fsmonitor` in a git folder with another
  name. Cursor's host-side `git status` then ran it. "The sandbox tried to protect a path spelling.
  Git was operating on a repository abstraction"
  ([Pillar](https://www.pillar.security/blog/git-directories-do-not-have-to-be-called-git)).
- An experiment with bubblewrap, a repository, and a worktree, in this session:
  - **The shared `.git` read-only**: committing fails, since objects cannot be written.
  - **`.git` writable, with `config` and `hooks` mounted read-only**: commits work, and a planted
    `core.fsmonitor` or hook fails.
  - **What stays writable**: `worktrees/<name>/config.worktree`, inert while
    `extensions.worktreeConfig` is off, `info/attributes`, and every ref. So the agent can move
    `main`.
  - **Further vectors, inferred and not checked**: the submodules' `modules/*/config`, and
    `objects/info/alternates`.
- Docker Sandboxes' clone mode and container-use avoid this: the agent's git folder is its own, and
  the host only fetches from it. A fetch runs none of the source repository's hooks or config: my
  reading of git's model, not checked.

### Credentials

- On Linux, Claude Code keeps its login in `~/.claude/.credentials.json`, under `CLAUDE_CONFIG_DIR`
  when set. On macOS it uses the Keychain
  ([authentication](https://code.claude.com/docs/en/authentication)).
- `claude setup-token` prints a one-year token for `CLAUDE_CODE_OAUTH_TOKEN`, limited to model
  requests. A subscription login also works in a container, with a paste-code fallback
  ([authentication](https://code.claude.com/docs/en/authentication),
  [env vars](https://code.claude.com/docs/en/env-vars)).
- The terms allow "an end user signing in to the unmodified Claude Code binary with their own Claude
  subscription", including "hosted sandboxes". A product must not "collect, store, or intermediate
  Claude.ai credentials or session tokens"
  ([legal](https://code.claude.com/docs/en/legal-and-compliance)).
- GitHub deploy keys are scoped to one repository, but are "usually not protected by a passphrase".
  GitHub recommends app tokens, which expire after an hour
  ([deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)).
- Agent forwarding lets anyone root on the remote use the loaded keys while connected
  ([ssh(1)](https://man.openbsd.org/ssh),
  [GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/using-ssh-agent-forwarding)).
- On the owner's machine, `gh` keeps its token in `~/.config/gh/hosts.yml` and pushes over HTTPS.
  Commits are not signed (`git config`, checked in this session).

### Remote hosts

- A Docker context over SSH (`docker context create --docker host=ssh://user@host`) needs no open
  daemon port, and Docker advises SSH connection reuse
  ([protect access](https://docs.docker.com/engine/security/protect-access/)). Bind mounts are made
  on the daemon's host: "you can't create a bind mount to access files on the client machine"
  ([bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)).
- Mutagen recommends not syncing `.git`: hooks are an attack vector, and git's index is not built
  for concurrent changes
  ([VCS](https://mutagen.io/documentation/synchronization/version-control-systems)). On Linux it
  polls every 10 seconds ([watching](https://mutagen.io/documentation/synchronization/watching)).
- VS Code Remote-SSH and JetBrains Gateway keep the code only on the remote, with a server there
  ([Remote-SSH](https://code.visualstudio.com/docs/remote/ssh),
  [Gateway](https://www.jetbrains.com/help/idea/remote-development-overview.html)).
- A killed `docker exec` client leaves its process running, an open issue since 2014
  ([moby#9098](https://github.com/moby/moby/issues/9098)). Running the agent as the container's main
  process, with `docker run -i --init`, forwards signals
  ([docker run](https://docs.docker.com/reference/cli/docker/container/run/)).
- Without a terminal, sshd sends no SIGHUP on a dropped connection, so the remote process lives on.
  This comes from forum sources only
  ([gist](https://gist.github.com/x-yuri/b46ff418555db7263eaec415c4a036c9)).
- inotify does not see remote changes through sshfs, from forum sources only
  ([minikube#1551](https://github.com/kubernetes/minikube/issues/1551)).
- No flag points a local `claude` at a remote machine
  ([web](https://code.claude.com/docs/en/claude-code-on-the-web)).
  - Remote Control steers a local session from another device
    ([remote control](https://code.claude.com/docs/en/remote-control)).
  - Self-hosted runners poll Anthropic from the user's own host, on Team and Enterprise plans only
    ([self-hosted](https://code.claude.com/docs/en/self-hosted-environments)).

### Previews and caches

- Storybook binds to loopback by default, and `0.0.0.0` "is insecure"
  ([CLI options](https://storybook.js.org/docs/api/cli-options)). A container port published on
  `127.0.0.1` reaches the host's proxy.
- Vite needs `server.allowedHosts` for a tunnel's host name, and a proxy that carries WebSockets
  ([server options](https://vite.dev/config/server-options)).
- pnpm hardlinks from its store on Linux by default. "The file in node_modules is the file in the
  store", so a sandbox writing `node_modules` could change a shared store
  ([pnpm settings](https://pnpm.io/settings/node-modules)).
- Cargo documents a shared `CARGO_TARGET_DIR` and sccache, without trust boundaries
  ([build cache](https://doc.rust-lang.org/cargo/reference/build-cache.html)). A shared writable
  target folder lets one sandbox plant build outputs another runs: my inference.
- Docker limits a container with `--cpus`, `--memory`, and `--pids-limit`, and kills containers
  before the daemon when memory runs out
  ([resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)).

## The code

### Important reads

- [`runner/claude.ts`](/packages/server/src/runner/claude.ts) spawns `claude` from the `PATH`, in
  `options.cwd`, with `--permission-mode auto`, the plugin folder, and the chat images' folder. Its
  `command` and `configDir` options already let a wrapper stand in for `claude`, as the benchmarks
  do. `hasSession` looks for transcripts in the host's `~/.claude/projects`, which a sandbox with
  its own configuration folder moves. `open` is over the function-length limit already, with a
  waiver.
- [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts): `OpenOptions` carries `cwd`,
  `nativeId`, `resume`, and `allowed`. Nothing describes where the process runs.
- [`runner/allow.ts`](/packages/server/src/runner/allow.ts): "Allow and retry" reopens the process
  with rules. With skipped permissions, nothing is ever blocked, so this path goes quiet in a
  sandbox.
- [`preview/run.ts`](/packages/server/src/preview/run.ts) and
  [`preview/runner.ts`](/packages/server/src/preview/runner.ts) start the preview decision's command
  with `sh -c` in the checkout, on the host. Storybook loads `.storybook/` and `vite.config.ts` from
  the branch, which the agent writes.
- [`crates/core/src/git/worktrees.rs`](/crates/core/src/git/worktrees.rs) adds worktrees under
  `.worktrees/`. [`watch.rs`](/crates/core/src/watch.rs),
  [`workspace.rs`](/crates/core/src/workspace.rs), and
  [`api/branch_panes.rs`](/crates/core/src/api/branch_panes.rs) list and read every worktree in
  process. A checkout that is not a linked worktree is invisible to them.
- [`actions/clean.rs`](/crates/core/src/actions/clean.rs) removes a merged feature's worktree and
  branch, only when the human asks, as the [git](/specs/decisions/git.md) decision requires.
- [`git/refresh.rs`](/crates/core/src/git/refresh.rs) runs the system `git` in a new worktree to
  refresh its index. Every system `git` in a checkout the agent wrote reads that checkout's config.
- [`flake.nix`](/flake.nix): a dev shell with Node 24, pnpm, the pinned Rust toolchain, cargo tools,
  and Playwright's browsers. Its `shellHook` runs
  [`worktree-seed.ts`](/packages/server/scripts/worktree-seed.ts), which clones the main checkout's
  `target/` into a new worktree. Inside a sandbox, the main checkout is not mounted, so the seed has
  to happen on the host first.
- `.vite-hooks/pre-commit` is tracked and set as `core.hooksPath`. It runs `vp staged`, which reads
  the branch's `vite.config.ts`. When the server commits a human's edits on a branch, the hook runs
  code the agent may have written.
- [`benchmarks/src/docker-wrapper.ts`](/packages/benchmarks/src/docker-wrapper.ts) and
  [`sandbox.ts`](/packages/benchmarks/src/sandbox.ts) run Claude Code in a case's image:
  - The host's `claude` binary is mounted read-only.
  - The `--plugin-dir` and `--add-dir` paths are mounted at their own paths.
  - A configuration folder is mounted, and the token is passed by name.
  - The repository is a plain checkout, not a worktree: "a worktree's absolute paths would not hold
    in the container's mount".
- Checked in this session: the host's `claude` 2.1.319 is a glibc binary. It runs in
  `debian:stable-slim` and fails in Alpine.

### The proposal's path and existing actions

- **Starting a feature** adds a worktree today. With a sandbox, it also makes a container and a
  checkout the container can use, whose shape depends on the git layout.
- **A session's run** spawns `claude` on the host. It would instead go through the sandbox. A
  usage-limit or restart continue, from the [run lifecycle](/specs/decisions/run-lifecycle.md),
  resumes from the transcript, so the transcript must survive the container: a mounted configuration
  folder, at the same paths.
- **Allow and retry** has nothing to allow when permissions are skipped. It still applies to
  sessions run outside a sandbox.
- **Previews** start Storybook on the host. In a sandbox they would start inside it, published on a
  loopback port that the existing proxy forwards to.
- **The Git page's commit** of a human's edits runs the branch's hooks on the host. It would have to
  run in the sandbox, or skip hooks, which the git decision forbids.
- **Chats on the main checkout** run there today, where agents also commit on the default branch, as
  an inbox triage does. Sandboxing them mounts the main checkout and its `.git`.
- **Finishing and cleaning** remove the worktree and branch when the human asks. The container would
  go with them. The checkout's folder stays on the host unless the checkout lives on a remote host.
- **Dropping a feature** archives its sessions. Its container would be removed with the drop.
- **Benchmarks** keep their own Docker wrapper. The two could share the sandbox's code later.

### Rules and their owners

- **How the agent is started**: [`claudeArgs`](/packages/server/src/runner/claude.ts), checked by
  the runner's tests. The benchmarks copy the binary-mount and path-mount rules in
  [`docker-wrapper.ts`](/packages/benchmarks/src/docker-wrapper.ts).
- **Where a session runs**: the session's folder, resolved in
  [`session-folders.ts`](/packages/server/src/runner/session-folders.ts) and the core's worktree
  listing.
- **Which checkouts exist**: the core's [`worktrees.rs`](/crates/core/src/git/worktrees.rs), read by
  the watcher, the workspace, the branch panes, and `clean`.

### Likely changes

- [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts) and
  [`runner/claude.ts`](/packages/server/src/runner/claude.ts): a process opened through a sandbox,
  with the permission mode from the answer on permissions. Under every option.
- A new `packages/server/src/sandbox/`: making, starting, stopping, and removing a checkout's
  container, and running a command in it. Under every option.
- [`preview/run.ts`](/packages/server/src/preview/run.ts): Storybook started in the sandbox, its
  port published on loopback. Under every option.
- [`crates/core/src/git/`](/crates/core/src/git/): writes on a sandboxed checkout run in its
  sandbox. With a private clone per sandbox, the checkout listing, the watcher, `start`, `clean`,
  and `drop` learn clones, and the host fetches each branch.
- [`crates/core/src/settings/`](/crates/core/src/settings/) and the settings page: the sandbox
  settings per repository.
- [`flake.nix`](/flake.nix), when a base image is built with Nix, and a Dockerfile or image
  definition shipped with the package, when it is not.
- `ura`: a command the human runs in a terminal to log in, inside the sandbox, to Claude Code and to
  git.
- Tests that guard behaviour this changes:
  - the runner's tests of `claudeArgs` and its `--permission-mode auto`, in
    [`runner/__tests__/`](/packages/server/src/runner/__tests__/);
  - the preview runner's tests, in [`preview/__tests__/`](/packages/server/src/preview/__tests__/);
  - the core's worktree tests, in [`crates/cli/tests/clean.rs`](/crates/cli/tests/clean.rs) and
    [`crates/cli/tests/status.rs`](/crates/cli/tests/status.rs).

### Overlaps with features in flight

- **[Extensions system](/specs/2026-11-08-extensions-system/proposal.md)**, on its branch, round 02
  answered. It moves the Claude Code runtime behind an extension API, and lets extensions add
  runtimes. A sandbox wraps how any runtime's process is started, and Storybook too. If it lives in
  the Claude runtime, every other runtime loses it.

## The proposal

### "All agent calls sandboxed, with no access to my local filesystem"

A sandbox around the agent's process alone does not achieve this. The host runs the branch's code in
three places today:

- Storybook previews;
- the commit hooks, when the server commits a human's edits;
- the dev shell's `shellHook`, when the human enters it.

The shared `.git` folder is a fourth door. The proposal's goal holds only if previews, Uraeda's own
git writes, and the git layout move with the agent. One door stays open by nature: the human running
the branch's code on their machine, as `vp run sandbox` or tests do.

### A flake for the project, and an Uraeda flake for agentic dependencies

The project's flake describes its tools, and this repository has one. The agent does not need to
come from a flake. The [agents](/specs/decisions/agents.md) decision requires the user's installed
`claude`, never a bundled one, and the host's binary runs in a glibc container. An Uraeda flake
bundling Claude Code would conflict with that rule. Projects without a flake are a gap: the proposal
does not say whether they can be sandboxed.

### Logging in to the agent and git inside the environment

A login inside the sandbox is readable by the agent: Anthropic's own guide says so of `~/.claude`.
Mounting the user's own `~/.claude` would also let the agent write its `settings.json` hooks, which
the human's next `claude` on the host runs. The web UI has no terminal for an interactive login.

### Every worktree has its own container

A container per worktree needs the worktree's shared `.git`, which leads to
[the escape above](#git-and-the-shared-git-folder). It also needs the main checkout's path inside
the container, for the absolute `gitdir`.

### A remote host to share the load

A remote host is the only part that adds capacity. A local container caps a run's resources, but the
machine's total stays the same. With a remote Docker, the checkout must live on the remote, so:

- the core's in-process reads and file watching of that checkout stop working;
- a remote helper must stream changes back, or the server only sees what is fetched;
- the process lifetime over SSH needs a supervisor;
- previews need a tunnel.

Its design depends on how the local sandbox is built: the same image, the same git layout, and the
same process API.

### Finishing prunes the container, no local worktree to delete

Only true with a remote host. Locally, the checkout's folder stays on the host, bind-mounted, and
`clean` still removes it.

### Storybook mockups without a full local environment

Possible. Storybook runs in the sandbox, from the sandbox's environment, and the host only proxies
its port. Nothing of the branch runs on the host.

### "If it doesn't achieve security and performance, we might drop it"

- **Security**: a container with skipped permissions confines a mistake or an injected prompt to the
  checkout, the sandbox's own login, and the network. Today's `auto` mode is a classifier, "not an
  isolation boundary".
- **Performance**: locally, nothing is gained but caps. A container adds 0.6 to 1.3 s per start, and
  40 ms per command into a running one. Performance comes only from the remote host.

## Worth it and feasibility

**Cost against gain.**

- **Gain**: a real boundary around unattended runs, where today an injected prompt in a web page
  could read `~/.ssh`. Removing the classifier's blocks also ends runs stopped by its fallback after
  3 blocks in a row.
- **Cost**:
  - a sandbox module in the server;
  - previews and Uraeda's git writes moved into the sandbox;
  - a login flow through `ura`;
  - settings;
  - with a private clone per sandbox, the core's worktree model widened to clones.

  The remote host is a feature of its own size again.

My judgement: the local sandbox is worth building for security, and the remote host is not justified
as part of it.

**Outside behaviour it relies on.**

- Checked:
  - the host's `claude` runs in a glibc container;
  - the flake's tools run from the host's read-only store, without Nix inside;
  - container start costs;
  - the shared `.git` experiment.
- Unverified:
  - **Resume.** `claude --resume` across container restarts must work, with the configuration folder
    and the checkout mounted at the same paths.
  - **Non-root bypass.** `bypassPermissions` must run as a non-root user in stream-json print mode.
  - **gix.** The core's in-process reads must never run a repository's `core.fsmonitor`, hooks, or
    filters. gix's documentation was not read on this point.
  - **Storybook.** It must answer the existing proxy through a loopback-published port, with its
    WebSockets.
  - **Fetch.** A host fetch from an agent's clone must run none of that clone's config.

  The plan's first task checks each one.

**Guards relaxed.**

- **Skipping permissions inside the sandbox.** An agent misled by a web page could do anything the
  sandbox allows without being stopped. It could delete the branch's uncommitted work, push with the
  sandbox's git login, or send the branch's code anywhere the network allows.
- **An open network from the sandbox.** A web page the agent reads could make it send the branch's
  code and the sandbox's Claude and git logins to any website.
- **A git login inside the sandbox.** Whoever controls the agent could push to every branch the
  login can push to, `main` included, unless the branch is protected on GitHub.
- **A shared `.git` with protective mounts.** The agent could still move any branch, `main`
  included, to a commit of its own, which the human might then run.
- **The host evaluating the branch's flake.** An agent's flake could make the host's Nix daemon
  build or download anything, inside Nix's own build sandbox.

## Approaches

Criteria:

- from the proposal: no access to the host's files, YOLO mode, previews working, finishing prunes
  everything, and security and performance as the bar;
- from the constitution: tools optional (V), state in git (II);
- from the [agents](/specs/decisions/agents.md) decision: the user's installed agent, least
  permission, credentials untouched;
- from the [git](/specs/decisions/git.md) decision: hooks never bypassed, nothing removed unasked;
- from the [distribution](/specs/decisions/distribution.md) decision: nothing downloaded at run
  time;
- from the [settings](/specs/decisions/settings.md) decision: settings never read from a repository.

### Scope

Whether the remote host is built now or after the local sandbox. See
[a remote host](#a-remote-host-to-share-the-load).

| Option                                  | Security | Capacity | Size        | Risk                      |
| --------------------------------------- | -------- | -------- | ----------- | ------------------------- |
| A. Local sandbox now, remote host later | yes      | caps     | one feature | remote designed on a base |
| B. Both now                             | yes      | yes      | about twice | two unknowns at once      |
| C. Drop                                 | no       | no       | none        | agents stay unconfined    |

### Isolation

What confines the agent. See [container runtimes](#container-runtimes-and-isolation).

| Option                                        | Strength               | Start        | macOS         | Remote later    | Limits | Agent's binary  |
| --------------------------------------------- | ---------------------- | ------------ | ------------- | --------------- | ------ | --------------- |
| A. A Docker-compatible container per checkout | namespaces, seccomp    | 0.6 to 1.3 s | Desktop VM    | Docker context  | yes    | host's, mounted |
| B. sandbox-runtime around each process        | bubblewrap or Seatbelt | under 10 ms  | yes, natively | no              | no     | host's          |
| C. Docker Sandboxes, a microVM per checkout   | own kernel             | not measured | yes           | cloud sandboxes | yes    | Docker's image  |

### Git layout

How the sandbox's checkout reaches the repository. See
[the shared `.git`](#git-and-the-shared-git-folder).

| Option                                                         | Host code execution | Branches the agent can move | Core changes                             |
| -------------------------------------------------------------- | ------------------- | --------------------------- | ---------------------------------------- |
| A. A private clone per sandbox, its branch fetched by the host | none found          | its own clone's only        | clones listed, watched, fetched, cleaned |
| B. The shared worktree, `config` and `hooks` mounted read-only | denylist, fragile   | every branch                | mounts only                              |
| C. The shared worktree, mounted as is                          | hooks and config    | every branch                | none                                     |

### Permissions inside the sandbox

| Option                                     | Agents decision | Blocked runs         | Defence in depth |
| ------------------------------------------ | --------------- | -------------------- | ---------------- |
| A. Skip permissions inside, `auto` outside | changes         | none                 | the sandbox only |
| B. `auto` everywhere                       | as is           | classifier fallbacks | two layers       |

### Network

| Option                                           | Discovery's web reading | Exfiltration         | Setup           |
| ------------------------------------------------ | ----------------------- | -------------------- | --------------- |
| A. Internet open, local network and host blocked | works                   | to any website       | firewall rules  |
| B. An allowlist through a proxy                  | broken outside the list | to listed hosts only | a proxy, upkeep |
| C. Open, local network included                  | works                   | anywhere, LAN too    | none            |

### Credentials

| Option                                                         | Agent reads    | Hooks run on host | Agents decision | Pushes and pull requests |
| -------------------------------------------------------------- | -------------- | ----------------- | --------------- | ------------------------ |
| A. The sandbox's own logins, made by the human through `ura`   | sandbox's only | no                | as is           | in the sandbox           |
| B. The user's `~/.claude` and `gh` folders mounted             | the user's own | yes               | as is           | in the sandbox           |
| C. Claude's login only, pushes and pull requests from the host | Claude's only  | no                | as is           | the steps rewritten      |

### Environment

What the sandbox has installed. See [Nix and containers](#nix-and-containers).

| Option                                                    | Start                 | Disk                 | Projects without a flake | macOS           |
| --------------------------------------------------------- | --------------------- | -------------------- | ------------------------ | --------------- |
| A. The flake's dev shell from the host's store, read-only | about 3 s             | none extra           | base tools only          | needs a builder |
| B. An image built from the flake per lock                 | image build, then 1 s | the closure, copied  | base tools only          | needs a builder |
| C. The repository's `devcontainer.json` or Dockerfile     | image build           | an image per project | yes                      | Docker Desktop  |

### Platforms

| Option                                    | Owner's use | macOS users                     | Work                         |
| ----------------------------------------- | ----------- | ------------------------------- | ---------------------------- |
| A. Linux only, macOS unsandboxed as today | covered     | no change                       | one platform                 |
| B. Linux and macOS                        | covered     | Docker Desktop, a Linux builder | two, with file-sharing costs |

### Needs no choice

- **One disposable unit per task**: follows from a container per checkout, removed with the
  feature's cleanup or drop.
- **Git is how code comes out**: Uraeda's workflow is commits already.
- **The environment from a file in the repository**: the flake, or what the answer on the
  environment picks.
- **A cache of the set-up environment**: the host's store, or the image, caches it.
- **Previews through forwarded ports**: Storybook in the sandbox, behind the existing proxy.
- **Resource limits**: Docker's `--memory`, `--cpus`, and `--pids-limit`, as settings.
- **Idle stop, then delete**: a container stops when no session or preview uses it, and is deleted
  with its feature.
- **Remote hosts through a provider**: left to the scope answer.
- **A shell into the live sandbox**: the web UI has no terminal. The human runs the command Uraeda
  shows.

## Not checked

- An official statement on `IS_SANDBOX` or `CLAUDE_CODE_BUBBLEWRAP`: a third-party snippet only.
- Docker's sandbox migration page (404) and its default network policy page.
- Whether gix runs `core.fsmonitor` or hooks on reads: its documentation was not read.
- The CVE-2026-55607 and "GitSpawn" advisories about Claude Code worktrees and `fsmonitor`: search
  snippets only.
- Firecracker's boot figures, Podman's `--userns=keep-id`, and Docker rootless's limitations page.
- A measured `nix develop` in a container with a cold store: estimated only.
- devenv's and nixos-containers' pages beyond the containers page.
- Where podman-remote resolves mount paths. Whether Tailscale Serve carries WebSockets.
- Terragon's documentation (an expired certificate), Jetify devbox (404), and docs.imbue.com (404).
- DevPod's maintenance status, from search snippets only.
