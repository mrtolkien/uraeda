---
status: answered
---

# Clarifications, round 01: Run the UI easily

> [!NOTE]
>
> Answered on 2026-10-14.
>
> - How Uraeda ships lasts beyond this feature, and comes with measured numbers: an `npx` package
>   built and run here is 3.5 MB but needs Node 24; single executables built with Node and with Bun
>   both ran, at 159 MB and 90 MB.
> - A single executable on Node means moving the repository to Node 26, and on Bun, changing the
>   stack decision: one follow-up each.
> - The npm package names are permanent once published, and each needs a first publish from your npm
>   account, whichever way releases are published afterwards.
> - Whether `ura` starts the UI changes the stack decision, which says the CLI needs no runtime.
> - A busy port today means another Uraeda may run: two servers would share one data folder and
>   break the one-session-per-feature rule, which rules out moving to the next free port.
> - Started in a project, the server would read that project's `.env`, letting a cloned repository
>   widen the host names it accepts. This is settled without you: check it.
> - Nine other points are settled without you, at the end.

## Context

The [proposal](proposal.md) asks for the simplest way to package Uraeda today, so anyone can run the
web UI with one command, testing a single binary, a desktop app, and `npx uraeda`.

Today the UI runs only from a checkout, with Rust, Node 24, and pnpm: `pnpm start` builds the Rust
binding and the UI, then runs the server from its TypeScript sources
([`package.json`](/package.json)). The server finds the skill it passes to `claude`, and checks the
binding's freshness, through paths relative to the checkout
([`runner/claude.ts`](/packages/server/src/runner/claude.ts),
[`binding.ts`](/packages/server/src/binding.ts)). Releases build only `ura`, with cargo-dist
([`release.yml`](/.github/workflows/release.yml)).

Three packages were built from this branch and run on this machine, Linux x64: each started in a
fresh repository, added it to the list, and served the UI. None ran on macOS or arm64, or started a
Claude session.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: How does Uraeda ship?

The npm package bundles the server into one 485 kB file, with the UI, the skill, and one 5.9 MB
binding per platform in separate packages, the pattern of Biome, Rolldown, and Codex: users need
Node. A single executable carries its own runtime: on Node, through the experimental
`vp pack --exe`, which needs Node 26; on Bun, as Claude Code, opencode, and Backlog.md ship. Either
executable can also be published through npm, so `npx uraeda` stays the command. Desktop apps still
run the server beside the window, and need $99 a year for macOS signing. More in
[discovery](discovery-01.md#how-the-server-ships) and [the spikes](discovery-01.md#the-spikes).

Why it matters: it decides whether users need Node, how big each release is, and which runtime the
server is tested on, for every later feature.

- **A (recommended). Publish an npm package, `uraeda`, run with `npx uraeda` on the user's Node 24,
  with the binding in one package per platform.**
  - [pro] 3.5 MB; stable tooling; the server runs on the Node it is tested on; no stack change.
  - [con] users need Node 24 or later, which Claude Code itself no longer requires.
  - Why recommended: it is the simplest package that works today. A single executable can come later
    behind the same `npx uraeda`, once Node 26 is LTS (2026-10-28) and its embedded files leave
    early development.
- **B. Build a single executable per platform with Node's single executable applications, through
  `vp pack --exe`, and publish it through npm and GitHub releases.**
  - [pro] nothing to install; the same runtime as today, one major version later.
  - [con] 159 MB (51 MB compressed); experimental in Node and tsdown; macOS x64 is not tested by
    Node; the UI and skill are written to a cache folder on first run.
- **C. Build a single executable per platform with `bun build --compile`, and publish it through npm
  and GitHub releases.**
  - [pro] nothing to install; 90 MB (40 MB compressed); proven by Claude Code, opencode, and
    Backlog.md.
  - [con] users run Bun while tests run on Node: a Bun difference only shows up for users.
- **D. Build an Electron desktop app that runs the server and opens its window.**
  - [pro] an app icon, and no browser tab.
  - [con] 80 to 150 MB, signing and an updater to maintain, and the phone, through
    `tailscale serve`, needs the server reachable anyway.

**Answer:** A

### Q1.B: Does the repository move to Node 26?

Only if you picked B in Q1. `vp pack --exe` requires Node 25.7, and Node 24 only runs a CommonJS
script, while the server needs ESM. The repository pins Node 24 in `devEngines`, and CI runs on it.

- **A (recommended). Move the whole repository to Node 26 once it is LTS, on 2026-10-28, so the
  executable runs the Node the tests run.**
  - [pro] one Node version everywhere.
  - [con] contributors and CI upgrade; this feature waits until 2026-10-28.
- **B. Keep Node 24 for development and tests, and build the executable with Node 26.**
  - [pro] nothing changes for contributors.
  - [con] users run a Node the tests never run.

**Answer:**

### Q1.C: How does the stack decision change for Bun?

Only if you picked C in Q1. The [stack](../decisions/stack.md) decision says the server "MUST be
written in TypeScript, run on Node".

- **A (recommended). The server runs on Node in development and tests, and is shipped compiled with
  Bun; a smoke test starts the compiled executable in CI.**
  - [pro] the toolchain stays as it is.
  - [con] two runtimes to keep compatible.
- **B. The server moves to Bun everywhere, tests included.**
  - [pro] one runtime.
  - [con] Vite+ and Vitest run on Node; a much larger change.

**Answer:**

## Q2: Does `ura` start the web UI?

`ura` installs from its own script, Homebrew, or Nix, and the [stack](../decisions/stack.md)
decision says it "MUST NOT need Node or any other runtime to run". Both tools read and write the
same `repositories.json`. More in [discovery](discovery-01.md#how-ura-relates-to-the-server).

Why it matters: it decides whether users learn one entry point or two, and whether the stack
decision changes.

- **A (recommended). Keep them separate: `ura` for the CLI, `npx uraeda` for the web UI, both
  released with the same version from the same tag.**
  - [pro] no decision changes; each tool installs the way its users expect.
  - [con] two commands to learn, and two versions that can drift on one machine.
  - Why recommended: the shared file is versioned, so drift is caught, and `ura ui` can be added
    later.
- **B. Add `ura ui`, which runs `npx --yes uraeda@<ura's version>`, and fails with a message when
  Node is missing.**
  - [pro] one entry point, always the same version as `ura`.
  - [con] softens the stack decision: the CLI needs Node for one command.
- **C. Make the npm package install `ura` too, so `npm i -g uraeda` gives both commands.**
  - [pro] one install for npm users.
  - [con] a third way to install `ura`, which `ura upgrade` must recognize.

**Answer:** A

## Q3: Which names does Uraeda take on npm?

On 2026-10-14, `uraeda`, `uraeda-binding`, and `@uraeda/cli` were free. The binding's loader,
generated by napi-rs, already looks for `uraeda-binding-linux-x64-gnu` and its siblings
([`index.js`](/packages/binding/index.js)). A published name is permanent, and each needs one
publish from your account before CI can publish it. With B or C in Q1, the platform packages hold
the executable instead, under the same names. More in
[discovery](discovery-01.md#the-package-names).

Why it matters: names cannot be taken back, and each one is a package to set up and publish at every
release.

- **A (recommended). `uraeda`, with four platform packages named as the loader expects today:
  `uraeda-binding-linux-x64-gnu`, `uraeda-binding-linux-arm64-gnu`, `uraeda-binding-darwin-x64`, and
  `uraeda-binding-darwin-arm64`.**
  - [pro] no organization; the generated loader as it is.
  - [con] five names to publish once and set up.
  - Why recommended: the simplest, and napi-rs's own default.
- **B. `uraeda`, with the platform packages in an npm organization: `@uraeda/binding-linux-x64-gnu`
  and the others.**
  - [pro] the packages are grouped, and the scope is reserved for later ones.
  - [con] an organization to create; the `@uraeda` page answered 403, so its availability is
    unknown.
- **C. `uraeda` only, with the platform builds as prerelease versions of it, like Codex.**
  - [pro] one name, one setup.
  - [con] unusual versions in `npm view uraeda`, and a loader written by hand.

**Answer:** A

## Q4: What happens when the port is already taken?

Today the server exits with "port 4310 is in use: another Uraeda server may run". A second server on
another port would share the data folder and its sessions, while the
[agents](../decisions/agents.md) decision allows one session per feature, which only one server can
enforce. Vite and Backlog.md move to the next free port. More in
[discovery](discovery-01.md#a-busy-port).

Why it matters: it decides what `npx uraeda` does in a second repository while the first one's
server runs, the most common case once several repositories are listed.

- **A (recommended). When the port answers as Uraeda, add the current repository to its list, open
  that repository's page, and exit; when something else holds it, fail and name `--port`.**
  - [pro] one server, whatever the folder `npx uraeda` runs in; bookmarks and `tailscale serve` keep
    working.
  - [con] a small route for the check.
- **B. Fail as today, and name `--port` in the message.**
  - [pro] nothing to build.
  - [con] the second repository needs the UI's menu, and `--port` starts a second server on the same
    data.
- **C. Move to the next free port, like Vite.**
  - [pro] always starts.
  - [con] two servers on one data folder by default, breaking the one-session-per-feature rule.

**Answer:** A

## Q5: Does the command open the browser?

Today the server only prints its URL. Backlog.md, opencode, and Vibe Kanban open the browser, and
Backlog.md takes `--no-open`; opening fails silently on a headless machine, so tools always print
the URL. With A in Q4, the same applies to the running server's page. More in
[discovery](discovery-01.md#opening-the-browser).

Why it matters: it is the first thing a new user sees, and the phone or SSH case must not break.

- **A (recommended). Open the browser by default, skip it with `--no-open`, and always print the
  URL.**
  - [pro] one command and the UI is there.
  - [con] a tab opens at each start, unless the flag is passed.
- **B. Never open the browser; print the URL.**
  - [pro] nothing can fail, nothing opens unasked.
  - [con] one more step for every user.

**Answer:** A

## Q6: How are releases published to npm?

`ura`'s releases run on a version tag in GitHub Actions. npm's trusted publishing lets that job
publish without a stored token, with provenance, once each package has been published a first time.
More in [discovery](discovery-01.md#publishing).

Why it matters: it decides which secret lives in the repository, and how much of a release is
manual.

- **A (recommended). Publish from CI on the version tag, with trusted publishing, after you publish
  each package once by hand.**
  - [pro] no long-lived secret; provenance on every release; pushing the tag releases everything.
  - [con] a one-time setup on npmjs.com for each package.
- **B. Publish from CI on the version tag, with an `NPM_TOKEN` secret.**
  - [pro] no per-package setup after the first publish.
  - [con] a long-lived token in the repository's secrets.
- **C. Publish by hand from your machine.**
  - [pro] no CI work.
  - [con] four platforms to build locally, and no provenance.

**Answer:** A

## Q7: Which channels does this feature cover?

`ura` ships through an install script, Homebrew, and Nix; Backlog.md ships through npm, Homebrew,
and Nix. The answer to Q1 decides what each channel carries. More in
[discovery](discovery-01.md#channels).

Why it matters: each channel is one more thing to build and keep working at every release.

These options combine: B and C can come on top of A.

- **A (recommended). npm only: `npx uraeda`, and `npm i -g uraeda` for a lasting install.**
  - [pro] one channel to build and test.
  - [con] Homebrew and Nix users install Node.
  - Why recommended: the proposal asks for one command; other channels can follow.
- **B. Also a Homebrew formula, in the existing tap.**
  - [pro] `brew install` for macOS users.
  - [con] a formula to keep in step with every release.
- **C. Also a Nix package, from the repository's flake.**
  - [pro] `nix run` for Nix users, as for `ura`.
  - [con] a flake output building the UI and the binding.

**Answer:** A: We might do homebrew and nix later, but it's not crucial

## Settled without the human

- **A project's `.env`** is no longer read when the server runs from the package: settings come from
  the environment and flags. A cloned repository's `.env` could otherwise list
  `URAEDA_ALLOWED_HOSTS` and widen the host names the server accepts, which the stack decision's
  `Host` check exists to prevent. The checkout's `vp dev` keeps reading Uraeda's own `.env`. See
  [discovery](discovery-01.md#a-projects-env).
- **Where the server finds its files**, the skill it passes to `claude`, the UI, and the binding's
  sources, moves to one module that knows both the checkout's layout and the package's, and the
  package holds a copy of the skill, since `npm pack` leaves symlinks out. The freshness check runs
  only in a checkout. See [important reads](discovery-01.md#important-reads).
- **Platforms** are Linux glibc and macOS, x64 and arm64, as the toolchain decision lists: no musl,
  no Windows. See [needs no choice](discovery-01.md#needs-no-choice).
- **Node 24 or later** is required, the version the repository pins and tests, which `node:sqlite`
  needs. With B or C in Q1, nothing is required.
- **No `postinstall` script**: the platform package is picked from `optionalDependencies` at run
  time, so `pnpm dlx` and `bunx`, which skip or run scripts differently, work too. See
  [npm and npx](discovery-01.md#npm-and-npx).
- **No update notice**: npm 11.2 and later check the registry at each `npx uraeda`, and Node 24
  ships npm 11.19; the README names `npm i -g uraeda@latest` for global installs.
- **Release order**: the platform packages first, the root last, behind a check that all four
  binaries are present; a partial release is completed with the same version, never a new one, as
  napi-rs recommends. See [napi-rs publishing](discovery-01.md#napi-rs-publishing).
- **Versions**: the npm packages take the workspace's version from `Cargo.toml` and are released on
  the same tag as `ura`, in a workflow of their own, so cargo-dist can regenerate `release.yml`.
- **Command-line options**: `npx uraeda` takes the server's `--port` and `--repo`, plus `--no-open`
  with A in Q5; the UI's folder is no longer an option users pass.
- **The README** moves the web UI out of "Building the tools" into the install section, with the
  command, the Node requirement, and `claude` as before.

**Notes:**

- Also deliver a _clear guide_ on what I need to do, in the PR body.
